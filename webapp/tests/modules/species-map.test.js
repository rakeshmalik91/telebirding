import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as SpeciesMap from '../../scripts/modules/public/species-map.js';
import State from '../../scripts/modules/public/state.js';

describe('Species Map Module', () => {
    let mockMapInstance;
    let mockLayers;
    let mockFetch;

    beforeEach(() => {
        document.body.innerHTML = `
            <div class="map-menu">
                <div id="species-map" style="height: 400px; width: 800px;"></div>
            </div>
        `;

        mockLayers = [];
        mockMapInstance = {
            remove: vi.fn(),
            hasLayer: vi.fn(() => false),
            addLayer: vi.fn((layer) => mockLayers.push(layer)),
            removeLayer: vi.fn(),
            on: vi.fn(),
            getZoom: vi.fn(() => 4),
            getCenter: vi.fn(() => ({ lat: 20, lng: 78 })),
            setView: vi.fn(),
            fitBounds: vi.fn(),
            flyTo: vi.fn(),
            invalidateSize: vi.fn(),
            getBoundsZoom: vi.fn(() => 7),
            getBounds: vi.fn(() => ({
                getCenter: vi.fn(() => ({ lat: 20, lng: 78 }))
            })),
            createPane: vi.fn((name) => {
                const pane = { style: {} };
                mockMapInstance._panes[name] = pane;
                return pane;
            }),
            getPane: vi.fn((name) => mockMapInstance._panes[name] || { style: {} }),
            _panes: {}
        };

        global.L = {
            map: vi.fn(() => mockMapInstance),
            tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
            control: {
                zoom: vi.fn(() => ({ addTo: vi.fn() })),
                attribution: vi.fn(() => ({ addTo: vi.fn() }))
            },
            Control: {
                extend: vi.fn((config) => {
                    return function () {
                        return {
                            addTo: vi.fn(),
                            ...config
                        };
                    };
                })
            },
            layerGroup: vi.fn(() => {
                const layers = [];
                return {
                    addLayer: vi.fn((l) => layers.push(l)),
                    eachLayer: vi.fn((cb) => layers.forEach(cb)),
                    clearLayers: vi.fn(() => { layers.length = 0; }),
                    _layers: layers
                };
            }),
            geoJSON: vi.fn((feature, options) => {
                return {
                    feature,
                    options,
                    setStyle: vi.fn(),
                    bringToFront: vi.fn(),
                    bindTooltip: vi.fn(),
                    on: vi.fn(),
                    getBounds: vi.fn(() => ({
                        getSouthWest: vi.fn(() => ({ lat: 8, lng: 68 })),
                        getNorthEast: vi.fn(() => ({ lat: 37, lng: 97 })),
                        getCenter: vi.fn(() => ({ lat: 20, lng: 78 })),
                        pad: vi.fn(() => ({ getCenter: vi.fn() }))
                    }))
                };
            }),
            circle: vi.fn((coords, options) => {
                return {
                    coords,
                    options,
                    setStyle: vi.fn(),
                    bringToFront: vi.fn(),
                    bindTooltip: vi.fn(),
                    on: vi.fn(),
                    getLatLng: vi.fn(() => ({ lat: coords[0], lng: coords[1] }))
                };
            }),
            latLngBounds: vi.fn(() => ({
                isValid: vi.fn(() => true),
                pad: vi.fn(() => ({ isValid: () => true }))
            })),
            DomEvent: {
                stopPropagation: vi.fn()
            }
        };

        mockFetch = vi.fn((url) => {
            if (url.includes('India.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        country: {
                            type: 'Feature',
                            properties: { name: 'India' },
                            geometry: { type: 'Polygon', coordinates: [[[78, 20], [79, 21], [78, 20]]] }
                        },
                        states: {
                            type: 'FeatureCollection',
                            features: [{
                                type: 'Feature',
                                properties: { name: 'Maharashtra', country: 'India' },
                                geometry: { type: 'Polygon', coordinates: [[[73, 19], [74, 20], [73, 19]]] }
                            }]
                        }
                    })
                });
            }
            return Promise.resolve({ ok: false });
        });
        global.fetch = mockFetch;
    });

    it('should only load boundary JSON for countries used in sightings', async () => {
        State.data = {
            sightings: [
                { country: 'India', species: { key: 'sp1' } }
            ]
        };

        const countriesData = {
            'India': { name: 'India', count: 5, states: {} },
            'Bhutan': { name: 'Bhutan', count: 0, states: {} },
            'Russia': { name: 'Russia', count: 0, states: {} }
        };
        const placesGeo = {
            countries: {
                'India': { lat: 20, lng: 78, radius: 500 },
                'Bhutan': { lat: 27, lng: 90, radius: 100 },
                'Russia': { lat: 60, lng: 100, radius: 1000 }
            }
        };

        await SpeciesMap.initSpeciesMap(countriesData, placesGeo);

        // Verify fetch calls
        const fetchedUrls = mockFetch.mock.calls.map(call => call[0]);
        expect(fetchedUrls.some(u => u.includes('India.json'))).toBe(true);
        expect(fetchedUrls.some(u => u.includes('Bhutan.json'))).toBe(false);
        expect(fetchedUrls.some(u => u.includes('Russia.json'))).toBe(false);
    });

    it('should initialize map with continuous wrapping and vertical bounds to prevent white gaps', async () => {
        State.data = {
            sightings: [{ country: 'India', species: { key: 'sp1' } }]
        };
        const countriesData = {
            'India': { name: 'India', count: 5, states: {} }
        };
        const placesGeo = {
            countries: {
                'India': { lat: 20, lng: 78, radius: 500 }
            }
        };

        await SpeciesMap.initSpeciesMap(countriesData, placesGeo);

        expect(global.L.map).toHaveBeenCalledWith('species-map', expect.objectContaining({
            worldCopyJump: true,
            minZoom: 1,
            maxBounds: [[-85.051129, -Infinity], [85.051129, Infinity]],
            maxBoundsViscosity: 1.0
        }));
    });

    it('should wrap vector layers across multiple world copies', async () => {
        State.data = {
            sightings: [{ country: 'India', species: { key: 'sp1' } }]
        };
        const countriesData = {
            'India': {
                name: 'India', count: 5,
                states: {
                    'Maharashtra': {
                        name: 'Maharashtra', count: 5,
                        cities: {
                            'Pune': {
                                count: 5,
                                places: { 'Viman Nagar': { count: 5 } }
                            }
                        }
                    }
                }
            }
        };
        const placesGeo = {
            countries: {
                'India': {
                    lat: 20, lng: 78, radius: 500,
                    states: {
                        'Maharashtra': {
                            lat: 19, lng: 73, radius: 100,
                            cities: {
                                'Pune': {
                                    lat: 18.5, lng: 73.8, radius: 10,
                                    places: {
                                        'Viman Nagar': { lat: 18.55, lng: 73.9, radius: 2 }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        await SpeciesMap.initSpeciesMap(countriesData, placesGeo);

        // Since WORLD_OFFSETS is [-2, -1, 0, 1, 2], there are 5 copies per country/state/city/place
        const geoJsonCalls = global.L.geoJSON.mock.calls;
        // Country India is loaded from mockFetch, so 5 copies are created for India country shape
        const indiaCountryShapes = geoJsonCalls.filter(call => call[0].properties && call[0].properties.name === 'India');
        expect(indiaCountryShapes.length).toBe(5);

        // Check longitude shifts across world offsets: 78, 78+360, 78-360, 78+720, 78-720
        const firstCoordLngs = indiaCountryShapes.map(call => call[0].geometry.coordinates[0][0][0]);
        expect(firstCoordLngs).toContain(78);
        expect(firstCoordLngs).toContain(78 + 360);
        expect(firstCoordLngs).toContain(78 - 360);
        expect(firstCoordLngs).toContain(78 + 720);
        expect(firstCoordLngs).toContain(78 - 720);
    });

    it('should assign place circles to placePane and city circles to cityPane so places are always above cities and clickable', async () => {
        State.data = {
            sightings: [{ country: 'India', species: { key: 'sp1' } }]
        };
        const countriesData = {
            'India': {
                name: 'India', count: 5,
                states: {
                    'Maharashtra': {
                        name: 'Maharashtra', count: 5,
                        cities: {
                            'Pune': {
                                count: 5,
                                places: { 'Viman Nagar': { count: 5 } }
                            }
                        }
                    }
                }
            }
        };
        const placesGeo = {
            countries: {
                'India': {
                    lat: 20, lng: 78, radius: 500,
                    states: {
                        'Maharashtra': {
                            lat: 19, lng: 73, radius: 100,
                            cities: {
                                'Pune': {
                                    lat: 18.5, lng: 73.8, radius: 10,
                                    places: {
                                        'Viman Nagar': { lat: 18.55, lng: 73.9, radius: 2 }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        await SpeciesMap.initSpeciesMap(countriesData, placesGeo);

        // Verify circle pane assignments
        const circleCalls = global.L.circle.mock.calls;
        const cityCalls = circleCalls.filter(call => call[1]?.pane === 'cityPane');
        const placeCalls = circleCalls.filter(call => call[1]?.pane === 'placePane');

        expect(cityCalls.length).toBe(5); // 5 world copies
        expect(placeCalls.length).toBe(5); // 5 world copies

        // Verify pane z-indexes
        const cityZIndex = parseInt(mockMapInstance._panes['cityPane'].style.zIndex, 10);
        const placeZIndex = parseInt(mockMapInstance._panes['placePane'].style.zIndex, 10);

        expect(placeZIndex).toBeGreaterThan(cityZIndex);
        expect(placeZIndex).toBe(450);
        expect(cityZIndex).toBe(420);

        // Verify city and place use subtly distinct colors
        expect(cityCalls[0][1].color).toBe('rgb(135, 215, 50)');
        expect(placeCalls[0][1].color).toBe('rgb(65, 215, 95)');
        expect(cityCalls[0][1].color).not.toBe(placeCalls[0][1].color);
    });
});
