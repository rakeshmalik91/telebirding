import Constants from '../constants.js';
import Util from '../util.js';
import {
    getFilters, setFilters, filterAndSortData, initAutocomplete,
    setSort, setNewSpeciesFilterState
} from './filters.js';
import {
    renderPageName, renderSightings, renderExploreMenu, fillStats,
    renderMapMenu, renderMapPage, renderHome, renderLocationList, renderYearList, renderStories
} from './rendering.js';
import State from './state.js';
import { showLoader, hideLoader, resetLoader, setSiteLogo, stopYoutubeVideos } from './ui-helpers.js';
import { computeInternalDataFields } from './data-helpers.js';

export function setMode(mode) {
    State.updateCurrentMode(mode);
}

export function showStoriesPage() {
    $('.home .featured').removeClass('hidden').addClass('collapsed');
    $('.stories').addClass('expanded');
}

export function showAboutPage() {
    $('.home .featured').removeClass('hidden').addClass('collapsed');
}

export function clearExploreMenu() {
    $('.home .featured').removeClass('collapsed');
    $('.explore-menu').removeClass('expanded');
}

export function clearStoriesPage() {
    $('.stories').removeClass('expanded');
}

export function hideRightPane() {
    if ($('.right-pane').is(":visible")) {
        toggleRightPane();
    }
}

export function toggleRightPane() {

    if ($(".right-pane").is(":visible")) {
        $(".right-pane-button").removeClass('button-active');
        $(".right-pane").addClass("slide-out");
        setTimeout(function () {
            $(".right-pane").hide();
        }, 250);
        $('.overlay-on-body').addClass('fadeout');
        setTimeout(function () { $('.overlay-on-body').removeClass('fadeout').hide() }, 250);
        // document.body.style.overflow = 'visible';
    } else {
        if ($(".right-pane").html() == '') {
            $(".right-pane").append("<h1>Index by Location</h1>");
            renderLocationList($(".right-pane"));

            $(".right-pane").append("<h1>Index by Year</h1>");
            renderYearList($(".right-pane"));

            const filteredSpecies = [...new Set(State.data.filteredSightings.map(b => b.species.key))];
            $(".right-pane").append("<h1>Species List<span class='count'>" + filteredSpecies.length + "<span></h1>");
            filteredSpecies.sort().forEach(function (species) {
                $(".right-pane").append("<div class='species'><button class='family' onclick='triggerFilter(\"sighting\", \"" + State.data.species[species].name + "\")'><span>" + State.data.species[species].name + "</span></button></div>");
            });

            $(".right-pane").append("<h1></h1>");
        }
        $(".right-pane-button").addClass('button-active');
        $(".right-pane").removeClass("slide-out").show();
        $('.overlay-on-body').show();
    }
}

export function getUrlFromState(state) {
    if (state.page == Constants.HOME) return (window.location.origin + window.location.pathname); //blank url
    var url = "?page=" + encodeURIComponent(state.page);
    if (State.currentMode != Constants.MODE_BIRD) {
        url += "&mode=" + State.currentMode;
    }
    if ([Constants.EXPLORE_PAGE].includes(state.page) && state.params && state.params.family) url += "&family=" + encodeURIComponent(state.params.family);
    if ([Constants.ARCHIVE, Constants.MAP].includes(state.page) && state.filter && state.filter.sighting) url += "&sighting=" + encodeURIComponent(state.filter.sighting);
    if ([Constants.ARCHIVE, Constants.MAP].includes(state.page) && state.filter && state.filter.place) url += "&place=" + encodeURIComponent(state.filter.place);
    if ([Constants.ARCHIVE, Constants.MAP].includes(state.page) && state.filter && state.filter.date) url += "&date=" + encodeURIComponent(state.filter.date);
    if (!(state.sort.by == 'date' && state.sort.descending)) {
        if ([Constants.EXPLORE_PAGE, Constants.ARCHIVE, Constants.MAP].includes(state.page) && state.sort && state.sort.by) url += "&sort_by=" + encodeURIComponent(state.sort.by);
        if ([Constants.EXPLORE_PAGE, Constants.ARCHIVE, Constants.MAP].includes(state.page) && state.sort && state.sort.descending) url += "&sort_descending=" + encodeURIComponent(state.sort.descending);
    }
    if (State.newSpeciesFilter) url += "&newspecies=true";
    if (State.ratingFilter) url += "&rating=" + State.ratingFilter;
    return url;
}

export function retrieveStateFromUrlParams() {
    var urlParams = Util.getUrlParams();
    State.updateCurrentPage(urlParams.page ? decodeURIComponent(urlParams.page) : Constants.HOME);
    State.updateCurrentMode(urlParams.mode ? decodeURIComponent(urlParams.mode) : Constants.MODE_BIRD);

    if ([Constants.EXPLORE_PAGE, Constants.ARCHIVE, Constants.MAP].includes(urlParams.page) && urlParams.sort_by) {
        let newSort = { by: decodeURIComponent(urlParams.sort_by), descending: !!urlParams.sort_descending };
        $(".sortby").ready(function () {
            $(".sortby button").removeClass("button-active");
            $(".sortby button[data-value='" + newSort.by + "']").addClass("button-active");
            if (newSort.descending) {
                $(".sortby button[data-value='" + newSort.by + "'] span.order").addClass('desc').removeClass('asc');
            } else {
                $(".sortby button[data-value='" + newSort.by + "'] span.order").removeClass('desc').addClass('asc');
            }
        });
        setSort(newSort);
    } else {
        setSort({ by: 'date', descending: true });
        $(".sortby").ready(function () {
            $(".sortby button[data-value='date'] span.order").addClass('desc').removeClass('asc');
        });
    }

    if ([Constants.EXPLORE_PAGE, Constants.ARCHIVE, Constants.MAP].includes(urlParams.page) && urlParams.newspecies) {
        State.updateNewSpeciesFilter(urlParams.newspecies);
        $('.newspeciesfilter').ready(setNewSpeciesFilterState);
    }
    if ([Constants.EXPLORE_PAGE, Constants.ARCHIVE, Constants.MAP].includes(urlParams.page) && urlParams.rating) {
        State.updateRatingFilter(urlParams.rating || 0);
    }

    if ([Constants.ARCHIVE, Constants.MAP].includes(urlParams.page)) {
        $(".filter").ready(function () {
            if (urlParams.sighting) $(".filter input[data-value='sighting']").addClass("button-active").val(Util.capitalize(decodeURIComponent(urlParams.sighting)).trim());
            if (urlParams.place) $(".filter input[data-value='place']").addClass("button-active").val(Util.capitalize(decodeURIComponent(urlParams.place)).trim());
            if (urlParams.date) {
                $(".filter input[data-value='date']").val(Util.capitalize(decodeURIComponent(urlParams.date)).trim());
                $(".filter input[data-value='date'] + button").removeClass("hidden").addClass("button-active").html(Util.capitalize(decodeURIComponent(urlParams.date)).trim());
            }
        });
    }
}


const UI_VIEWS = [
    '.home', '.home-page', '.home .menu', '.home .explore-menu', '.map-menu', '.about-page', '.stories',
    '.sightings-list', '.filter-panel', '.filter-panel .filter', '.filter-panel .sortby', '.filter-panel .stats'
];

const VIEW_STATES = {
    [Constants.ARCHIVE]: {
        show: ['.home', '.sightings-list', '.filter-panel', '.filter-panel .filter', '.filter-panel .sortby', '.filter-panel .stats'],
        featured: 'hidden'
    },
    [Constants.EXPLORE_MENU]: {
        show: ['.home', '.home .explore-menu'],
        featured: 'visible'
    },
    [Constants.EXPLORE_PAGE]: {
        show: ['.home', '.sightings-list', '.filter-panel', '.filter-panel .stats'],
        featured: 'hidden'
    },
    [Constants.MAP_MENU]: {
        show: ['.home', '.home .map-menu'],
        featured: 'collapsed'
    },
    [Constants.MAP]: {
        show: ['.home', '.sightings-list', '.filter-panel', '.filter-panel .filter', '.filter-panel .sortby', '.filter-panel .stats'],
        featured: 'hidden'
    },
    [Constants.STORIES]: {
        show: ['.stories', '.home'],
        featured: 'collapsed'
    },
    [Constants.ABOUT]: {
        show: ['.home', '.about-page'],
        featured: 'collapsed'
    },
    'DEFAULT': {
        show: (isMobile) => isMobile ? ['.home', '.home .menu'] : ['.home', '.home .menu', '.home-page'],
        featured: 'visible'
    }
};

function updatePageUI(page) {
    const config = VIEW_STATES[page] || VIEW_STATES.DEFAULT;

    // Hide all managed views
    $(UI_VIEWS.join(', ')).hide();

    // Show specific views
    let toShow = config.show;
    if (typeof toShow === 'function') {
        toShow = toShow(State.IS_MOBILE_DEVICE);
    }
    $(toShow.join(', ')).show();

    // Handle Featured Section
    const featured = $('.home .featured');
    featured.removeClass('hidden collapsed');
    if (config.featured === 'hidden') featured.addClass('hidden');
    else if (config.featured === 'collapsed') featured.addClass('collapsed');


}

export function showPage(page, params, isPopstate) {
    stopYoutubeVideos();
    resetLoader();

    var filter = getFilters();
    if (params) {
        filter.place = params.place || filter.place || '';
        filter.date = params.date || filter.date || '';
        filter.sighting = params.sighting || filter.sighting || '';
        filter.newspecies = params.newspecies;
        filter.rating = params.rating;
    }

    if (!isPopstate) {
        var state = { page: page, params: params, filter: filter, sort: State.sort };
        history.pushState(state, '', getUrlFromState(state));
    }

    if (page == State.currentPage && JSON.stringify(filter) == JSON.stringify(State.data.filter) && JSON.stringify(State.sort) == JSON.stringify(State.data.sort)) {
        // dont reload page if all content are same 
        return;
    }

    State.updateCurrentPage(page);
    if ([Constants.ARCHIVE, Constants.EXPLORE_PAGE, Constants.MAP].includes(page)) {
        showLoader('page-load');
    }
    var files = [
        Util.getData("data/" + State.currentMode + "-sightings.json"),
        Util.getData("data/" + State.currentMode + "-species.json"),
        Util.getData("data/" + State.currentMode + "-families.json"),
        Util.getData("data/" + State.currentMode + "-likes.json"),
        Util.getData("data/places.json"),
        Util.getData('data/stories.json')
    ];
    Util.readJSONFiles(files, function (json) {
        State.updateData(json);
        computeInternalDataFields();
        initAutocomplete();
        renderPageName(page, params);
        if ([Constants.ARCHIVE, Constants.MAP].includes(State.currentPage)) {
            if (params) setFilters(filter);
        } else {
            setFilters({});
        }
        updatePageUI(State.currentPage);
        switch (State.currentPage) {
            case Constants.HOME:
                renderHome();
                setMode(Constants.DEFAULT_MODE);
                break;
            case Constants.EXPLORE_MENU:
                renderExploreMenu();
                break;
            case Constants.MAP_MENU:
                renderMapMenu();
                break;
            case Constants.STORIES:
                renderStories();
                break;
            case Constants.ARCHIVE:
                State.updateData({ ...State.data, sightingFamilyFilter: null });
                filterAndSortData(filter);
                fillStats(State.ratingFilter, State.newSpeciesFilter, getFilters);
                renderSightings(0, Constants.ARCHIVE_DATA_PER_PAGE, State.IS_MOBILE_DEVICE);
                break;
            case Constants.EXPLORE_PAGE:
                filterAndSortData(filter, params);
                fillStats(State.ratingFilter, State.newSpeciesFilter, getFilters);
                renderSightings(0, Constants.ARCHIVE_DATA_PER_PAGE, params, State.IS_MOBILE_DEVICE);
                break;
            case Constants.MAP:
                filterAndSortData(filter);
                fillStats(State.ratingFilter, State.newSpeciesFilter, getFilters);
                renderMapPage();
                break;
        }

        setSiteLogo(Constants.MODE, State.currentMode);

        if (State.currentPage != Constants.HOME) {
            $('.scroll-up-highlighter').remove();
        }
        hideLoader('page-load');
    });
}
