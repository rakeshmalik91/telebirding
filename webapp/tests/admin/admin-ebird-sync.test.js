import { describe, expect, it } from 'vitest';
import { hasMatchingScientificName, hasMatchingTaxonIdentity, hasTaxonomyCodeConflict, resolveCurrentTaxonFromHistory } from '../../scripts/modules/admin/ebird-sync.js';

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

    it('fails closed when an exact old-name lookup is required but unavailable', () => {
        expect(hasMatchingTaxonIdentity(
            { name: 'Tawny Owl', latin_name: 'Ketupa flavipes' },
            { speciesCode: 'tafowl1', sciName: 'Ketupa flavipes' },
            undefined,
            true
        )).toBe(false);
        expect(hasMatchingTaxonIdentity(
            { name: 'Tawny Owl', latin_name: 'Ketupa flavipes' },
            { speciesCode: 'tafowl1', sciName: 'Ketupa flavipes' },
            'tawowl1',
            true
        )).toBe(false);
    });

    it('accepts an exact old-name lookup only when it resolves to the same eBird code', () => {
        expect(hasMatchingTaxonIdentity(
            { name: 'Tawny Owl', latin_name: 'Strix aluco' },
            { speciesCode: 'tawowl1', sciName: 'Strix aluco' },
            'tawowl1',
            true
        )).toBe(true);
    });

    it('blocks Tawny Owl from being renamed to Tawny Fish-Owl using the exact local-name code', () => {
        const taxonomyByCommonName = new Map([
            ['tawny owl', { speciesCode: 'tawowl1', comName: 'Tawny Owl', sciName: 'Strix aluco' }],
            ['tawny fish-owl', { speciesCode: 'tafowl1', comName: 'Tawny Fish-Owl', sciName: 'Ketupa flavipes' }]
        ]);
        const result = hasTaxonomyCodeConflict(
            { name: 'Tawny Owl', latin_name: 'Strix aluco' },
            { speciesCode: 'tafowl1', comName: 'Tawny Fish-Owl', sciName: 'Ketupa flavipes' },
            taxonomyByCommonName
        );
        expect(result.conflict).toBe(true);
        expect(result.localNameCode).toBe('tawowl1');
    });

    it('allows a scientific-name update when the existing common name maps to the same code', () => {
        const taxonomyByCommonName = new Map([
            ['demoiselle crane', { speciesCode: 'demcra1', comName: 'Demoiselle Crane', sciName: 'Grus virgo' }]
        ]);
        const result = hasTaxonomyCodeConflict(
            { name: 'Demoiselle Crane', latin_name: 'Anthropoides virgo' },
            { speciesCode: 'demcra1', comName: 'Demoiselle Crane', sciName: 'Grus virgo' },
            taxonomyByCommonName
        );
        expect(result.conflict).toBe(false);
        expect(result.scientificNameDiffers).toBe(true);
    });

    it('allows code-resolved legacy records when the local name has no conflicting taxonomy match', () => {
        const taxonomyByCommonName = new Map();
        const result = hasTaxonomyCodeConflict(
            { name: 'Blue Whistling-Thrush', latin_name: 'myiophoneus caeruleus' },
            { speciesCode: 'blwhtr1', comName: 'Blue Whistling-Thrush', sciName: 'Myophonus caeruleus' },
            taxonomyByCommonName
        );
        expect(result.conflict).toBe(false);
        expect(result.scientificNameDiffers).toBe(true);
    });

    it('maps historical taxa through reportAs to the current taxonomy', () => {
        const current = [
            { speciesCode: 'litswi1', comName: 'Little Swift', sciName: 'Apus affinis' }
        ];
        expect(resolveCurrentTaxonFromHistory(
            { speciesCode: 'houswi1', comName: 'House Swift', sciName: 'Apus nipalensis', reportAs: 'litswi1' },
            current
        )).toEqual(current[0]);
    });

    it('does not guess a current species when a historical taxon has no unique current match', () => {
        const current = [
            { speciesCode: 'speca1', comName: 'Species A', sciName: 'Genus alpha' },
            { speciesCode: 'specb1', comName: 'Species B', sciName: 'Genus beta' }
        ];
        expect(resolveCurrentTaxonFromHistory(
            { speciesCode: 'legacy1', comName: 'Legacy species', sciName: 'Genus gamma' },
            current
        )).toBeNull();
    });

    it('maps a historical taxon by scientific name only when the current match is unique', () => {
        const current = [
            { speciesCode: 'newcode1', comName: 'Renamed Bird', sciName: 'Genus species' }
        ];
        expect(resolveCurrentTaxonFromHistory(
            { speciesCode: 'oldcode1', comName: 'Old Bird', sciName: 'Genus species' },
            current
        )).toEqual(current[0]);
    });

    it('rejects ambiguous scientific-name crosswalks', () => {
        const current = [
            { speciesCode: 'newcode1', comName: 'Bird One', sciName: 'Genus species' },
            { speciesCode: 'newcode2', comName: 'Bird Two', sciName: 'Genus species' }
        ];
        expect(resolveCurrentTaxonFromHistory(
            { speciesCode: 'oldcode1', comName: 'Old Bird', sciName: 'Genus species' },
            current
        )).toBeNull();
    });

    it('rejects records when either scientific name is missing', () => {
        expect(hasMatchingScientificName({ latin_name: '' }, { sciName: 'Strix aluco' })).toBe(false);
        expect(hasMatchingScientificName({ latin_name: 'Strix aluco' }, {})).toBe(false);
    });
});
