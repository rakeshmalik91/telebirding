import { data, syncStoriesData, uploadJSONData } from './data.js';
import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import { customAlert, customConfirm, showToast } from './ui.js';

let searchFilter = '';
const expandedSubTables = new Map(); // key: storyIndex, value: 'itinerary' | 'sightings' | 'images' | 'storyHtml'

export function moveStoryItem(fromIndex, toIndex, dropAfter) {
    if (fromIndex === toIndex || !data.stories || !data.stories[fromIndex] || !data.stories[toIndex]) {
        return;
    }
    const item = data.stories[fromIndex];
    data.stories.splice(fromIndex, 1);
    let targetPos = toIndex;
    if (fromIndex < toIndex) {
        targetPos = toIndex - 1;
    }
    if (dropAfter) {
        targetPos += 1;
    }
    data.stories.splice(targetPos, 0, item);
    expandedSubTables.clear();
    syncStoriesData();
    renderStoriesSheet();
}

export function moveItineraryDay(storyIdx, fromIdx, toIdx, dropAfter) {
    const itin = data.stories[storyIdx]?.itinerary;
    if (!itin || fromIdx === toIdx || !itin[fromIdx] || !itin[toIdx]) return;
    const item = itin[fromIdx];
    itin.splice(fromIdx, 1);
    let targetPos = toIdx;
    if (fromIdx < toIdx) targetPos = toIdx - 1;
    if (dropAfter) targetPos += 1;
    itin.splice(targetPos, 0, item);
    syncStoriesData();
    renderStoriesSheet();
}

export function setupStoriesTab() {
    const $tab = $('#stories-tab');
    if (!$tab.length) return;

    expandedSubTables.clear();
    searchFilter = '';
    renderStoriesSheet();
}

export function renderStoriesSheet() {
    const $tab = $('#stories-tab');
    if (!$tab.length) return;

    data.stories = data.stories || [];
    const storiesCount = data.stories.length;

    let html = `
        <div class="admin-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h2 style="margin: 0; border: none; padding: 0;">Stories (${storiesCount})</h2>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
                        Manage birding trip stories, itineraries, YouTube video integrations, and linked sightings.
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="spreadsheet-add-btn" id="add-story-btn" style="margin: 0;">
                        ➕ Add New Story
                    </button>
                    <button class="save-stories-btn" style="background-color: #22c55e; color: #fff; padding: 8px 16px; font-weight: 500; border-radius: 6px;">
                        💾 Save Stories
                    </button>
                </div>
            </div>

            <div class="spreadsheet-toolbar">
                <div style="font-size: 13px; color: #94a3b8;">
                    Click on Itinerary, Sightings, or HTML buttons to expand detailed sub-spreadsheets inline.
                </div>
                <div class="input-clear-wrapper" style="width: 260px;">
                    <input type="text" class="stories-filter" placeholder="Filter stories..." value="${searchFilter}" style="margin: 0 !important; width: 100%;" />
                    <span class="input-clear-btn" title="Clear">✕</span>
                </div>
            </div>

            <div class="spreadsheet-container">
                <table class="spreadsheet-table" id="stories-main-table">
                    <thead>
                        <tr>
                            <th style="width: 65px; text-align: center;">#</th>
                            <th style="min-width: 200px;">Title</th>
                            <th style="width: 170px;">Date</th>
                            <th style="width: 140px;">YouTube ID</th>
                            <th style="min-width: 180px;">Story HTML / Summary</th>
                            <th style="width: 110px; text-align: center;">Itinerary</th>
                            <th style="width: 110px; text-align: center;">Sightings</th>
                            <th style="width: 110px; text-align: center;">Images</th>
                            <th style="width: 80px; text-align: center;" title="Expand itinerary by default on public Home page">Itin. Open</th>
                            <th style="width: 60px; text-align: center;">Hidden</th>
                            <th style="width: 50px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    let displayedCount = 0;
    const filter = searchFilter.toLowerCase().trim();

    data.stories.forEach((story, index) => {
        const title = story.title || '';
        const date = story.date || '';
        const yt = story.youtubeVideoId || '';
        const htmlContent = story.storyHtml || '';
        const isHidden = Boolean(story.hidden);

        if (filter) {
            const matches = title.toLowerCase().includes(filter)
                || date.toLowerCase().includes(filter)
                || yt.toLowerCase().includes(filter)
                || htmlContent.toLowerCase().includes(filter);
            if (!matches) return;
        }

        displayedCount++;
        const activeSub = expandedSubTables.get(index);
        const itinCount = (story.itinerary || []).length;
        const sightingsCount = (story.sightings || []).length;
        const imagesCount = (story.images || []).length;

        // Strip tags for summary preview
        const textSummary = htmlContent.replace(/<[^>]*>?/gm, '').trim();

        html += `
            <tr data-index="${index}" class="story-main-row draggable-story-row ${activeSub ? 'has-expanded-sub' : ''}">
                <td style="text-align: center; width: 75px;">
                    <div class="spreadsheet-row-index story-drag-handle drag-handle" draggable="true" title="Drag to reorder" style="cursor: grab; display: flex; align-items: center; justify-content: center; gap: 4px; user-select: none;">
                        <span style="font-size: 16px; color: #64748b; line-height: 1;">⋮⋮</span>
                        <span style="color: #94a3b8; font-size: 12px; font-weight: 500;">${index + 1}</span>
                        <div style="display: flex; flex-direction: column;">
                            <button class="spreadsheet-move-btn move-story-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
                            <button class="spreadsheet-move-btn move-story-down" data-index="${index}" title="Move Down" ${index === data.stories.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
                        </div>
                    </div>
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input story-field" data-field="title" data-index="${index}" value="${escapeHtml(title)}" placeholder="Story Title" />
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input story-field" data-field="date" data-index="${index}" value="${escapeHtml(date)}" placeholder="e.g. Feb - Mar 2026" />
                </td>
                <td>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <input type="text" class="spreadsheet-cell-input story-field" data-field="youtubeVideoId" data-index="${index}" value="${escapeHtml(yt)}" placeholder="Video ID" />
                        <a href="${yt ? `https://www.youtube.com/watch?v=${escapeHtml(yt)}` : '#'}" target="_blank" class="open-yt-link" title="Watch on YouTube" style="text-decoration:none; font-size:14px; padding:2px; ${yt ? '' : 'display:none;'}">▶️</a>
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #cbd5e1; max-width: 220px;" title="${escapeHtml(textSummary)}">
                            ${textSummary || '<span style="color:#64748b; font-style:italic;">No text</span>'}
                        </div>
                        <button class="toggle-sub-btn ${activeSub === 'storyHtml' ? 'active-sub' : ''}" data-index="${index}" data-sub="storyHtml" title="Edit HTML/Text" style="padding: 3px 8px; font-size: 11px; white-space: nowrap;">
                            📝 Edit
                        </button>
                    </div>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-sub-btn ${activeSub === 'itinerary' ? 'active-sub' : ''}" data-index="${index}" data-sub="itinerary" style="padding: 4px 8px; font-size: 11px; width: 100%; border-radius: 4px;">
                        📅 ${itinCount} Days ${activeSub === 'itinerary' ? '▲' : '▼'}
                    </button>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-sub-btn ${activeSub === 'sightings' ? 'active-sub' : ''}" data-index="${index}" data-sub="sightings" style="padding: 4px 8px; font-size: 11px; width: 100%; border-radius: 4px;">
                        📍 ${sightingsCount} Links ${activeSub === 'sightings' ? '▲' : '▼'}
                    </button>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-sub-btn ${activeSub === 'images' ? 'active-sub' : ''}" data-index="${index}" data-sub="images" style="padding: 4px 8px; font-size: 11px; width: 100%; border-radius: 4px;">
                        🖼️ ${imagesCount} Photos ${activeSub === 'images' ? '▲' : '▼'}
                    </button>
                </td>
                <td style="text-align: center;" title="Expand itinerary by default on public Home page">
                    <input type="checkbox" class="story-checkbox" data-field="itineraryExpanded" data-index="${index}" ${Boolean(story.itineraryExpanded) ? 'checked' : ''} />
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="story-checkbox" data-field="hidden" data-index="${index}" ${isHidden ? 'checked' : ''} title="Hide Story" />
                </td>
                <td style="text-align: center;">
                    <button class="delete-sighting delete-story-btn" data-index="${index}" title="Delete Story" style="margin: 0 auto;">🗑️</button>
                </td>
            </tr>
        `;

        // Render expanded sub-table if active
        if (activeSub) {
            html += `
                <tr class="sub-table-row">
                    <td colspan="11" style="background: rgba(15, 23, 42, 0.95); padding: 12px 16px; border-left: 3px solid #38bdf8;">
                        ${renderSubTable(story, index, activeSub)}
                    </td>
                </tr>
            `;
        }
    });

    if (displayedCount === 0) {
        html += `<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 24px;">No stories found matching filter.</td></tr>`;
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    $tab.html(html);

    // Event handlers
    $tab.find('.stories-filter').on('input', function () {
        searchFilter = $(this).val();
        $(this).closest('.input-clear-wrapper').toggleClass('has-value', Boolean(searchFilter));
        renderStoriesSheet();
    });

    $tab.find('.input-clear-btn').click(function () {
        searchFilter = '';
        renderStoriesSheet();
    });

    // Drag and drop story row reordering
    $tab.find('.draggable-story-row').each(function () {
        const $row = $(this);
        const idx = parseInt($row.data('index'), 10);

        $row.find('.story-drag-handle').on('dragstart', function (e) {
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', String(idx));
            if (e.originalEvent.dataTransfer.setDragImage) {
                const rect = $row[0].getBoundingClientRect();
                e.originalEvent.dataTransfer.setDragImage($row[0], e.originalEvent.clientX - rect.left, e.originalEvent.clientY - rect.top);
            }
            $row.css('opacity', '0.4').addClass('is-dragging');
        }).on('dragend', function () {
            $row.css('opacity', '1').removeClass('is-dragging');
            $tab.find('tr').removeClass('drag-over-top drag-over-bottom');
        });

        $row.on('dragover', function (e) {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            const bounding = this.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.originalEvent.clientY > offset) {
                $(this).removeClass('drag-over-top').addClass('drag-over-bottom');
            } else {
                $(this).removeClass('drag-over-bottom').addClass('drag-over-top');
            }
        });

        $row.on('dragleave', function () {
            $(this).removeClass('drag-over-top drag-over-bottom');
        });

        $row.on('drop', function (e) {
            if (e.preventDefault) e.preventDefault();
            $(this).removeClass('drag-over-top drag-over-bottom');
            const fromIdxStr = e.originalEvent.dataTransfer.getData('text/plain');
            const fromIdx = parseInt(fromIdxStr, 10);
            const toIdx = idx;
            if (!isNaN(fromIdx) && !isNaN(toIdx) && fromIdx !== toIdx) {
                const bounding = this.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                const dropAfter = e.originalEvent.clientY > offset;
                moveStoryItem(fromIdx, toIdx, dropAfter);
            }
        });
    });

    // Delegate dragover and drop on expanded sub-table row to parent story
    $tab.find('.sub-table-row').each(function () {
        const $subRow = $(this);
        const $prevMainRow = $subRow.prev('.draggable-story-row');
        const idx = parseInt($prevMainRow.data('index'), 10);

        $subRow.on('dragover', function (e) {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            $prevMainRow.removeClass('drag-over-top').addClass('drag-over-bottom');
        });

        $subRow.on('dragleave', function () {
            $prevMainRow.removeClass('drag-over-top drag-over-bottom');
        });

        $subRow.on('drop', function (e) {
            if (e.preventDefault) e.preventDefault();
            $prevMainRow.removeClass('drag-over-top drag-over-bottom');
            const fromIdxStr = e.originalEvent.dataTransfer.getData('text/plain');
            const fromIdx = parseInt(fromIdxStr, 10);
            const toIdx = idx;
            if (!isNaN(fromIdx) && !isNaN(toIdx) && fromIdx !== toIdx) {
                moveStoryItem(fromIdx, toIdx, true);
            }
        });
    });

    $tab.find('.story-field').on('change input', function () {
        const idx = $(this).data('index');
        const field = $(this).data('field');
        const val = $(this).val().trim();
        if (data.stories[idx]) {
            data.stories[idx][field] = val;
            if (field === 'youtubeVideoId') {
                const $row = $(this).closest('tr');
                const $ytLink = $row.find('.open-yt-link');
                if (val) {
                    $ytLink.attr('href', `https://www.youtube.com/watch?v=${encodeURIComponent(val)}`).show();
                } else {
                    $ytLink.attr('href', '#').hide();
                }
            }
            syncStoriesData();
        }
    });

    $tab.on('click', '.open-yt-link', function (e) {
        const $row = $(this).closest('tr');
        const val = $row.find('input[data-field="youtubeVideoId"]').val().trim();
        if (!val) {
            e.preventDefault();
            return;
        }
        $(this).attr('href', `https://www.youtube.com/watch?v=${encodeURIComponent(val)}`);
    });

    $tab.find('.story-checkbox').on('change', function () {
        const idx = $(this).data('index');
        const field = $(this).data('field');
        const isChecked = $(this).is(':checked');
        if (data.stories[idx]) {
            if (field === 'itineraryExpanded') {
                data.stories[idx].itineraryExpanded = isChecked;
                $tab.find(`.sub-itin-expanded-checkbox[data-story-idx="${idx}"]`).prop('checked', isChecked);
            } else {
                if (isChecked) {
                    data.stories[idx][field] = true;
                } else {
                    delete data.stories[idx][field];
                }
            }
            syncStoriesData();
        }
    });

    $tab.find('.move-story-up').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        if (idx > 0) {
            const temp = data.stories[idx];
            data.stories[idx] = data.stories[idx - 1];
            data.stories[idx - 1] = temp;
            syncStoriesData();
            renderStoriesSheet();
        }
    });

    $tab.find('.move-story-down').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        if (idx < data.stories.length - 1) {
            const temp = data.stories[idx];
            data.stories[idx] = data.stories[idx + 1];
            data.stories[idx + 1] = temp;
            syncStoriesData();
            renderStoriesSheet();
        }
    });

    $tab.find('.delete-story-btn').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        const story = data.stories[idx];
        const label = story?.title || `Story #${idx + 1}`;
        customConfirm(`Are you sure you want to permanently delete story "${label}"?`, () => {
            data.stories.splice(idx, 1);
            expandedSubTables.delete(idx);
            syncStoriesData();
            renderStoriesSheet();
        });
    });

    $tab.find('#add-story-btn').click(function () {
        data.stories.unshift({
            title: 'New Story',
            date: moment().format('MMMM YYYY'),
            youtubeVideoId: '',
            storyHtml: '<p>Story description here...</p>',
            itineraryExpanded: false,
            itinerary: [],
            sightings: [],
            images: []
        });
        syncStoriesData();
        renderStoriesSheet();
        setTimeout(() => {
            $tab.find('tr[data-index="0"] input[data-field="title"]').focus().select();
        }, 50);
    });

    $tab.find('.save-stories-btn').click(async function () {
        const $btn = $(this);
        $btn.text('Saving...').attr('disabled', 'disabled');
        try {
            await uploadJSONData('stories', true);
            showToast('Stories saved successfully!', 'success');
        } catch (e) {
            showToast('Failed to save stories: ' + e.message, 'error');
        } finally {
            $btn.text('💾 Save Stories').removeAttr('disabled');
        }
    });

    // Sub-table toggle
    $tab.find('.toggle-sub-btn').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        const sub = $(this).data('sub');
        if (expandedSubTables.get(idx) === sub) {
            expandedSubTables.delete(idx);
        } else {
            expandedSubTables.set(idx, sub);
        }
        renderStoriesSheet();
    });

    // Bind sub-table events
    bindSubTableEvents($tab);
}

function renderSubTable(story, storyIndex, subType) {
    if (subType === 'itinerary') {
        const itinerary = story.itinerary || [];
        let html = `
            <div class="sub-spreadsheet-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <div style="font-weight: 600; color: #38bdf8; font-size: 13px;">
                        📅 Itinerary for: ${escapeHtml(story.title || 'Untitled Story')} (${itinerary.length} Days)
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #cbd5e1; cursor: pointer; user-select: none;">
                            <input type="checkbox" class="sub-itin-expanded-checkbox" data-story-idx="${storyIndex}" ${story.itineraryExpanded ? 'checked' : ''} />
                            <span>Expanded by default on Home</span>
                        </label>
                        <button class="spreadsheet-add-btn add-itinerary-btn" data-story-idx="${storyIndex}" style="padding: 4px 10px; font-size: 12px; margin: 0;">
                            ➕ Add Day
                        </button>
                    </div>
                </div>
                <table class="spreadsheet-table" style="background: #1e293b;">
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">Day #</th>
                            <th style="width: 180px;">Date (e.g. 25/02/2026)</th>
                            <th>Activity Description</th>
                            <th style="width: 60px; text-align: center;">Order</th>
                            <th style="width: 50px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        itinerary.forEach((item, dayIdx) => {
            html += `
                <tr data-story-idx="${storyIndex}" data-day-idx="${dayIdx}" class="draggable-itin-row">
                    <td style="text-align: center; color: #94a3b8;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span class="itin-drag-handle drag-handle" draggable="true" title="Drag to reorder day" style="cursor: grab; font-size: 13px; color: #64748b; user-select: none;">⋮⋮</span>
                            <span>${dayIdx + 1}</span>
                        </div>
                    </td>
                    <td>
                        <input type="text" class="spreadsheet-cell-input itin-field" data-story-idx="${storyIndex}" data-day-idx="${dayIdx}" data-field="date" value="${escapeHtml(item.date || '')}" placeholder="Date" />
                    </td>
                    <td>
                        <textarea class="spreadsheet-cell-textarea itin-field" data-story-idx="${storyIndex}" data-day-idx="${dayIdx}" data-field="activity" placeholder="Activity details">${escapeHtml(item.activity || '')}</textarea>
                    </td>
                    <td style="text-align: center;">
                        <button class="spreadsheet-move-btn move-itin-up" data-story-idx="${storyIndex}" data-day-idx="${dayIdx}" ${dayIdx === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
                        <button class="spreadsheet-move-btn move-itin-down" data-story-idx="${storyIndex}" data-day-idx="${dayIdx}" ${dayIdx === itinerary.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
                    </td>
                    <td style="text-align: center;">
                        <button class="delete-sighting delete-itin-btn" data-story-idx="${storyIndex}" data-day-idx="${dayIdx}" title="Delete Day" style="margin: 0 auto;">🗑️</button>
                    </td>
                </tr>
            `;
        });
        if (itinerary.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:12px;">No itinerary days added yet. Click "+ Add Day" to add one.</td></tr>`;
        }
        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    if (subType === 'sightings') {
        const sightings = story.sightings || [];
        let html = `
            <div class="sub-spreadsheet-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; color: #38bdf8; font-size: 13px;">
                        📍 Linked Sightings Filters for: ${escapeHtml(story.title || 'Untitled Story')} (${sightings.length} Links)
                    </div>
                    <button class="spreadsheet-add-btn add-sighting-link-btn" data-story-idx="${storyIndex}" style="padding: 4px 10px; font-size: 12px; margin: 0;">
                        ➕ Add Sightings Link
                    </button>
                </div>
                <table class="spreadsheet-table" style="background: #1e293b;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">#</th>
                            <th style="min-width: 200px;">Button / Link Display Text</th>
                            <th style="width: 200px;">Place Filter Param</th>
                            <th style="width: 140px;">Date Filter Param</th>
                            <th style="width: 50px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        sightings.forEach((item, linkIdx) => {
            const text = item.text || '';
            const place = item.params?.place || '';
            const date = item.params?.date || '';
            html += `
                <tr>
                    <td style="text-align: center; color: #94a3b8;">${linkIdx + 1}</td>
                    <td>
                        <input type="text" class="spreadsheet-cell-input sighting-link-field" data-story-idx="${storyIndex}" data-link-idx="${linkIdx}" data-field="text" value="${escapeHtml(text)}" placeholder="e.g. Andaman Sightings" />
                    </td>
                    <td>
                        <input type="text" class="spreadsheet-cell-input sighting-link-field" data-story-idx="${storyIndex}" data-link-idx="${linkIdx}" data-field="place" value="${escapeHtml(place)}" placeholder="e.g. Andaman & Nicobar Islands" />
                    </td>
                    <td>
                        <input type="text" class="spreadsheet-cell-input sighting-link-field" data-story-idx="${storyIndex}" data-link-idx="${linkIdx}" data-field="date" value="${escapeHtml(date)}" placeholder="e.g. 2026" />
                    </td>
                    <td style="text-align: center;">
                        <button class="delete-sighting delete-sighting-link-btn" data-story-idx="${storyIndex}" data-link-idx="${linkIdx}" title="Delete Link" style="margin: 0 auto;">🗑️</button>
                    </td>
                </tr>
            `;
        });
        if (sightings.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:12px;">No sightings filter links added yet.</td></tr>`;
        }
        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    if (subType === 'images') {
        const images = story.images || [];
        let html = `
            <div class="sub-spreadsheet-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; color: #38bdf8; font-size: 13px;">
                        🖼️ Story Photos for: ${escapeHtml(story.title || 'Untitled Story')} (${images.length} Photos)
                    </div>
                    <button class="spreadsheet-add-btn add-story-image-btn" data-story-idx="${storyIndex}" style="padding: 4px 10px; font-size: 12px; margin: 0;">
                        ➕ Add Photo
                    </button>
                </div>
                <table class="spreadsheet-table" style="background: #1e293b;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">#</th>
                            <th style="width: 60px; text-align: center;">Preview</th>
                            <th>Image Path (src)</th>
                            <th style="width: 50px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        images.forEach((imgSrc, imgIdx) => {
            const previewUrl = imgSrc ? Util.getMedia(imgSrc) : '';
            html += `
                <tr>
                    <td style="text-align: center; color: #94a3b8;">${imgIdx + 1}</td>
                    <td style="text-align: center;">
                        ${imgSrc ? `<img src="${previewUrl}" class="spreadsheet-thumb preview-story-img" data-src="${previewUrl}" onerror="this.style.display='none'" />` : '<span style="color:#64748b; font-size:11px;">No img</span>'}
                    </td>
                    <td>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <input type="text" class="spreadsheet-cell-input story-img-field" data-story-idx="${storyIndex}" data-img-idx="${imgIdx}" value="${escapeHtml(imgSrc)}" placeholder="images/... or featured-images/..." />
                            <label class="spreadsheet-upload-btn" title="Upload image" style="cursor: pointer; padding: 4px 6px; background: rgba(255,255,255,0.08); border-radius: 4px; font-size: 14px;">
                                📁
                                <input type="file" class="story-file-upload" data-story-idx="${storyIndex}" data-img-idx="${imgIdx}" accept="image/*" style="display: none;" />
                            </label>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button class="delete-sighting delete-story-img-btn" data-story-idx="${storyIndex}" data-img-idx="${imgIdx}" title="Delete Photo" style="margin: 0 auto;">🗑️</button>
                    </td>
                </tr>
            `;
        });
        if (images.length === 0) {
            html += `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:12px;">No photos added yet. Click "+ Add Photo" to add one.</td></tr>`;
        }
        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    if (subType === 'storyHtml') {
        return `
            <div class="sub-spreadsheet-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; color: #38bdf8; font-size: 13px;">
                        📝 Story HTML Content for: ${escapeHtml(story.title || 'Untitled Story')}
                    </div>
                    <button class="toggle-sub-btn" data-index="${storyIndex}" data-sub="storyHtml" style="padding: 4px 10px; font-size: 12px; background: rgba(255,255,255,0.1); border-radius: 4px; border: none; color: #fff;">
                        ✕ Close Editor
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">HTML Source:</div>
                        <textarea class="spreadsheet-cell-textarea story-html-source" data-story-idx="${storyIndex}" style="height: 180px; font-family: monospace; font-size: 12px;">${escapeHtml(story.storyHtml || '')}</textarea>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">Live Preview:</div>
                        <div class="story-html-preview" data-story-idx="${storyIndex}" style="height: 180px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 10px; font-size: 13px; line-height: 1.5;">
                            ${story.storyHtml || '<span style="color:#64748b;">(No preview available)</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return '';
}

function bindSubTableEvents($tab) {
    // Itinerary expanded toggle
    $tab.find('.sub-itin-expanded-checkbox').on('change', function () {
        const storyIdx = $(this).data('story-idx');
        const isChecked = $(this).is(':checked');
        if (data.stories[storyIdx]) {
            data.stories[storyIdx].itineraryExpanded = isChecked;
            $tab.find(`.story-checkbox[data-field="itineraryExpanded"][data-index="${storyIdx}"]`).prop('checked', isChecked);
            syncStoriesData();
        }
    });

    // Drag and drop itinerary days
    $tab.find('.draggable-itin-row').each(function () {
        const $row = $(this);
        const storyIdx = $(this).data('story-idx');
        const dayIdx = parseInt($(this).data('day-idx'), 10);

        $row.find('.itin-drag-handle').on('dragstart', function (e) {
            e.stopPropagation();
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', String(dayIdx));
            if (e.originalEvent.dataTransfer.setDragImage) {
                const rect = $row[0].getBoundingClientRect();
                e.originalEvent.dataTransfer.setDragImage($row[0], e.originalEvent.clientX - rect.left, e.originalEvent.clientY - rect.top);
            }
            $row.css('opacity', '0.4').addClass('is-dragging');
        }).on('dragend', function () {
            $row.css('opacity', '1').removeClass('is-dragging');
            $tab.find('.draggable-itin-row').removeClass('drag-over-top drag-over-bottom');
        });

        $row.on('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            const bounding = this.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.originalEvent.clientY > offset) {
                $(this).removeClass('drag-over-top').addClass('drag-over-bottom');
            } else {
                $(this).removeClass('drag-over-bottom').addClass('drag-over-top');
            }
        });

        $row.on('dragleave', function () {
            $(this).removeClass('drag-over-top drag-over-bottom');
        });

        $row.on('drop', function (e) {
            if (e.preventDefault) e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over-top drag-over-bottom');
            const fromIdx = parseInt(e.originalEvent.dataTransfer.getData('text/plain'), 10);
            const toIdx = dayIdx;
            if (!isNaN(fromIdx) && !isNaN(toIdx) && fromIdx !== toIdx) {
                const bounding = this.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                const dropAfter = e.originalEvent.clientY > offset;
                moveItineraryDay(storyIdx, fromIdx, toIdx, dropAfter);
            }
        });
    });

    // Itinerary input
    $tab.find('.itin-field').on('change input', function () {
        const storyIdx = $(this).data('story-idx');
        const dayIdx = $(this).data('day-idx');
        const field = $(this).data('field');
        const val = $(this).val();
        if (data.stories[storyIdx]?.itinerary?.[dayIdx]) {
            data.stories[storyIdx].itinerary[dayIdx][field] = val;
            syncStoriesData();
        }
    });

    // Move itinerary
    $tab.find('.move-itin-up').click(function () {
        const storyIdx = $(this).data('story-idx');
        const dayIdx = parseInt($(this).data('day-idx'), 10);
        const itin = data.stories[storyIdx]?.itinerary;
        if (itin && dayIdx > 0) {
            const temp = itin[dayIdx];
            itin[dayIdx] = itin[dayIdx - 1];
            itin[dayIdx - 1] = temp;
            syncStoriesData();
            renderStoriesSheet();
        }
    });

    $tab.find('.move-itin-down').click(function () {
        const storyIdx = $(this).data('story-idx');
        const dayIdx = parseInt($(this).data('day-idx'), 10);
        const itin = data.stories[storyIdx]?.itinerary;
        if (itin && dayIdx < itin.length - 1) {
            const temp = itin[dayIdx];
            itin[dayIdx] = itin[dayIdx + 1];
            itin[dayIdx + 1] = temp;
            syncStoriesData();
            renderStoriesSheet();
        }
    });

    // Delete itinerary day
    $tab.find('.delete-itin-btn').click(function () {
        const storyIdx = $(this).data('story-idx');
        const dayIdx = parseInt($(this).data('day-idx'), 10);
        data.stories[storyIdx].itinerary.splice(dayIdx, 1);
        syncStoriesData();
        renderStoriesSheet();
    });

    // Add itinerary day
    $tab.find('.add-itinerary-btn').click(function () {
        const storyIdx = $(this).data('story-idx');
        data.stories[storyIdx].itinerary = data.stories[storyIdx].itinerary || [];
        data.stories[storyIdx].itinerary.push({
            date: moment().format('DD/MM/YYYY'),
            activity: ''
        });
        syncStoriesData();
        renderStoriesSheet();
    });

    // Sightings link inputs
    $tab.find('.sighting-link-field').on('change input', function () {
        const storyIdx = $(this).data('story-idx');
        const linkIdx = $(this).data('link-idx');
        const field = $(this).data('field');
        const val = $(this).val().trim();
        const item = data.stories[storyIdx]?.sightings?.[linkIdx];
        if (item) {
            if (field === 'text') {
                item.text = val;
            } else {
                item.params = item.params || {};
                item.params[field] = val;
            }
            syncStoriesData();
        }
    });

    $tab.find('.delete-sighting-link-btn').click(function () {
        const storyIdx = $(this).data('story-idx');
        const linkIdx = parseInt($(this).data('link-idx'), 10);
        data.stories[storyIdx].sightings.splice(linkIdx, 1);
        syncStoriesData();
        renderStoriesSheet();
    });

    $tab.find('.add-sighting-link-btn').click(function () {
        const storyIdx = $(this).data('story-idx');
        data.stories[storyIdx].sightings = data.stories[storyIdx].sightings || [];
        data.stories[storyIdx].sightings.push({
            text: 'Sightings',
            params: {
                place: data.stories[storyIdx].title || '',
                date: ''
            }
        });
        syncStoriesData();
        renderStoriesSheet();
    });

    // Story image inputs
    $tab.find('.story-img-field').on('change input', function () {
        const storyIdx = $(this).data('story-idx');
        const imgIdx = $(this).data('img-idx');
        const val = $(this).val().trim();
        if (data.stories[storyIdx]?.images) {
            data.stories[storyIdx].images[imgIdx] = val;
            syncStoriesData();
        }
    });

    $tab.find('.delete-story-img-btn').click(function () {
        const storyIdx = $(this).data('story-idx');
        const imgIdx = parseInt($(this).data('img-idx'), 10);
        data.stories[storyIdx].images.splice(imgIdx, 1);
        syncStoriesData();
        renderStoriesSheet();
    });

    $tab.find('.add-story-image-btn').click(function () {
        const storyIdx = $(this).data('story-idx');
        data.stories[storyIdx].images = data.stories[storyIdx].images || [];
        data.stories[storyIdx].images.push('');
        syncStoriesData();
        renderStoriesSheet();
    });

    $tab.find('.story-file-upload').on('change', async function () {
        const storyIdx = $(this).data('story-idx');
        const imgIdx = $(this).data('img-idx');
        const file = this.files && this.files[0];
        if (!file) return;

        const storagePath = `images/story-${Math.floor(Date.now() / 1000)}-${file.name}`;
        showToast(`Uploading ${file.name}...`, 'info');
        try {
            await FirebaseApi.getFirebase().storage().ref(storagePath).put(file);
            data.stories[storyIdx].images[imgIdx] = storagePath;
            syncStoriesData();
            showToast(`Uploaded ${file.name}!`, 'success');
            renderStoriesSheet();
        } catch (e) {
            customAlert(`Failed to upload image: ${e.message}`);
        }
    });

    // Story HTML source input
    $tab.find('.story-html-source').on('input', function () {
        const storyIdx = $(this).data('story-idx');
        const val = $(this).val();
        if (data.stories[storyIdx]) {
            data.stories[storyIdx].storyHtml = val;
            $tab.find(`.story-html-preview[data-story-idx="${storyIdx}"]`).html(val || '<span style="color:#64748b;">(No preview available)</span>');
            syncStoriesData();
        }
    });

    // Story photo preview click
    $tab.find('.preview-story-img').click(function () {
        const src = $(this).data('src');
        if (src) {
            $('#media-popup-video').hide().attr('src', '');
            $('#media-popup-img').show().attr('src', src);
            $('#media-popup').fadeIn(200);
        }
    });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
