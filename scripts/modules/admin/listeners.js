import {
    data, syncSightingsData, addSighting, backup, sortByDate, sightingMatches,
    undoSighting, redoSighting, delayPendingSave
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

    // Initialize chip inputs
    setupChipInputs();

    // Media Popup logic
    $('body').on('click', '.thumbnail', function(e) {
        // Ignore clicks on interactive elements inside the thumbnail
        if ($(e.target).closest('button, input, select, textarea, .camera-select-wrapper, .media-header').length) return;
        
        // Prevent click if we were dragging
        if ($(this).closest('.thumbnail').hasClass('is-dragging')) return;
        
        let fullSrc = $(this).attr("data-fullsrc");
        let mediaType = $(this).attr("data-mediatype");
        
        $("#media-popup-img, #media-popup-video").hide();
        if (mediaType === 'video') {
            $("#media-popup-video").attr("src", fullSrc).show();
        } else {
            $("#media-popup-img").attr("src", fullSrc).show();
        }
        $("#media-popup").fadeIn(200);
    });

    $('#media-popup .media-popup-overlay, #media-popup .media-popup-close').click(function() {
        $("#media-popup").fadeOut(200, function() {
            $("#media-popup-video").attr("src", ""); // Stop video playing
            $("#media-popup-img").attr("src", "");
        });
    });

    $('#undo-btn').click(undoSighting);
    $('#redo-btn').click(redoSighting);
    $('.sort-by-date').click(sortByDate);
    
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
