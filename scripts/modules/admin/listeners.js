import {
    data, syncSightingsData, addSighting, backup, sortByDate, sightingMatches
} from './data.js';

export function setupDashboardListeners(render, viewState) {
    $('.save').click(function () {
        syncSightingsData(0);
    });
    $('.sort-by-date').click(sortByDate);
    $('.add-sighting').click(() => {
        viewState.offset = 0;
        addSighting();
    });
    $('.backup').click(backup);
    $('button.first-page').click(function () {
        if (viewState.offset > 0) {
            viewState.offset = 0;
            render();
        }
    });
    $('button.previous').click(function () {
        if (viewState.offset > 0) {
            viewState.offset = Math.max(viewState.offset - viewState.rows, 0);
            render();
        }
    });
    $('button.next').click(function () {
        const searchKey = $("input[name=filter-sighting]").val() || "";
        const length = data.sightings.filter(b => sightingMatches(b, searchKey)).length;
        if (viewState.offset + viewState.rows < length) {
            viewState.offset += viewState.rows;
            render();
        }
    });
    $('button.last-page').click(function () {
        const searchKey = $("input[name=filter-sighting]").val() || "";
        const length = data.sightings.filter(b => sightingMatches(b, searchKey)).length;
        if (viewState.offset + viewState.rows < length) {
            viewState.offset = Math.floor(length / viewState.rows) * viewState.rows;
            render();
        }
    });
    $('select[name=page-size]').click(function () {
        viewState.rows = Number($("select[name=page-size]").val());
        render();
    });
    $("input[name=filter-sighting]").change(function () {
        viewState.offset = 0;
        render();
        $(this).blur();
    });
    $("input[name=filter-sighting]").focus(function () {
        $(this).select();
    });
}
