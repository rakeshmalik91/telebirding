import {
    data, syncSightingsData, addSighting, backup, sortByDate, sightingMatches,
    undoSighting, redoSighting, delayPendingSave, moveSighting, deleteMedia,
    getMaxPinnedCount, setMaxPinnedCount
} from './data.js';
import { showLoader, hideLoader } from '../loader.js';
import { customConfirm } from './ui.js';
import { setupChipInputs } from './chip-input.js';

export function setupDashboardListeners(render, viewState) {
    const doRender = () => {
        showLoader();
        setTimeout(() => {
            render();
            hideLoader();
        }, 10);
    };
    $('.save').click(function () {
        if ($(this).text() === 'Conflict') {
            customConfirm("Data conflict detected. Would you like to refresh the page now to get the latest data?", () => {
                location.reload();
            });
            return;
        }
        syncSightingsData(0);
    });

    // Delay pending auto-save when user interacts with any input element or dropdown
    $('body').on('input focusin keydown mousedown touchstart change', 'input, select, textarea, .ss-wrapper, .ss-dropdown, .chip-input-container, [contenteditable="true"]', function () {
        delayPendingSave();
    });

    // Text input clear button handler - prevent input focus on touch/pointerdown
    $('body').on('pointerdown mousedown touchstart', '.input-clear-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    $('body').on('click', '.input-clear-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const $wrapper = $(this).closest('.input-clear-wrapper');
        const $input = $wrapper.find('input');
        $input.val('').trigger('input').trigger('change');
        $wrapper.removeClass('has-value');
    });

    $('body').on('input', '.input-clear-wrapper input', function () {
        const hasVal = Boolean($(this).val() && $(this).val().trim());
        $(this).closest('.input-clear-wrapper').toggleClass('has-value', hasVal);
    });

    // Initialize chip inputs
    setupChipInputs();

    // Media Popup logic
    let previewMediaList = [];
    let previewMediaIndex = -1;

    function escapePopupHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderPreviewDetails(item) {
        const $details = $('#media-popup-details');
        const $body = $('#media-popup-details-body');
        if (!$details.length || !$body.length) return;

        if (!item || !item.sightingKey) {
            $details.hide();
            $body.empty();
            return;
        }

        const sighting = (data.sightings || []).find(s => String(s.key) === String(item.sightingKey));
        const mediaObj = sighting && Array.isArray(sighting.media)
            ? sighting.media.find(m => m.src === item.mediaSrc)
            : null;

        const speciesName = sighting && sighting.species
            ? ((data.species && data.species[sighting.species] && data.species[sighting.species].name) || sighting.species)
            : 'Sighting Media';
        const fileName = (item.mediaSrc || item.src || '').split('/').pop() || '-';
        const ext = fileName.includes('.') ? fileName.split('.').pop().toUpperCase() : (item.type || 'IMAGE').toUpperCase();
        const title = (mediaObj && mediaObj.title) || '-';
        const rawCamera = (mediaObj && mediaObj.exif_data && mediaObj.exif_data.camera_model) || '';
        const cameraLabel = rawCamera
            ? rawCamera.split('+').map(p => {
                const k = p.trim();
                return (data.camera_model && data.camera_model[k]) ? data.camera_model[k] : k;
            }).filter(Boolean).join(' + ')
            : '-';
        const dateParts = sighting ? [sighting.date, sighting.time_of_day, sighting.weather].filter(Boolean) : [];
        const placeParts = sighting ? [sighting.place, sighting.city, sighting.state, sighting.country].filter(Boolean) : [];
        const rating = sighting && sighting.rating ? `${'★'.repeat(Number(sighting.rating))} (${sighting.rating}/5)` : '-';

        const rows = [
            { label: 'File', value: `${ext} · ${fileName}` },
            { label: 'Title', value: title },
            { label: 'Camera / Lens', value: cameraLabel },
            { label: 'Date / Conditions', value: dateParts.length ? dateParts.join(' · ') : '-' },
            { label: 'Location', value: placeParts.length ? placeParts.join(', ') : '-' },
            { label: 'Rating', value: rating + (sighting && sighting.unconfirmed ? ' · Unconfirmed' : '') }
        ];
        if (item.type === 'video' && mediaObj && mediaObj.thumbnail) {
            rows.push({ label: 'Video Thumbnail', value: mediaObj.thumbnail.split('/').pop() });
        }

        const rowsHtml = rows.map(r => `
            <div class="media-popup-detail-row">
                <span class="media-popup-detail-label">${escapePopupHtml(r.label)}</span>
                <span class="media-popup-detail-value">${escapePopupHtml(r.value)}</span>
            </div>
        `).join('');

        $body.html(`
            <div class="media-popup-details-header">
                <span class="media-popup-details-title">${escapePopupHtml(speciesName)}</span>
                <span class="media-popup-details-counter">${previewMediaIndex + 1} / ${previewMediaList.length}</span>
            </div>
            ${rowsHtml}
        `);
        $details.show();
    }

    function showPreviewMediaAt(index) {
        if (!previewMediaList.length) return;
        previewMediaIndex = ((index % previewMediaList.length) + previewMediaList.length) % previewMediaList.length;
        const item = previewMediaList[previewMediaIndex];
        $("#media-popup-img, #media-popup-video").hide();
        if (item.type === 'video') {
            $("#media-popup-img").attr("src", "");
            $("#media-popup-video").attr("src", item.src).show();
        } else {
            $("#media-popup-video").attr("src", "");
            $("#media-popup-img").attr("src", item.src).show();
        }
        $("#media-popup .media-popup-nav").toggle(previewMediaList.length > 1);
        renderPreviewDetails(item);
    }

    function closeMediaPopup() {
        previewMediaList = [];
        previewMediaIndex = -1;
        $("#media-popup .media-popup-nav").hide();
        $("#media-popup-details").hide();
        $("#media-popup-details-body").empty();
        $("#media-popup").fadeOut(200, function() {
            $("#media-popup-video").attr("src", ""); // Stop video playing
            $("#media-popup-img").attr("src", "");
        });
    }

    function deleteCurrentPreviewMedia() {
        if (previewMediaIndex < 0 || previewMediaIndex >= previewMediaList.length) return;
        const item = previewMediaList[previewMediaIndex];
        if (!item || !item.sightingKey || !item.mediaSrc) return;

        const deletedIndex = previewMediaIndex;
        deleteMedia(item.sightingKey, item.mediaSrc, false, () => {
            previewMediaList.splice(deletedIndex, 1);
            if (!previewMediaList.length) {
                closeMediaPopup();
            } else {
                showPreviewMediaAt(Math.min(deletedIndex, previewMediaList.length - 1));
            }
        });
    }

    $('body').off('click.mediaPopup', '.thumbnail').on('click.mediaPopup', '.thumbnail', function(e) {
        // Ignore clicks on interactive elements inside the thumbnail
        if ($(e.target).closest('button, input, select, textarea, .camera-select-wrapper, .media-header').length) return;
        
        // Prevent click if we were dragging
        if ($(this).closest('.thumbnail').hasClass('is-dragging')) return;

        const $row = $(this).closest('tr');
        const $thumbnails = $row.length ? $row.find('.thumbnail') : $(this);
        previewMediaList = $thumbnails.map(function() {
            return {
                src: $(this).attr("data-fullsrc"),
                type: $(this).attr("data-mediatype"),
                sightingKey: $(this).attr("data-sightingkey"),
                mediaSrc: $(this).attr("data-mediasrc")
            };
        }).get();
        previewMediaIndex = Math.max(0, $thumbnails.index(this));

        showPreviewMediaAt(previewMediaIndex);
        $("#media-popup").fadeIn(200);
    });

    $('#media-popup .media-popup-overlay, #media-popup .media-popup-close').off('click.mediaPopup').on('click.mediaPopup', closeMediaPopup);
    $('#media-popup .media-popup-prev').off('click.mediaPopup').on('click.mediaPopup', function(e) {
        e.stopPropagation();
        showPreviewMediaAt(previewMediaIndex - 1);
    });
    $('#media-popup .media-popup-next').off('click.mediaPopup').on('click.mediaPopup', function(e) {
        e.stopPropagation();
        showPreviewMediaAt(previewMediaIndex + 1);
    });
    $('#media-popup-delete').off('click.mediaPopup').on('click.mediaPopup', function(e) {
        e.stopPropagation();
        deleteCurrentPreviewMedia();
    });

    $(document).off('keydown.mediaPopup').on('keydown.mediaPopup', function(e) {
        const $confirmOverlay = $('#custom-modal-overlay');
        if ($confirmOverlay.length && $confirmOverlay.css('display') !== 'none') return;
        const $popup = $('#media-popup');
        if (!$popup.length || $popup.css('display') === 'none') return;
        if ($(e.target).is('input, textarea, select')) return;

        if (e.key === 'ArrowLeft' && previewMediaList.length > 1) {
            e.preventDefault();
            showPreviewMediaAt(previewMediaIndex - 1);
        } else if (e.key === 'ArrowRight' && previewMediaList.length > 1) {
            e.preventDefault();
            showPreviewMediaAt(previewMediaIndex + 1);
        } else if (e.key === 'Delete' && previewMediaList.length > 0) {
            e.preventDefault();
            deleteCurrentPreviewMedia();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeMediaPopup();
        }
    });

    $('#undo-btn').click(undoSighting);
    $('#redo-btn').click(redoSighting);
    $('.sort-by-date').click(sortByDate);

    // Max pinned configuration
    const savedMaxPins = typeof getMaxPinnedCount === 'function' ? getMaxPinnedCount() : 3;
    $('input[name=max-pinned]').val(savedMaxPins);
    $('input[name=max-pinned]').on('change', function () {
        const validated = typeof setMaxPinnedCount === 'function' ? setMaxPinnedCount($(this).val()) : $(this).val();
        $(this).val(validated);
    });
    
    // Auto sort toggle
    const savedAutoSort = localStorage.getItem('autoSortEnabled');
    if (savedAutoSort === 'false') {
        $('#auto-sort-btn').removeClass('active');
    }
    $('#auto-sort-btn').click(function() {
        $(this).toggleClass('active');
        localStorage.setItem('autoSortEnabled', $(this).hasClass('active'));
    });

    $('.add-sighting').click(() => {
        viewState.offset = 0;
        addSighting();
    });
    $('.backup').click(backup);
    // Explicit cross-page movement controls coexist with the drag-and-drop handle.
    $('#sightings-table')
        .off('click.sightingMove', '.move-sighting-page')
        .on('click.sightingMove', '.move-sighting-page', function (event) {
            event.preventDefault();
            event.stopPropagation();

            if ($(this).prop('disabled')) return;

            const key = $(this).attr('data-key');
            const delta = $(this).hasClass('move-sighting-next') ? 1 : -1;
            const currentIndex = data.sightings.findIndex(s => s.key === key);
            const targetIndex = currentIndex + delta;

            // Only allow a single adjacent-row swap; never wrap or jump pages.
            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= data.sightings.length) return;

            moveSighting(key, delta);
        });
    $('button.first-page').click(function () {
        if (viewState.offset > 0) {
            viewState.offset = 0;
            doRender();
        }
    });
    $('button.previous').click(function () {
        if (viewState.offset > 0) {
            viewState.offset = Math.max(viewState.offset - viewState.rows, 0);
            doRender();
        }
    });
    $('button.next').click(function () {
        const searchKey = $("input[name=filter-sighting]").val() || "";
        const length = data.sightings.filter(b => sightingMatches(b, searchKey)).length;
        if (viewState.offset + viewState.rows < length) {
            viewState.offset += viewState.rows;
            doRender();
        }
    });
    $('button.last-page').click(function () {
        const searchKey = $("input[name=filter-sighting]").val() || "";
        const length = data.sightings.filter(b => sightingMatches(b, searchKey)).length;
        if (viewState.offset + viewState.rows < length) {
            viewState.offset = Math.floor(length / viewState.rows) * viewState.rows;
            doRender();
        }
    });
    $('select[name=page-size]').change(function () {
        viewState.rows = Number($("select[name=page-size]").val());
        doRender();
    });
    $("input[name=filter-sighting]").change(function () {
        viewState.offset = 0;
        doRender();
        $(this).blur();
    });
    $("input[name=filter-sighting]").focus(function () {
        $(this).select();
    });
}
