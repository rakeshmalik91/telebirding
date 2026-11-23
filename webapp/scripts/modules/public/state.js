import Util from '../util.js';
import Constants from '../constants.js';

function isMobileViewport() {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Mobile phones: portrait width < 768px, or landscape phone height <= 500px and width <= 950px
    return (w < 768 && h > w) || (h <= 500 && w <= 950);
}

export default class State {
    static _isMobileOverride = undefined;
    static get IS_MOBILE_DEVICE() {
        if (State._isMobileOverride !== undefined) return State._isMobileOverride;
        return isMobileViewport();
    }
    static set IS_MOBILE_DEVICE(val) {
        State._isMobileOverride = val;
    }

    static data = { "sightings": [] };
    static sort = { by: undefined, descending: undefined };
    static currentRenderOffset = 0;
    static noMoreDataToRender = false;
    static sightingFamilyFilter = null;
    static newSpeciesFilter = false;
    static ratingFilter = 0;
    static autocompleteInitialized = false;

    static _currentPage = undefined;
    static get currentPage() {
        if (State._currentPage !== undefined) return State._currentPage;
        return State.IS_MOBILE_DEVICE ? Constants.ARCHIVE : Constants.HOME;
    }
    static set currentPage(val) {
        State._currentPage = val;
    }
    static currentMode = Constants.MODE_BIRD;

    static likeLocked = false;
    static remainingLikes = 25;

    // Setters to allow updating state
    static updateData(newData) { State.data = newData; }
    static updateSort(newSort) { State.sort = newSort; }
    static updateCurrentRenderOffset(val) { State.currentRenderOffset = val; }
    static updateNoMoreDataToRender(val) { State.noMoreDataToRender = val; }
    static updateSightingFamilyFilter(val) { State.sightingFamilyFilter = val; }
    static updateNewSpeciesFilter(val) { State.newSpeciesFilter = val; }
    static updateRatingFilter(val) { State.ratingFilter = val; }
    static updateAutocompleteInitialized(val) { State.autocompleteInitialized = val; }
    static updateCurrentPage(val) { State.currentPage = val; }
    static updateCurrentMode(val) { State.currentMode = val; }
    static updateLikeLocked(val) { State.likeLocked = val; }
    static updateRemainingLikes(val) { State.remainingLikes = val; }
}
