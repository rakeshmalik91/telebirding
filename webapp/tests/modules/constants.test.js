import { describe, it, expect } from 'vitest';
import Constants from '../../scripts/modules/constants.js';

describe('Constants', () => {
    it('should have all required modes', () => {
        expect(Constants.MODE_BIRD).toBe('bird');
        expect(Constants.MODE_INSECT).toBe('insect');
        expect(Constants.DEFAULT_MODE).toBe('bird');
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
