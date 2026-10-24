/**
 * Swappable Geocoding Service
 * 
 * Provides a unified interface for geocoding locations (lat, lng, radius).
 * Default provider: OpenStreetMap Nominatim
 * Easily swappable to Photon (Komoot), GeoNames, Google Maps, etc.
 */

/**
 * Calculate Haversine distance in kilometers between two lat/lng coordinates
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Compute approximate radius in km from a bounding box [minLat, maxLat, minLon, maxLon]
 * relative to the center coordinate [centerLat, centerLon]
 */
export function computeBoundingBoxRadius(centerLat, centerLon, minLat, maxLat, minLon, maxLon, defaultRadius = 5) {
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
        return defaultRadius;
    }
    const d1 = haversineDistanceKm(centerLat, centerLon, minLat, minLon);
    const d2 = haversineDistanceKm(centerLat, centerLon, maxLat, maxLon);
    const d3 = haversineDistanceKm(centerLat, centerLon, minLat, maxLon);
    const d4 = haversineDistanceKm(centerLat, centerLon, maxLat, minLon);
    const maxDistance = Math.max(d1, d2, d3, d4);
    return Math.max(1, Math.round(maxDistance));
}

// Maximum and minimum sensible radius caps in km per hierarchy level
export const GEO_RADIUS_CAPS = {
    place:   { min: 1,  max: 20,   default: 5 },
    city:    { min: 5,  max: 40,   default: 20 },
    state:   { min: 25, max: 200,  default: 150 },
    country: { min: 50, max: 1500, default: 1000 }
};

/**
 * Base Geo Provider class defining the contract
 */
export class BaseGeoProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * Lookup coordinates for a location
     * @param {Object} options
     * @param {string} [options.place] - Specific place or hotspot name
     * @param {string} [options.city] - City or district
     * @param {string} [options.state] - State or province
     * @param {string} [options.country] - Country name
     * @param {string} [options.type] - 'place' | 'city' | 'state' | 'country'
     * @returns {Promise<{lat: number, lng: number, radius: number, displayName: string, raw: Object}|null>}
     */
    async lookup(options) {
        throw new Error('Method lookup() must be implemented by provider');
    }
}

/**
 * OpenStreetMap Nominatim Provider (Default)
 * Free, no API key required.
 * Rate limit: max 1 request per second.
 */
export class NominatimProvider extends BaseGeoProvider {
    constructor(options = {}) {
        super('nominatim');
        this.baseUrl = options.baseUrl || 'https://nominatim.openstreetmap.org/search';
        this.lastRequestTime = 0;
        this.minDelayMs = options.minDelayMs || 1000; // 1 second rate limit compliance
    }

    async _enforceRateLimit() {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.minDelayMs) {
            await new Promise(resolve => setTimeout(resolve, this.minDelayMs - elapsed));
        }
        this.lastRequestTime = Date.now();
    }

    buildQueryString({ place, city, state, country, type }) {
        const parts = [];
        if (place && type === 'place') parts.push(place);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (country) parts.push(country);
        return parts.filter(Boolean).join(', ');
    }

    async lookup({ place, city, state, country, type = 'place' }) {
        await this._enforceRateLimit();

        const query = this.buildQueryString({ place, city, state, country, type });
        if (!query.trim()) return null;

        const params = new URLSearchParams({
            q: query,
            format: 'json',
            addressdetails: '1',
            limit: '1'
        });

        const url = `${this.baseUrl}?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Nominatim request failed with status: ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                // If specific place lookup with city failed, retry with just city + state + country if place was requested
                if (place && (city || state)) {
                    return await this.lookup({ place: '', city, state, country, type: 'city' });
                }
                return null;
            }

            const item = data[0];
            const lat = parseFloat(parseFloat(item.lat).toFixed(4));
            const lng = parseFloat(parseFloat(item.lon).toFixed(4));

            const caps = GEO_RADIUS_CAPS[type] || GEO_RADIUS_CAPS.place;
            const defaultRadius = caps.default;

            let radius = defaultRadius;
            if (Array.isArray(item.boundingbox) && item.boundingbox.length >= 4) {
                const minLat = parseFloat(item.boundingbox[0]);
                const maxLat = parseFloat(item.boundingbox[1]);
                const minLon = parseFloat(item.boundingbox[2]);
                const maxLon = parseFloat(item.boundingbox[3]);
                radius = computeBoundingBoxRadius(lat, lng, minLat, maxLat, minLon, maxLon, defaultRadius);
            }

            radius = Math.min(Math.max(radius, caps.min), caps.max);

            return {
                lat,
                lng,
                radius,
                displayName: item.display_name,
                provider: this.name,
                raw: item
            };
        } catch (err) {
            console.error('[NominatimProvider] Geocoding error:', err);
            return null;
        }
    }
}

/**
 * Photon (Komoot) Provider (Alternative)
 * Based on OpenStreetMap data, very fast, no strict 1 req/sec limit.
 */
export class PhotonProvider extends BaseGeoProvider {
    constructor(options = {}) {
        super('photon');
        this.baseUrl = options.baseUrl || 'https://photon.komoot.io/api';
    }

    buildQueryString({ place, city, state, country, type }) {
        const parts = [];
        if (place && type === 'place') parts.push(place);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (country) parts.push(country);
        return parts.filter(Boolean).join(', ');
    }

    async lookup({ place, city, state, country, type = 'place' }) {
        const query = this.buildQueryString({ place, city, state, country, type });
        if (!query.trim()) return null;

        const params = new URLSearchParams({
            q: query,
            limit: '1'
        });

        const url = `${this.baseUrl}/?${params.toString()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Photon request failed with status: ${response.status}`);
            }

            const data = await response.json();
            const features = data.features;
            if (!Array.isArray(features) || features.length === 0) {
                return null;
            }

            const feature = features[0];
            const coordinates = feature.geometry.coordinates; // [lon, lat]
            const lng = parseFloat(coordinates[0].toFixed(4));
            const lat = parseFloat(coordinates[1].toFixed(4));

            const caps = GEO_RADIUS_CAPS[type] || GEO_RADIUS_CAPS.place;
            const defaultRadius = caps.default;

            let radius = defaultRadius;
            if (Array.isArray(feature.properties.extent) && feature.properties.extent.length >= 4) {
                // extent format in Photon: [minLon, maxLat, maxLon, minLat]
                const [minLon, maxLat, maxLon, minLat] = feature.properties.extent;
                radius = computeBoundingBoxRadius(lat, lng, minLat, maxLat, minLon, maxLon, defaultRadius);
            }

            radius = Math.min(Math.max(radius, caps.min), caps.max);

            const displayName = [
                feature.properties.name,
                feature.properties.city,
                feature.properties.state,
                feature.properties.country
            ].filter(Boolean).join(', ');

            return {
                lat,
                lng,
                radius,
                displayName,
                provider: this.name,
                raw: feature
            };
        } catch (err) {
            console.error('[PhotonProvider] Geocoding error:', err);
            return null;
        }
    }
}

/**
 * Central Geocoding Service Manager
 * Allows switching providers seamlessly at runtime.
 */
export class GeoService {
    constructor() {
        this.providers = new Map();
        
        // Register default providers
        this.registerProvider(new NominatimProvider());
        this.registerProvider(new PhotonProvider());
        
        // Default to nominatim
        this.activeProviderName = 'nominatim';
    }

    registerProvider(provider) {
        if (!(provider instanceof BaseGeoProvider)) {
            throw new Error('Provider must extend BaseGeoProvider');
        }
        this.providers.set(provider.name, provider);
    }

    setProvider(name) {
        if (!this.providers.has(name)) {
            throw new Error(`Unknown geo provider: "${name}". Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        this.activeProviderName = name;
        console.log(`[GeoService] Switched active provider to: ${name}`);
    }

    getProvider(name) {
        if (name) return this.providers.get(name);
        return this.providers.get(this.activeProviderName);
    }

    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    getActiveProviderName() {
        return this.activeProviderName;
    }

    /**
     * Perform geocoding lookup using active provider
     */
    async lookup(options) {
        const provider = this.getProvider();
        if (!provider) throw new Error('No active geo provider configured');
        return await provider.lookup(options);
    }
}

// Global singleton instance
export const geoService = new GeoService();

/**
 * Convenience wrapper
 */
export async function lookupLocation(options) {
    return await geoService.lookup(options);
}

export function setGeoProvider(name) {
    geoService.setProvider(name);
}

/**
 * Fetch all states/provinces/territories for a country using CountriesNow API
 * @param {string} countryName
 * @returns {Promise<Array<string>>}
 */
export async function fetchStatesForCountry(countryName) {
    if (!countryName || !countryName.trim()) return [];
    try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: countryName.trim() })
        });
        if (!res.ok) {
            console.warn(`[GeoService] CountriesNow returned status ${res.status} for "${countryName}"`);
            return [];
        }
        const json = await res.json();
        if (json && json.data && Array.isArray(json.data.states)) {
            return json.data.states
                .map(s => (typeof s === 'string' ? s : s.name))
                .filter(Boolean);
        }
        return [];
    } catch (err) {
        console.warn(`[GeoService] Failed to fetch states for "${countryName}":`, err);
        return [];
    }
}
