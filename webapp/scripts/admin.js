// Import dependencies (jQuery and moment are loaded as regular scripts in HTML)
import Constants from './modules/constants.js';
import {
	currentMode, setCurrentMode, refreshData, setRenderCallback, hasUnsavedChanges
} from './modules/admin/data.js';
import { customAlert } from './modules/admin/ui.js';
import {
	setupUpdateSpeciesForm, renderSightingsTable, updatePaginationControls, setupAddFamilyForm, setupPlacesTab,
	setupSiteDataTab, setupStoriesTab
} from './modules/admin/rendering.js';
import { setupAuthListeners } from './modules/admin/auth.js';
import { setupDashboardListeners } from './modules/admin/listeners.js';
import { setupCleanupListeners } from './modules/admin/cleanup.js';
import { setupRestoreListeners } from './modules/admin/restore.js';
import { setupEbirdSync } from './modules/admin/ebird-sync.js';

export const viewState = {
	offset: 0,
	rows: 10
};

export function switchMode(targetMode) {
	if (currentMode !== targetMode) {
		if (hasUnsavedChanges()) {
			customAlert("Please wait for your changes to finish saving before switching modes.");
			return;
		}

		setCurrentMode(targetMode);
		history.pushState(null, null, "?mode=" + targetMode);
		
		$('.mode-tab').removeClass('active');
		$(`.mode-tab[data-mode="${targetMode}"]`).addClass('active');
		$('.site-logo').html('<img class="logo" src="' + Constants.MODE[targetMode].logo + '" alt="' + Constants.MODE[targetMode].title + '" title="' + Constants.MODE[targetMode].title + '" />');
		
		// When mode is changed, reset to page 1 (offset 0) with no filters applied
		viewState.offset = 0;
		$("input[name=filter-sighting]").val("").closest('.input-clear-wrapper').removeClass('has-value');
		if (typeof window !== 'undefined' && window.scrollTo) {
			window.scrollTo(0, 0);
		}

		refreshData();
	}
}

function render(preserveScroll = true) {
	const scrollY = (typeof window !== 'undefined' && preserveScroll) ? window.scrollY : 0;
	setupUpdateSpeciesForm();
	setupAddFamilyForm();
	setupPlacesTab();
	setupEbirdSync();
	setupSiteDataTab();
	setupStoriesTab();
	renderSightingsTable(viewState.offset, viewState.rows, preserveScroll);
	updatePaginationControls(viewState.offset, viewState.rows);
	if (preserveScroll && typeof window !== 'undefined' && scrollY > 0) {
		try {
			if (typeof window.scrollTo === 'function') {
				window.scrollTo(0, scrollY);
			}
		} catch (e) {}
	}
}

setRenderCallback(render);

$(document).ready(function () {
	refreshData();
	setupDashboardListeners(render, viewState);
	setupAuthListeners();
	setupCleanupListeners();
	setupRestoreListeners();

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
		const tab = $(this).data('tab');
		if (tab === 'places-tab') {
			setupPlacesTab();
		}
		if (tab === 'site-data-tab') {
			setupSiteDataTab();
		}
		if (tab === 'stories-tab') {
			setupStoriesTab();
		}
		if (tab === 'species-tab') {
			setupEbirdSync();
			// Refresh species form so newly added families/species appear in its dropdowns
			setupUpdateSpeciesForm();
		}
		if (tab === 'sightings-tab') {
			// Rebuild sightings table so species/country/etc. dropdowns reflect
			// any species (or other data) added while on another tab.
			renderSightingsTable(viewState.offset, viewState.rows);
			updatePaginationControls(viewState.offset, viewState.rows);
		}
	});
});

window.onpopstate = function () {
	const urlParams = new URLSearchParams(window.location.search);
	const targetMode = urlParams.get('mode') || Constants.DEFAULT_MODE;
	if (Constants.MODE[targetMode] && currentMode !== targetMode) {
		switchMode(targetMode);
	}
};

window.onbeforeunload = function (e) {
	// Sync check logic skipped
};