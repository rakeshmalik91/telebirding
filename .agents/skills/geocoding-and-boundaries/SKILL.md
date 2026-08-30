---
name: geocoding-and-boundaries
description: Architecture, procedures, and troubleshooting guidelines for maintaining location geocoding, places.json hierarchy, and Natural Earth / OpenStreetMap GeoJSON boundary polygons in Telebirding. Use when modifying places.json, geocoding providers, species map boundaries, admin location tools, or running geo build/sync scripts.
---

# Geocoding & Geo Boundary Maintenance Guide

This skill describes the architecture, workflows, and operational procedures for maintaining geographic locations, coordinates, and boundary polygon outlines in Telebirding.

---

## 🎯 Target Files & Components

### 1. Webapp Public Map
- [`webapp/scripts/modules/public/species-map.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/public/species-map.js): Leaflet map rendering country & state polygon shapes, city/place circles, zoom thresholds, continuous world wrapping (`worldCopyJump: true`, `WORLD_OFFSETS = [-2, -1, 0, 1, 2]`), strict vertical bounds, and click navigation. Selectively loads only countries present in sightings.
- [`webapp/scripts/modules/public/rendering.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/public/rendering.js): Invokes `initSpeciesMap` with computed counts and raw places geo data.
- [`webapp/css/home.css`](file:///d:/Projects/telebirding/webapp/css/home.css): Styling for `#species-map` (dark ocean background `#232227` matching Esri Dark Gray tiles to eliminate white gaps), tooltips, and map controls.

### 2. Admin Geocoding & Boundaries
- [`webapp/scripts/modules/admin/data.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/admin/data.js): Hierarchy navigation (`getPlaceNode`), coordinate persistence (`savePlaceGeo`), boundary management (`getCountryGeoJSON`, `uploadGeoBoundary`, `uploadGeoBoundaries`), cloud uploads, and minified per-country backup.
- [`webapp/scripts/modules/admin/rendering.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/admin/rendering.js): Admin UI handlers for `#places-tab` (Add Location, Inspect & Re-Geocode, Batch Scanner, and Geo Boundaries Management card).
- [`webapp/scripts/modules/admin/restore.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/admin/restore.js): Backup restoration and deletion including `backup/${date}/geo/${country}.json`.
- [`webapp/scripts/modules/geo-service.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/geo-service.js): Swappable geocoding provider engine (Nominatim and Photon) with request throttling, bounding box radius estimation, and safety caps.
- [`webapp/admin.html`](file:///d:/Projects/telebirding/webapp/admin.html): Markup for places grid, configurable Geocoding & Geo Boundary provider bar at the top, and geo boundary management card.

### 3. Build & Maintenance Utilities
- [`utils/sync_dynamic_files_to_firebase_storage.py`](file:///d:/Projects/telebirding/utils/sync_dynamic_files_to_firebase_storage.py): Dynamically discovers and synchronizes `places.json` and all `data/geo/*.json` files to Firebase Storage.
- [`utils/backup.py`](file:///d:/Projects/telebirding/utils/backup.py): Downloads cloud backups of location data and all `data/geo/{country}.json` datasets into `webapp/resources/data/geo/`. Automatically cleans up legacy monolithic boundary files.
- [`storage.rules`](file:///d:/Projects/telebirding/storage.rules): Security rules allowing up to 15 MB writes under `/data/geo/{fileName}` and `/backup/{allPaths=**}` for large composite boundary files.

### 4. Data Assets
- [`webapp/resources/data/places.json`](file:///d:/Projects/telebirding/webapp/resources/data/places.json): Source of truth for 4-level location hierarchy (`countries -> states -> cities -> places`) with `lat`, `lng`, `radius`.
- [`webapp/resources/data/geo/${country}.json`](file:///d:/Projects/telebirding/webapp/resources/data/geo): Modular per-country GeoJSON files containing both country polygon boundary and state boundaries.

---

## 🧩 Architecture & Data Schema

### 1. Hierarchy in `places.json`
```json
{
  "countries": {
    "India": {
      "name": "India",
      "lat": 22.5,
      "lng": 78.9,
      "radius": 1200,
      "states": {
        "West Bengal": {
          "name": "West Bengal",
          "lat": 22.98,
          "lng": 87.85,
          "radius": 200,
          "cities": {
            "Howrah": {
              "name": "Howrah",
              "lat": 22.59,
              "lng": 88.26,
              "radius": 15,
              "places": {
                "Bally": {
                  "name": "Bally",
                  "lat": 22.65,
                  "lng": 88.34,
                  "radius": 5
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 2. Modular GeoJSON Schema (`data/geo/${country}.json`)
Instead of monolithic global boundary files, each country has a dedicated file in `data/geo/`:
```json
{
  "country": {
    "type": "Feature",
    "properties": {
      "name": "India"
    },
    "geometry": {
      "type": "MultiPolygon",
      "coordinates": [...]
    }
  },
  "states": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": "West Bengal",
          "country": "India"
        },
        "geometry": {
          "type": "MultiPolygon",
          "coordinates": [...]
        }
      }
    ]
  }
}
```

### 3. Public Map Selective Loading & Wrapping
1. **Selective Country Fetching**:
   - `loadBoundaries(countriesData)` queries only countries with sightings (`count > 0` or in `State.data.sightings`).
   - Unused country JSONs are never fetched over the network.
2. **Continuous Wrapping**:
   - `worldCopyJump: true` enabled on Leaflet map instance.
   - Vector features (country polygons, state polygons, city/place circles) are rendered across `WORLD_OFFSETS = [-2, -1, 0, 1, 2]`. Coordinates shifted via `shiftFeatureLng(feature, offset * 360)`.
   - Initial `fitBounds` strictly uses `_isPrimaryWorld` (offset 0) to frame the initial view without zooming out.
3. **No White Gaps**:
   - `#species-map` and Leaflet container/panes are styled with `background-color: #232227 !important;` (the exact ocean tile color of Esri Dark Gray canvas `rgb(35, 34, 39)`).
   - `minZoom: 1` prevents zooming out to a thin ribbon.
   - `maxBounds: [[-85.051129, -Infinity], [85.051129, Infinity]]` with `maxBoundsViscosity: 1.0` prevents panning vertically beyond the poles into empty void.

### 4. Radius Limits & Caps
To prevent island chains or sparse administrative regions from generating massive circles:
- **`GEO_RADIUS_CAPS`** in `geo-service.js`: Caps bounding box calculation during geocoding (place: 10 km, city: 25 km, state: 150 km, country: 600 km).
- **`UI_RADIUS_LIMITS`** in `species-map.js`: Enforces strict visual rendering bounds on Leaflet circles:
  - Place: 8 km min, 20 km max
  - City: 15 km min, 40 km max
  - State: 35 km min, 200 km max
  - Country: 60 km min, 800 km max

### 5. Layer Separation, Panes & Zoom Behavior
- **Map Panes Hierarchy (Strict Z-Indexing)**:
  To prevent overlapping circles from blocking interaction:
  - `statePane` (`z-index: 380`): State boundary polygons.
  - `cityPane` (`z-index: 420`): City circles.
  - `placePane` (`z-index: 450`): Place circles (rendered strictly above city circles so places are always clickable when overlapping).
- **Zoom < 4 (Overview)**: Displays filled country polygon shapes (warm orange).
- **Zoom &ge; 4 (Detail)**:
  - Automatically hides country shapes (since country boundary datasets are coarse compared to states, preventing mismatched borders).
  - State boundary polygons (teal/cyan, dashed border, behind).
  - City circles (`cityPane`, warm lime green `rgb(135, 215, 50)`).
  - Place circles (`placePane`, bright emerald green `rgb(65, 215, 95)`, on top, always clickable).
- **State Zoom Threshold (`zoom >= 7`)**: Clicking a state polygon flies to its bounds at zoom < 7; once at zoom &ge; 7, clicking navigates directly to the sightings feed filtered for that state.

---

## 🛠️ Workflows & Procedures

### Workflow 1: Adding a New Country or State

#### Via Admin UI (Recommended)
1. Open Admin &rarr; **Places & Geocoding** (`admin.html#tab-places`).
2. **Add Country**:
   - Enter country name (e.g. `Nepal`).
   - Keep `"Automatically fetch all states/provinces"` checked.
   - Keep `"Geocode country coordinates immediately"` checked.
   - Click `➕ Add Country`.
3. Check **Geo Boundaries Management** card:
   - Check if the country has a polygon boundary.
   - If missing, select it in the boundary inspector and click `🌐 Fetch Boundary from OSM`, then `💾 Save Boundary to Memory`.
   - Click `☁️ Upload Boundary to Storage` to publish `data/geo/${country}.json`.

---

### Workflow 2: Re-Geocoding Existing Locations & Real-Time Coverage
1. **Real-Time Geocode Coverage Status**:
   - The Admin Places tab displays a live **Geocode Coverage Status** banner with real-time counts and percentages for Countries, States, Cities, and Places.
   - Any missing locations across `places.json` and sightings are detected automatically without clicking a scan button.
   - Clicking `⚡ Auto-Fill Missing Coordinates` will sequentially geocode and persist missing coordinates to `places.json`.
2. **Single Location Geocode / Inspection**:
   - Select Country &rarr; State &rarr; City &rarr; Place.
   - Observe live coordinates banner.
   - Click `🔄 Re-Geocode Selected` (or edit Lat/Lng/Radius numbers manually in the result box).
   - Click `💾 Save to Places`.
3. **Bulk Re-Geocoding Existing Locations**:
   - In the **Force Re-Geocode Existing Locations** section, choose `All Locations` or `Specific Country` and click `⚡ Re-Geocode` to scan and batch re-geocode.
   - Alternatively, click `⚡ Re-Geocode All States in [Country]` or `⚡ Re-Geocode All Cities & Places in [State]`.
   - Requests run sequentially with safety throttling to comply with OSM usage policies.

---

### Workflow 3: Backup and Restore
1. **Admin Backup**:
   - Clicking `Backup` in Admin data tab backs up `places.json` and every country boundary into `backup/${date}/geo/${country}.json` as minified JSON.
2. **Admin Restore**:
   - Restoring a backup pulls `backup/${date}/geo/*.json`, restores in-memory structures, and uploads back to `data/geo/${country}.json`.
3. **Local CLI Backup**:
   - Run `python utils/backup.py` to download all data and per-country geo boundaries into `webapp/resources/data/geo/`.

---

## ⚠️ Important Rules & Gotchas

1. **Storage Rules Limit (15 MB)**:
   - Country files with detailed multi-polygons (e.g. `Russia.json`) can be large. Ensure `storage.rules` allows up to 15 MB writes under `/data/geo/` and `/backup/`.
   - When serializing GeoJSON in backup scripts/modules, do not use whitespace indentation (`JSON.stringify(data)`) to keep payloads compact.

2. **OSM Nominatim Rate Limits**:
   - Public Nominatim allows max 1 request/second.
   - Batch operations in `admin/rendering.js` and `geo-service.js` enforce a 1,000 ms delay between sequential queries.
   - Always send custom `User-Agent` identifying Telebirding.

3. **URL Resolution via `Util.getData()`**:
   - Always load data files using `Util.getData('data/...')`.
   - Resolves canonical Firebase Storage URLs in production (`FIREBASE_ENABLED`), localhost prepended paths (`resources/data/...`), and Android local offline cache paths.

4. **Cache Invalidation**:
   - When modifying `species-map.js`, `home.css`, `rendering.js`, `admin.js`, or `admin/rendering.js`, bump the query version string (`?v=YYYYMMDD_N`) in `webapp/index.html` and `webapp/admin.html`.
