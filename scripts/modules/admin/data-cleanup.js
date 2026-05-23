/**
 * Data Cleanup Utilities
 * Ported from utils/data-cleanup.py for client-side use before uploading JSON from admin.
 *
 * Provides:
 *  - removeUnwantedValues: strips null, false, empty arrays/strings/objects recursively
 *  - toSingular: naive word singularization with an exceptions list
 *  - applySpeciesTags: auto-tags species based on name keywords and singularizes all tags
 */

const SINGULAR_EXCEPTIONS = new Set([
    'ibis', 'lens', 'analysis', 'albatross', 'erpornis'
]);

/**
 * Recursively remove null, false, empty array, empty string, and empty object values.
 * @param {*} d - The value to clean.
 * @returns {*} The cleaned value, or undefined if the value itself is unwanted.
 */
export function removeUnwantedValues(d) {
    if (d === null || d === undefined) return undefined;
    if (typeof d === 'boolean' && d === false) return undefined;
    if (typeof d === 'string' && d === '') return undefined;

    if (Array.isArray(d)) {
        const cleaned = d
            .map(v => removeUnwantedValues(v))
            .filter(v => v !== undefined);
        return cleaned.length === 0 ? undefined : cleaned;
    }

    if (typeof d === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(d)) {
            const val = removeUnwantedValues(v);
            if (val !== undefined) {
                cleaned[k] = val;
            }
        }
        return Object.keys(cleaned).length === 0 ? undefined : cleaned;
    }

    return d;
}

/**
 * Naively singularize a word, with an exceptions list.
 * @param {string} word
 * @returns {string}
 */
export function toSingular(word) {
    if (SINGULAR_EXCEPTIONS.has(word.toLowerCase())) return word;

    // Words ending in 'ies' -> 'y' (e.g. Canaries -> Canary)
    if (word.endsWith('ies') && word.length > 3) {
        if (word === word.toUpperCase()) return word.slice(0, -3) + 'Y';
        if (word[0] === word[0].toUpperCase()) return word.slice(0, -3) + 'y';
        return word.slice(0, -3) + 'y';
    }

    // Words ending in 's' (but not 'ss') -> remove 's'
    if (word.endsWith('s') && !word.endsWith('ss')) {
        return word.slice(0, -1);
    }

    return word;
}

/**
 * Auto-apply tags to species based on name keywords and singularize all tags.
 * Modifies species in-place.
 * @param {Object} speciesMap - The species map { key: { name, tags, ... } }
 */
const TAG_RULES = [
    {
        keywords: ['Eagle', 'Hawk', 'Falcon', 'Hobby', 'Kite', 'Kestrel', 'Merlin', 'Sparrowhawk', 'Shikra', 'Besra', 'Harrier', 'Buzzard', 'Osprey', 'Vulture', 'Eagle-Owl', 'Owl', 'Frogmouth', 'Nightjar'],
        tags: ['Raptor', 'Bird of Prey']
    },
    {
        keywords: ['Falcon', 'Hawk', 'Hobby', 'Kestrel', 'Merlin', 'Sparrowhawk', 'Shikra', 'Besra'],
        tags: ['Accipiter']
    },
    {
        keywords: ['Vulture'],
        tags: ['Scavenger']
    },
    {
        keywords: ['Owl', 'Frogmouth', 'Nightjar'],
        tags: ['Nocturnal']
    },
    {
        keywords: ['Sandpiper', 'Plover', 'Duck', 'Waterfowl', 'Goose'],
        tags: ['Wader', 'Wading Bird', 'Water Bird', 'Shorebird']
    },
    {
        keywords: ['Gull', 'Gannet', 'Tern', 'Skua', 'Petrel', 'Shearwater', 'Albatross', 'Storm-petrel', 'Storm Petrel', 'Kittiwake'],
        tags: ['Seabird', 'Pelagic']
    },
    {
        keywords: ['Dove', 'Pigeon'],
        tags: ['Dove', 'Pigeon']
    }
];

/**
 * Auto-apply tags to species based on name keywords and singularize all tags.
 * Modifies species in-place.
 * @param {Object} speciesMap - The species map { key: { name, tags, ... } }
 */
export function applySpeciesTags(speciesMap) {
    for (const bird of Object.values(speciesMap)) {
        const name = bird.name || '';
        if (!bird.tags) bird.tags = [];

        const existingTags = new Set(bird.tags);
        const tagsToAdd = new Set();

        for (const rule of TAG_RULES) {
            const hasMatch = rule.keywords.some(kw => 
                name.toLowerCase().includes(kw.toLowerCase())
            );
            if (hasMatch) {
                for (const tag of rule.tags) {
                    tagsToAdd.add(tag);
                }
            }
        }

        // Merge and singularize all tags
        const allTags = new Set([...existingTags, ...tagsToAdd]);
        const finalTags = new Set();
        for (const tag of allTags) {
            finalTags.add(toSingular(tag));
        }

        bird.tags = [...finalTags].sort();
    }
}
