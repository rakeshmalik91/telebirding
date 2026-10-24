import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AdminData from '../../scripts/modules/admin/data.js';
import { setupPlacesTab } from '../../scripts/modules/admin/rendering.js';
import * as GeoServiceModule from '../../scripts/modules/geo-service.js';
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
                    put: vi.fn(() => Promise.resolve({ metadata: {} }))
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

describe('Admin Places Geocoding Integration', () => {
    beforeEach(() => {
        AdminData.setRenderCallback(vi.fn());
        for (const key in AdminData.data) delete AdminData.data[key];

        AdminData.data.countries = {
            India: {
                name: 'India',
                lat: 22.5,
                lng: 78.9,
                radius: 1200,
                states: {
                    'West Bengal': {
                        name: 'West Bengal',
                        lat: 22.98,
                        lng: 87.85,
                        radius: 200,
                        cities: {
                            Howrah: {
                                name: 'Howrah',
                                lat: 22.59,
                                lng: 88.26,
                                radius: 20,
                                places: {}
                            }
                        }
                    }
                }
            }
        };

        AdminData.data.sightings = [
            { key: 's1', country: 'India', state: 'West Bengal', city: 'Howrah', place: 'Bally' }
        ];
    });

    it('getLocationGeo should find existing coordinates and return null if missing', () => {
        const cityGeo = AdminData.getLocationGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah'
        });
        expect(cityGeo).not.toBeNull();
        expect(cityGeo.lat).toBe(22.59);

        const placeGeo = AdminData.getLocationGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah',
            place: 'Bally'
        });
        expect(placeGeo).toBeNull();
    });

    it('savePlaceGeo should insert new place into countries hierarchy', () => {
        const success = AdminData.savePlaceGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah',
            place: 'Bally',
            lat: 22.65,
            lng: 88.34,
            radius: 4
        });

        expect(success).toBe(true);
        const bally = AdminData.data.countries.India.states['West Bengal'].cities.Howrah.places.Bally;
        expect(bally).toBeDefined();
        expect(bally.lat).toBe(22.65);
        expect(bally.lng).toBe(88.34);
        expect(bally.radius).toBe(4);
    });

    it('geocodeAndSaveLocation should call lookupLocation and save result', async () => {
        const mockLookup = vi.spyOn(GeoServiceModule, 'lookupLocation').mockResolvedValue({
            lat: 22.65,
            lng: 88.34,
            radius: 4,
            displayName: 'Bally, Howrah, West Bengal, India',
            provider: 'nominatim'
        });

        const res = await AdminData.geocodeAndSaveLocation({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah',
            place: 'Bally'
        });

        expect(mockLookup).toHaveBeenCalledWith({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah',
            place: 'Bally',
            type: 'place'
        });

        expect(res).not.toBeNull();
        expect(res.lat).toBe(22.65);

        const saved = AdminData.getLocationGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah',
            place: 'Bally'
        });
        expect(saved).not.toBeNull();
        expect(saved.lat).toBe(22.65);
    });

    it('savePlaceGeo and getLocationGeo should support Country and State levels', () => {
        // Save new Country without coordinates initially
        AdminData.savePlaceGeo({
            country: 'Nepal',
            lat: 28.39,
            lng: 84.12,
            radius: 400
        });

        const nepalGeo = AdminData.getLocationGeo({ country: 'Nepal' });
        expect(nepalGeo).not.toBeNull();
        expect(nepalGeo.lat).toBe(28.39);
        expect(nepalGeo.radius).toBe(400);

        // Save new State
        AdminData.savePlaceGeo({
            country: 'Nepal',
            state: 'Bagmati',
            lat: 27.8,
            lng: 85.3,
            radius: 80
        });

        const bagmatiGeo = AdminData.getLocationGeo({ country: 'Nepal', state: 'Bagmati' });
        expect(bagmatiGeo).not.toBeNull();
        expect(bagmatiGeo.lat).toBe(27.8);
    });

    it('addNewCountry should create country, fetch states, and geocode', async () => {
        vi.spyOn(GeoServiceModule, 'lookupLocation').mockResolvedValue({
            lat: 28.39,
            lng: 84.12,
            radius: 400,
            displayName: 'Nepal',
            provider: 'nominatim'
        });
        vi.spyOn(GeoServiceModule, 'fetchStatesForCountry').mockResolvedValue([
            'Bagmati Province',
            'Gandaki Province'
        ]);

        const result = await AdminData.addNewCountry({
            country: 'Nepal',
            fetchStates: true,
            geocode: true
        });

        expect(result.country).toBe('Nepal');
        expect(result.geocoded).toBe(true);
        expect(result.statesCount).toBe(2);

        const nepal = AdminData.data.countries.Nepal;
        expect(nepal).toBeDefined();
        expect(nepal.lat).toBe(28.39);
        expect(nepal.states['Bagmati Province']).toBeDefined();
        expect(nepal.states['Gandaki Province']).toBeDefined();
    });

    it('addNewState should create state under existing country and geocode', async () => {
        vi.spyOn(GeoServiceModule, 'lookupLocation').mockResolvedValue({
            lat: 27.7,
            lng: 85.3,
            radius: 50,
            displayName: 'Kathmandu, Bagmati, Nepal',
            provider: 'nominatim'
        });

        const result = await AdminData.addNewState({
            country: 'India',
            state: 'Kerala',
            geocode: true
        });

        expect(result.country).toBe('India');
        expect(result.state).toBe('Kerala');
        expect(result.geocoded).toBe(true);

        const kerala = AdminData.data.countries.India.states['Kerala'];
        expect(kerala).toBeDefined();
        expect(kerala.lat).toBe(27.7);
    });

    it('addNewCountry with geocodeStates should geocode all states', async () => {
        vi.spyOn(GeoServiceModule, 'lookupLocation').mockImplementation(async ({ type, state }) => {
            if (type === 'country') return { lat: 36.5, lng: 139.2, radius: 2000, displayName: 'Japan', provider: 'nominatim' };
            if (type === 'state') return { lat: 35.1, lng: 137.2, radius: 50, displayName: `${state}, Japan`, provider: 'nominatim' };
            return null;
        });
        vi.spyOn(GeoServiceModule, 'fetchStatesForCountry').mockResolvedValue(['Aichi Prefecture', 'Tokyo']);

        const progressCalls = [];
        const result = await AdminData.addNewCountry({
            country: 'Japan',
            fetchStates: true,
            geocode: true,
            geocodeStates: true,
            onProgress: (cur, tot, name) => progressCalls.push({ cur, tot, name })
        });

        expect(result.country).toBe('Japan');
        expect(result.statesCount).toBe(2);
        expect(progressCalls.length).toBe(2);

        const aichi = AdminData.data.countries.Japan.states['Aichi Prefecture'];
        expect(aichi.lat).toBe(35.1);
        expect(aichi.lng).toBe(137.2);
    });

    it('savePlaceGeo should clamp place and city radii to valid limits', () => {
        // Test place radius clamp (max 20km)
        AdminData.savePlaceGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Kolkata',
            place: 'Rabindra Sarobar',
            lat: 22.51,
            lng: 88.36,
            radius: 192 // oversized
        });

        const place = AdminData.data.countries.India.states['West Bengal'].cities['Kolkata'].places['Rabindra Sarobar'];
        expect(place.radius).toBe(20);

        // Test city radius clamp (max 40km)
        AdminData.savePlaceGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Kolkata',
            lat: 22.57,
            lng: 88.36,
            radius: 999 // oversized
        });

        const city = AdminData.data.countries.India.states['West Bengal'].cities['Kolkata'];
        expect(city.radius).toBe(40);
    });

    it('backup should include places.json in storage uploads', () => {
        const uploadedPaths = [];
        const putMock = vi.fn(() => Promise.resolve());
        const refMock = vi.fn((path) => {
            uploadedPaths.push(path);
            return { put: putMock };
        });

        vi.spyOn(FirebaseApi, 'getFirebase').mockReturnValue({
            storage: () => ({ ref: refMock })
        });

        AdminData.backup();

        const hasPlaces = uploadedPaths.some(p => p.endsWith('places.json'));
        expect(hasPlaces).toBe(true);
    });

    it('getPlaceNode should retrieve existing node even if coordinates are missing', () => {
        AdminData.data.countries.Japan = {
            name: 'Japan',
            states: {
                Tokyo: { name: 'Tokyo', cities: {} }
            }
        };

        const countryNode = AdminData.getPlaceNode({ country: 'Japan' });
        expect(countryNode).not.toBeNull();
        expect(countryNode.name).toBe('Japan');

        const stateNode = AdminData.getPlaceNode({ country: 'Japan', state: 'Tokyo' });
        expect(stateNode).not.toBeNull();
        expect(stateNode.name).toBe('Tokyo');
        expect(stateNode.lat).toBeUndefined();

        const missingNode = AdminData.getPlaceNode({ country: 'Japan', state: 'Kyoto' });
        expect(missingNode).toBeNull();
    });

    it('re-geocoding should update existing location coordinates and radius', () => {
        // Initially West Bengal has lat 22.98, lng 87.85, radius 200
        const initial = AdminData.getLocationGeo({ country: 'India', state: 'West Bengal' });
        expect(initial.lat).toBe(22.98);

        // Re-geocode / update coordinates
        AdminData.savePlaceGeo({
            country: 'India',
            state: 'West Bengal',
            lat: 23.1234,
            lng: 88.5678,
            radius: 120
        });

        const updated = AdminData.getLocationGeo({ country: 'India', state: 'West Bengal' });
        expect(updated.lat).toBe(23.1234);
        expect(updated.lng).toBe(88.5678);
        expect(updated.radius).toBe(120);
    });

    it('getGeocodeCoverage should calculate real-time coverage statistics', () => {
        // India is geocoded, West Bengal is geocoded, Howrah is geocoded, Bally from sightings has no coords in places.json
        const coverage = AdminData.getGeocodeCoverage();

        expect(coverage.countries.total).toBe(1);
        expect(coverage.countries.geocoded).toBe(1);
        expect(coverage.states.total).toBe(1);
        expect(coverage.states.geocoded).toBe(1);
        expect(coverage.cities.total).toBe(1);
        expect(coverage.cities.geocoded).toBe(1);

        // Bally is in sightings but missing from places.json
        expect(coverage.places.missing).toContain('Bally, Howrah');
        expect(coverage.missingList.some(m => m.place === 'Bally')).toBe(true);

        // Now save Bally coordinates
        AdminData.savePlaceGeo({
            country: 'India',
            state: 'West Bengal',
            city: 'Howrah',
            place: 'Bally',
            lat: 22.65,
            lng: 88.34,
            radius: 5
        });

        // Check coverage again in real time
        const updatedCoverage = AdminData.getGeocodeCoverage();
        expect(updatedCoverage.places.geocoded).toBe(1);
        expect(updatedCoverage.missingList.length).toBe(0);
    });
});
