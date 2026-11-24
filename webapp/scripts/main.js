import Constants from './modules/constants.js';
import Util from './modules/util.js';
import { showLoader } from './modules/loader.js';
import {
	rollSightingCarousal, showMore, setSiteLogo,
	initHomePageCarousal, rollHomePageCarousal, copyStoryLink,
	toggleMobileFilters
} from './modules/public/ui-helpers.js';
import State from './modules/public/state.js';
import { renderSightings, renderPageName } from './modules/public/rendering.js';
import {
	showPage, toggleRightPane, hideRightPane, setMode,
	retrieveStateFromUrlParams
} from './modules/public/router.js';
import {
	triggerFilter, sortByOnChange, filterOnChange, clearFilter, clearFamilyFilter, resetRatingFilter,
	toggleNewSpeciesFilter, getFilters, setSort, setFilters
} from './modules/public/filters.js';
import {
	previewImage, removePreviewImage, scrollPreviewImageSighting, scrollPreviewImage, toggleSlideshow
} from './modules/public/preview.js';
import { like } from './modules/public/data-helpers.js';

// Expose functions to window for HTML onclick handlers
window.showPage = showPage;
window.toggleMobileFilters = toggleMobileFilters;

window.toggleCollpasible = Util.toggleCollpasible;

window.rollHomePageCarousal = rollHomePageCarousal;
window.rollSightingCarousal = rollSightingCarousal;
window.previewImage = previewImage;
window.removePreviewImage = removePreviewImage;
window.scrollPreviewImageSighting = scrollPreviewImageSighting;
window.toggleSlideshow = toggleSlideshow;
window.triggerFilter = triggerFilter;
window.sortByOnChange = sortByOnChange;
window.filterOnChange = filterOnChange;
window.clearFilter = clearFilter;
window.clearFamilyFilter = clearFamilyFilter;
window.resetRatingFilter = resetRatingFilter;
window.toggleNewSpeciesFilter = toggleNewSpeciesFilter;
window.toggleRightPane = toggleRightPane;
window.hideRightPane = hideRightPane;
window.setMode = setMode;
window.showMore = showMore;
window.like = like;
window.renderPageName = renderPageName;
window.copyStoryLink = copyStoryLink;
window.scrollToTop = function () {
	window.scrollTo({ top: 0, behavior: 'smooth' });
};



function isAdmin() {
	return Util.getCookie("credentials") != null;
}

$(document).ready(function () {
	showLoader();
	setSiteLogo(Constants.MODE, State.currentMode);

	// Hide web scroll-to-top button in Android app (which uses native Compose button)
	if (typeof window !== 'undefined' && window.Android) {
		$('#scroll-to-top-btn').remove();
	}

	// Show/hide web scroll to top button
	$(window).scroll(function () {
		if ($(window).scrollTop() > 500) {
			$('#scroll-to-top-btn').addClass('visible');
		} else {
			$('#scroll-to-top-btn').removeClass('visible');
		}
	});

	//feed infinite scroll
	$(window).scroll(function () {
		if ($(window).scrollTop() > $(document).height() - window.innerHeight * 2) {
			if ([Constants.ARCHIVE, Constants.EXPLORE_PAGE, Constants.MAP].includes(State.currentPage)) {
				renderSightings(State.currentRenderOffset, Constants.ARCHIVE_DATA_PER_PAGE);
			}
		}
	});

	//autoscroll explore menu
	Util.autoScroll($('.explore-menu'), 200);

	//close right preview pane on clicking outside
	$('html').click(function (e) {
		if (!$(e.target).hasClass('right-pane') && !$(e.target).parents('.right-pane').length && !$(e.target).hasClass('right-pane-button')) {
			hideRightPane();
		}
	});

	//navigate/close preview image
	$('body').keydown(function (e) {
		if ($('.preview-image').is(':visible')) {
			if (['Enter', 'Escape', 'Space'].includes(e.code)) {
				e.preventDefault();
				removePreviewImage();
			}
			if (['ArrowLeft'].includes(e.code)) {
				e.shiftKey ? scrollPreviewImageSighting(-1) : scrollPreviewImage(-1);
			}
			if (['ArrowRight'].includes(e.code)) {
				e.shiftKey ? scrollPreviewImageSighting(1) : scrollPreviewImage(1);
			}
		}
	});

	if (isAdmin()) {
		$("#admin-button").show();
		$("#admin-button").click(function () {
			window.open("/admin", "_blank");
		});
	}

	// Global mode toggle (bird / insect / future modes)
	$(document).on('click', '.mode-toggle .mode-toggle-btn', function () {
		const mode = $(this).attr('data-mode');
		if (mode) setMode(mode);
	});

	initHomePageCarousal();
});


// Initialize the application
showLoader('app-init');
retrieveStateFromUrlParams();
const params = Util.getUrlParams();
showPage(State.currentPage, {
	family: params.family ? decodeURIComponent(params.family) : undefined,
	newspecies: params.newspecies ? decodeURIComponent(params.newspecies) : undefined,
	rating: getFilters().rating,
	sighting: params.sighting ? decodeURIComponent(params.sighting) : undefined,
	place: params.place ? decodeURIComponent(params.place) : undefined,
	date: params.date ? decodeURIComponent(params.date) : undefined,
	camera_model: params.camera_model ? decodeURIComponent(params.camera_model) : undefined,
	story: params.story ? decodeURIComponent(params.story) : undefined,
	sort_by: params.sort_by ? decodeURIComponent(params.sort_by) : undefined,
	sort_descending: params.sort_descending
}, false);

window.onpopstate = function (state) {
	// Re-parse mode (and other params) from the new URL so back/forward restores correctly
	const urlParams = Util.getUrlParams();
	const modeFromUrl = Constants.normalizeMode(urlParams.mode ? decodeURIComponent(urlParams.mode) : Constants.DEFAULT_MODE);
	if (modeFromUrl !== State.currentMode && Constants.MODE[modeFromUrl]) {
		State.updateCurrentMode(modeFromUrl);
	}
	if (state.state) {
		setFilters(state.state.filter);
		setSort(state.state.sort);
		showPage(state.state.page, state.state.params, true);
	} else {
		// Fallback if no state object (e.g. direct hash / manual URL change)
		retrieveStateFromUrlParams();
		showPage(State.currentPage, {}, true);
	}
};
