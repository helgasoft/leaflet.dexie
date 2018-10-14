/*	leaflet.dexie.js
	based on https://github.com/allartk/leaflet.offline	http://allartk.github.io/leaflet.offline/dist/bundle.js
	advantages for local data storage: 
		uses stable, small-size library Dexie.js
		save offline maps from different providers, supports offline testing
		store/retrieve any data in a table with putItem/getItem
*/
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('leaflet')) :
	typeof define === 'function' && define.amd ? define(['leaflet'], factory) : (factory(global.L));
}(this, (function (L) { 'use strict';

L = L && L.hasOwnProperty('default') ? L['default'] : L;

var ControlSaveTiles = L.Control.extend( {
  options: {
    position: 'topleft',
    maxZoom: 18,
    minimalZoom: 8,		// minimal zoom to prevent the user from saving the World (and freeze computer)
    zoomlevels: null,		// zoomlevels have higher priority than maxZoom
    bounds: null,
    confirmSave: null,
    confirmRemoval: null
  },
  status: {
    storagesize: null,
    lengthToBeSaved: null,
    lengthSaved: null,
    lengthLoaded: null,
    _tilesforSave: null,
    mapSize: null,
    currMinZoom: null,
    tnames: []			// names of all DB tables
  },
  _db: new Dexie('leaflet-maps'),	// IndexedDB database
  _dbversion: 1,
  dtable: null,			// current DB table
  
  initialize: function (baseLayer, options) {
    this._baseLayer = baseLayer;
    L.setOptions(this, options);
  },
  
  openDB: async function() {
    var self = this;
    await this._db.open().then(function () {	// init all
	console.log ("Found database: " + self._db.name + " version: " + self._db.verno);
	self._dbversion = self._db.verno;
	self._db.tables.forEach(function (table) {
		self.status.tnames.push(table.name);
	});
	console.log(self._db.name + ' tables: ' + self.status.tnames.join(' ') );
	self._baseLayer.fire('tblevent', self.status);
	return true;
    }).catch('NoSuchDatabaseError', function(e) {
		console.log ("Database not found, will be created with first table.");
		return false;
    }).catch(function (e) {
		console.log ("Oh uh: " + e);
		return false;
    });

  },

  setTable: function (tblName) {
  	this.dtable = this._db.table(tblName);
  	this._baseLayer.dtable = this.dtable;
  },
  deleteTable: function (tname) {
  	var self = this;
	this._extendSchema(tname).then(function() {
		console.log('dropped: '+ tname);
        	self._baseLayer.fire('tblevent', tname);
	}).catch(function(rej) {  console.log(rej); });	
  },
  putItem: function (key, value) {	// insert and update in one command
  	this.dtable.put(value, key);
  },
  getItem: function (key) {
  	return this.dtable.get(key);
  },
  deleteItem: function (key) {
  	return this.dtable.delete(key);
  },

  rmContent: function () {		// delete table after confirmation
    var self = this;
    var clearCallback = function () {
	self.deleteTable(self.dtable.name);
	self.dtable = null;
	self.status.storagesize = 0;
	self._baseLayer.fire('storagesize', self.status);
    };
    
    if (this.options.confirmRemoval) {
      this.options.confirmRemoval(this.status, clearCallback);
    } else {
      clearCallback();
    }
  },

  setLayer: function (layer) {
    this._baseLayer = layer;
    this._baseLayer.dtable = this.dtable;
  },

  setZoomlevels: function (zoomlevels) {
    this.options.zoomlevels = zoomlevels;
  },

  setBounds: function (bounds) {
    this.options.bounds = bounds;
  },

  onAdd: function () {
	var options = this.options;
	if (options.visualUI)
		return options.visualUI;
	return L.DomUtil.create('div'); 	// 'invisible' by default
  },

  saveMap: function() {
  
    var zoomlevels = [];
    if (this.options.zoomlevels) {	// zoomlevels have higher priority than maxZoom
	zoomlevels = this.options.zoomlevels; 
    } else {
	var currentZoom = this._map.getZoom();
	if (currentZoom < this.options.minimalZoom) {
		throw new Error('Not allowed to save with zoom level below '+ this.options.minimalZoom); //test...
	}
	var maxZoom = 	this._map.options.maxZoom || 
			this._baseLayer.options.maxZoom || 
			this.options.maxZoom ||
			currentZoom;
	for (var zoom = currentZoom; zoom <= maxZoom; zoom++) {
		zoomlevels.push(zoom);
	}
    }
    
    var latlngBounds = this.options.bounds || this._map.getBounds();

    var bounds;
    var tiles = [];
    for (var i = 0; i < zoomlevels.length; i++) {
      if (zoomlevels[i] < this.options.minimalZoom) continue;
      bounds = L.bounds(
        this._map.project(latlngBounds.getNorthWest(), zoomlevels[i]),
        this._map.project(latlngBounds.getSouthEast(), zoomlevels[i])
      );
      tiles = tiles.concat(this._baseLayer.getTileUrls(bounds, zoomlevels[i]));
    }
    this._resetStatus(tiles);
    this.status.currMinZoom = zoomlevels[0];
    
    var self = this;
    var saveCallback = function(tblName) {
	// user confirmed 'Save tiles?'
	self._baseLayer.fire('savestart', self.status);
	var subdlength = self._baseLayer.getSimultaneous();
	for (var i = 0; i < subdlength; i++) {
		self._loadTile(tblName);
	}
    };
    
    if (this.options.confirmSave) {
      this.options.confirmSave(this.status, saveCallback);
    } else {
      saveCallback();
    }
  },
  
  setStorageSize: function (callback) {
    var self = this;
    this.dtable.count().then(function (numberOfKeys) {
      self.status.storagesize = numberOfKeys;
      self._baseLayer.fire('storagesize', self.status);
      if (callback) {
        callback(numberOfKeys);
      }
    }, function (err) { callback(0); throw err; });
  },

  _resetStatus: function (tiles) {
	this.status.lengthLoaded = 0;
	this.status.lengthToBeSaved = tiles.length;
	this.status.lengthSaved = 0;
	this.status._tilesforSave = tiles
  },
  
  _loadTile: async function(tblName) {		// recursively load all tiles for one subdomain
	var self = this;
	var tileUrl = self.status._tilesforSave.shift();
	
	//	without {mode: 'no-cors'} - err 'TypeError: Failed to fetch' on certain providers like tiles.wmflabs.org
	//	with 'no-cors' - no errors, but blobs empty
	const blob = await fetch(tileUrl.url).then   //, {mode: 'no-cors'}
		((res) => { return(res.blob()) }).catch(err => console.log(err));
	if (!blob) return;
	//self.status.lengthLoaded += 1;	//moved down
	if (self.status.lengthLoaded == 0) {
		if (self.status.tnames.indexOf(tblName) < 0)	// create new table on 1st tile and save all tiles into it
			await self._extendSchema("+"+tblName).catch(err => console.log(err));
		else						//overwrite existing table
			await self._db.table(tblName).clear().catch(err => console.log(err));
		self.dtable = self._db.table(tblName);		// needed here by _saveTile
		self.status.mapSize = 0;
	}
	self._saveTile(tileUrl.key, blob);
	self.status.mapSize += blob.size;
	self.status.lengthLoaded++;
	if (self.status._tilesforSave.length > 0) {
		self._loadTile(tblName).catch(err => console.log(err));
	} else {
		if (self.status.lengthLoaded === self.status.lengthToBeSaved) {
			console.log("New table " + self.dtable.name);
			self._baseLayer.fire('loadend', self.status);
		}
	}
  },

  _saveTile: function (tileUrl, blob) {
	var self = this;
	if (!this.dtable) return;
	this.dtable.put(blob, tileUrl).then(() => {	// store the binary data
		self.status.lengthSaved++;
		self._baseLayer.fire('savetileend', self.status);
		if (self.status.lengthSaved === self.status.lengthToBeSaved) {
		  self._baseLayer.fire('tblevent', self.status);	// map saved
		  self.setStorageSize();
		}
	}).catch(err => console.log(err)); 
  },

  _extendSchema: async function (tbl) {		// replace db schema in Dexie.js
  	// add: prefix table name with "+", delete: table name only
	this._db.close();
	var currSchema = this.status.tnames.reduce(function(obj, v) { obj[v] = ''; return obj; }, {})
	var extendedSchema;
	if (tbl.startsWith('+')) {	//add
		tbl = tbl.substring(1);
		extendedSchema = { [tbl]: '' };
		this.status.tnames.push(tbl);
	} else {			//delete
		extendedSchema = { [tbl]: null };
		this.status.tnames.splice(this.status.tnames.indexOf(tbl),1);
	}
	this._db.version(this._dbversion).stores(currSchema);
	this._dbversion++;
	this._db.version(Math.round(this._dbversion)).stores(extendedSchema);
	return await this._db.open();
  }

});

/**
* @function L.control.savetiles
* @param  {object} baseLayer     {@link http://leafletjs.com/reference-1.2.0.html#tilelayer}
* @property {Object} options
* @property {string} [options.position] default topleft
* @property {string} [options.saveText] html for save button, default +
* @property {string} [options.rmText] html for remove button, deflault -
* @property {number} [options.maxZoom] maximum zoom level that will be reached when saving tiles
* @property {boolean} [options.saveWhatYouSee] save the tiles that you see
* on screen plus deeper zooms, ignores zoomLevels options. Default false
* @property {function} [options.confirm] function called before confirm, default null.
* @property {function} [options.confirmRemoval] function called before confirm, default null
* @return {ControlSaveTiles}
*/
L.control.savetiles = function (baseLayer, options) { return new ControlSaveTiles(baseLayer, options); };



/**
 * A layer that uses store tiles when available. Falls back to online.
 * @class TileLayerOffline
 */
var TileLayerOffline = L.TileLayer.extend( {
  options: {
    maxZoom: 17,	
    offUrl: null	// tile to show in offline mode
  },
  dtable: null,		// database table to get tiles from
  offtest: false,	// for simulating offline response
  /**
  * Create tile HTMLElement
  * @private
  * @param  {array}   coords [description]
  * @param  {Function} done   [description]
  * @return {HTMLElement}          [description]
  */
  createTile: function (coords, done) {
    var tile = L.TileLayer.prototype.createTile.call(this, coords, done);
    var url = tile.src;
    tile.src = '';
    var self = this;
    this._setDataUrl(tile, url).then(function (dataurl) {
      tile.src = dataurl;
    }).catch(function () {
      if (self.offtest) url = self.options.offUrl; // ='dont download it'
      tile.src = url;
    });
    return tile;
  },
  /**
   * dataurl from localstorage
   * @param {DomElement} tile [description]
   * @param {string} url  [description]
   * @return {Promise} resolves to base64 url
   */
  _setDataUrl: function (tile, url) {
    var self = this;
    return new Promise(function (resolve, reject) {
	if (!self.dtable) reject();
	self.dtable.get(self._getStorageKey(url)).then(function (data) {
		if (data && typeof data === 'object') {
			resolve(URL.createObjectURL(data));
		} else 
			reject();
	}).catch((e) => { reject(e); });   //console.log(e); 
    }); //dont catch here, handled upstream
  },
  /**
   * get key to use for storage
   * @private
   * @param  {string} url url used to load tile
   * @return {string} unique identifier.
   */
  _getStorageKey: function (url) {
    var key;
    var subdomainpos = this._url.indexOf('{s}');
    if (subdomainpos > 0) {
      key = url.substring(0, subdomainpos) +
        this.options.subdomains[0] +
        url.substring(subdomainpos + 1, url.length);
    }
    return key || url;
  },
  /**
   * @return {number} Number of simultanous downloads from tile server
   */
  getSimultaneous: function () {
    return this.options.subdomains.length;
  },
  /**
   * getTileUrls for single zoomlevel
   * @param  {object} L.latLngBounds
   * @param  {number} zoom
   * @return {object[]} the tile urls, key, url
   */
  getTileUrls: function (bounds, zoom) {	// used in control.saveMap only
    var self = this;
    var tiles = [];
    var origurl = this._url;
    // getTileUrl uses current zoomlevel, we want to overwrite it
    this.setUrl(this._url.replace('{z}', zoom), true);
    var tileBounds = L.bounds(
      bounds.min.divideBy(this.getTileSize().x).floor(),
      bounds.max.divideBy(this.getTileSize().x).floor()
    );
    var url;
    for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
      for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
        var tilePoint = new L.Point(i, j);
        url = L.TileLayer.prototype.getTileUrl.call(self, tilePoint);
        tiles.push({
          key: self._getStorageKey(url),
          url: url
        });
      }
    }
    // restore url
    this.setUrl(origurl, true);
    return tiles;
  },
});

/**
 * @function L.tileLayer.offline
 * @param  {string} url     [description]
 * @param  {object} options {@link http://leafletjs.com/reference-1.2.0.html#tilelayer}
 * @return {TileLayerOffline}      an instance of TileLayerOffline
 */
L.tileLayer.offline = function (url, options) { return new TileLayerOffline(url, options); };

})));