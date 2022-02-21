Leaflet.dexie.js
================
A Leaflet plugin for offline maps storage using library [Dexie.js](https://github.com/dfahlander/Dexie.js).

The source code is based on [leaflet.offline](https://github.com/allartk/leaflet.offline) with the following differences:
- instead of [localForage](https://github.com/localForage/localForage) and now [idb](https://github.com/jakearchibald/idb), 
we use [dexie.js](https://github.com/dfahlander/Dexie.js) which is efficient, stable and well supported indexedDB library.
- instead of having all maps in a single table(store), each map is saved in its own table and can add other user-defined attributes like size, center, bounds, etc.

### Dependencies
- [leaflet.js](https://leafletjs.com/) - for map controls
- [dexie.js](https://github.com/dfahlander/Dexie.js) - to store tiles in indexedDB asynchronously

### Demo
The [Demo](https://helgasoft.github.io/leaflet.dexie/demo/index.html) implements creation and deletion of offline maps and can simulate offline map display.

### Usage
Main usage is for offline maps, but could be also used to store other information. [API documentation](https://github.com/helgasoft/leaflet.dexie/blob/master/docs/api.md) is available.

### Manual installation
Add a &lt;script&gt; tag to your HTML page after _leaflet_ and _dexie_. You can web-load the script, or download [leaflet.dexie.min.js](https://raw.githubusercontent.com/helgasoft/leaflet.dexie/master/dist/leaflet.dexie.min.js) and load it locally. See code below.

### Minimal code sample
```html
<!doctype html>
<html>
 <head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
	<script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>   
	<script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>

	<script src="https://cdn.jsdelivr.net/gh/helgasoft/leaflet.dexie/dist/leaflet.dexie.min.js"></script>
	<!--   or local copy:
	<script src="js/leaflet.dexie.min.js"></script>  -->
 </head>
 <body>
	<div id="map" style="height: 75vh"></div>
<p>
	<input type='button' value='Save map' onclick='savem()' />
	<input type='button' value='Delete map' onclick='delm()' />
</p>
	press F12 to watch IndexedDB/leaflet-maps in tab <i>Application</i>(Chrome), <i>Storage</i>(FF) or <i>Debugger</i>(Edge)
  <script>
	let map = L.map('map');
	map.setView(L.latLng(47.2572, 3.6842), 18);
	let baseLayer = L.tileLayer.offline('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 18});
	baseLayer.addTo(map);
	let control = L.control.savetiles(baseLayer, {
	    'confirmSave': function(status, saveCallback) {
			var newTname = prompt("Please enter map name ("+status._tilesforSave.length+" tiles):", "");
			if (newTname == null || newTname == "") return;  // user cancelled the prompt
			saveCallback(newTname);
	    }
	});
	control.addTo(map);
	control.openDB();

	savem = function() {
		control.setBounds(map.getBounds());
		control.saveMap();
	}
	delm = function() {
		control.deleteTable(control.dtable.name);
	}
	baseLayer.on('loadend', function(e) {	// all tiles just saved
		control.putItem('mapSize', e.mapSize);
		control.getItem('mapSize').then( (msize) => {
			alert("size of map '"+ control.dtable.name +"' is "+ msize +' bytes');
		});
	});
  </script>
 </body>
</html>
```

### IndexedDB
[indexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) is the standard database in the browser.
Press F12 to open inspection, watch IndexedDB in tab *Application*(Chrome), *Storage*(FF) or *Debugger*(Edge). The database name is *leaflet-maps*. Watch also tab *Console* for errors.

![indexedDB table](devtools.png)

