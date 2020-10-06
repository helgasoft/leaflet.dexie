import L from 'leaflet';

/**
 * A layer that uses IndexedDB store tiles when available. Falls back to online.
 * @class TileLayerOffline
 * @property {object} dtable database table to get tiles from  {@link https://dexie.org/docs/Table/Table}
 * @property {boolean} offtest simulate offline response or not
 */
var TileLayerOffline = L.TileLayer.extend( {
  options: {
    maxZoom: 20,	// max zoom to display
    offUrl: null	// link to PNG file to show in offline mode
  },
  dtable: null,		// database table to get tiles from
  offtest: false,	// for simulating offline response
  /**
  * Create tile HTMLElement
  * @private
  * @param  {array} coords
  * @param  {Function} done
  * @return {HTMLElement}     
  */
  createTile: function (coords, done) {
    var tile = L.TileLayer.prototype.createTile.call(this, coords, done);
    var url = tile.src;
    tile.src = '';
    var self = this;
    this._setDataUrl(url).then(function (dataurl) {
      tile.src = dataurl;
    }).catch(function () {	// not found in DB, get online
      if (self.offtest) url = self.options.offUrl; 	// show local PNG if testing offline
      tile.src = url;
    });
    return tile;
  },
  /**
   * data url of tile from DB table
   * @private
   * @param {string} url  
   * @return {Promise} resolves to base64 url
   */
  _setDataUrl: function (url) {
    var self = this;
    return new Promise(function (resolve, reject) {
	if (self.dtable == null) {
	    reject();
	}
	else {
	    self.dtable.get(self._getStorageKey(url)).then(function (data) {
	        if (data && typeof data === 'object') {
	            resolve(URL.createObjectURL(data));
	        } else {
	            reject();
	        }
	    }).catch((e) => { reject(e); }); 
	}
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
 * @param  {string} url  
 * @param  {object} options {@link http://leafletjs.com/reference-1.2.0.html#tilelayer}
 * @return {TileLayerOffline}      an instance of TileLayerOffline
 */
L.tileLayer.offline = function (url, options) { return new TileLayerOffline(url, options); };
