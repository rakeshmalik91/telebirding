// Import dependencies (jQuery and moment are loaded as regular scripts in HTML)
import Constants from './modules/constants.js';
import {
	currentMode, refreshData, setRenderCallback
} from './modules/admin/data.js';
import {
	setupUpdateSpeciesForm, renderSightingsTable, updatePaginationControls, setupAddFamilyForm
} from './modules/admin/rendering.js';
import { setupAuthListeners } from './modules/admin/auth.js';
import { setupDashboardListeners } from './modules/admin/listeners.js';

const viewState = {
	offset: 0,
	rows: 10
};

function switchMode(targetMode) {
	if (currentMode !== targetMode) {
		window.location.href = window.location.origin + "/admin?mode=" + targetMode;
	}
}

function render() {

	setupUpdateSpeciesForm();
	setupAddFamilyForm();
	renderSightingsTable(viewState.offset, viewState.rows);
	updatePaginationControls(viewState.offset, viewState.rows);
}

setRenderCallback(render);

$(document).ready(function () {
	refreshData();
	setupDashboardListeners(render, viewState);
	setupAuthListeners();

	$('.site-logo').html('<img class="logo" src="' + Constants.MODE[currentMode].logo + '" alt="' + Constants.MODE[currentMode].title + '" title="' + Constants.MODE[currentMode].title + '" />');

	$(`.mode-tab[data-mode="${currentMode}"]`).addClass('active');
	$(".mode-tab").click(function () {
		switchMode($(this).attr("data-mode"));
	});

	$('.admin-nav-tab').click(function () {
		$('.admin-nav-tab').removeClass('active');
		$(this).addClass('active');
		$('.admin-tab-content').removeClass('active').hide();
		$('#' + $(this).data('tab')).addClass('active').show();
	});
});

window.onbeforeunload = function (e) {
	// Sync check logic skipped
};