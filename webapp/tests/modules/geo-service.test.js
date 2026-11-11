import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    haversineDistanceKm,
    computeBoundingBoxRadius,
    NominatimProvider,
    PhotonProvider,
    GeoService,
    geoService,
    lookupLocation,
    setGeoProvider,
    fetchStatesForCountry
} from '../../scripts/modules/geo-service.js';

describe('GeoService & Providers', () => {
    it('haversineDistanceKm should calculate distance accurately', () => {
        // Distance between Mumbai (19.0760, 72.8777) and Pune (18.5204, 73.8567) is ~120 km
        const dist = haversineDistanceKm(19.0760, 72.8777, 18.5204, 73.8567);
        expect(dist).toBeGreaterThan(110);
        expect(dist).toBeLessThan(135);
    });

    it('computeBoundingBoxRadius should calculate bounding box radius', () => {
        const radius = computeBoundingBoxRadius(18.52, 73.85, 18.41, 18.63, 73.73, 73.98, 5);
        expect(radius).toBeGreaterThan(5);
        expect(radius).toBeLessThan(30);
    });

    it('NominatimProvider should build query correctly', () => {
        const provider = new NominatimProvider();
        const q = provider.buildQueryString({
            place: 'Bally',
            city: 'Howrah',
            state: 'West Bengal',
            country: 'India',
            type: 'place'
        });
        expect(q).toBe('Bally, Howrah, West Bengal, India');

        const qCity = provider.buildQueryString({
            city: 'Howrah',
            state: 'West Bengal',
            country: 'India',
            type: 'city'
        });
        expect(qCity).toBe('Howrah, West Bengal, India');
    });

    it('NominatimProvider should parse API response and compute radius', async () => {
        const provider = new NominatimProvider({ minDelayMs: 0 });
        
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [{
                lat: "18.5204",
                lon: "73.8567",
                boundingbox: ["18.41", "18.63", "73.73", "73.98"],
                display_name: "Pune, Maharashtra, India"
            }]
        });

        const result = await provider.lookup({
            city: 'Pune',
            state: 'Maharashtra',
            country: 'India',
            type: 'city'
        });

        expect(result).not.toBeNull();
        expect(result.lat).toBe(18.5204);
        expect(result.lng).toBe(73.8567);
        expect(result.radius).toBeGreaterThan(5);
        expect(result.displayName).toBe("Pune, Maharashtra, India");
        expect(result.provider).toBe("nominatim");
    });

    it('GeoService should allow swapping providers easily', async () => {
        const service = new GeoService();
        expect(service.getActiveProviderName()).toBe('nominatim');
        expect(service.getAvailableProviders()).toContain('nominatim');
        expect(service.getAvailableProviders()).toContain('photon');

        service.setProvider('photon');
        expect(service.getActiveProviderName()).toBe('photon');

        expect(() => service.setProvider('unknown-provider')).toThrow();
    });

    it('fetchStatesForCountry should fetch and parse state list from CountriesNow', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    states: [
                        { name: 'Western Region', state_code: '3' },
                        { name: 'Capital Region', state_code: '1' }
                    ]
                }
            })
        });

        const states = await fetchStatesForCountry('Iceland');
        expect(states).toEqual(['Western Region', 'Capital Region']);
    });
});
