import L from 'leaflet';

/**
 * Status of ControlSaveTiles, keeps info about process during downloading and saving tiles. Used internal and as object for events.
 * @typedef {Object} ControlStatus
 * @property {number} storagesize total number of saved tiles.
 * @property {number} lengthToBeSaved number of tiles that will be saved in db during current process
 * @property {number} lengthSaved number of tiles saved during current process
 * @property {number} lengthLoaded number of tiles loaded during current process
 * @property {array} _tilesforSave tiles waiting for processing
 * @property {array} tnames names of all DB tables
 */

/**
 * Control to save tiles, invisible by default
 * @class ControlSaveTiles
 *
 * @property {ControlStatus} status
 * @property {TileLayerOffline} baseLayer TileLayer to control
 * @property {object} dtable DB table associated with baseLayer  {@link https://dexie.org/docs/Table/Table}
 *
 * @example
 * const controlSaveTiles = L.control.savetiles(myTileLayerOffline, {
 *   zoomlevels: [13, 16],   // optional zoomlevels to save, default current zoomlevel
 *   maxZoom: 17
 * });
 */
 
var ControlSaveTiles = L.Control.extend( {
  options: {
    maxZoom: 19,
    minimalZoom: 8,		// minimal zoom to prevent the user from saving the World (and freeze computer)
    zoomlevels: null,	// zoomlevels have higher priority than maxZoom
    bounds: null,		// LatLngBounds of map to save {@link https://leafletjs.com/reference-0.7.7.html#latlngbounds}
    confirmSave: null,	// function to be called before confirm
  },
  status: {
    storagesize: null,
    lengthToBeSaved: null,
    lengthSaved: null,
    lengthLoaded: null,
    _tilesforSave: null,
    mapSize: null,
    currMinZoom: null,
    tnames: []			// all table names from DB
  },
  baseLayer: null,			// current TileLayerOffline
  dtable: null,				// current DB table
  _db: new Dexie('leaflet-maps'),	// IndexedDB database
  _dbversion: 1,			// current DB version
  _dterr: new Error('dtable not set'),	
  
  initialize: function (baseLayer, options) {
    this.baseLayer = baseLayer;
    L.setOptions(this, options);
  },

  onAdd: function () {
	var options = this.options;
	if (options.visualUI)
		return options.visualUI;	// rem...
	return L.DomUtil.create('div'); 	// 'invisible' by default
  },
  
  /**
   * Open database 'leaflet-maps' from IndexedDB storage
   * @return {boolean} result - false when not found or error
   */
  openDB: async function() {
    var self = this;
    await this._db.open().then(function () {	// init all
	console.log ("Found database: " + self._db.name + " version: " + self._db.verno);
	self._dbversion = self._db.verno;
	self._db.tables.forEach(function (table) {
		self.status.tnames.push(table.name);
	});
	console.log(self._db.name + ' tables: ' + self.status.tnames.join(' ') );
	self.baseLayer.fire('tblevent', self.status);
	return true;
    }).catch('NoSuchDatabaseError', function(e) {
		console.log ("Database not found, will be created with first table.");
		return false;
    }).catch(function (e) {
		console.log ("Oh uh: " + e);
		return false;
    });

  },
  /**
  * Set a baseLayer, also this Control and its baseLayer to have the same DB table
  * @param  {TileLayerOffline} object TileLayerOffline
  * @return {none} 
  */
  setLayer: function (layer) {
    this.baseLayer = layer;
    this.baseLayer.dtable = this.dtable;
  },
  /**
  * Sets the current DB table for Control and its TileLayer
  * @param  {string} table name
  */
  setTable: function (tblName) {
  	this.dtable = this._db.table(tblName);
  	this.baseLayer.dtable = this.dtable;
  },
  /**
  * Delete a table from DB
  * @param  {string} table name
  * @return {Promise} fires 'tblevent'
  */
  deleteTable: function (tname) {
  	var self = this;
	this._extendSchema(tname).then(function() {
		console.log('dropped: '+ tname);
        	self.baseLayer.fire('tblevent', tname);
	}).catch(function(rej) {  console.log(rej); });	
  },
  /**
  * Add/Update an item in DB table
  * @param  {string} table name
  * @return {Promise} operation result
  */
  putItem: function (key, value) {	// insert and update in one command
  	if (this.dtable==null) throw this._dterr;
  	this.dtable.put(value, key);
  },
  /**
  * Get an item in DB table
  * @param  {string} table name
  * @return {Promise} operation result
  */
  getItem: function (key) {
  	if (this.dtable==null) throw this._dterr;
  	return this.dtable.get(key);
  },
  /**
  * Delete an item in DB table
  * @param  {string} table name
  * @return {Promise} operation result
  */
  deleteItem: function (key) {
  	if (this.dtable==null) throw this._dterr;
  	return this.dtable.delete(key);
  },

  /**
  * Set options zoomlevels
  * @param  {array} zoomlevels array of zoom values
  */
  setZoomlevels: function (zoomlevels) {
    this.options.zoomlevels = zoomlevels;
  },

  /**
  * Set Lat/Lng bounds of map to save
  * @param  {LatLngBounds} bounds {@link https://leafletjs.com/reference-0.7.7.html#latlngbounds}
  */
  setBounds: function (bounds) {
    this.options.bounds = bounds;
  },

  /**
  * Save all map tiles in DB async after name confirmation. Fires event 'savestart'.
  */
  saveMap: function() {
  
    var zoomlevels = [];
    if (this.options.zoomlevels) {	// zoomlevels have higher priority than maxZoom
	zoomlevels = this.options.zoomlevels; 
    } else {
	var currentZoom = this._map.getZoom();
	if (currentZoom < this.options.minimalZoom) {
		throw new Error('Not allowed to save with zoom level below '+ this.options.minimalZoom);
	}
	var maxZoom = 	this.baseLayer.options.maxZoom || 
			this._map.options.maxZoom ||
			this.options.maxZoom ||
			currentZoom;
	for (var zoom = currentZoom; zoom <= maxZoom; zoom++) {
		zoomlevels.push(zoom);
	}
    }
    
    var latlngBounds = this.options.bounds || this._map.getBounds();

    var bnds;
    var tiles = [];
    for (var i = 0; i < zoomlevels.length; i++) {
      if (zoomlevels[i] < this.options.minimalZoom) continue;
      bnds = L.bounds(
        this._map.project(latlngBounds.getNorthWest(), zoomlevels[i]),
        this._map.project(latlngBounds.getSouthEast(), zoomlevels[i])
      );
      tiles = tiles.concat(this.baseLayer.getTileUrls(bnds, zoomlevels[i]));
    }
    this._resetStatus(tiles);
    this.status.currMinZoom = zoomlevels[0];
    
    //var self = this;
    const saveCallback = async (tblName) => {
	// user confirmed 'Save tiles?'
	this.baseLayer.fire('savestart', this.status);

	await Promise.all(tiles.map(async (tile) => {
		await this._loadTile(tblName, tile)
	}));
    };
    
    if (this.options.confirmSave) {
      this.options.confirmSave(this.status, saveCallback);
    } //else { saveCallback(); }
  },
  
  /**
  * Sets status.storagesize to count of table rows
  * @param  {callback} function to get the count
  */
  setStorageSize: function (callback) {
    var self = this;
    if (this.dtable==null) throw this._dterr;
    this.dtable.count().then(function (numberOfKeys) {
      self.status.storagesize = numberOfKeys;
      self.baseLayer.fire('storagesize', self.status);
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
  
  _loadTile: async function(tblName, tileUrl) {		// recursively load all tiles for one subdomain
	var self = this;

	if (self.status.lengthLoaded == 0) {
		if (self.status.tnames.indexOf(tblName) < 0)	// create new table on 1st tile and save all tiles into it
			await self._extendSchema("+"+tblName).catch(err => console.log(err));
		else						//overwrite existing table
			await self._db.table(tblName).clear().catch(err => console.log(err));
		self.dtable = self._db.table(tblName);		// needed here by _saveTile
		self.status.mapSize = 0;
	}
	self._downloadTile(tileUrl.url).then((blob) => {
	  self._saveTile(tileUrl.key, blob);
	  self.status.mapSize += blob.size;
	  self.status.lengthLoaded += 1;
	  //self.baseLayer.fire('loadtileend', self.status);
	  if (self.status.lengthLoaded === self.status.lengthToBeSaved) {
		console.log("New table " + self.dtable.name);
		self.baseLayer.fire('loadend', self.status);
	  }
	});
/*      	
	const blob = await fetch(tileUrl.url).then
		((res) => { return(res.blob()) }).catch(err => console.log(err));
	if (!blob) return;
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
			self.baseLayer.fire('loadend', self.status);
		}
	} 
*/
  },

  _downloadTile: function(tileUrl) {		// download one tile by url
  	return fetch(tileUrl).then((response) => {
	  	if (!response.ok) {
	      throw new Error(`Request failed with status ${response.statusText}`);
	    }
	    return response.blob();
	});
  },

  _saveTile: function (tileUrl, blob) {		// save one tile by URL key
	var self = this;
	if (this.dtable==null) return;
	this.dtable.put(blob, tileUrl).then(() => {	// store the binary data
		self.status.lengthSaved++;
		self.baseLayer.fire('savetileend', self.status);
		if (self.status.lengthSaved === self.status.lengthToBeSaved) {
		  self.baseLayer.fire('tblevent', self.status);	// entire map saved
		  self.setStorageSize();
		}
	}).catch(err => console.log(err)); 
  },

  _extendSchema: async function (tbl) {			// replace db schema in Dexie.js
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
* @property {number} [options.maxZoom] maximum zoom level that will be reached when saving tiles
* @property {function} [options.confirmSave] function called before confirm, default null.
* @return {ControlSaveTiles}
*/
L.control.savetiles = function (baseLayer, options) { return new ControlSaveTiles(baseLayer, options); };

