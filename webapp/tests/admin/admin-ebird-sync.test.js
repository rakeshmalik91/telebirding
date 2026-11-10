import { describe, expect, it } from 'vitest';
import { hasMatchingScientificName, hasMatchingTaxonIdentity } from '../../scripts/modules/admin/ebird-sync.js';

describe('eBird taxonomy identity validation', () => {
    it('accepts the same scientific name regardless of case and whitespace', () => {
        expect(hasMatchingScientificName(
            { latin_name: '  Strix   aluco ' },
            { sciName: 'strix aluco' }
        )).toBe(true);
    });

    it('rejects different species even when common names are similar', () => {
        expect(hasMatchingScientificName(
            { name: 'Tawny Owl', latin_name: 'Strix aluco' },
            { comName: 'Tawny Fish-Owl', sciName: 'Ketupa flavipes' }
        )).toBe(false);
    });

    it('blocks a local common name that resolves to a different eBird code', () => {
        expect(hasMatchingTaxonIdentity(
            { name: 'Tawny Owl', latin_name: 'Strix aluco' },
            { speciesCode: 'tafowl1', comName: 'Tawny Fish-Owl', sciName: 'Ketupa flavipes' },
            'tawowl1'
        )).toBe(false);
    });

    it('allows scientific-name changes when the existing common name resolves to the same code', () => {
        expect(hasMatchingTaxonIdentity(
            { name: 'Demoiselle Crane', latin_name: 'Anthropoides virgo' },
            { speciesCode: 'demcra1', comName: 'Demoiselle Crane', sciName: 'Grus virgo' },
            undefined
        )).toBe(false);
        expect(hasMatchingTaxonIdentity(
            { name: 'Demoiselle Crane', latin_name: 'Anthropoides virgo' },
            { speciesCode: 'demcra1', comName: 'Demoiselle Crane', sciName: 'Grus virgo' },
            'demcra1'
        )).toBe(true);
    });

    it('rejects records when either scientific name is missing', () => {
        expect(hasMatchingScientificName({ latin_name: '' }, { sciName: 'Strix aluco' })).toBe(false);
        expect(hasMatchingScientificName({ latin_name: 'Strix aluco' }, {})).toBe(false);
    });
});
