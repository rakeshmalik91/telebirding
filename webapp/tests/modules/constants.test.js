import { describe, it, expect } from 'vitest';
import Constants from '../../scripts/modules/constants.js';

describe('Constants', () => {
    it('should have all required modes', () => {
        expect(Constants.MODE_BIRD).toBe('bird');
        expect(Constants.MODE_INSECT).toBe('insect');
        expect(Constants.MODE_REPTILE).toBe('reptile');
        expect(Constants.DEFAULT_MODE).toBe('bird');
        expect(Constants.MODES).toEqual(['bird', 'insect', 'reptile']);
    });

    it('should provide default species per mode', () => {
        expect(Constants.getDefaultSpecies(Constants.MODE_BIRD)).toBe('');
        expect(Constants.getDefaultSpecies(Constants.MODE_INSECT)).toBe('');
        expect(Constants.getDefaultSpecies(Constants.MODE_REPTILE)).toBe('unidentified-lizard');
    });

    it('should use the same site logo for all modes', () => {
        Constants.MODES.forEach(mode => {
            expect(Constants.MODE[mode].logo).toBe('icons/telebirding-logo.png');
        });
    });

    it('should normalize mode aliases correctly', () => {
        expect(Constants.normalizeMode('reptile')).toBe('reptile');
        expect(Constants.normalizeMode('reptiles')).toBe('reptile');
        expect(Constants.normalizeMode('reptiles_amphibians')).toBe('reptile');
        expect(Constants.normalizeMode('insect')).toBe('insect');
        expect(Constants.normalizeMode('insects')).toBe('insect');
        expect(Constants.normalizeMode('bird')).toBe('bird');
        expect(Constants.normalizeMode('birds')).toBe('bird');
        expect(Constants.normalizeMode('unknown')).toBe('bird');
    });

    it('should have correct URL for eBird', () => {
        expect(Constants.EBIRD_SPECIES_BASE_URL).toContain('ebird.org');
    });

    it('should have valid date formats', () => {
        expect(Constants.DATA_DATE_FORMAT).toBe('DD-MM-yyyy');
        expect(Constants.DISPLAY_DATE_FORMAT).toBe('D MMM, YYYY');
    });

    it('should have expected location shortening rules', () => {
        expect(Constants.LOCATION_SHORTEN_LIST).toBeInstanceOf(Array);
        expect(Constants.LOCATION_SHORTEN_BLOCK_LIST).toContain('Isl.');
        expect(Constants.LOCATION_SHORTEN_BLOCK_LIST).toContain('Zoo');
    });

    it('should have tag normalize replacement mapping', () => {
        expect(Constants.TAG_NORMALIZE_REPLACE_MAPPING).toHaveProperty('gray', 'grey');
        expect(Constants.TAG_NORMALIZE_REPLACE_MAPPING).toHaveProperty('-', ' ');
    });
});
