## Classes

<dl>
<dt><a href="#ControlSaveTiles">ControlSaveTiles</a></dt>
<dd></dd>
<dt><a href="#TileLayerOffline">TileLayerOffline</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#openDB">openDB()</a> ⇒ <code>boolean</code></dt>
<dd><p>Open database &#39;leaflet-maps&#39; from IndexedDB storage</p>
</dd>
<dt><a href="#setLayer">setLayer(object)</a> ⇒ <code>none</code></dt>
<dd><p>Set a baseLayer, also this Control and its baseLayer to have the same DB table</p>
</dd>
<dt><a href="#setTable">setTable(table)</a></dt>
<dd><p>Sets the current DB table for Control and its TileLayer</p>
</dd>
<dt><a href="#deleteTable">deleteTable(table)</a> ⇒ <code>Promise</code></dt>
<dd><p>Delete a table from DB</p>
</dd>
<dt><a href="#putItem">putItem(table)</a> ⇒ <code>Promise</code></dt>
<dd><p>Add/Update an item in DB table</p>
</dd>
<dt><a href="#getItem">getItem(table)</a> ⇒ <code>Promise</code></dt>
<dd><p>Get an item in DB table</p>
</dd>
<dt><a href="#deleteItem">deleteItem(table)</a> ⇒ <code>Promise</code></dt>
<dd><p>Delete an item in DB table</p>
</dd>
<dt><a href="#setZoomlevels">setZoomlevels(zoomlevels)</a></dt>
<dd><p>Set options zoomlevels</p>
</dd>
<dt><a href="#setBounds">setBounds(bounds)</a></dt>
<dd><p>Set Lat/Lng bounds of map to save</p>
</dd>
<dt><a href="#saveMap">saveMap()</a></dt>
<dd><p>Save all map tiles in DB async after name confirmation. Fires event &#39;savestart&#39;.</p>
</dd>
<dt><a href="#setStorageSize">setStorageSize(function)</a></dt>
<dd><p>Sets status.storagesize to count of table rows</p>
</dd>
<dt><a href="#getTileUrls">getTileUrls(zoom)</a> ⇒ <code>Array.&lt;object&gt;</code></dt>
<dd><p>getTileUrls for single zoomlevel</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#ControlStatus">ControlStatus</a> : <code>Object</code></dt>
<dd><p>Status of ControlSaveTiles, keeps info about process during downloading and saving tiles. Used internal and as object for events.</p>
</dd>
</dl>

<a name="ControlSaveTiles"></a>

## ControlSaveTiles
**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| status | [<code>ControlStatus</code>](#ControlStatus) |  |
| baseLayer | [<code>TileLayerOffline</code>](#TileLayerOffline) | TileLayer to control |
| dtable | <code>object</code> | DB table associated with baseLayer  [https://dexie.org/docs/Table/Table](https://dexie.org/docs/Table/Table) |

<a name="new_ControlSaveTiles_new"></a>

### new ControlSaveTiles()
Control to save tiles, invisible by default

**Example**  
```js
const controlSaveTiles = L.control.savetiles(myTileLayerOffline, {  zoomlevels: [13, 16],   // optional zoomlevels to save, default current zoomlevel  maxZoom: 17});
```
<a name="TileLayerOffline"></a>

## TileLayerOffline
**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| dtable | <code>object</code> | database table to get tiles from  [https://dexie.org/docs/Table/Table](https://dexie.org/docs/Table/Table) |
| offtest | <code>boolean</code> | simulate offline response or not |

<a name="new_TileLayerOffline_new"></a>

### new TileLayerOffline()
A layer that uses IndexedDB store tiles when available. Falls back to online.

<a name="openDB"></a>

## openDB() ⇒ <code>boolean</code>
Open database 'leaflet-maps' from IndexedDB storage

**Kind**: global function  
**Returns**: <code>boolean</code> - result - false when not found or error  
<a name="setLayer"></a>

## setLayer(object) ⇒ <code>none</code>
Set a baseLayer, also this Control and its baseLayer to have the same DB table

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| object | [<code>TileLayerOffline</code>](#TileLayerOffline) | TileLayerOffline |

<a name="setTable"></a>

## setTable(table)
Sets the current DB table for Control and its TileLayer

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| table | <code>string</code> | name |

<a name="deleteTable"></a>

## deleteTable(table) ⇒ <code>Promise</code>
Delete a table from DB

**Kind**: global function  
**Returns**: <code>Promise</code> - fires 'tblevent'  

| Param | Type | Description |
| --- | --- | --- |
| table | <code>string</code> | name |

<a name="putItem"></a>

## putItem(table) ⇒ <code>Promise</code>
Add/Update an item in DB table

**Kind**: global function  
**Returns**: <code>Promise</code> - operation result  

| Param | Type | Description |
| --- | --- | --- |
| table | <code>string</code> | name |

<a name="getItem"></a>

## getItem(table) ⇒ <code>Promise</code>
Get an item in DB table

**Kind**: global function  
**Returns**: <code>Promise</code> - operation result  

| Param | Type | Description |
| --- | --- | --- |
| table | <code>string</code> | name |

<a name="deleteItem"></a>

## deleteItem(table) ⇒ <code>Promise</code>
Delete an item in DB table

**Kind**: global function  
**Returns**: <code>Promise</code> - operation result  

| Param | Type | Description |
| --- | --- | --- |
| table | <code>string</code> | name |

<a name="setZoomlevels"></a>

## setZoomlevels(zoomlevels)
Set options zoomlevels

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| zoomlevels | <code>array</code> | array of zoom values |

<a name="setBounds"></a>

## setBounds(bounds)
Set Lat/Lng bounds of map to save

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| bounds | <code>LatLngBounds</code> | [https://leafletjs.com/reference-0.7.7.html#latlngbounds](https://leafletjs.com/reference-0.7.7.html#latlngbounds) |

<a name="saveMap"></a>

## saveMap()
Save all map tiles in DB async after name confirmation. Fires event 'savestart'.

**Kind**: global function  
<a name="setStorageSize"></a>

## setStorageSize(function)
Sets status.storagesize to count of table rows

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| function | <code>callback</code> | to get the count |

<a name="getTileUrls"></a>

## getTileUrls(zoom) ⇒ <code>Array.&lt;object&gt;</code>
getTileUrls for single zoomlevel

**Kind**: global function  
**Returns**: <code>Array.&lt;object&gt;</code> - the tile urls, key, url  

| Param | Type |
| --- | --- |
| L.latLngBounds | <code>object</code> | 
| zoom | <code>number</code> | 

<a name="ControlStatus"></a>

## ControlStatus : <code>Object</code>
Status of ControlSaveTiles, keeps info about process during downloading and saving tiles. Used internal and as object for events.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| storagesize | <code>number</code> | total number of saved tiles. |
| lengthToBeSaved | <code>number</code> | number of tiles that will be saved in db during current process |
| lengthSaved | <code>number</code> | number of tiles saved during current process |
| lengthLoaded | <code>number</code> | number of tiles loaded during current process |
| _tilesforSave | <code>array</code> | tiles waiting for processing |
| tnames | <code>array</code> | names of all DB tables |

