import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AdminData from '../../scripts/modules/admin/data.js';
import { setupPlacesTab } from '../../scripts/modules/admin/rendering.js';
import FirebaseApi from '../../scripts/modules/firebase-api.js';

vi.mock('../../scripts/modules/util.js', () => ({
    default: {
        getUrlParams: vi.fn(() => ({})),
        clearFileCache: vi.fn(),
        readJSONFiles: vi.fn(),
        getData: vi.fn((p) => p),
        getMedia: vi.fn((p) => p),
        compare: vi.fn((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
        plural: vi.fn((s) => s + 's')
    }
}));

vi.mock('../../scripts/modules/firebase-api.js', () => ({
    default: {
        getFirebase: vi.fn(() => ({
            storage: () => ({
                ref: () => ({
                    put: vi.fn(() => Promise.resolve({ metadata: {} })),
                    getMetadata: vi.fn(() => Promise.resolve({ generation: '1' }))
                })
            })
        })),
        moveFile: vi.fn(() => Promise.resolve())
    }
}));

vi.mock('../../scripts/modules/admin/ui.js', () => ({
    customAlert: vi.fn(),
    customConfirm: vi.fn((msg, cb) => cb()),
    showToast: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn()
}));

describe('Admin Geo Boundaries Management', () => {
    beforeEach(() => {
        AdminData.setRenderCallback(vi.fn());
        for (const key in AdminData.data) delete AdminData.data[key];

        AdminData.data.countries = {
            India: {
                name: 'India',
                lat: 22.5,
                lng: 78.9,
                states: {
                    'West Bengal': { name: 'West Bengal', lat: 22.98, lng: 87.85 },
                    'Goa': { name: 'Goa', lat: 15.29, lng: 74.12 }
                }
            },
            Singapore: {
                name: 'Singapore',
                lat: 1.35,
                lng: 103.81,
                states: {}
            }
        };

        AdminData.data.geoCountries = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'India' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[70, 20], [80, 20], [80, 30], [70, 30], [70, 20]]]
                    }
                }
            ]
        };

        AdminData.data.geoStates = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'West Bengal', country: 'India' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[[87, 22], [88, 22], [88, 24], [87, 24], [87, 22]]]
                    }
                }
            ]
        };

        // Setup DOM elements expected by setupPlacesTab
        document.body.innerHTML = `
            <div id="places-tab">
                <select id="geo-provider-select">
                    <option value="nominatim">Nominatim</option>
                    <option value="photon">Photon</option>
                </select>
                <div id="geo-provider-status"></div>

                <select id="place-lookup-country"></select>
                <select id="place-lookup-state"></select>
                <input type="text" id="place-lookup-city" />
                <datalist id="place-lookup-city-list"></datalist>
                <input type="text" id="place-lookup-place" />
                <datalist id="place-lookup-place-list"></datalist>

                <div id="place-current-coords-box" style="display:none;">
                    <div id="place-current-coords-title"></div>
                    <div id="place-current-coords-text"></div>
                </div>
                <button id="btn-fetch-geo"></button>
                <button id="btn-batch-regeocode-sub"></button>

                <select id="new-state-country-select"></select>
                <select id="scan-country-filter"></select>
                <select id="scan-mode-select"><option value="missing">Missing</option></select>
                <button id="btn-scan-missing-places"></button>
                <div id="missing-places-summary"></div>
                <div id="missing-places-count"></div>
                <button id="btn-autofill-missing"></button>
                <div id="autofill-status-text"></div>
                <div id="missing-places-list"></div>

                <!-- Geo Boundaries elements -->
                <strong id="boundary-stat-countries">-</strong>
                <strong id="boundary-stat-states">-</strong>
                <div id="boundary-missing-alert"></div>
                <select id="boundary-inspect-country"></select>
                <select id="boundary-inspect-state"></select>
                <div id="boundary-status-box">
                    <div id="boundary-status-text"></div>
                </div>
                <button id="btn-update-boundary"></button>
                <button id="btn-update-all-states"></button>
            </div>
        `;
    });

    describe('getGeoBoundaryCoverage()', () => {
        it('accurately calculates country and state coverage and identifies missing items', () => {
            const coverage = AdminData.getGeoBoundaryCoverage();

            expect(coverage.countries.total).toBe(2);
            expect(coverage.countries.covered).toBe(1); // India covered, Singapore missing
            expect(coverage.countries.missing).toContain('Singapore');

            expect(coverage.states.total).toBe(2);
            expect(coverage.states.covered).toBe(1); // West Bengal covered, Goa missing
            expect(coverage.states.missing).toContain('India/Goa');
        });
    });

    describe('getGeoBoundary()', () => {
        it('retrieves country polygon by name', () => {
            const b = AdminData.getGeoBoundary({ country: 'India' });
            expect(b).not.toBeNull();
            expect(b.properties.name).toBe('India');
            expect(b.geometry.type).toBe('Polygon');
        });

        it('returns null for country without boundary', () => {
            const b = AdminData.getGeoBoundary({ country: 'Singapore' });
            expect(b).toBeNull();
        });

        it('retrieves state polygon by country and state name', () => {
            const b = AdminData.getGeoBoundary({ country: 'India', state: 'West Bengal' });
            expect(b).not.toBeNull();
            expect(b.properties.name).toBe('West Bengal');
            expect(b.properties.country).toBe('India');
        });

        it('returns null for missing state boundary', () => {
            const b = AdminData.getGeoBoundary({ country: 'India', state: 'Goa' });
            expect(b).toBeNull();
        });
    });

    describe('saveGeoBoundary()', () => {
        it('adds or updates country polygon in memory', () => {
            const newFeature = {
                type: 'Feature',
                properties: { name: 'Singapore' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[103.6, 1.2], [104.0, 1.2], [104.0, 1.4], [103.6, 1.4], [103.6, 1.2]]]
                }
            };

            AdminData.saveGeoBoundary({ level: 'country', country: 'Singapore', feature: newFeature });
            const saved = AdminData.getGeoBoundary({ country: 'Singapore' });
            expect(saved).not.toBeNull();
            expect(saved.properties.name).toBe('Singapore');

            const coverage = AdminData.getGeoBoundaryCoverage();
            expect(coverage.countries.covered).toBe(2);
            expect(coverage.countries.missing).not.toContain('Singapore');
        });

        it('adds or updates state polygon in memory', () => {
            const newFeature = {
                type: 'Feature',
                properties: { name: 'Goa', country: 'India' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[73.8, 15.0], [74.3, 15.0], [74.3, 15.8], [73.8, 15.8], [73.8, 15.0]]]
                }
            };

            AdminData.saveGeoBoundary({ level: 'state', country: 'India', state: 'Goa', feature: newFeature });
            const saved = AdminData.getGeoBoundary({ country: 'India', state: 'Goa' });
            expect(saved).not.toBeNull();
            expect(saved.properties.name).toBe('Goa');

            const coverage = AdminData.getGeoBoundaryCoverage();
            expect(coverage.states.covered).toBe(2);
            expect(coverage.states.missing).not.toContain('India/Goa');
        });
    });

    describe('fetchBoundaryFromOSM()', () => {
        it('queries Nominatim and returns formatted polygon feature', async () => {
            const mockOsmResponse = [
                {
                    display_name: 'Goa, India',
                    osm_type: 'relation',
                    osm_id: 12345,
                    geojson: {
                        type: 'Polygon',
                        coordinates: [[[73.8123, 15.0456], [74.3456, 15.0456], [74.3456, 15.8123], [73.8123, 15.8123], [73.8123, 15.0456]]]
                    }
                }
            ];

            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockOsmResponse)
                })
            );

            const feature = await AdminData.fetchBoundaryFromOSM({ country: 'India', state: 'Goa' });
            expect(feature).toBeDefined();
            expect(feature.properties.name).toBe('Goa');
            expect(feature.properties.country).toBe('India');
            expect(feature.geometry.type).toBe('Polygon');
            expect(feature._osmInfo.osmId).toBe(12345);
        });

        it('throws error when no polygon is found in OSM results', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([{ display_name: 'Point location', geojson: { type: 'Point', coordinates: [0, 0] } }])
                })
            );

            await expect(AdminData.fetchBoundaryFromOSM({ country: 'Unknown' })).rejects.toThrow(/no polygon boundary geometry/i);
        });
    });

    describe('setupPlacesTab() Geo Boundaries UI', () => {
        it('populates boundary selector and displays accurate coverage status', async () => {
            setupPlacesTab();

            // Give promise resolution a tick
            await new Promise(r => setTimeout(r, 10));

            expect($('#boundary-stat-countries').text()).toContain('1 / 2');
            expect($('#boundary-stat-states').text()).toContain('1 / 2');
            expect($('#boundary-missing-alert').text()).toContain('Singapore');

            // Check inspect country dropdown
            const countryOptions = $('#boundary-inspect-country option').map((i, el) => el.value).get();
            expect(countryOptions).toContain('India');
            expect(countryOptions).toContain('Singapore');

            // Select India
            $('#boundary-inspect-country').val('India').trigger('change');
            expect($('#boundary-status-text').text()).toContain('Boundary Polygon Present');

            // Select Singapore (missing boundary)
            $('#boundary-inspect-country').val('Singapore').trigger('change');
            expect($('#boundary-status-text').text()).toContain('No Boundary Polygon');
        });
    });

    describe('Per-Country Geo Backup & Restore', () => {
        it('getCountryGeoJSON creates composite country and states payload', () => {
            const indiaGeo = AdminData.getCountryGeoJSON('India');
            expect(indiaGeo.country).toBeDefined();
            expect(indiaGeo.country.properties.name).toBe('India');
            expect(indiaGeo.states.type).toBe('FeatureCollection');
            expect(indiaGeo.states.features.length).toBe(1);
            expect(indiaGeo.states.features[0].properties.name).toBe('West Bengal');
        });

        it('uploadGeoBoundary uploads individual country boundary to Firebase', async () => {
            const putMock = vi.fn(() => Promise.resolve());
            const refMock = vi.fn(() => ({ put: putMock }));
            vi.spyOn(FirebaseApi, 'getFirebase').mockReturnValue({
                storage: () => ({ ref: refMock })
            });

            await AdminData.uploadGeoBoundary('India');
            expect(refMock).toHaveBeenCalledWith('data/geo/India.json');
            expect(putMock).toHaveBeenCalled();
        });

        it('backup() includes per-country geo files in backup/{date}/geo/', async () => {
            const uploadedPaths = [];
            const putMock = vi.fn(() => Promise.resolve());
            const refMock = vi.fn((path) => {
                uploadedPaths.push(path);
                return { put: putMock };
            });
            vi.spyOn(FirebaseApi, 'getFirebase').mockReturnValue({
                storage: () => ({ ref: refMock })
            });

            await AdminData.backup();

            expect(uploadedPaths.some(p => p.includes('/geo/India.json'))).toBe(true);
            expect(uploadedPaths.some(p => p.endsWith('places.json'))).toBe(true);
        });
    });
});
