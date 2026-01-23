// Import dependencies (jQuery and moment are loaded as regular scripts in HTML)
import Constants from './modules/constants.js';
import {
	currentMode, refreshData, setRenderCallback
} from './modules/admin/data.js';
import {
	setupUpdateSpeciesForm, renderSightingsTable, updatePaginationControls
} from './modules/admin/rendering.js';
import { setupAuthListeners } from './modules/admin/auth.js';
import { setupDashboardListeners } from './modules/admin/listeners.js';

const viewState = {
	offset: 0,
	rows: 10
};

function switchMode() {
	if (currentMode == Constants.MODE_BIRD) {
		window.location.href = window.location.origin + "/admin?mode=" + Constants.MODE_INSECT;
	} else {
		window.location.href = window.location.origin + "/admin?mode=" + Constants.MODE_BIRD;
	}
}

function render() {

	setupUpdateSpeciesForm();
	renderSightingsTable(viewState.offset, viewState.rows);
	updatePaginationControls(viewState.offset, viewState.rows);
}

setRenderCallback(render);

$(document).ready(function () {
	refreshData();
	setupDashboardListeners(render, viewState);
	setupAuthListeners();

	$('.site-logo').html('<img class="logo" src="' + Constants.MODE[currentMode].logo + '" alt="' + Constants.MODE[currentMode].title + '" title="' + Constants.MODE[currentMode].title + '" />');

	$("button.mode").html("Mode: " + currentMode.toUpperCase());
	$("button.mode").click(function () {
		switchMode();
	});
});

window.onbeforeunload = function (e) {
	// Sync check logic skipped
};