import { data, currentMode, saveSpecies, deleteSpecies, renameFamily, deleteFamily } from './data.js';
import Constants from '../constants.js';
import { customAlert, customConfirm, showToast } from './ui.js';

let activeSubtab = 'add-species-family';
let expandedFamilies = new Set();
let knownFamiliesSet = new Set();
let hasInitializedExpanded = false;
let searchFilter = '';
let selectedFamilyFilter = '';
let selectedTagFilter = '';
let sightingFilter = 'all'; // 'all' | 'with' | 'without'
let columnFilters = { name: '', sci: '', ebird: '', tags: '', sightings: '' };
let editingTarget = null; // { type: 'family', name: string } | { type: 'species', key: string } | null

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildGoogleSearchLink(sciName) {
    if (!sciName) return '-';
    const url = `https://www.google.com/search?q=${encodeURIComponent(sciName)}`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;"><em>${escapeHtml(sciName)}</em></a>`;
}

export function invalidateHierarchyCache() {
    // No-op for backward compatibility
}

export function autoExpandFamilies(familyNames) {
    if (!familyNames) return;
    const names = Array.isArray(familyNames) ? familyNames : [familyNames];
    names.forEach(name => {
        if (name) {
            expandedFamilies.add(name);
            knownFamiliesSet.add(name);
        }
    });
}

export function _getExpandedFamilies() {
    return expandedFamilies;
}

export function _resetState() {
    activeSubtab = 'add-species-family';
    expandedFamilies = new Set();
    knownFamiliesSet = new Set();
    hasInitializedExpanded = false;
    searchFilter = '';
    selectedFamilyFilter = '';
    selectedTagFilter = '';
    sightingFilter = 'all';
    columnFilters = { name: '', sci: '', ebird: '', tags: '', sightings: '' };
    editingTarget = null;
}

/**
 * Computes indexes from live data for rendering.
 */
function getHierarchyIndex() {
    const sightingsList = data.sightings || [];
    const speciesObj = data.species || {};
    const familiesListRaw = data.families || [];

    // 1. Single-pass sighting counts
    const sightingsCountBySpecies = {};
    for (let i = 0; i < sightingsList.length; i++) {
        const spKey = sightingsList[i].species;
        if (spKey) {
            sightingsCountBySpecies[spKey] = (sightingsCountBySpecies[spKey] || 0) + 1;
        }
    }

    // 2. Sorted families
    const familiesList = familiesListRaw.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const knownFamilyNames = new Set(familiesList.map(f => f.name));

    // 3. Species grouped by family & unique tag counts
    const speciesByFamily = {};
    const unassignedSpecies = [];
    const tagCounts = {};

    const spEntries = Object.values(speciesObj);
    for (let i = 0; i < spEntries.length; i++) {
        const sp = spEntries[i];
        if (sp.family && knownFamilyNames.has(sp.family)) {
            (speciesByFamily[sp.family] ||= []).push(sp);
        } else {
            unassignedSpecies.push(sp);
        }
        if (Array.isArray(sp.tags)) {
            for (let t = 0; t < sp.tags.length; t++) {
                const tag = sp.tags[t];
                if (tag) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            }
        }
    }

    const tagsList = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));

    // Sort species within each family
    Object.keys(speciesByFamily).forEach(fam => {
        speciesByFamily[fam].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
    unassignedSpecies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return {
        familiesList,
        speciesObj,
        speciesByFamily,
        unassignedSpecies,
        sightingsCountBySpecies,
        tagsList,
        tagCounts,
        totalFamilies: familiesList.length,
        totalSpecies: spEntries.length,
        totalSightings: sightingsList.length
    };
}

/**
 * Initializes and switches subtabs inside the Species/Family tab.
 * Subtabs:
 * 1. Add Species/Family ('add-species-family') -> Form only
 * 2. Hierarchical View ('hierarchical-view') -> Spreadsheet only
 * 3. eBird Sync ('ebird-sync') -> eBird sync card (bird mode only)
 */
export function setupSpeciesSubtabs(targetSubtab) {
    if (targetSubtab) {
        activeSubtab = targetSubtab;
    }

    // eBird sync is only for bird mode
    const isBirdMode = (currentMode === Constants.MODE_BIRD);
    const $ebirdBtn = $('.species-subtab-btn[data-subtab="ebird-sync"]');
    if (isBirdMode) {
        $ebirdBtn.show();
    } else {
        $ebirdBtn.hide();
        if (activeSubtab === 'ebird-sync') {
            activeSubtab = 'add-species-family';
        }
    }

    // Update active button state
    $('.species-subtab-btn').removeClass('active');
    $(`.species-subtab-btn[data-subtab="${activeSubtab}"]`).addClass('active');

    // Control visibility of cards
    const $formsWrapper = $('#species-forms-wrapper');
    const $hierarchySection = $('#species-hierarchical-section');
    const $ebirdCard = $('#ebird-sync-card');

    if (activeSubtab === 'add-species-family') {
        $formsWrapper.show();
        $hierarchySection.hide(); // REMOVED from first subtab per user request
        $ebirdCard.hide();
    } else if (activeSubtab === 'hierarchical-view') {
        $formsWrapper.hide();
        $hierarchySection.show();
        $ebirdCard.hide();
        renderSpeciesHierarchy();
    } else if (activeSubtab === 'ebird-sync') {
        $formsWrapper.hide();
        $hierarchySection.hide();
        if (isBirdMode) {
            $ebirdCard.show();
        } else {
            $ebirdCard.hide();
        }
    }

    // Attach click handlers once (namespaced)
    $('.species-subtab-btn').off('click.speciesSubtab').on('click.speciesSubtab', function () {
        const sub = $(this).data('subtab');
        if (sub) {
            setupSpeciesSubtabs(sub);
        }
    });
}

function matchesSightingsExpr(count, expr) {
    const trimmed = (expr || '').trim();
    if (!trimmed) return true;
    const opMatch = trimmed.match(/^(>=|<=|>|<|=)?\s*(\d+)$/);
    if (!opMatch) {
        return String(count).includes(trimmed);
    }
    const op = opMatch[1] || '=';
    const target = Number(opMatch[2]);
    if (op === '>') return count > target;
    if (op === '>=') return count >= target;
    if (op === '<') return count < target;
    if (op === '<=') return count <= target;
    return count === target;
}

function filterSpeciesList(famSpecies, famKey, familyMatchesQuery, query, sightingFilter, sightingsCountBySpecies, tagFilter, colFilters = columnFilters, familyMatchesCols = {}) {
    const colNameQuery = (colFilters.name || '').trim().toLowerCase();
    const colSciQuery = (colFilters.sci || '').trim().toLowerCase();
    const colEbirdQuery = (colFilters.ebird || '').trim().toLowerCase();
    const colTagsQuery = (colFilters.tags || '').trim().toLowerCase();
    const colSightingsQuery = (colFilters.sightings || '').trim();

    return famSpecies.filter(sp => {
        const count = sightingsCountBySpecies[sp.key] || 0;
        if (sightingFilter === 'with' && count === 0) return false;
        if (sightingFilter === 'without' && count > 0) return false;

        if (tagFilter === '__no_tags__') {
            if (Array.isArray(sp.tags) && sp.tags.length > 0) return false;
        } else if (tagFilter) {
            if (!Array.isArray(sp.tags) || !sp.tags.includes(tagFilter)) return false;
        }

        if (colSightingsQuery && !matchesSightingsExpr(count, colSightingsQuery)) return false;

        const spNameLower = (sp.name || '').toLowerCase();
        const spLatinLower = (sp.latin_name || '').toLowerCase();
        const spEbirdLower = (sp.ebird_code || '').toLowerCase();
        const spTagsLower = (sp.tags || []).join(' ').toLowerCase();

        if (colNameQuery && !familyMatchesCols.name && !spNameLower.includes(colNameQuery)) return false;
        if (colSciQuery && !familyMatchesCols.sci && !spLatinLower.includes(colSciQuery)) return false;
        if (colEbirdQuery && !familyMatchesCols.ebird && !spEbirdLower.includes(colEbirdQuery)) return false;
        if (colTagsQuery && !spTagsLower.includes(colTagsQuery)) return false;

        if (!query) return true;
        if (familyMatchesQuery) return true;

        return spNameLower.includes(query) ||
            spLatinLower.includes(query) ||
            spEbirdLower.includes(query) ||
            spTagsLower.includes(query);
    });
}

function buildSpeciesRowHtml(sp, famKey, isBirdMode, sightingsCount, isEditing, familiesList) {
    if (isEditing) {
        return `
            <tr class="species-row editing-row" data-parent-family="${escapeHtml(famKey)}" data-key="${escapeHtml(sp.key)}" style="background: #1e293b; border-left: 3px solid #a3ff2e;">
                <td style="padding-left: 20px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 10px; color: #a3ff2e; font-weight: bold;">NAME:</span>
                        <input type="text" class="spreadsheet-cell-input inline-edit-sp-name" value="${escapeHtml(sp.name || '')}" placeholder="Species Name" style="font-weight: 500;" />
                        <span style="font-size: 10px; color: #94a3b8;">FAMILY:</span>
                        <select class="spreadsheet-cell-input inline-edit-sp-family" style="font-size: 12px;">
                            <option value="">-- Select Family --</option>
                            ${(familiesList || []).map(f => `<option value="${escapeHtml(f.name)}" ${sp.family === f.name ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
                        </select>
                    </div>
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input inline-edit-sp-latin" value="${escapeHtml(sp.latin_name || '')}" placeholder="Scientific Name" />
                </td>
                ${isBirdMode ? `<td><input type="text" class="spreadsheet-cell-input inline-edit-sp-ebird" value="${escapeHtml(sp.ebird_code || '')}" placeholder="eBird Code" /></td>` : ''}
                <td>
                    <input type="text" class="spreadsheet-cell-input inline-edit-sp-tags" value="${escapeHtml((sp.tags || []).join(', '))}" placeholder="Tags (comma-separated)" />
                </td>
                <td style="text-align: center; color: #94a3b8;">
                    ${sightingsCount}
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center;">
                        <button type="button" class="btn-save-sp-inline" data-key="${escapeHtml(sp.key)}" title="Save Species" style="background: #0284c7; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">Save</button>
                        <button type="button" class="btn-cancel-inline" title="Cancel" style="background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">Cancel</button>
                    </div>
                </td>
            </tr>
        `;
    }

    return `
        <tr class="species-row" data-parent-family="${escapeHtml(famKey)}" data-key="${escapeHtml(sp.key)}" style="background: rgba(15, 23, 42, 0.4);">
            <td style="padding-left: 28px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #64748b; font-size: 12px;">↳</span>
                    <span class="sp-name-label" style="font-weight: 500; color: #f8fafc;">${escapeHtml(sp.name)}</span>
                </div>
            </td>
            <td style="color: #cbd5e1;">
                ${buildGoogleSearchLink(sp.latin_name)}
            </td>
            ${isBirdMode ? `<td>${sp.ebird_code ? `<a href="https://ebird.org/species/${encodeURIComponent(sp.ebird_code)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">${escapeHtml(sp.ebird_code)}</a>` : '-'}</td>` : ''}
            <td>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${(sp.tags && sp.tags.length) ? sp.tags.map(t => `<span style="background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 1px 6px; font-size: 11px;">${escapeHtml(t)}</span>`).join('') : '<span style="color:#64748b;">-</span>'}
                </div>
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-view-sightings-badge" data-species="${escapeHtml(sp.key)}" title="View sightings for ${escapeHtml(sp.name)}" style="background: ${sightingsCount > 0 ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.05)'}; color: ${sightingsCount > 0 ? '#38bdf8' : '#64748b'}; border: 1px solid ${sightingsCount > 0 ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
                    ${sightingsCount}
                </button>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                    <button type="button" class="btn-edit-sp-inline" data-key="${escapeHtml(sp.key)}" title="Edit Species Inline" style="background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 5px;">✏️</button>
                    <button type="button" class="btn-edit-sp-form" data-key="${escapeHtml(sp.key)}" title="Edit in Add/Modify Form" style="background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 5px;">📝</button>
                    <button type="button" class="btn-delete-sp" data-key="${escapeHtml(sp.key)}" title="${sightingsCount > 0 ? 'Cannot delete: has sightings' : 'Delete Species'}" style="background: none; border: none; cursor: ${sightingsCount > 0 ? 'not-allowed' : 'pointer'}; opacity: ${sightingsCount > 0 ? '0.3' : '1'}; font-size: 13px; padding: 2px 5px;">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Instant in-place DOM expansion/collapse for a single family.
 * Runs in <1ms without re-rendering or rebuilding the whole table.
 */
function toggleFamilyExpansion($famRow, famKey, isBirdMode) {
    const $container = $('#species-hierarchical-section');
    const isExpanded = expandedFamilies.has(famKey);
    const $chevron = $famRow.find('.family-chevron');

    if (isExpanded) {
        expandedFamilies.delete(famKey);
        $chevron.text('▶');
        $container.find('tr.species-row').filter(function () {
            return $(this).attr('data-parent-family') === famKey;
        }).remove();
    } else {
        expandedFamilies.add(famKey);
        $chevron.text('▼');

        const index = getHierarchyIndex();
        const famSpecies = (famKey === '__unassigned__')
            ? index.unassignedSpecies
            : (index.speciesByFamily[famKey] || []);

        const query = searchFilter.trim().toLowerCase();
        const famObj = famKey === '__unassigned__' ? null : index.familiesList.find(f => f.name === famKey);
        const familyMatchesQuery = Boolean(query && (
            famKey === '__unassigned__'
                ? 'unassigned / no family'.includes(query)
                : famObj && ((famObj.name || '').toLowerCase().includes(query) ||
                    (famObj.sci_name || '').toLowerCase().includes(query) ||
                    (famObj.ebird_code || '').toLowerCase().includes(query))
        ));
        const familyMatchesCols = getFamilyColMatches(famObj, famKey === '__unassigned__');

        const matchingSpecies = filterSpeciesList(famSpecies, famKey, familyMatchesQuery, query, sightingFilter, index.sightingsCountBySpecies, selectedTagFilter, columnFilters, familyMatchesCols);

        let rowsHtml = '';
        if (!matchingSpecies.length) {
            rowsHtml = `
                <tr class="species-row empty-fam-row" data-parent-family="${escapeHtml(famKey)}" style="background: rgba(15, 23, 42, 0.3);">
                    <td colspan="${isBirdMode ? 6 : 5}" style="padding-left: 36px; color: #64748b; font-size: 12px; font-style: italic;">
                        No species in this family yet. <button type="button" class="btn-add-sp-to-fam" data-name="${escapeHtml(famKey)}" style="background: none; border: none; color: #38bdf8; text-decoration: underline; cursor: pointer; font-size: 12px; padding: 0 4px;">Add a species now</button>
                    </td>
                </tr>
            `;
        } else {
            rowsHtml = matchingSpecies.map(sp => {
                const count = index.sightingsCountBySpecies[sp.key] || 0;
                const isEditing = editingTarget && editingTarget.type === 'species' && editingTarget.key === sp.key;
                return buildSpeciesRowHtml(sp, famKey, isBirdMode, count, isEditing, index.familiesList);
            }).join('');
        }

        $famRow.after(rowsHtml);
    }
}

function getFamilyColMatches(fam, isUnassigned) {
    const colNameQuery = (columnFilters.name || '').trim().toLowerCase();
    const colSciQuery = (columnFilters.sci || '').trim().toLowerCase();
    const colEbirdQuery = (columnFilters.ebird || '').trim().toLowerCase();

    if (isUnassigned || !fam) {
        return {
            name: Boolean(colNameQuery && 'unassigned / no family'.includes(colNameQuery)),
            sci: false,
            ebird: false
        };
    }

    return {
        name: Boolean(colNameQuery && (fam.name || '').toLowerCase().includes(colNameQuery)),
        sci: Boolean(colSciQuery && (fam.sci_name || '').toLowerCase().includes(colSciQuery)),
        ebird: Boolean(colEbirdQuery && (fam.ebird_code || '').toLowerCase().includes(colEbirdQuery))
    };
}

function hasActiveColumnFilters() {
    return Object.values(columnFilters).some(v => Boolean((v || '').trim()));
}

function buildFilteredGroups(index) {
    const { familiesList, speciesByFamily, unassignedSpecies, sightingsCountBySpecies } = index;
    const query = searchFilter.trim().toLowerCase();
    const colNameQuery = (columnFilters.name || '').trim().toLowerCase();
    const colSciQuery = (columnFilters.sci || '').trim().toLowerCase();
    const colEbirdQuery = (columnFilters.ebird || '').trim().toLowerCase();
    const colTagsQuery = (columnFilters.tags || '').trim().toLowerCase();
    const colSightingsQuery = (columnFilters.sightings || '').trim();
    const hasSpeciesOnlyFilter = Boolean(selectedTagFilter || colTagsQuery || colSightingsQuery);

    const displayGroups = [];
    let visibleSpeciesCount = 0;

    for (let i = 0; i < familiesList.length; i++) {
        const fam = familiesList[i];
        if (selectedFamilyFilter && selectedFamilyFilter !== fam.name) {
            continue;
        }

        const allFamSpecies = speciesByFamily[fam.name] || [];
        const famNameLower = (fam.name || '').toLowerCase();
        const famSciLower = (fam.sci_name || '').toLowerCase();
        const famEbirdLower = (fam.ebird_code || '').toLowerCase();
        const familyMatchesQuery = Boolean(query && (
            famNameLower.includes(query) ||
            famSciLower.includes(query) ||
            famEbirdLower.includes(query)
        ));
        const familyMatchesCols = getFamilyColMatches(fam, false);

        const matchingSpecies = filterSpeciesList(
            allFamSpecies, fam.name, familyMatchesQuery, query, sightingFilter,
            sightingsCountBySpecies, selectedTagFilter, columnFilters, familyMatchesCols
        );

        const matchedByColText = Boolean(
            (colNameQuery && !familyMatchesCols.name) ||
            (colSciQuery && !familyMatchesCols.sci) ||
            (colEbirdQuery && !familyMatchesCols.ebird)
        );
        if (matchingSpecies.length > 0 && ((query && !familyMatchesQuery) || hasSpeciesOnlyFilter || matchedByColText)) {
            expandedFamilies.add(fam.name);
        }

        let countTotalFamSightings = 0;
        for (let j = 0; j < allFamSpecies.length; j++) {
            countTotalFamSightings += (sightingsCountBySpecies[allFamSpecies[j].key] || 0);
        }

        const familyPassesAllColFilters = (!colNameQuery || familyMatchesCols.name) &&
            (!colSciQuery || familyMatchesCols.sci) &&
            (!colEbirdQuery || familyMatchesCols.ebird);
        const hasColTextFilter = Boolean(colNameQuery || colSciQuery || colEbirdQuery);

        let includeFamily;
        if (hasSpeciesOnlyFilter) {
            includeFamily = matchingSpecies.length > 0;
        } else if (hasColTextFilter || query) {
            includeFamily = matchingSpecies.length > 0 || (
                (!query || familyMatchesQuery) && (!hasColTextFilter || familyPassesAllColFilters)
            );
        } else {
            includeFamily = true;
        }

        if (includeFamily) {
            visibleSpeciesCount += matchingSpecies.length;
            displayGroups.push({
                family: fam,
                isUnassigned: false,
                speciesList: matchingSpecies,
                totalSightings: countTotalFamSightings
            });
        }
    }

    // Check unassigned species
    if (unassignedSpecies.length && (!selectedFamilyFilter || selectedFamilyFilter === '__unassigned__')) {
        const unassignedColMatches = getFamilyColMatches(null, true);
        const matchingUnassigned = filterSpeciesList(
            unassignedSpecies, '__unassigned__', false, query, sightingFilter,
            sightingsCountBySpecies, selectedTagFilter, columnFilters, unassignedColMatches
        );
        if (matchingUnassigned.length) {
            visibleSpeciesCount += matchingUnassigned.length;
            let countTotalUnassigned = 0;
            for (let j = 0; j < matchingUnassigned.length; j++) {
                countTotalUnassigned += (sightingsCountBySpecies[matchingUnassigned[j].key] || 0);
            }
            displayGroups.push({
                family: { name: 'Unassigned / No Family', isVirtual: true, key: '__unassigned__' },
                isUnassigned: true,
                speciesList: matchingUnassigned,
                totalSightings: countTotalUnassigned
            });
        }
    }

    return { displayGroups, visibleSpeciesCount };
}

/**
 * Renders the hierarchical spreadsheet of all families and species.
 */
export function renderSpeciesHierarchy() {
    const $container = $('#species-hierarchical-section');
    if (!$container.length) return;

    const index = getHierarchyIndex();
    const { familiesList, speciesObj, speciesByFamily, unassignedSpecies, sightingsCountBySpecies, tagsList, tagCounts, totalFamilies, totalSpecies, totalSightings } = index;

    // Initialize expanded families on first render
    if (!hasInitializedExpanded) {
        familiesList.forEach(f => {
            expandedFamilies.add(f.name);
            knownFamiliesSet.add(f.name);
        });
        if (unassignedSpecies.length) expandedFamilies.add('__unassigned__');
        hasInitializedExpanded = true;
    } else {
        // Auto-expand any newly added family
        familiesList.forEach(f => {
            if (!knownFamiliesSet.has(f.name)) {
                expandedFamilies.add(f.name);
                knownFamiliesSet.add(f.name);
            }
        });
    }

    // Auto-expand family of recently added/updated species
    if (data.lastUpdatedSpecies && speciesObj[data.lastUpdatedSpecies]?.family) {
        expandedFamilies.add(speciesObj[data.lastUpdatedSpecies].family);
    }

    const query = searchFilter.trim().toLowerCase();
    const isBirdMode = (currentMode === Constants.MODE_BIRD);
    const { displayGroups, visibleSpeciesCount } = buildFilteredGroups(index);

    // Build Toolbar HTML
    const toolbarHtml = `
        <div class="species-hierarchy-toolbar" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; flex: 1; min-width: 280px;">
                <div style="position: relative; flex: 1; min-width: 200px; max-width: 340px;">
                    <input type="text" id="species-hierarchy-search" class="spreadsheet-cell-input" placeholder="🔍 Search family, species, tags, code..." value="${escapeHtml(searchFilter)}" style="padding-left: 10px;" />
                    ${searchFilter ? `<button id="species-hierarchy-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 13px;">✕</button>` : ''}
                </div>
                <select id="species-hierarchy-family-filter" class="spreadsheet-cell-input" style="max-width: 200px;">
                    <option value="">All Families (${totalFamilies})</option>
                    ${familiesList.map(f => `<option value="${escapeHtml(f.name)}" ${selectedFamilyFilter === f.name ? 'selected' : ''}>${escapeHtml(f.name)} (${(speciesByFamily[f.name] || []).length})</option>`).join('')}
                    ${unassignedSpecies.length ? `<option value="__unassigned__" ${selectedFamilyFilter === '__unassigned__' ? 'selected' : ''}>Unassigned (${unassignedSpecies.length})</option>` : ''}
                </select>
                <select id="species-hierarchy-tag-filter" class="spreadsheet-cell-input" style="max-width: 170px;">
                    <option value="">All Tags (${tagsList.length})</option>
                    <option value="__no_tags__" ${selectedTagFilter === '__no_tags__' ? 'selected' : ''}>No Tags</option>
                    ${tagsList.map(t => `<option value="${escapeHtml(t)}" ${selectedTagFilter === t ? 'selected' : ''}>${escapeHtml(t)} (${tagCounts[t]})</option>`).join('')}
                </select>
                <select id="species-hierarchy-sightings-filter" class="spreadsheet-cell-input" style="max-width: 150px;">
                    <option value="all" ${sightingFilter === 'all' ? 'selected' : ''}>All Sightings</option>
                    <option value="with" ${sightingFilter === 'with' ? 'selected' : ''}>Has Sightings (&gt;0)</option>
                    <option value="without" ${sightingFilter === 'without' ? 'selected' : ''}>No Sightings (0)</option>
                </select>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <button type="button" id="species-hierarchy-expand-all" class="spreadsheet-sheet-tab" style="padding: 6px 12px; font-size: 12px; border: 1px solid rgba(255,255,255,0.15);" title="Expand All Families">▾ Expand All</button>
                <button type="button" id="species-hierarchy-collapse-all" class="spreadsheet-sheet-tab" style="padding: 6px 12px; font-size: 12px; border: 1px solid rgba(255,255,255,0.15);" title="Collapse All Families">▸ Collapse All</button>
                <button type="button" id="species-hierarchy-add-sp-btn" class="spreadsheet-add-btn" style="padding: 6px 12px; font-size: 12px;">+ Add Species</button>
                <button type="button" id="species-hierarchy-add-fam-btn" class="spreadsheet-add-btn" style="padding: 6px 12px; font-size: 12px; background-color: #0d9488;">+ Add Family</button>
            </div>
        </div>
        <div id="species-hierarchy-stats" style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 12px; color: #94a3b8;">
            ${buildStatsHtml(index, displayGroups, visibleSpeciesCount)}
        </div>
    `;

    const rowsHtml = buildHierarchyRowsHtml(displayGroups, index, isBirdMode);

    const tableHtml = `
        <div class="spreadsheet-table-wrapper" style="overflow-x: auto; max-height: 600px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px;">
            <table class="spreadsheet-table" id="species-hierarchy-table">
                <thead>
                    <tr>
                        <th style="width: ${isBirdMode ? '24%' : '27%'}; text-align: left;">Family / Species Name</th>
                        <th style="width: ${isBirdMode ? '20%' : '22%'}; text-align: left;">Scientific Name</th>
                        ${isBirdMode ? '<th style="width: 10%; text-align: left;">eBird Code</th>' : ''}
                        <th style="width: ${isBirdMode ? '26%' : '30%'}; text-align: left;">Tags / Info</th>
                        <th style="width: ${isBirdMode ? '8%' : '9%'}; text-align: center;">Sightings</th>
                        <th style="width: 12%; text-align: center;">Actions</th>
                    </tr>
                    <tr class="hierarchy-filter-row">
                        <th><input type="text" class="spreadsheet-cell-input hierarchy-col-filter" data-col="name" placeholder="Filter name..." value="${escapeHtml(columnFilters.name)}" /></th>
                        <th><input type="text" class="spreadsheet-cell-input hierarchy-col-filter" data-col="sci" placeholder="Filter scientific..." value="${escapeHtml(columnFilters.sci)}" /></th>
                        ${isBirdMode ? `<th><input type="text" class="spreadsheet-cell-input hierarchy-col-filter" data-col="ebird" placeholder="Code..." value="${escapeHtml(columnFilters.ebird)}" /></th>` : ''}
                        <th><input type="text" class="spreadsheet-cell-input hierarchy-col-filter" data-col="tags" placeholder="Filter tags..." value="${escapeHtml(columnFilters.tags)}" /></th>
                        <th><input type="text" class="spreadsheet-cell-input hierarchy-col-filter" data-col="sightings" placeholder="e.g. >0, 2" value="${escapeHtml(columnFilters.sightings)}" style="text-align: center;" /></th>
                        <th style="text-align: center;">
                            <button type="button" id="species-hierarchy-clear-col-filters" title="Clear column filters" style="display: ${hasActiveColumnFilters() ? 'inline-block' : 'none'}; background: transparent; border: 1px solid rgba(255,255,255,0.18); color: #94a3b8; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;">✕ Clear</button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    $container.html(toolbarHtml + tableHtml);

    // Bind event handlers via delegation
    bindHierarchyEvents($container, isBirdMode);
}

function buildStatsHtml(index, displayGroups, visibleSpeciesCount) {
    const { totalFamilies, totalSpecies, totalSightings } = index;
    const isFiltered = Boolean(searchFilter.trim() || selectedFamilyFilter || selectedTagFilter || sightingFilter !== 'all' || hasActiveColumnFilters());
    return `
        <span>Families: <strong style="color: #38bdf8;">${totalFamilies}</strong></span>
        <span>·</span>
        <span>Total Species: <strong style="color: #a3ff2e;">${totalSpecies}</strong></span>
        <span>·</span>
        <span>Sightings: <strong style="color: #f8fafc;">${totalSightings}</strong></span>
        ${isFiltered ? `<span style="margin-left: 8px; color: #f59e0b; font-weight: 500;">(Filtered: ${visibleSpeciesCount} species in ${displayGroups.length} families)</span>` : ''}
    `;
}

function buildHierarchyRowsHtml(displayGroups, index, isBirdMode) {
    const { familiesList, sightingsCountBySpecies } = index;
    const rowsBuffer = [];
    if (!displayGroups.length) {
        rowsBuffer.push(`
            <tr>
                <td colspan="${isBirdMode ? 6 : 5}" style="text-align: center; color: #94a3b8; padding: 24px;">
                    No families or species match the current filter.
                </td>
            </tr>
        `);
        return rowsBuffer.join('');
    }

    for (let i = 0; i < displayGroups.length; i++) {
        const group = displayGroups[i];
        const fam = group.family;
        const famKey = fam.isVirtual ? fam.key : fam.name;
        const isExpanded = expandedFamilies.has(famKey);
        const isEditingThisFam = editingTarget && editingTarget.type === 'family' && editingTarget.name === fam.name;

        if (isEditingThisFam) {
            rowsBuffer.push(`
                <tr class="family-row editing-row" data-family="${escapeHtml(fam.name)}" style="background: #1e293b; border-left: 3px solid #38bdf8;">
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 11px; color: #38bdf8; font-weight: bold;">FAMILY:</span>
                            <input type="text" class="spreadsheet-cell-input inline-edit-fam-name" value="${escapeHtml(fam.name)}" placeholder="Family Name" style="font-weight: 600;" />
                        </div>
                    </td>
                    <td>
                        <input type="text" class="spreadsheet-cell-input inline-edit-fam-sci" value="${escapeHtml(fam.sci_name || '')}" placeholder="Scientific Name" />
                    </td>
                    ${isBirdMode ? `<td><input type="text" class="spreadsheet-cell-input inline-edit-fam-ebird" value="${escapeHtml(fam.ebird_code || '')}" placeholder="eBird Code" /></td>` : ''}
                    <td style="color: #94a3b8; font-size: 12px;">
                        ${group.speciesList.length} species
                    </td>
                    <td style="text-align: center; color: #94a3b8;">
                        ${group.totalSightings}
                    </td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button type="button" class="btn-save-fam-inline" data-old-name="${escapeHtml(fam.name)}" title="Save Family" style="background: #0284c7; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">Save</button>
                            <button type="button" class="btn-cancel-inline" title="Cancel" style="background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">Cancel</button>
                        </div>
                    </td>
                </tr>
            `);
        } else {
            rowsBuffer.push(`
                <tr class="family-row" data-family="${escapeHtml(famKey)}" style="background: #1a2234; border-top: 1px solid rgba(255,255,255,0.15); cursor: pointer;" title="Click to expand/collapse family">
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="family-chevron" style="color: #38bdf8; font-size: 12px; width: 14px; text-align: center; user-select: none;">
                                ${isExpanded ? '▼' : '▶'}
                            </span>
                            <span style="font-size: 14px; line-height: 1;">📁</span>
                            <strong style="color: #38bdf8; font-size: 14px;">${escapeHtml(fam.name)}</strong>
                            ${fam.isVirtual ? '<span style="font-size: 10px; background: rgba(245,158,11,0.2); color: #f59e0b; padding: 1px 6px; border-radius: 4px;">Unassigned</span>' : ''}
                        </div>
                    </td>
                    <td style="color: #94a3b8;">
                        ${buildGoogleSearchLink(fam.sci_name)}
                    </td>
                    ${isBirdMode ? `<td>${fam.ebird_code ? escapeHtml(fam.ebird_code) : '-'}</td>` : ''}
                    <td>
                        <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;">
                            ${group.speciesList.length} species
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <span style="font-weight: 600; color: ${group.totalSightings > 0 ? '#38bdf8' : '#64748b'};">
                            ${group.totalSightings}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        ${fam.isVirtual ? '-' : `
                            <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                                <button type="button" class="btn-edit-fam-inline" data-name="${escapeHtml(fam.name)}" title="Edit Family Name/Code" style="background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 5px;">✏️</button>
                                <button type="button" class="btn-delete-fam" data-name="${escapeHtml(fam.name)}" title="${group.speciesList.length > 0 ? 'Cannot delete: has species' : 'Delete Family'}" style="background: none; border: none; cursor: ${group.speciesList.length > 0 ? 'not-allowed' : 'pointer'}; opacity: ${group.speciesList.length > 0 ? '0.3' : '1'}; font-size: 13px; padding: 2px 5px;">🗑️</button>
                                <button type="button" class="btn-add-sp-to-fam" data-name="${escapeHtml(fam.name)}" title="Add Species to ${escapeHtml(fam.name)}" style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer; margin-left: 2px;">+ Species</button>
                            </div>
                        `}
                    </td>
                </tr>
            `);
        }

        if (isExpanded) {
            if (!group.speciesList.length) {
                rowsBuffer.push(`
                    <tr class="species-row empty-fam-row" data-parent-family="${escapeHtml(famKey)}" style="background: rgba(15, 23, 42, 0.3);">
                        <td colspan="${isBirdMode ? 6 : 5}" style="padding-left: 36px; color: #64748b; font-size: 12px; font-style: italic;">
                            No species in this family yet. <button type="button" class="btn-add-sp-to-fam" data-name="${escapeHtml(fam.name)}" style="background: none; border: none; color: #38bdf8; text-decoration: underline; cursor: pointer; font-size: 12px; padding: 0 4px;">Add a species now</button>
                        </td>
                    </tr>
                `);
            } else {
                for (let j = 0; j < group.speciesList.length; j++) {
                    const sp = group.speciesList[j];
                    const isEditingThisSp = editingTarget && editingTarget.type === 'species' && editingTarget.key === sp.key;
                    const sightingsCount = sightingsCountBySpecies[sp.key] || 0;
                    rowsBuffer.push(buildSpeciesRowHtml(sp, famKey, isBirdMode, sightingsCount, isEditingThisSp, familiesList));
                }
            }
        }
    }

    return rowsBuffer.join('');
}

function updateHierarchyTableBody($container, isBirdMode) {
    const index = getHierarchyIndex();
    const { displayGroups, visibleSpeciesCount } = buildFilteredGroups(index);
    $container.find('#species-hierarchy-table tbody').html(buildHierarchyRowsHtml(displayGroups, index, isBirdMode));
    $container.find('#species-hierarchy-stats').html(buildStatsHtml(index, displayGroups, visibleSpeciesCount));
    $container.find('#species-hierarchy-clear-col-filters').toggle(hasActiveColumnFilters());
}

function bindHierarchyEvents($container, isBirdMode) {
    // Unbind previous delegated events to avoid duplicates
    $container.off('.hierarchy');

    // Column filter textboxes (update tbody in-place to preserve focus & cursor)
    $container.on('input.hierarchy', '.hierarchy-col-filter', function () {
        const col = $(this).data('col');
        if (col && Object.prototype.hasOwnProperty.call(columnFilters, col)) {
            columnFilters[col] = $(this).val();
            updateHierarchyTableBody($container, isBirdMode);
        }
    });

    // Clear all column filters
    $container.on('click.hierarchy', '#species-hierarchy-clear-col-filters', function () {
        columnFilters = { name: '', sci: '', ebird: '', tags: '', sightings: '' };
        $container.find('.hierarchy-col-filter').val('');
        updateHierarchyTableBody($container, isBirdMode);
    });

    // Search input
    $container.on('input.hierarchy', '#species-hierarchy-search', function () {
        searchFilter = $(this).val();
        renderSpeciesHierarchy();
        const $newSearch = $('#species-hierarchy-search');
        if ($newSearch.length) {
            $newSearch.focus();
            const len = $newSearch.val().length;
            $newSearch[0].setSelectionRange(len, len);
        }
    });

    // Clear search
    $container.on('click.hierarchy', '#species-hierarchy-search-clear', function () {
        searchFilter = '';
        renderSpeciesHierarchy();
    });

    // Family filter
    $container.on('change.hierarchy', '#species-hierarchy-family-filter', function () {
        selectedFamilyFilter = $(this).val();
        renderSpeciesHierarchy();
    });

    // Tag filter
    $container.on('change.hierarchy', '#species-hierarchy-tag-filter', function () {
        selectedTagFilter = $(this).val();
        renderSpeciesHierarchy();
    });

    // Sightings filter
    $container.on('change.hierarchy', '#species-hierarchy-sightings-filter', function () {
        sightingFilter = $(this).val();
        renderSpeciesHierarchy();
    });

    // Expand All
    $container.on('click.hierarchy', '#species-hierarchy-expand-all', function () {
        const index = getHierarchyIndex();
        (index.familiesList || []).forEach(f => expandedFamilies.add(f.name));
        expandedFamilies.add('__unassigned__');
        renderSpeciesHierarchy();
    });

    // Collapse All - Fast instant removal of all species rows
    $container.on('click.hierarchy', '#species-hierarchy-collapse-all', function () {
        expandedFamilies.clear();
        $container.find('tr.species-row').remove();
        $container.find('.family-chevron').text('▶');
    });

    // Add Species quick action -> switch to add tab, scroll to species form
    $container.on('click.hierarchy', '#species-hierarchy-add-sp-btn', function () {
        setupSpeciesSubtabs('add-species-family');
        const $form = $('#update-species-form');
        if ($form.length) {
            $form.find('select[data-field="name"]').val('').trigger('change');
            $('html, body').animate({ scrollTop: $form.offset().top - 80 }, 200);
            $form.find('input[data-field="display-name"]').focus();
        }
    });

    // Add Family quick action -> switch to add tab, scroll to family form
    $container.on('click.hierarchy', '#species-hierarchy-add-fam-btn', function () {
        setupSpeciesSubtabs('add-species-family');
        const $form = $('#add-family-form');
        if ($form.length) {
            $form.find('select[data-field="name"]').val('').trigger('change');
            $('html, body').animate({ scrollTop: $form.offset().top - 80 }, 200);
            $form.find('input[data-field="display-name"]').focus();
        }
    });

    // Add Species to specific family
    $container.on('click.hierarchy', '.btn-add-sp-to-fam', function (e) {
        e.stopPropagation();
        const famName = $(this).data('name');
        setupSpeciesSubtabs('add-species-family');
        const $form = $('#update-species-form');
        if ($form.length) {
            $form.find('select[data-field="name"]').val('').trigger('change');
            $form.find('select[data-field="family"]').val(famName).trigger('change');
            $('html, body').animate({ scrollTop: $form.offset().top - 80 }, 200);
            $form.find('input[data-field="display-name"]').focus();
        }
    });

    // Fast instant expand/collapse on Family Row Click (<1ms)
    $container.on('click.hierarchy', '.family-row:not(.editing-row)', function (e) {
        // Prevent toggle if clicking on inline buttons or links
        if ($(e.target).closest('button, a, input, select').length) return;

        const famKey = $(this).data('family');
        if (!famKey) return;
        toggleFamilyExpansion($(this), famKey, isBirdMode);
    });

    // Edit Family inline
    $container.on('click.hierarchy', '.btn-edit-fam-inline', function (e) {
        e.stopPropagation();
        const name = $(this).data('name');
        editingTarget = { type: 'family', name };
        renderSpeciesHierarchy();
    });

    // Save Family inline
    $container.on('click.hierarchy', '.btn-save-fam-inline', function (e) {
        e.stopPropagation();
        const oldName = $(this).data('old-name');
        const $row = $(this).closest('tr');
        const newName = $row.find('.inline-edit-fam-name').val().trim();
        const sciName = $row.find('.inline-edit-fam-sci').val().trim();
        const ebirdCode = $row.find('.inline-edit-fam-ebird').val().trim();

        if (!newName) {
            customAlert('Family name is required');
            return;
        }

        const success = renameFamily(oldName, newName, ebirdCode, sciName);
        if (success) {
            editingTarget = null;
            if (expandedFamilies.has(oldName)) {
                expandedFamilies.delete(oldName);
                expandedFamilies.add(newName);
            }
            invalidateHierarchyCache();
            renderSpeciesHierarchy();
        }
    });

    // Delete Family
    $container.on('click.hierarchy', '.btn-delete-fam', function (e) {
        e.stopPropagation();
        const name = $(this).data('name');
        deleteFamily(name, () => {
            expandedFamilies.delete(name);
            invalidateHierarchyCache();
            renderSpeciesHierarchy();
        });
    });

    // Edit Species inline
    $container.on('click.hierarchy', '.btn-edit-sp-inline', function (e) {
        e.stopPropagation();
        const key = $(this).data('key');
        editingTarget = { type: 'species', key };
        renderSpeciesHierarchy();
    });

    // Delete Species
    $container.on('click.hierarchy', '.btn-delete-sp', function (e) {
        e.stopPropagation();
        const key = $(this).data('key');
        deleteSpecies(key, () => {
            invalidateHierarchyCache();
            renderSpeciesHierarchy();
        });
    });

    // Save Species inline
    $container.on('click.hierarchy', '.btn-save-sp-inline', function (e) {
        e.stopPropagation();
        const key = $(this).data('key');
        const $row = $(this).closest('tr');
        const name = $row.find('.inline-edit-sp-name').val().trim();
        const family = $row.find('.inline-edit-sp-family').val();
        const latinName = $row.find('.inline-edit-sp-latin').val().trim();
        const ebirdCode = $row.find('.inline-edit-sp-ebird').val().trim();
        const tags = $row.find('.inline-edit-sp-tags').val().trim();

        if (!name) {
            customAlert('Species name is required');
            return;
        }

        saveSpecies(key, name, tags, family, latinName, ebirdCode);
        editingTarget = null;
        invalidateHierarchyCache();
        renderSpeciesHierarchy();
    });

    // Cancel inline editing
    $container.on('click.hierarchy', '.btn-cancel-inline', function (e) {
        e.stopPropagation();
        editingTarget = null;
        renderSpeciesHierarchy();
    });

    // Edit in Form (populates update species form and switches to subtab 1)
    $container.on('click.hierarchy', '.btn-edit-sp-form', function (e) {
        e.stopPropagation();
        const key = $(this).data('key');
        setupSpeciesSubtabs('add-species-family');
        const $form = $('#update-species-form');
        if ($form.length) {
            $form.find('select[data-field="name"]').val(key).trigger('change');
            $('html, body').animate({ scrollTop: $form.offset().top - 80 }, 200);
        }
    });

    // View sightings count badge -> jump to sightings tab filtered by species
    $container.on('click.hierarchy', '.btn-view-sightings-badge', function (e) {
        e.stopPropagation();
        const spKey = $(this).data('species');
        $('.admin-nav-tab[data-tab="sightings-tab"]').click();
        const $filterInput = $('input[name="filter-sighting"]');
        if ($filterInput.length) {
            $filterInput.val(spKey).trigger('input');
        }
    });
}
