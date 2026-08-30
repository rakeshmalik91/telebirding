---
name: geocoding-and-boundaries
description: Architecture, procedures, and troubleshooting guidelines for maintaining location geocoding, places.json hierarchy, and Natural Earth / OpenStreetMap GeoJSON boundary polygons in Telebirding. Use when modifying places.json, geocoding providers, species map boundaries, admin location tools, or running geo build/sync scripts.
---

# Geocoding & Geo Boundary Maintenance Guide

This skill describes the architecture, workflows, and operational procedures for maintaining geographic locations, coordinates, and boundary polygon outlines in Telebirding.

---

## 🎯 Target Files & Components

### 1. Webapp Public Map
- [`webapp/scripts/modules/public/species-map.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/public/species-map.js): Leaflet map rendering country & state polygon shapes, city/place circles, zoom thresholds, and click navigation.
- [`webapp/scripts/modules/public/rendering.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/public/rendering.js): Invokes `initSpeciesMap` with computed counts and raw places geo data.
- [`webapp/css/home.css`](file:///d:/Projects/telebirding/webapp/css/home.css): Styling for `#species-map`, tooltips, and map controls.

### 2. Admin Geocoding & Boundaries
- [`webapp/scripts/modules/admin/data.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/admin/data.js): Hierarchy navigation (`getPlaceNode`), coordinate persistence (`savePlaceGeo`), boundary management (`getGeoBoundaryCoverage`, `fetchBoundaryFromOSM`, `saveGeoBoundary`, `uploadGeoBoundaries`), and cloud uploads.
- [`webapp/scripts/modules/admin/rendering.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/admin/rendering.js): Admin UI handlers for `#places-tab` (Add Location, Inspect & Re-Geocode, Batch Scanner, and Geo Boundaries Management).
- [`webapp/scripts/modules/geo-service.js`](file:///d:/Projects/telebirding/webapp/scripts/modules/geo-service.js): Swappable geocoding provider engine (Nominatim and Photon) with request throttling, bounding box radius estimation, and safety caps.
- [`webapp/admin.html`](file:///d:/Projects/telebirding/webapp/admin.html): Markup for places grid and geo boundary management card.

### 3. Build & Maintenance Utilities
- [`utils/build-geo-boundaries.js`](file:///d:/Projects/telebirding/utils/build-geo-boundaries.js): CLI build script that downloads Natural Earth 110m (countries) and 10m (states), simplifies geometries via Douglas-Peucker, and generates optimized JSON files.
- [`utils/sync_dynamic_files_to_firebase_storage.py`](file:///d:/Projects/telebirding/utils/sync_dynamic_files_to_firebase_storage.py): Synchronizes `places.json`, `geo-countries.json`, and `geo-states.json` to Firebase Storage.
- [`utils/backup.py`](file:///d:/Projects/telebirding/utils/backup.py): Downloads cloud backups of location and boundary datasets.

### 4. Data Assets
- [`webapp/resources/data/places.json`](file:///d:/Projects/telebirding/webapp/resources/data/places.json): Source of truth for 4-level location hierarchy (`countries -> states -> cities -> places`) with `lat`, `lng`, `radius`.
- [`webapp/resources/data/geo-countries.json`](file:///d:/Projects/telebirding/webapp/resources/data/geo-countries.json): Lightweight GeoJSON FeatureCollection of country polygon boundaries (~22 KB).
- [`webapp/resources/data/geo-states.json`](file:///d:/Projects/telebirding/webapp/resources/data/geo-states.json): Lightweight GeoJSON FeatureCollection of state/province polygon boundaries (~280 KB).

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

### 2. Radius Limits & Caps
To prevent island chains or sparse administrative regions from generating massive circles:
- **`GEO_RADIUS_CAPS`** in `geo-service.js`: Caps bounding box calculation during geocoding (place: 10 km, city: 25 km, state: 150 km, country: 600 km).
- **`UI_RADIUS_LIMITS`** in `species-map.js`: Enforces strict visual rendering bounds on Leaflet circles:
  - Place: 8 km min, 20 km max
  - City: 15 km min, 40 km max
  - State: 35 km min, 200 km max
  - Country: 60 km min, 800 km max

### 3. Layer Separation & Zoom Behavior
- **Zoom < 4 (Overview)**: Displays country polygon boundary outlines (warm orange).
- **Zoom &ge; 4 (Detail)**: Automatically hides country shapes and displays:
  - State boundary polygons (teal/cyan, dashed border, behind).
  - City & Place circles (bright green, solid border, on top).
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
   - Click `☁️ Sync to Firebase Storage` to publish changes.

#### Via Offline Build Script (Bulk / Complete Data Rebuild)
1. If adding many locations or updating administrative definitions, run the build script:
   ```bash
   npm run build:geo
   # OR
   node utils/build-geo-boundaries.js
   ```
2. The script downloads Natural Earth 110m and 10m datasets, resolves name mismatches via `COUNTRY_NAME_MAP` and `STATE_NAME_MAP`, simplifies geometries to 2 decimal places, and writes `geo-countries.json` and `geo-states.json`.
3. Synchronize to Firebase Storage:
   ```bash
   python utils/sync_dynamic_files_to_firebase_storage.py
   ```

---

### Workflow 2: Re-Geocoding Existing Locations
When coordinates or radius are inaccurate:
1. Go to Admin &rarr; **Inspect & Re-Geocode**.
2. Select Country &rarr; State &rarr; City &rarr; Place.
3. Observe live coordinates banner.
4. Click `🔄 Re-Geocode Selected` (or edit Lat/Lng/Radius numbers manually in the result box).
5. Click `💾 Save to Places`.

To re-geocode all sub-locations in bulk:
- Click `⚡ Re-Geocode All States in [Country]` or `⚡ Re-Geocode All Cities & Places in [State]`.
- Requests run sequentially with safety throttling (1s per request) to comply with OSM usage policies.

---

### Workflow 3: Resolving Name Mismatches in Boundary Generation
Natural Earth sometimes uses alternate or historical spellings (e.g. `Lao PDR` vs `Laos`, `Puducherry` vs `Pondicherry`).
To map new names:
1. Open [`utils/build-geo-boundaries.js`](file:///d:/Projects/telebirding/utils/build-geo-boundaries.js).
2. For country mismatches, add to `COUNTRY_NAME_MAP`:
   ```javascript
   const COUNTRY_NAME_MAP = {
       'MyCountry': 'NaturalEarthCountryName',
   };
   ```
3. For state mismatches, add to `STATE_NAME_MAP`:
   ```javascript
   const STATE_NAME_MAP = {
       'Country/PlacesStateName': 'NaturalEarthStateName',
   };
   ```
4. Re-run `npm run build:geo`.

---

## ⚠️ Important Rules & Gotchas

1. **Keep GeoJSON Payloads Small**:
   - Raw global Admin-1 files are ~38 MB+. Never serve raw 10m GeoJSON directly in client browsers.
   - Always filter to repository locations and simplify coordinates to 2 decimal places (`simplifyCoords(coords, 2)`).
   - Target bundle size: `geo-countries.json` < 30 KB, `geo-states.json` < 300 KB.

2. **OSM Nominatim Rate Limits**:
   - Public Nominatim allows max 1 request/second.
   - Batch operations in `admin/rendering.js` and `geo-service.js` enforce a 1,000 ms delay between sequential queries.
   - Always send custom `User-Agent` identifying Telebirding.

3. **URL Resolution via `Util.getData()`**:
   - Always load data files using `Util.getData('data/...')`.
   - Resolves canonical Firebase Storage URLs in production (`FIREBASE_ENABLED`), localhost prepended paths (`resources/data/...`), and Android local offline cache paths.

4. **Cache Invalidation**:
   - When modifying `species-map.js`, `rendering.js`, `admin.js`, or `admin/rendering.js`, bump the query version string (`?v=YYYYMMDD_N`) in `webapp/index.html` and `webapp/admin.html`.
