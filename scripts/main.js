import Constants from './modules/constants.js';
import Util from './modules/util.js';
import { showLoader } from './modules/loader.js';
import {
	rollSightingCarousal, showMore, setSiteLogo,
	initHomePageCarousal, rollHomePageCarousal, copyStoryLink
} from './modules/public/ui-helpers.js';
import State from './modules/public/state.js';
import { renderSightings, renderPageName } from './modules/public/rendering.js';
import {
	showPage, toggleRightPane, hideRightPane, setMode,
	retrieveStateFromUrlParams
} from './modules/public/router.js';
import {
	triggerFilter, sortByOnChange, filterOnChange, clearFilter, resetRatingFilter,
	toggleNewSpeciesFilter, getFilters, setSort, setFilters
} from './modules/public/filters.js';
import {
	previewImage, removePreviewImage, scrollPreviewImageSighting, scrollPreviewImage, toggleSlideshow
} from './modules/public/preview.js';
import { like } from './modules/public/data-helpers.js';

// Expose functions to window for HTML onclick handlers
window.showPage = showPage;

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
window.resetRatingFilter = resetRatingFilter;
window.toggleNewSpeciesFilter = toggleNewSpeciesFilter;
window.toggleRightPane = toggleRightPane;
window.hideRightPane = hideRightPane;
window.setMode = setMode;
window.showMore = showMore;
window.like = like;
window.renderPageName = renderPageName;
window.copyStoryLink = copyStoryLink;



function isAdmin() {
	return Util.getCookie("credentials") != null;
}

$(document).ready(function () {
	showLoader();
	setSiteLogo(Constants.MODE, State.currentMode);

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
	story: params.story ? decodeURIComponent(params.story) : undefined,
	sort_by: params.sort_by ? decodeURIComponent(params.sort_by) : undefined,
	sort_descending: params.sort_descending
}, false);

window.onpopstate = function (state) {
	if (state.state) {
		setFilters(state.state.filter);
		setSort(state.state.sort);
		showPage(state.state.page, state.state.params, true);
	}
};
