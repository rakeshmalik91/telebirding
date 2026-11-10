import { data, currentMode, uploadJSONData, triggerRender } from './data.js';
import Constants from '../constants.js';
import EbirdApi from '../ebird-api.js';

const API_URL = 'https://api.ebird.org/v2/ref/taxonomy/ebird';
const BATCH_SIZE = 25;
let proposedChanges = [];
let proposedWarnings = [];
let selectionState = new Map();


const normalizeTaxonName = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function hasMatchingScientificName(localSpecies, ebirdSpecies) {
    const localName = normalizeTaxonName(localSpecies?.latin_name || localSpecies?.sci_name);
    const ebirdName = normalizeTaxonName(ebirdSpecies?.sciName);
    return Boolean(localName && ebirdName && localName === ebirdName);
}

// Prefer resolving the existing common name through eBird. This catches an
// incorrect stored code (e.g. Tawny Owl -> tafowl1), while allowing scientific
// name/genus changes when the old common name still resolves to the same code.
export function hasMatchingTaxonIdentity(localSpecies, ebirdSpecies, localNameCode, nameLookupRequired = false) {
    // When either the common name or scientific name changes, require eBird to
    // resolve the existing local common name to this exact stored species code.
    // Never fall back to matching scientific strings in this situation.
    if (nameLookupRequired) return Boolean(localNameCode && localNameCode === ebirdSpecies?.speciesCode);
    return hasMatchingScientificName(localSpecies, ebirdSpecies);
}

export function hasTaxonomyCodeConflict(localSpecies, ebirdSpecies, taxonomyByCommonName) {
    const localName = normalizeTaxonName(localSpecies?.name);
    const localNameTaxon = taxonomyByCommonName.get(localName);
    const localNameCode = localNameTaxon?.speciesCode;
    const codeConflict = Boolean(localNameCode && localNameCode !== ebirdSpecies?.speciesCode);
    const scientificNameDiffers =
        normalizeTaxonName(localSpecies?.latin_name || localSpecies?.sci_name) !== normalizeTaxonName(ebirdSpecies?.sciName);
    const identityUnverified = !localNameCode && scientificNameDiffers;
    return { conflict: codeConflict || identityUnverified, localNameTaxon, localNameCode, scientificNameDiffers };
}

function ebirdSpeciesLink(code, label = 'View on eBird') {
    if (!code || !/^[a-z0-9]+$/i.test(String(code))) return '';
    const url = `https://ebird.org/species/${encodeURIComponent(code)}`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

async function fetchTaxonomy() {
    const url = new URL(API_URL);
    url.searchParams.set('cat', 'species');
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('locale', 'en');
    // eBird API v2 requires the account API key. The previous implementation
    // omitted it on this endpoint, so the taxonomy scan could be incomplete or
    // fail depending on the API gateway/account.
    url.searchParams.set('key', EbirdApi.apiKey);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`eBird returned HTTP ${response.status}`);
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error('eBird returned an unexpected taxonomy response.');
    return records;
}

function renderChanges() {
    const $results = $('#ebird-sync-results');
    if (!proposedChanges.length && !proposedWarnings.length) {
        $results.html('<p>No changes found. Local species and family names are up to date.</p>');
        $('#ebird-sync-apply, #ebird-sync-select-all').prop('disabled', true);
        return;
    }
    const warnings = proposedWarnings.length
        ? `<section class=\"ebird-sync-warnings\" style=\"margin:10px 0;padding:10px;border:1px solid #d99b35;border-radius:6px;\"><strong>Needs review — not selectable</strong><p>These records need review because the existing local name does not resolve to the same eBird species code, or its scientific identity conflicts.</p>${proposedWarnings.map(warning => `<div style=\"padding:8px 0;border-top:1px solid var(--border-color,#ddd);\"><strong>${escapeHtml(warning.title)}</strong><div>${escapeHtml(warning.message)}</div><div style="margin-top:4px;">${warning.localEbirdCode ? `Local-name match: ${ebirdSpeciesLink(warning.localEbirdCode, `eBird ${warning.localEbirdCode}`)}` : ''}${warning.localEbirdCode && warning.ebirdCode ? ' · ' : ''}${warning.ebirdCode ? `Stored-code listing: ${ebirdSpeciesLink(warning.ebirdCode, `eBird ${warning.ebirdCode}`)}` : ''}</div></div>`).join('')}</section>`
        : '';
    if (!proposedChanges.length) {
        $results.html(`${warnings}<p>No safe changes found.</p>`);
        $('#ebird-sync-apply, #ebird-sync-select-all').prop('disabled', true);
        return;
    }
    const rows = proposedChanges.map((change, index) => {
        const details = change.details.map(line => `<div>${escapeHtml(line)}</div>`).join('');
        return `<label class="ebird-sync-change" style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-bottom:1px solid var(--border-color,#ddd);">
            <input type="checkbox" class="ebird-sync-checkbox" data-index="${index}" ${selectionState.get(change.id) !== false ? 'checked' : ''}>
            <span><strong>${escapeHtml(change.title)}</strong>${details}${change.ebirdCode ? `<div style="margin-top:4px;">${ebirdSpeciesLink(change.ebirdCode, `Verify on eBird (${change.ebirdCode})`)}</div>` : ''}</span>
        </label>`;
    }).join('');
    $results.html(`${warnings}<div style="margin:10px 0;"><strong>${proposedChanges.length} proposed change(s)</strong></div>${rows}`);
    $('#ebird-sync-apply, #ebird-sync-select-all').prop('disabled', false);
    $('#ebird-sync-select-all').text('Deselect All');
}

export function setupEbirdSync() {
    if (currentMode !== Constants.MODE_BIRD) {
        $('#ebird-sync-card').hide();
        return;
    }
    $('#ebird-sync-card').show();
    $('#ebird-sync-fetch').off('click').on('click', async function () {
        const $button = $(this);
        $button.prop('disabled', true);
        $('#ebird-sync-apply, #ebird-sync-select-all').prop('disabled', true);
        proposedChanges = [];
        proposedWarnings = [];
        selectionState = new Map();
        $('#ebird-sync-results').empty();
        const species = data.species || {};
        const codeToKeys = {};
        Object.entries(species).forEach(([key, item]) => {
            if (item.ebird_code) (codeToKeys[item.ebird_code] ||= []).push(key);
        });
        const codes = Object.keys(codeToKeys);
        if (!codes.length) {
            $('#ebird-sync-progress').text('No species with eBird codes were found.');
            $button.prop('disabled', false);
            return;
        }
        const changesByKey = new Map();
        const familyByName = new Map((data.families || []).map(f => [f.name, f]));
        try {
            $('#ebird-sync-progress').text('Fetching the current eBird species taxonomy…');
            const taxonomy = await fetchTaxonomy();
            const byCode = new Map(taxonomy.map(item => [item.speciesCode, item]));
            const byCommonName = new Map(taxonomy.map(item => [normalizeTaxonName(item.comName), item]));
            const totalBatches = Math.ceil(codes.length / BATCH_SIZE);
            for (let start = 0; start < codes.length; start += BATCH_SIZE) {
                const batch = codes.slice(start, start + BATCH_SIZE);
                const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
                $('#ebird-sync-progress').text(`Comparing eBird taxonomy: batch ${batchNumber} of ${totalBatches} (${Math.min(start + batch.length, codes.length)} of ${codes.length} species codes checked)…`);

                for (const code of batch) {
                    const item = byCode.get(code);
                    if (!item) {
                        for (const key of codeToKeys[code] || []) {
                            const local = species[key];
                            proposedWarnings.push({
                                id: `missing:${key}:${code}`,
                                title: local.name || key,
                                ebirdCode: code,
                                message: `Stored eBird code ${code} was not found in the current eBird taxonomy. No changes will be proposed.`
                            });
                        }
                        continue;
                    }

                    const verifiedKeys = [];
                    for (const key of codeToKeys[code] || []) {
                        const local = species[key];
                        const { conflict, localNameTaxon, localNameCode, scientificNameDiffers } =
                            hasTaxonomyCodeConflict(local, item, byCommonName);

                        // A conflicting exact common-name match is conclusive: the
                        // stored code belongs to another species. If the common name
                        // is no longer in today's taxonomy, only accept the record
                        // when its scientific name still matches exactly.
                        if (conflict) {
                            proposedWarnings.push({
                                id: `mismatch:${key}:${code}`,
                                title: local.name || key,
                                ebirdCode: code,
                                localEbirdCode: localNameCode,
                                message: `Stored eBird code ${code} resolves to ${item.comName} (${item.sciName}); local name “${local.name || ''}”${local.latin_name || local.sci_name ? ` has scientific name “${local.latin_name || local.sci_name}”` : ''}${localNameCode ? ` and independently resolves to code ${localNameCode} (${localNameTaxon.comName}, ${localNameTaxon.sciName})` : ', but its identity could not be confirmed from the current eBird taxonomy'}. No changes will be proposed for this record.`
                            });
                            continue;
                        }

                        verifiedKeys.push(key);
                        const details = [];
                        const updates = {};
                        if (item.comName && local.name !== item.comName) {
                            details.push(`Species name: “${local.name || ''}” → “${item.comName}”`);
                            updates.name = item.comName;
                        }
                        if (scientificNameDiffers) {
                            details.push(`Scientific name: “${local.latin_name || local.sci_name || 'missing'}” → “${item.sciName}”`);
                            updates.latin_name = item.sciName.toLowerCase();
                        }
                        if (item.familyComName && local.family !== item.familyComName) {
                            details.push(`Family: “${local.family || ''}” → “${item.familyComName}”`);
                            updates.family = item.familyComName;
                        }
                        if (details.length) changesByKey.set(`species:${key}`, {
                            id: `species:${key}`, type: 'species', key, updates, title: local.name || key, details, ebirdCode: code
                        });
                    }

                    if (verifiedKeys.length && item.familyComName) {
                        const existing = familyByName.get(item.familyComName);
                        const details = [];
                        const updates = { name: item.familyComName, ebird_code: item.familyCode || null, sci_name: item.familySciName || null };
                        if (!existing) details.push(`Add family “${item.familyComName}”`);
                        else {
                            if (existing.ebird_code !== updates.ebird_code) details.push(`eBird code: “${existing.ebird_code || ''}” → “${updates.ebird_code || ''}”`);
                            if (existing.sci_name !== updates.sci_name) details.push(`Scientific name: “${existing.sci_name || ''}” → “${updates.sci_name || ''}”`);
                        }
                        if (details.length) changesByKey.set(`family:${item.familyComName}`, {
                            id: `family:${item.familyComName}`, type: 'family', name: item.familyComName, updates, title: `Family: ${item.familyComName}`, details, ebirdCode: code
                        });
                    }
                }

                proposedChanges = [...changesByKey.values()];
                renderChanges();
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            proposedChanges = [...changesByKey.values()];
            renderChanges();
            $('#ebird-sync-progress').text(`Scan complete. ${proposedChanges.length} proposed change(s); ${proposedWarnings.length} record(s) need identity review across ${codes.length} local species codes.`);
        } catch (error) {
            $('#ebird-sync-progress').text(`Sync scan failed: ${error.message}`);
        } finally {
            $button.prop('disabled', false);
        }
    });

    $('#ebird-sync-results').off('change', '.ebird-sync-checkbox').on('change', '.ebird-sync-checkbox', function () {
        const $checks = $('.ebird-sync-checkbox');
        const index = Number($(this).attr('data-index'));
        const changed = proposedChanges[index];
        if (changed) selectionState.set(changed.id, $(this).prop('checked'));
        $('#ebird-sync-select-all').text($checks.filter(':checked').length === $checks.length ? 'Deselect All' : 'Select All');
    });

    $('#ebird-sync-select-all').off('click').on('click', function () {
        const $checks = $('.ebird-sync-checkbox');
        const selectAll = $checks.filter(':checked').length !== $checks.length;
        $checks.each(function () {
            $(this).prop('checked', selectAll);
            const change = proposedChanges[Number($(this).attr('data-index'))];
            if (change) selectionState.set(change.id, selectAll);
        });
        $(this).text(selectAll ? 'Deselect All' : 'Select All');
    });

    $('#ebird-sync-apply').off('click').on('click', async function () {
        const selected = $('.ebird-sync-checkbox:checked').map(function () {
            return proposedChanges[Number($(this).attr('data-index'))];
        }).get().filter(Boolean);
        if (!selected.length) {
            $('#ebird-sync-progress').text('No changes selected.');
            return;
        }
        // Keep species-family references valid: include a required new family record
        // when a selected species change points to a family not yet in the local list.
        const requiredFamilies = new Set(selected
            .filter(change => change.type === 'species' && change.updates.family)
            .map(change => change.updates.family)
            .filter(name => !(data.families || []).some(f => f.name === name)));
        const dependencies = proposedChanges.filter(change =>
            change.type === 'family' && requiredFamilies.has(change.name));
        const changesToApply = [...selected, ...dependencies.filter(change => !selected.includes(change))];
        const $button = $(this);
        $button.prop('disabled', true);
        let speciesChanged = false;
        let familiesChanged = false;
        changesToApply.forEach(change => {
            if (change.type === 'species') {
                const local = data.species[change.key];
                if (!local) return;
                if (change.updates.name && local.name) { local.tags ||= []; if (!local.tags.includes(local.name)) local.tags.push(local.name); }
                Object.assign(local, change.updates);
                speciesChanged = true;
            } else {
                const existing = data.families.find(f => f.name === change.name);
                if (existing) Object.assign(existing, change.updates);
                else data.families.push({ ...change.updates });
                familiesChanged = true;
            }
        });
        if (familiesChanged) {
            data.families.sort((a, b) => a.name.localeCompare(b.name));
            await uploadJSONData('families', true);
        }
        if (speciesChanged) await uploadJSONData('species', true);
        triggerRender();
        proposedChanges = proposedChanges.filter(change => !changesToApply.includes(change));
        changesToApply.forEach(change => selectionState.delete(change.id));
        renderChanges();
        $('#ebird-sync-progress').text(`Applied ${selected.length} selected change(s)${dependencies.length ? ` plus ${dependencies.length} required family record(s)` : ''}.`);
        $button.prop('disabled', proposedChanges.length === 0);
    });
}
