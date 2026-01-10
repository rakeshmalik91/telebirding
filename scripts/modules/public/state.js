import Util from '../util.js';
import Constants from '../constants.js';

export default class State {
    static IS_MOBILE = !Util.isDeviceOnLandscapeOrientation();

    static data = { "sightings": [] };
    static sort = { by: undefined, descending: undefined };
    static currentRenderOffset = 0;
    static noMoreDataToRender = false;
    static sightingFamilyFilter = null;
    static newSpeciesFilter = false;
    static ratingFilter = 0;
    static autocompleteInitialized = false;

    static currentPage = Constants.HOME;
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
