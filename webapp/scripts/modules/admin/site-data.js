import { data, syncSiteData, uploadJSONData, replaceCameraModelInAllModes, replaceAuthorInAllModes } from './data.js';
import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import { customAlert, customConfirm, showToast } from './ui.js';

let activeSheet = 'featured'; // 'featured' | 'camera_model' | 'author'
let searchFilter = '';

export function moveFeaturedItem(fromIndex, toIndex, dropAfter) {
    if (fromIndex === toIndex || !data.featured || !data.featured[fromIndex] || !data.featured[toIndex]) {
        return;
    }
    const item = data.featured[fromIndex];
    data.featured.splice(fromIndex, 1);
    let targetPos = toIndex;
    if (fromIndex < toIndex) {
        targetPos = toIndex - 1;
    }
    if (dropAfter) {
        targetPos += 1;
    }
    data.featured.splice(targetPos, 0, item);
    syncSiteData();
    renderActiveSheet();
}

export function setActiveSheet(sheet) {
    if (sheet) activeSheet = sheet;
}

export function setupSiteDataTab(sheet) {
    const $tab = $('#site-data-tab');
    if (!$tab.length) return;

    if (sheet) {
        activeSheet = sheet;
    } else {
        activeSheet = 'featured';
    }
    searchFilter = '';
    renderSiteData();
}

export function renderSiteData() {
    const $tab = $('#site-data-tab');
    if (!$tab.length) return;

    const featuredCount = (data.featured || []).length;
    const cameraCount = Object.keys(data.camera_model || {}).length;
    const authorCount = Object.keys(data.author || {}).length;

    let html = `
        <div class="admin-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h2 style="margin: 0; border: none; padding: 0;">Site Data</h2>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
                        Manage global site metadata: featured images, camera &amp; lens definitions, and authors.
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="save-site-data-btn" style="background-color: #22c55e; color: #fff; padding: 8px 16px; font-weight: 500; border-radius: 6px;">
                        💾 Save Site Data
                    </button>
                </div>
            </div>

            <!-- Spreadsheet Sheet Navigation & Filter Toolbar -->
            <div class="spreadsheet-toolbar">
                <div class="spreadsheet-sheet-tabs">
                    <button class="spreadsheet-sheet-tab ${activeSheet === 'featured' ? 'active' : ''}" data-sheet="featured">
                        🖼️ Featured Images (${featuredCount})
                    </button>
                    <button class="spreadsheet-sheet-tab ${activeSheet === 'camera_model' ? 'active' : ''}" data-sheet="camera_model">
                        📷 Camera &amp; Lenses (${cameraCount})
                    </button>
                    <button class="spreadsheet-sheet-tab ${activeSheet === 'author' ? 'active' : ''}" data-sheet="author">
                        ✍️ Authors (${authorCount})
                    </button>
                </div>

                <div class="input-clear-wrapper" style="width: 240px;">
                    <input type="text" class="site-data-filter" placeholder="Filter rows..." value="${searchFilter}" style="margin: 0 !important; width: 100%;" />
                    <span class="input-clear-btn" title="Clear">✕</span>
                </div>
            </div>

            <div class="spreadsheet-container">
                <div id="site-data-sheet-content"></div>
            </div>
        </div>
    `;

    $tab.html(html);

    // Event listeners for toolbar
    $tab.find('.spreadsheet-sheet-tab').click(function () {
        activeSheet = $(this).data('sheet');
        $tab.find('.spreadsheet-sheet-tab').removeClass('active');
        $(this).addClass('active');
        renderActiveSheet();
    });

    $tab.find('.site-data-filter').on('input', function () {
        searchFilter = $(this).val().toLowerCase().trim();
        $(this).closest('.input-clear-wrapper').toggleClass('has-value', Boolean(searchFilter));
        renderActiveSheet();
    });

    $tab.find('.input-clear-btn').click(function () {
        searchFilter = '';
        const $input = $(this).closest('.input-clear-wrapper').find('input');
        $input.val('');
        $(this).closest('.input-clear-wrapper').removeClass('has-value');
        renderActiveSheet();
    });

    $tab.find('.save-site-data-btn').click(async function () {
        const $btn = $(this);
        $btn.text('Saving...').attr('disabled', 'disabled');
        try {
            await uploadJSONData('site-data', true);
            showToast('Site data saved successfully!', 'success');
        } catch (e) {
            showToast('Failed to save site data: ' + e.message, 'error');
        } finally {
            $btn.text('💾 Save Site Data').removeAttr('disabled');
        }
    });

    renderActiveSheet();
}

function renderActiveSheet() {
    const $container = $('#site-data-sheet-content');
    if (!$container.length) return;

    if (activeSheet === 'featured') {
        renderFeaturedSheet($container);
    } else if (activeSheet === 'camera_model') {
        renderCameraModelSheet($container);
    } else if (activeSheet === 'author') {
        renderAuthorSheet($container);
    }
}

// ----------------------------------------------------
// Sheet 1: Featured Images
// ----------------------------------------------------
function renderFeaturedSheet($container) {
    data.featured = data.featured || [];
    const filter = searchFilter;

    let html = `
        <table class="spreadsheet-table">
            <thead>
                <tr>
                    <th style="width: 70px; text-align: center;">#</th>
                    <th style="width: 60px; text-align: center;">Preview</th>
                    <th style="width: 250px;">Image Path (src)</th>
                    <th style="min-width: 220px;">Title Line 1</th>
                    <th style="min-width: 180px;">Title Line 2</th>
                    <th style="width: 120px;">Title Color</th>
                    <th style="width: 160px;">Alt Text</th>
                    <th style="width: 50px; text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    let displayedCount = 0;
    data.featured.forEach((item, index) => {
        const src = item.src || '';
        const titleLine1 = item.titleLine1 || '';
        const titleLine2 = item.titleLine2 || '';
        const titleColor = item.titleColor || '';
        const alt = item.alt || '';

        // Apply filter
        if (filter) {
            const matches = src.toLowerCase().includes(filter)
                || titleLine1.toLowerCase().includes(filter)
                || titleLine2.toLowerCase().includes(filter)
                || alt.toLowerCase().includes(filter);
            if (!matches) return;
        }

        displayedCount++;
        const previewUrl = src ? Util.getMedia(src) : '';

        html += `
            <tr data-index="${index}" class="draggable-featured-row">
                <td style="text-align: center; width: 75px;">
                    <div class="spreadsheet-row-index featured-drag-handle drag-handle" draggable="true" title="Drag to reorder" style="cursor: grab; display: flex; align-items: center; justify-content: center; gap: 4px; user-select: none;">
                        <span style="font-size: 16px; color: #64748b; line-height: 1;">⋮⋮</span>
                        <span style="color: #94a3b8; font-size: 12px; font-weight: 500;">${index + 1}</span>
                        <div style="display: flex; flex-direction: column;">
                            <button class="spreadsheet-move-btn move-featured-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
                            <button class="spreadsheet-move-btn move-featured-down" data-index="${index}" title="Move Down" ${index === data.featured.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
                        </div>
                    </div>
                </td>
                <td style="text-align: center;">
                    ${src ? `<img src="${previewUrl}" class="spreadsheet-thumb preview-image-click" data-src="${previewUrl}" title="Click to view" onerror="this.style.display='none'" />` : '<span style="color:#64748b; font-size:11px;">No img</span>'}
                </td>
                <td>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <input type="text" class="spreadsheet-cell-input featured-field" data-field="src" data-index="${index}" value="${escapeHtml(src)}" placeholder="e.g. featured-images/owl.jpg" />
                        <label class="spreadsheet-upload-btn" title="Upload new image" style="cursor: pointer; padding: 4px 6px; background: rgba(255,255,255,0.08); border-radius: 4px; font-size: 14px;">
                            📁
                            <input type="file" class="featured-file-upload" data-index="${index}" accept="image/*" style="display: none;" />
                        </label>
                    </div>
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input featured-field" data-field="titleLine1" data-index="${index}" value="${escapeHtml(titleLine1)}" placeholder="Subject, Place, Country" />
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input featured-field" data-field="titleLine2" data-index="${index}" value="${escapeHtml(titleLine2)}" placeholder="© Author, Year" />
                </td>
                <td>
                    <select class="spreadsheet-cell-input featured-field" data-field="titleColor" data-index="${index}">
                        <option value="" ${!titleColor ? 'selected' : ''}>White</option>
                        <option value="black" ${titleColor === 'black' ? 'selected' : ''}>Black</option>
                    </select>
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input featured-field" data-field="alt" data-index="${index}" value="${escapeHtml(alt)}" placeholder="Alt Text" />
                </td>
                <td style="text-align: center;">
                    <button class="delete-sighting delete-featured-btn" data-index="${index}" title="Delete Featured Image" style="margin: 0 auto;">🗑️</button>
                </td>
            </tr>
        `;
    });

    if (displayedCount === 0) {
        html += `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 24px;">No featured images found matching filter.</td></tr>`;
    }

    html += `
            </tbody>
        </table>
        <div style="padding: 12px;">
            <button class="spreadsheet-add-btn" id="add-featured-btn">➕ Add Featured Image</button>
        </div>
    `;

    $container.html(html);

    // Event handlers
    $container.find('.featured-field').on('change input', function () {
        const idx = $(this).data('index');
        const field = $(this).data('field');
        const val = $(this).val().trim();
        if (data.featured[idx]) {
            if (val) {
                data.featured[idx][field] = val;
            } else {
                delete data.featured[idx][field];
            }
            syncSiteData();
        }
    });

    // Drag and drop row reordering
    $container.find('.draggable-featured-row').each(function () {
        const $row = $(this);
        const idx = parseInt($row.data('index'), 10);

        $row.find('.featured-drag-handle').on('dragstart', function (e) {
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', String(idx));
            if (e.originalEvent.dataTransfer.setDragImage) {
                const rect = $row[0].getBoundingClientRect();
                e.originalEvent.dataTransfer.setDragImage($row[0], e.originalEvent.clientX - rect.left, e.originalEvent.clientY - rect.top);
            }
            $row.css('opacity', '0.4').addClass('is-dragging');
        }).on('dragend', function () {
            $row.css('opacity', '1').removeClass('is-dragging');
            $container.find('tr').removeClass('drag-over-top drag-over-bottom');
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
                moveFeaturedItem(fromIdx, toIdx, dropAfter);
            }
        });
    });

    $container.find('.move-featured-up').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        if (idx > 0) {
            const temp = data.featured[idx];
            data.featured[idx] = data.featured[idx - 1];
            data.featured[idx - 1] = temp;
            syncSiteData();
            renderActiveSheet();
        }
    });

    $container.find('.move-featured-down').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        if (idx < data.featured.length - 1) {
            const temp = data.featured[idx];
            data.featured[idx] = data.featured[idx + 1];
            data.featured[idx + 1] = temp;
            syncSiteData();
            renderActiveSheet();
        }
    });

    $container.find('.delete-featured-btn').click(function () {
        const idx = parseInt($(this).data('index'), 10);
        const item = data.featured[idx];
        const label = item?.titleLine1 || item?.src || `Item #${idx + 1}`;
        customConfirm(`Are you sure you want to remove featured image "${label}"?`, () => {
            data.featured.splice(idx, 1);
            syncSiteData();
            renderSiteData();
        });
    });

    $container.find('#add-featured-btn').click(function () {
        data.featured.push({
            src: '',
            titleLine1: '',
            titleLine2: '',
            alt: ''
        });
        syncSiteData();
        renderSiteData();
        setTimeout(() => {
            $container.find(`tr[data-index="${data.featured.length - 1}"] input[data-field="src"]`).focus();
        }, 50);
    });

    $container.find('.featured-file-upload').on('change', async function () {
        const idx = $(this).data('index');
        const file = this.files && this.files[0];
        if (!file) return;

        const storagePath = `featured-images/${file.name}`;
        showToast(`Uploading ${file.name}...`, 'info');
        try {
            await FirebaseApi.getFirebase().storage().ref(storagePath).put(file);
            data.featured[idx].src = storagePath;
            syncSiteData();
            showToast(`Uploaded ${file.name}!`, 'success');
            renderActiveSheet();
        } catch (e) {
            customAlert(`Failed to upload image: ${e.message}`);
        }
    });

    $container.find('.preview-image-click').click(function () {
        const src = $(this).data('src');
        if (src) {
            $('#media-popup-video').hide().attr('src', '');
            $('#media-popup-img').show().attr('src', src);
            $('#media-popup').fadeIn(200);
        }
    });
}

// ----------------------------------------------------
// Sheet 2: Camera & Lens Models
// ----------------------------------------------------
function renderCameraModelSheet($container) {
    data.camera_model = data.camera_model || {};
    const filter = searchFilter;
    const entries = Object.entries(data.camera_model);

    let html = `
        <table class="spreadsheet-table">
            <thead>
                <tr>
                    <th style="width: 60px; text-align: center;">#</th>
                    <th style="width: 220px;">Code / Key (e.g. S7RV)</th>
                    <th style="min-width: 300px;">Full Model Name (e.g. Sony α7rmV)</th>
                    <th style="width: 60px; text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    let displayedCount = 0;
    entries.forEach(([code, name], index) => {
        if (filter) {
            const matches = code.toLowerCase().includes(filter) || name.toLowerCase().includes(filter);
            if (!matches) return;
        }

        displayedCount++;
        html += `
            <tr data-orig-code="${escapeHtml(code)}">
                <td style="text-align: center; color: #94a3b8;">${index + 1}</td>
                <td>
                    <input type="text" class="spreadsheet-cell-input camera-code-input" value="${escapeHtml(code)}" placeholder="Code (e.g. NZ8)" />
                </td>
                <td>
                    <input type="text" class="spreadsheet-cell-input camera-name-input" value="${escapeHtml(name)}" placeholder="Full Model Name" />
                </td>
                <td style="text-align: center;">
                    <button class="delete-sighting delete-camera-btn" data-code="${escapeHtml(code)}" title="Delete Camera Model" style="margin: 0 auto;">🗑️</button>
                </td>
            </tr>
        `;
    });

    if (displayedCount === 0) {
        html += `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 24px;">No camera models found matching filter.</td></tr>`;
    }

    html += `
            </tbody>
        </table>
        <div style="padding: 12px;">
            <button class="spreadsheet-add-btn" id="add-camera-btn">➕ Add Camera / Lens Model</button>
        </div>
    `;

    $container.html(html);

    // Code change handler
    $container.find('.camera-code-input').on('change', function () {
        const $row = $(this).closest('tr');
        const origCode = $row.data('orig-code');
        const newCode = $(this).val().trim();
        const currentName = $row.find('.camera-name-input').val().trim();

        if (!newCode) {
            customAlert('Camera model code cannot be empty.');
            $(this).val(origCode);
            return;
        }

        if (newCode !== origCode && data.camera_model[newCode]) {
            customAlert(`Camera model code "${newCode}" already exists.`);
            $(this).val(origCode);
            return;
        }

        if (newCode !== origCode) {
            delete data.camera_model[origCode];
            data.camera_model[newCode] = currentName;
            $row.data('orig-code', newCode);
            $row.find('.delete-camera-btn').data('code', newCode);
            syncSiteData();
            replaceCameraModelInAllModes(origCode, newCode).then(count => {
                if (count > 0) {
                    showToast(`Updated camera code "${origCode}" -> "${newCode}" in ${count} sighting(s).`, 'info');
                }
            });
        }
    });

    // Name change handler
    $container.find('.camera-name-input').on('change input', function () {
        const $row = $(this).closest('tr');
        const code = $row.find('.camera-code-input').val().trim();
        const newName = $(this).val().trim();
        if (code) {
            data.camera_model[code] = newName;
            syncSiteData();
        }
    });

    // Delete handler
    $container.find('.delete-camera-btn').click(function () {
        const code = $(this).data('code');
        const name = data.camera_model[code] || code;
        customConfirm(`Are you sure you want to delete camera model "${name}" (${code})?`, () => {
            delete data.camera_model[code];
            syncSiteData();
            renderSiteData();
        });
    });

    // Add button
    $container.find('#add-camera-btn').click(function () {
        let newKey = 'NEW_MODEL';
        let count = 1;
        while (data.camera_model[newKey]) {
            newKey = `NEW_MODEL_${count++}`;
        }
        data.camera_model[newKey] = '';
        syncSiteData();
        renderSiteData();
        setTimeout(() => {
            $container.find(`tr[data-orig-code="${newKey}"] .camera-code-input`).focus().select();
        }, 50);
    });
}

function getFullUrl(url) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        return trimmed;
    }
    return 'https://' + trimmed;
}

// ----------------------------------------------------
// Sheet 3: Authors
// ----------------------------------------------------
function renderAuthorSheet($container) {
    data.author = data.author || {};
    const filter = searchFilter;
    const entries = Object.entries(data.author);

    let html = `
        <table class="spreadsheet-table">
            <thead>
                <tr>
                    <th style="width: 60px; text-align: center;">#</th>
                    <th style="width: 250px;">Author Name</th>
                    <th style="min-width: 320px;">Profile / Social URL</th>
                    <th style="width: 60px; text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    let displayedCount = 0;
    entries.forEach(([name, url], index) => {
        if (filter) {
            const matches = name.toLowerCase().includes(filter) || url.toLowerCase().includes(filter);
            if (!matches) return;
        }

        displayedCount++;
        html += `
            <tr data-orig-name="${escapeHtml(name)}">
                <td style="text-align: center; color: #94a3b8;">${index + 1}</td>
                <td>
                    <input type="text" class="spreadsheet-cell-input author-name-input" value="${escapeHtml(name)}" placeholder="Author Name" />
                </td>
                <td>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <input type="text" class="spreadsheet-cell-input author-url-input" value="${escapeHtml(url)}" placeholder="https://instagram.com/username" />
                        <a href="${url ? escapeHtml(getFullUrl(url)) : '#'}" target="_blank" class="open-author-link" title="Open Link" style="padding: 4px 6px; font-size: 14px; text-decoration: none; ${url ? '' : 'display: none;'}">🔗</a>
                    </div>
                </td>
                <td style="text-align: center;">
                    <button class="delete-sighting delete-author-btn" data-name="${escapeHtml(name)}" title="Delete Author" style="margin: 0 auto;">🗑️</button>
                </td>
            </tr>
        `;
    });

    if (displayedCount === 0) {
        html += `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 24px;">No authors found matching filter.</td></tr>`;
    }

    html += `
            </tbody>
        </table>
        <div style="padding: 12px;">
            <button class="spreadsheet-add-btn" id="add-author-btn">➕ Add Author</button>
        </div>
    `;

    $container.html(html);

    // Name change handler
    $container.find('.author-name-input').on('change', function () {
        const $row = $(this).closest('tr');
        const origName = $row.data('orig-name');
        const newName = $(this).val().trim();
        const currentUrl = $row.find('.author-url-input').val().trim();

        if (!newName) {
            customAlert('Author name cannot be empty.');
            $(this).val(origName);
            return;
        }

        if (newName !== origName && data.author[newName]) {
            customAlert(`Author "${newName}" already exists.`);
            $(this).val(origName);
            return;
        }

        if (newName !== origName) {
            delete data.author[origName];
            data.author[newName] = currentUrl;
            $row.data('orig-name', newName);
            $row.find('.delete-author-btn').data('name', newName);
            syncSiteData();
            replaceAuthorInAllModes(origName, newName).then(count => {
                if (count > 0) {
                    showToast(`Updated author "${origName}" -> "${newName}" in ${count} sighting(s).`, 'info');
                }
            });
        }
    });

    // URL change handler
    $container.find('.author-url-input').on('change input', function () {
        const $row = $(this).closest('tr');
        const name = $row.find('.author-name-input').val().trim();
        const newUrl = $(this).val().trim();
        const $link = $row.find('.open-author-link');

        if (newUrl) {
            $link.attr('href', getFullUrl(newUrl)).show();
        } else {
            $link.attr('href', '#').hide();
        }

        if (name) {
            data.author[name] = newUrl;
            syncSiteData();
        }
    });

    // Ensure clicking link always uses current input value
    $container.on('click', '.open-author-link', function (e) {
        const $row = $(this).closest('tr');
        const currentUrl = $row.find('.author-url-input').val().trim();
        if (!currentUrl) {
            e.preventDefault();
            return;
        }
        $(this).attr('href', getFullUrl(currentUrl));
    });

    // Delete handler
    $container.find('.delete-author-btn').click(function () {
        const name = $(this).data('name');
        customConfirm(`Are you sure you want to delete author "${name}"?`, () => {
            delete data.author[name];
            syncSiteData();
            renderSiteData();
        });
    });

    // Add button
    $container.find('#add-author-btn').click(function () {
        let newName = 'New Author';
        let count = 1;
        while (data.author[newName]) {
            newName = `New Author ${count++}`;
        }
        data.author[newName] = '';
        syncSiteData();
        renderSiteData();
        setTimeout(() => {
            $container.find(`tr[data-orig-name="${newName}"] .author-name-input`).focus().select();
        }, 50);
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
