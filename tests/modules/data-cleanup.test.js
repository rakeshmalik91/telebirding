import { describe, it, expect } from 'vitest';
import { removeUnwantedValues, toSingular, applySpeciesTags } from '../../scripts/modules/admin/data-cleanup.js';

// ========================================================================
// removeUnwantedValues
// ========================================================================
describe('removeUnwantedValues', () => {

    // --- Primitives ---
    it('should strip null', () => {
        expect(removeUnwantedValues(null)).toBeUndefined();
    });

    it('should strip undefined', () => {
        expect(removeUnwantedValues(undefined)).toBeUndefined();
    });

    it('should strip false', () => {
        expect(removeUnwantedValues(false)).toBeUndefined();
    });

    it('should strip empty string', () => {
        expect(removeUnwantedValues('')).toBeUndefined();
    });

    it('should preserve true', () => {
        expect(removeUnwantedValues(true)).toBe(true);
    });

    it('should preserve non-empty string', () => {
        expect(removeUnwantedValues('hello')).toBe('hello');
    });

    it('should preserve numbers (including 0)', () => {
        expect(removeUnwantedValues(0)).toBe(0);
        expect(removeUnwantedValues(42)).toBe(42);
        expect(removeUnwantedValues(-1)).toBe(-1);
    });

    // --- Arrays ---
    it('should strip empty array', () => {
        expect(removeUnwantedValues([])).toBeUndefined();
    });

    it('should remove unwanted items from arrays', () => {
        expect(removeUnwantedValues([1, null, '', false, 'a'])).toEqual([1, 'a']);
    });

    it('should return undefined for array that becomes empty after cleaning', () => {
        expect(removeUnwantedValues([null, '', false])).toBeUndefined();
    });

    it('should recursively clean nested arrays', () => {
        expect(removeUnwantedValues([1, [null, '', 2], []])).toEqual([1, [2]]);
    });

    // --- Objects ---
    it('should strip empty object', () => {
        expect(removeUnwantedValues({})).toBeUndefined();
    });

    it('should remove keys with unwanted values from objects', () => {
        const input = { a: 1, b: null, c: '', d: false, e: 'hi' };
        expect(removeUnwantedValues(input)).toEqual({ a: 1, e: 'hi' });
    });

    it('should return undefined for object that becomes empty after cleaning', () => {
        expect(removeUnwantedValues({ a: null, b: '' })).toBeUndefined();
    });

    it('should recursively clean nested objects', () => {
        const input = {
            a: { x: null, y: 'keep' },
            b: { z: '' },
            c: 'ok'
        };
        expect(removeUnwantedValues(input)).toEqual({
            a: { y: 'keep' },
            c: 'ok'
        });
    });

    // --- Mixed deep nesting ---
    it('should handle deeply nested mixed structures', () => {
        const input = {
            species: {
                'rock-pigeon': {
                    name: 'Rock Pigeon',
                    tags: ['Dove', 'Pigeon'],
                    latin_name: null,
                    ebird_code: '',
                    extra: { nested: false, val: [] }
                },
                'empty-bird': {
                    name: '',
                    tags: [],
                    latin_name: null
                }
            }
        };
        expect(removeUnwantedValues(input)).toEqual({
            species: {
                'rock-pigeon': {
                    name: 'Rock Pigeon',
                    tags: ['Dove', 'Pigeon']
                }
                // 'empty-bird' is gone (all values were unwanted)
            }
        });
    });

    // --- Sightings array with null/empty fields ---
    it('should clean a sightings-like array, removing empty media and null fields', () => {
        const input = {
            sightings: [
                {
                    key: 's1',
                    species: 'sp1',
                    date: '01-01-2024',
                    weather: null,
                    hidden: false,
                    media: []
                },
                {
                    key: 's2',
                    species: 'sp2',
                    date: '02-01-2024',
                    weather: 'sunny',
                    media: [{ src: 'img.jpg' }]
                }
            ]
        };
        const result = removeUnwantedValues(input);
        // s1: weather (null), hidden (false), media ([]) all removed
        expect(result.sightings[0]).toEqual({
            key: 's1',
            species: 'sp1',
            date: '01-01-2024'
        });
        // s2 keeps weather and media
        expect(result.sightings[1]).toEqual({
            key: 's2',
            species: 'sp2',
            date: '02-01-2024',
            weather: 'sunny',
            media: [{ src: 'img.jpg' }]
        });
    });
});

// ========================================================================
// toSingular
// ========================================================================
describe('toSingular', () => {

    // --- Standard plurals ---
    it('should remove trailing s', () => {
        expect(toSingular('Ducks')).toBe('Duck');
        expect(toSingular('Eagles')).toBe('Eagle');
    });

    it('should convert -ies to -y', () => {
        expect(toSingular('Canaries')).toBe('Canary');
        expect(toSingular('Hobbies')).toBe('Hobby');
        expect(toSingular('flies')).toBe('fly');
        expect(toSingular('canaries')).toBe('canary');
    });

    it('should change all-uppercase words correctly', () => {
        expect(toSingular('CANARIES')).toBe('CANARY');
    });

    it('should convert title case -ies to -y', () => {
        expect(toSingular('Berries')).toBe('Berry');
    });

    it('should not change words ending in ss', () => {
        expect(toSingular('Albatross')).toBe('Albatross');
        expect(toSingular('Grass')).toBe('Grass');
    });

    // --- Exceptions ---
    it('should not change exception words', () => {
        expect(toSingular('ibis')).toBe('ibis');
        expect(toSingular('Ibis')).toBe('Ibis'); // case-insensitive lookup
        expect(toSingular('albatross')).toBe('albatross');
        expect(toSingular('erpornis')).toBe('erpornis');
        expect(toSingular('lens')).toBe('lens');
        expect(toSingular('analysis')).toBe('analysis');
    });

    // --- Already singular ---
    it('should not change already singular words', () => {
        expect(toSingular('Eagle')).toBe('Eagle');
        expect(toSingular('Owl')).toBe('Owl');
        expect(toSingular('Hawk')).toBe('Hawk');
    });

    // --- Short words ending in -ies ---
    it('should handle short words ending in ies (length <= 3) by not applying -ies rule', () => {
        // 'ies' itself is length 3 — should fall to the trailing-s rule instead
        expect(toSingular('ies')).toBe('ie');
    });
});

// ========================================================================
// applySpeciesTags
// ========================================================================
describe('applySpeciesTags', () => {

    it('should add Raptor and Bird of Prey tags to eagles', () => {
        const species = {
            'crested-serpent-eagle': { name: 'Crested Serpent Eagle', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['crested-serpent-eagle'].tags).toContain('Raptor');
        expect(species['crested-serpent-eagle'].tags).toContain('Bird of Prey');
    });

    it('should add Accipiter tag to hawks', () => {
        const species = {
            'sparrowhawk': { name: 'Eurasian Sparrowhawk', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['sparrowhawk'].tags).toContain('Accipiter');
        expect(species['sparrowhawk'].tags).toContain('Raptor');
    });

    it('should add Scavenger tag to vultures', () => {
        const species = {
            'king-vulture': { name: 'King Vulture', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['king-vulture'].tags).toContain('Scavenger');
        expect(species['king-vulture'].tags).toContain('Raptor');
    });

    it('should add Nocturnal tag to owls', () => {
        const species = {
            'barn-owl': { name: 'Barn Owl', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['barn-owl'].tags).toContain('Nocturnal');
        expect(species['barn-owl'].tags).toContain('Raptor');
    });

    it('should add Wader/Water Bird/Shorebird tags to ducks (case-insensitive)', () => {
        const species = {
            'mallard-duck': { name: 'Mallard Duck', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['mallard-duck'].tags).toContain('Wader');
        expect(species['mallard-duck'].tags).toContain('Wading Bird');
        expect(species['mallard-duck'].tags).toContain('Water Bird');
        expect(species['mallard-duck'].tags).toContain('Shorebird');
    });

    it('should add Seabird and Pelagic tags to gulls', () => {
        const species = {
            'herring-gull': { name: 'Herring Gull', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['herring-gull'].tags).toContain('Seabird');
        expect(species['herring-gull'].tags).toContain('Pelagic');
    });

    it('should add Dove and Pigeon tags to doves (case-insensitive)', () => {
        const species = {
            'rock-pigeon': { name: 'Rock Pigeon', tags: [] }
        };
        applySpeciesTags(species);
        expect(species['rock-pigeon'].tags).toContain('Dove');
        expect(species['rock-pigeon'].tags).toContain('Pigeon');
    });

    it('should singularize existing tags', () => {
        const species = {
            'robin': { name: 'Robin', tags: ['Songbirds', 'Passerines'] }
        };
        applySpeciesTags(species);
        expect(species['robin'].tags).toContain('Songbird');
        expect(species['robin'].tags).toContain('Passerine');
        expect(species['robin'].tags).not.toContain('Songbirds');
    });

    it('should sort tags alphabetically', () => {
        const species = {
            'barn-owl': { name: 'Barn Owl', tags: ['Zoo'] }
        };
        applySpeciesTags(species);
        const tags = species['barn-owl'].tags;
        const sorted = [...tags].sort();
        expect(tags).toEqual(sorted);
    });

    it('should initialize tags array if missing', () => {
        const species = {
            'robin': { name: 'Robin' }
        };
        applySpeciesTags(species);
        expect(Array.isArray(species['robin'].tags)).toBe(true);
    });

    it('should not add tags to species with no matching keywords', () => {
        const species = {
            'robin': { name: 'Robin', tags: [] }
        };
        applySpeciesTags(species);
        // Robin matches no keyword categories, so tags should remain empty
        expect(species['robin'].tags).toEqual([]);
    });

    it('should handle multiple species at once', () => {
        const species = {
            'barn-owl': { name: 'Barn Owl', tags: [] },
            'rock-pigeon': { name: 'Rock Pigeon', tags: [] },
            'robin': { name: 'Robin', tags: ['Garden'] }
        };
        applySpeciesTags(species);

        expect(species['barn-owl'].tags).toContain('Nocturnal');
        expect(species['rock-pigeon'].tags).toContain('Pigeon');
        expect(species['robin'].tags).toContain('Garden');
        expect(species['robin'].tags).not.toContain('Raptor');
    });

    it('should not duplicate tags that already exist', () => {
        const species = {
            'barn-owl': { name: 'Barn Owl', tags: ['Raptor', 'Nocturnal'] }
        };
        applySpeciesTags(species);
        const raptorCount = species['barn-owl'].tags.filter(t => t === 'Raptor').length;
        expect(raptorCount).toBe(1);
    });

    it('should handle empty name gracefully', () => {
        const species = {
            'unknown': { name: '', tags: ['Rare'] }
        };
        applySpeciesTags(species);
        expect(species['unknown'].tags).toContain('Rare');
    });

    it('should singularize auto-added plural tags', () => {
        // "Wading Bird" is singular already, but "Waders" would become "Wader"
        const species = {
            'duck': { name: 'Mallard Duck', tags: ['Waders'] }
        };
        applySpeciesTags(species);
        expect(species['duck'].tags).toContain('Wader');
        // Should not have both 'Wader' and 'Waders'
        expect(species['duck'].tags).not.toContain('Waders');
    });
});
