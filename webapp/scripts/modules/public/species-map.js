import State from './state.js';
import Util from '../util.js';

let speciesMap = null;
let countryLayer = null;
let detailLayer = null;      // state + city + place combined in one layer group
let initialView = null;       // {center, zoom} for reset button

// GeoJSON boundary data (loaded once)
let geoCountries = null;
let geoStates = null;

/**
 * Fixed color per level:
 *   country = warm orange, state = teal/cyan, city/place = bright green
 * Opacity encodes species count (more species → more opaque/brighter)
 */
const LEVEL_COLORS = {
    country: 'rgb(255, 160, 40)',   // warm orange
    state:   'rgb(0, 200, 200)',    // teal/cyan
    city:    'rgb(100, 220, 60)',   // bright green
    place:   'rgb(100, 220, 60)'   // bright green
};

/**
 * Map species count to an opacity value (0.25 – 1.0)
 */
function getOpacityForCount(count, maxCount) {
    if (maxCount === 0) return 0.5;
    const ratio = Math.min(count / maxCount, 1);
    return 0.25 + ratio * 0.75;  // range [0.25 .. 1.0]
}

// UI visual radius boundaries (meters) per hierarchy level to prevent oversized circles
const UI_RADIUS_LIMITS = {
    place:   { min: 8000,  max: 20000 },   // 8 km - 20 km
    city:    { min: 15000, max: 40000 },   // 15 km - 40 km
    state:   { min: 35000, max: 200000 },  // 35 km - 200 km
    country: { min: 60000, max: 800000 }   // 60 km - 800 km
};

// Zoom threshold at which clicking a state navigates to sightings instead of zooming in
const STATE_ZOOM_THRESHOLD = 7;

// Zoom threshold at which the map transitions from country shapes to state+city+place details
const DETAIL_ZOOM_THRESHOLD = 4;

/**
 * Build tooltip HTML for a location
 */
function buildTooltipHtml(name, count, hintText) {
    return `<div class="species-map-tooltip">
        <strong>${name}</strong>
        <span class="count">${count} species</span>
        <span class="hint">${hintText} &rarr;</span>
    </div>`;
}

/**
 * Create a styled GeoJSON polygon for a country or state
 */
function createGeoShape(geoJsonFeature, count, name, maxCount, level) {
    const color = LEVEL_COLORS[level] || LEVEL_COLORS.place;
    const countOpacity = getOpacityForCount(count, maxCount);

    const isState = (level === 'state');
    const fillOpacity = isState ? countOpacity * 0.18 : countOpacity * 0.35;
    const strokeOpacity = isState ? countOpacity * 0.5 : countOpacity * 0.9;

    const layer = L.geoJSON(geoJsonFeature, {
        style: {
            fillColor: color,
            fillOpacity: fillOpacity,
            color: color,
            weight: isState ? 1 : 1.5,
            opacity: strokeOpacity,
            dashArray: isState ? '6, 5' : null,
            className: 'species-shape species-shape-' + level
        }
    });

    // Store base opacities for hover restore
    layer._baseFillOpacity = fillOpacity;
    layer._baseStrokeOpacity = strokeOpacity;
    layer._shapeName = name;
    layer._shapeCount = count;
    layer._shapeLevel = level;

    const hintText = (level === 'country')
        ? 'Click to explore'
        : (level === 'state')
            ? 'Click to zoom in'
            : 'Click to view sightings';

    // Tooltip bound to the layer group
    layer.bindTooltip(buildTooltipHtml(name, count, hintText), {
        direction: 'top',
        sticky: true,
        offset: [0, -12],
        opacity: 0.95,
        className: 'species-map-tooltip-container'
    });

    // Click behavior
    layer.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        const bounds = this.getBounds();
        const center = bounds.getCenter();

        if (level === 'country') {
            speciesMap.flyTo(center, 5, { duration: 0.8 });
        } else if (level === 'state') {
            const currentZoom = speciesMap ? speciesMap.getZoom() : 0;
            if (currentZoom < STATE_ZOOM_THRESHOLD) {
                const targetZoom = Math.max(speciesMap.getBoundsZoom(bounds.pad(0.15)), STATE_ZOOM_THRESHOLD);
                speciesMap.flyTo(center, targetZoom, { duration: 0.8 });
            } else {
                if (typeof window.triggerFilter === 'function') {
                    window.triggerFilter('place', name);
                }
            }
        } else {
            if (typeof window.triggerFilter === 'function') {
                window.triggerFilter('place', name);
            }
        }
    });

    // Hover effect
    layer.on('mouseover', function () {
        this.setStyle({ fillOpacity: Math.min(fillOpacity + 0.2, 0.75), weight: isState ? 1.5 : 2.5 });
        if (!isState) {
            this.bringToFront();
        } else if (speciesMap) {
            const isZoomed = speciesMap.getZoom() >= STATE_ZOOM_THRESHOLD;
            const hint = isZoomed ? 'Click to view sightings' : 'Click to zoom in';
            this.setTooltipContent(buildTooltipHtml(name, count, hint));
        }
    });
    layer.on('mouseout', function () {
        this.setStyle({ fillOpacity: fillOpacity, weight: isState ? 1 : 1.5 });
    });

    return layer;
}

/**
 * Create a styled Leaflet circle for a city/place location
 */
function createCircle(lat, lng, radiusKm, count, name, maxCount, level) {
    const color = LEVEL_COLORS[level] || LEVEL_COLORS.place;
    const countOpacity = getOpacityForCount(count, maxCount);

    const limits = UI_RADIUS_LIMITS[level] || { min: 8000, max: 30000 };
    const rawMeters = (radiusKm || 5) * 1000;
    const radiusMeters = Math.min(Math.max(rawMeters, limits.min), limits.max);

    const fillOpacity = countOpacity * 0.5;
    const strokeOpacity = countOpacity * 0.9;

    const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        fillColor: color,
        fillOpacity: fillOpacity,
        color: color,
        weight: 2,
        opacity: strokeOpacity,
        className: 'species-circle species-circle-' + level
    });

    circle._baseFillOpacity = fillOpacity;
    circle._baseStrokeOpacity = strokeOpacity;

    circle.bindTooltip(buildTooltipHtml(name, count, 'Click to view sightings'), {
        direction: 'top',
        sticky: true,
        offset: [0, -12],
        opacity: 0.95,
        className: 'species-map-tooltip-container'
    });

    // Click → filter sightings
    circle.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        if (typeof window.triggerFilter === 'function') {
            window.triggerFilter('place', name);
        }
    });

    circle.on('mouseover', function () {
        this.setStyle({ fillOpacity: Math.min(fillOpacity + 0.25, 0.85), weight: 3 });
        this.bringToFront();
    });
    circle.on('mouseout', function () {
        this.setStyle({ fillOpacity: fillOpacity, weight: 2 });
    });

    return circle;
}

/**
 * Find the maximum species count across a particular level for color scaling
 */
function getMaxCount(countriesData, level) {
    let max = 0;
    Object.values(countriesData).forEach(country => {
        if (level === 'country') {
            max = Math.max(max, country.count || 0);
        } else {
            Object.values(country.states || {}).forEach(state => {
                if (level === 'state') {
                    max = Math.max(max, state.count || 0);
                } else {
                    Object.values(state.cities || {}).forEach(city => {
                        max = Math.max(max, city.count || 0);
                        Object.values(city.places || {}).forEach(place => {
                            max = Math.max(max, place.count || 0);
                        });
                    });
                }
            });
        }
    });
    return max;
}

/**
 * Build layers from the merged data.
 * Level 1 (countryLayer): Country GeoJSON polygon shapes
 * Level 2 (detailLayer): State GeoJSON polygon shapes (faded/dotted, behind)
 *                         + City & Place circles (prominent, on top)
 */
function buildLayers(countriesData, placesGeo, detailOnly = false) {
    if (speciesMap) {
        if (countryLayer && speciesMap.hasLayer(countryLayer)) {
            speciesMap.removeLayer(countryLayer);
        }
        if (detailLayer && speciesMap.hasLayer(detailLayer)) {
            speciesMap.removeLayer(detailLayer);
        }
    }

    if (!detailOnly) {
        countryLayer = L.layerGroup();
        detailLayer = L.layerGroup();
    } else {
        detailLayer = L.layerGroup();
    }

    const maxCountryCount = getMaxCount(countriesData, 'country');
    const maxStateCount = getMaxCount(countriesData, 'state');
    const maxCityCount = getMaxCount(countriesData, 'cityPlace');

    const countriesGeo = placesGeo.countries || {};

    // Build lookup for GeoJSON boundaries by name
    const countryBoundaries = {};
    if (geoCountries && geoCountries.features) {
        geoCountries.features.forEach(f => {
            countryBoundaries[f.properties.name] = f;
        });
    }
    const stateBoundaries = {};
    if (geoStates && geoStates.features) {
        geoStates.features.forEach(f => {
            const key = `${f.properties.country}/${f.properties.name}`;
            stateBoundaries[key] = f;
        });
    }

    // Temporary arrays to control z-order within detailLayer
    const stateShapes = [];
    const cityCircles = [];
    const placeCircles = [];

    Object.keys(countriesData).forEach(countryKey => {
        const country = countriesData[countryKey];
        const countryGeo = countriesGeo[countryKey];

        if (!country.count || country.count <= 0 || !countryGeo || !countryGeo.lat) return;

        // Country shape (Level 1) - use GeoJSON polygon if available, fallback to circle
        if (!detailOnly) {
            const countryBoundary = countryBoundaries[countryKey];
            if (countryBoundary) {
                const shape = createGeoShape(
                    countryBoundary, country.count, country.name, maxCountryCount, 'country'
                );
                countryLayer.addLayer(shape);
            } else {
                // Fallback: circle for countries without boundary data (e.g., Singapore)
                const limits = UI_RADIUS_LIMITS.country;
                const rawMeters = (countryGeo.radius || 5) * 1000;
                const radiusMeters = Math.min(Math.max(rawMeters, limits.min), limits.max);
                const countOpacity = getOpacityForCount(country.count, maxCountryCount);

                const circle = L.circle([countryGeo.lat, countryGeo.lng], {
                    radius: radiusMeters,
                    fillColor: LEVEL_COLORS.country,
                    fillOpacity: countOpacity * 0.35,
                    color: LEVEL_COLORS.country,
                    weight: 1.5,
                    opacity: countOpacity * 0.9,
                    className: 'species-circle species-circle-country'
                });
                circle.bindTooltip(buildTooltipHtml(country.name, country.count, 'Click to explore'), {
                    direction: 'top', sticky: true, offset: [0, -12],
                    opacity: 0.95, className: 'species-map-tooltip-container'
                });
                circle.on('click', function (e) {
                    L.DomEvent.stopPropagation(e);
                    speciesMap.flyTo([countryGeo.lat, countryGeo.lng], 5, { duration: 0.8 });
                });
                circle.on('mouseover', function () {
                    this.setStyle({ fillOpacity: Math.min(countOpacity * 0.35 + 0.2, 0.75), weight: 2.5 });
                    this.bringToFront();
                });
                circle.on('mouseout', function () {
                    this.setStyle({ fillOpacity: countOpacity * 0.35, weight: 1.5 });
                });
                countryLayer.addLayer(circle);
            }
        }

        // States (Level 2)
        Object.keys(country.states || {}).forEach(stateKey => {
            const state = country.states[stateKey];
            const stateGeo = (countryGeo.states || {})[stateKey];

            if (!state.count || state.count <= 0 || !stateGeo || !stateGeo.lat) return;

            // Use GeoJSON shape if available, fallback to circle
            const boundaryKey = `${countryKey}/${stateKey}`;
            const stateBoundary = stateBoundaries[boundaryKey];

            if (stateBoundary) {
                const shape = createGeoShape(
                    stateBoundary, state.count, state.name, maxStateCount, 'state'
                );
                stateShapes.push(shape);
            } else {
                // Fallback: circle for states without boundary data
                const stateCircle = createCircle(
                    stateGeo.lat, stateGeo.lng, stateGeo.radius,
                    state.count, state.name, maxStateCount, 'state'
                );
                stateShapes.push(stateCircle);
            }

            // Cities and Places (always circles)
            Object.keys(state.cities || {}).forEach(cityKey => {
                const city = state.cities[cityKey];
                const cityGeo = (stateGeo.cities || {})[cityKey];

                if (!city.count || city.count <= 0 || !cityGeo || !cityGeo.lat) return;

                const cityCircle = createCircle(
                    cityGeo.lat, cityGeo.lng, cityGeo.radius,
                    city.count, cityKey, maxCityCount, 'city'
                );
                cityCircles.push(cityCircle);

                // Places
                Object.keys(city.places || {}).forEach(placeKey => {
                    const place = city.places[placeKey];
                    const placeGeo = (cityGeo.places || {})[placeKey];

                    if (!place.count || place.count <= 0 || !placeGeo || !placeGeo.lat) return;

                    const placeCircle = createCircle(
                        placeGeo.lat, placeGeo.lng, placeGeo.radius,
                        place.count, placeKey, maxCityCount, 'place'
                    );
                    placeCircles.push(placeCircle);
                });
            });
        });
    });

    // Z-order: states (behind) → cities → places (on top, always clickable)
    stateShapes.forEach(c => detailLayer.addLayer(c));
    cityCircles.forEach(c => detailLayer.addLayer(c));
    placeCircles.forEach(c => detailLayer.addLayer(c));
}

/**
 * Update visible layers based on current zoom level
 * Level 1 (zoom < DETAIL_ZOOM_THRESHOLD): Country shapes only
 * Level 2 (zoom >= DETAIL_ZOOM_THRESHOLD): State shapes (faded/dotted) + City & Place circles (prominent)
 */
function updateVisibleLayers() {
    if (!speciesMap) return;

    const zoom = speciesMap.getZoom();

    if (zoom < DETAIL_ZOOM_THRESHOLD) {
        if (!speciesMap.hasLayer(countryLayer)) speciesMap.addLayer(countryLayer);
        if (speciesMap.hasLayer(detailLayer)) speciesMap.removeLayer(detailLayer);
    } else {
        if (speciesMap.hasLayer(countryLayer)) speciesMap.removeLayer(countryLayer);
        if (!speciesMap.hasLayer(detailLayer)) speciesMap.addLayer(detailLayer);
    }
}

/**
 * Toggle fullscreen mode for the map
 */
function toggleFullscreen() {
    const mapContainer = document.getElementById('species-map');
    if (!mapContainer) return;

    const isFullscreen = mapContainer.classList.toggle('map-fullscreen');
    document.body.classList.toggle('has-fullscreen-map', isFullscreen);

    const enterIcon = mapContainer.querySelector('.fullscreen-icon-enter');
    const exitIcon = mapContainer.querySelector('.fullscreen-icon-exit');
    if (enterIcon && exitIcon) {
        enterIcon.style.display = isFullscreen ? 'none' : 'block';
        exitIcon.style.display = isFullscreen ? 'block' : 'none';
    }

    // Try HTML5 Fullscreen API
    if (isFullscreen) {
        if (mapContainer.requestFullscreen) {
            mapContainer.requestFullscreen().catch(() => {});
        } else if (mapContainer.webkitRequestFullscreen) {
            mapContainer.webkitRequestFullscreen();
        }
    } else {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    setTimeout(() => { if (speciesMap) speciesMap.invalidateSize(); }, 100);
    setTimeout(() => { if (speciesMap) speciesMap.invalidateSize(); }, 300);
}

/**
 * Reset map to initial view (center + zoom)
 */
function resetMapView() {
    if (!speciesMap || !initialView) return;
    speciesMap.flyTo(initialView.center, initialView.zoom, { duration: 0.8 });
}

/**
 * Add custom map controls: Fullscreen + Reset buttons
 */
function addMapControls(map) {
    const MapControls = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            // Fullscreen button
            const fullscreenBtn = L.DomUtil.create('a', 'leaflet-control-custom-button', container);
            fullscreenBtn.href = '#';
            fullscreenBtn.title = 'Toggle Fullscreen';
            fullscreenBtn.setAttribute('role', 'button');
            fullscreenBtn.setAttribute('aria-label', 'Toggle Fullscreen');
            fullscreenBtn.innerHTML = `
                <svg class="fullscreen-icon-enter" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
                <svg class="fullscreen-icon-exit" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                </svg>`;

            // Reset button
            const resetBtn = L.DomUtil.create('a', 'leaflet-control-custom-button', container);
            resetBtn.href = '#';
            resetBtn.title = 'Reset Map View';
            resetBtn.setAttribute('role', 'button');
            resetBtn.setAttribute('aria-label', 'Reset Map View');
            resetBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                </svg>`;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(fullscreenBtn, 'click', function (e) {
                L.DomEvent.stop(e);
                toggleFullscreen();
            });
            L.DomEvent.on(resetBtn, 'click', function (e) {
                L.DomEvent.stop(e);
                resetMapView();
            });

            return container;
        }
    });

    new MapControls().addTo(map);

    // Sync fullscreen state when user presses Escape or browser exits fullscreen
    document.addEventListener('fullscreenchange', function () {
        const mapContainer = document.getElementById('species-map');
        if (!mapContainer) return;
        if (!document.fullscreenElement && mapContainer.classList.contains('map-fullscreen')) {
            mapContainer.classList.remove('map-fullscreen');
            document.body.classList.remove('has-fullscreen-map');
            const enterIcon = mapContainer.querySelector('.fullscreen-icon-enter');
            const exitIcon = mapContainer.querySelector('.fullscreen-icon-exit');
            if (enterIcon && exitIcon) {
                enterIcon.style.display = 'block';
                exitIcon.style.display = 'none';
            }
            setTimeout(() => { if (speciesMap) speciesMap.invalidateSize(); }, 150);
        }
    });
}

/**
 * Load GeoJSON boundary files for all used countries
 */
async function loadBoundaries(countriesData) {
    const countries = countriesData || {};
    const countryNames = Object.keys(countries);

    geoCountries = { type: 'FeatureCollection', features: [] };
    geoStates = { type: 'FeatureCollection', features: [] };

    await Promise.all(countryNames.map(async (country) => {
        const path = Util.getData(`data/geo/${country}.json`);
        try {
            const res = await fetch(path);
            if (res.ok) {
                const file = await res.json();
                if (file.country) {
                    geoCountries.features.push(file.country);
                }
                if (file.states && file.states.features) {
                    geoStates.features.push(...file.states.features);
                }
            }
        } catch (e) {
            console.warn(`[SpeciesMap] Could not load geo/${country}.json:`, e);
        }
    }));
}

/**
 * Initialize the species map
 * @param {Object} countriesData - State.data.countries (with computed counts)
 * @param {Object} placesGeo - Raw places.json data (with lat/lng/radius)
 */
export async function initSpeciesMap(countriesData, placesGeo) {
    const container = document.getElementById('species-map');
    if (!container) return;

    // Load GeoJSON boundaries
    await loadBoundaries(countriesData);

    // Destroy existing map if any
    if (speciesMap) {
        speciesMap.remove();
        speciesMap = null;
    }

    // Initialize map
    speciesMap = L.map('species-map', {
        scrollWheelZoom: true,
        zoomControl: false,
        attributionControl: false
    });

    // Controls: custom buttons first, then zoom
    addMapControls(speciesMap);
    L.control.zoom({ position: 'topright' }).addTo(speciesMap);

    // Esri Dark Gray Canvas - free, no API key required, clean dark theme
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri'
    }).addTo(speciesMap);

    // Reference labels overlay on top of dark canvas
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
    }).addTo(speciesMap);

    // Add subtle attribution in bottom right
    L.control.attribution({
        position: 'bottomright',
        prefix: false
    }).addTo(speciesMap);

    // Build all layers (shapes for countries/states, circles for cities/places)
    buildLayers(countriesData, placesGeo);

    if (!speciesMap.hasLayer(countryLayer)) speciesMap.addLayer(countryLayer);

    // Fit bounds to country layer points
    const allBounds = [];
    countryLayer.eachLayer(layer => {
        if (layer.getBounds) {
            try {
                const b = layer.getBounds();
                allBounds.push(b.getSouthWest());
                allBounds.push(b.getNorthEast());
            } catch (e) {
                if (layer.getLatLng) allBounds.push(layer.getLatLng());
            }
        } else if (layer.getLatLng) {
            allBounds.push(layer.getLatLng());
        }
    });

    if (allBounds.length > 0) {
        const bounds = L.latLngBounds(allBounds);
        if (bounds.isValid()) {
            speciesMap.fitBounds(bounds.pad(0.12), { maxZoom: 5 });
        } else {
            speciesMap.setView([22.5, 78.9], 4);
        }
    } else {
        speciesMap.setView([22.5, 78.9], 4);
    }

    // Store initial view for reset button
    initialView = {
        center: speciesMap.getCenter(),
        zoom: speciesMap.getZoom()
    };

    // Show correct layer for initial zoom
    updateVisibleLayers();

    // Update layers on zoom change
    speciesMap.on('zoomend', updateVisibleLayers);
}

/**
 * Destroy the map instance (for cleanup)
 */
export function destroySpeciesMap() {
    if (speciesMap) {
        speciesMap.remove();
        speciesMap = null;
        countryLayer = null;
        detailLayer = null;
        initialView = null;
    }
}
