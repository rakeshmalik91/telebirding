import Constants from '../constants.js';
import Util from '../util.js';
import {
    getFilters, setFilters, filterAndSortData, initAutocomplete,
    setSort, setNewSpeciesFilterState
} from './filters.js';
import {
    renderPageName, renderSightings, renderExploreMenu, fillStats,
    renderMapMenu, renderMapPage, renderHome, renderLocationList, renderYearList
} from './rendering.js';
import State from './state.js';
import { showLoader, hideLoader, setSiteLogo, stopYoutubeVideos } from './ui-helpers.js';
import { computeInternalDataFields } from './data-helpers.js';

export function setMode(mode) {
    State.updateCurrentMode(mode);
}

export function showVideosPage() {
    $('.home .featured').addClass('collapsed');
    $('.videos').addClass('expanded');
}

export function showAboutPage() {
    $('.home .featured').addClass('collapsed');
}

export function clearExploreMenu() {
    $('.home .featured').removeClass('collapsed');
    $('.explore-menu').removeClass('expanded');
}

export function clearVideosPage() {
    $('.videos').removeClass('expanded');
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

export function showPage(page, params, isPopstate) {
    stopYoutubeVideos();

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
        showLoader();
    }
    var files = [
        Util.getData("data/" + State.currentMode + "-sightings.json"),
        Util.getData("data/" + State.currentMode + "-species.json"),
        Util.getData("data/" + State.currentMode + "-families.json"),
        Util.getData("data/" + State.currentMode + "-likes.json"),
        Util.getData("data/places.json")
    ];
    Util.readJSONFiles(files, function (json) {
        State.updateData(json);
        computeInternalDataFields();
        initAutocomplete();
        renderPageName(page, params);
        if (params) {
            setFilters(filter);
        }
        switch (State.currentPage) {
            case Constants.ARCHIVE:
                $('.home .explore-menu, .home .menu, .about-page, .videos, .home-page').hide();
                $('.home, .sightings-list, .filter-panel, .filter-panel .filter, .filter-panel .sortby, .filter-panel .stats').show();
                $('.home .featured').addClass('hidden');
                State.updateData({ ...State.data, sightingFamilyFilter: null });

                filterAndSortData(filter);
                fillStats(State.ratingFilter, State.newSpeciesFilter, getFilters);
                renderSightings(0, Constants.ARCHIVE_DATA_PER_PAGE, State.IS_MOBILE);
                break;
            case Constants.EXPLORE_MENU:
                $('.filter-panel, .sightings-list, .home .menu, .about-page, .videos, .home-page').hide();
                $('.home, .home .explore-menu').show();
                $('.home .featured').removeClass('hidden');
                setFilters({});
                renderExploreMenu();
                break;
            case Constants.EXPLORE_PAGE:
                $('.home .explore-menu, .home .menu, .about-page, .filter-panel .filter, .filter-panel .sortby, .videos, .home-page').hide();
                $('.home, .sightings-list, .filter-panel, .filter-panel .stats').show();
                $('.home .featured').addClass('hidden');
                setFilters({});
                filterAndSortData(filter, params);
                fillStats(State.ratingFilter, State.newSpeciesFilter, getFilters);
                renderSightings(0, Constants.ARCHIVE_DATA_PER_PAGE, params, State.IS_MOBILE);
                break;
            case Constants.MAP_MENU:
                $('.filter-panel, .sightings-list, .home .menu, .about-page, .videos, .home-page').hide();
                $('.home, .home .map-menu').show();
                $('.home .featured').removeClass('hidden');
                setFilters({});
                renderMapMenu();
                break;
            case Constants.MAP:
                $('.home .explore-menu, .home .menu, .about-page, .videos, .map-menu, .home-page').hide();
                $('.home, .sightings-list, .filter-panel, .filter-panel .filter, .filter-panel .sortby, .filter-panel .stats').show();
                $('.home .featured').addClass('hidden');
                filterAndSortData(filter);
                fillStats(State.ratingFilter, State.newSpeciesFilter, getFilters);
                renderMapPage();
                break;
            case Constants.VIDEOS:
                $('.filter-panel, .home .menu, .sightings-list, .about-page, .home-page').hide();
                $('.videos, .home').show();
                setFilters({});
                showVideosPage();
                break;
            case Constants.ABOUT:
                $('.filter-panel, .sightings-list, .home .explore-menu, .home .menu, .videos, .home-page').hide();
                $('.home, .about-page').show();
                setFilters({});
                showAboutPage();
                break;
            default:
                $('.filter-panel, .sightings-list, .home .explore-menu, .about-page, .videos, .map-menu').hide();
                $('.home, .home .menu').show();
                if (!State.IS_MOBILE) {
                    $('.home-page').show();
                }
                setFilters({});
                renderHome();
                setMode(Constants.DEFAULT_MODE);
        }

        setSiteLogo(Constants.MODE, State.currentMode);

        if (State.currentPage != Constants.HOME) {
            $('.scroll-up-highlighter').remove();
        }
        hideLoader();
    });
}
