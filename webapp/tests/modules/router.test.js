import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Router from '../../scripts/modules/public/router.js';
import State from '../../scripts/modules/public/state.js';
import Constants from '../../scripts/modules/constants.js';
import Util from '../../scripts/modules/util.js';
import * as Filters from '../../scripts/modules/public/filters.js';

vi.mock('../../scripts/modules/public/filters.js', () => ({
    getFilters: vi.fn(() => ({})),
    setFilters: vi.fn(),
    filterAndSortData: vi.fn(),
    initAutocomplete: vi.fn(),
    setSort: vi.fn(),
    setNewSpeciesFilterState: vi.fn()
}));

vi.mock('../../scripts/modules/public/rendering.js', () => ({
    renderPageName: vi.fn(),
    renderSightings: vi.fn(),
    renderExploreMenu: vi.fn(),
    fillStats: vi.fn(),
    renderMapMenu: vi.fn(),
    renderMapPage: vi.fn(),
    renderHome: vi.fn(),
    renderLocationList: vi.fn(),
    renderYearList: vi.fn(),
    renderStories: vi.fn()
}));

vi.mock('../../scripts/modules/ui-helpers.js', () => ({
    setSiteLogo: vi.fn(),
    stopYoutubeVideos: vi.fn()
}));

vi.mock('../../scripts/modules/public/data-helpers.js', () => ({
    computeInternalDataFields: vi.fn()
}));

// Mock window history
const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

describe('Router Module', () => {

    beforeEach(() => {
        document.body.innerHTML = `
            <div class="home">
                <div class="featured"></div>
                <div class="menu"></div>
                <div class="explore-menu"></div>
                <div class="map-menu"></div>
            </div>
            <div class="stories"></div>
            <div class="about-page"></div>
            <div class="home-page"></div>
            <div class="sightings-list"></div>
            <div class="filter-panel">
                <div class="filter">
                    <input data-value="sighting" />
                    <input data-value="place" />
                    <input data-value="date" />
                    <button class="hidden"></button>
                </div>
                <div class="sortby">
                    <button data-value="date"><span class="order"></span></button>
                    <button data-value="name"><span class="order"></span></button>
                </div>
                <div class="stats"></div>
            </div>
            <div class="right-pane"></div>
            <div class="overlay-on-body"></div>
            <button class="right-pane-button"></button>
            <div class="newspeciesfilter"></div>
        `;

        State.data = {
            filteredSightings: [
                { species: { key: 'sp1' } }
            ],
            species: {
                'sp1': { name: 'Rock Pigeon' }
            }
        };
        State.currentMode = Constants.MODE_BIRD;
        State.currentPage = Constants.HOME;
        State.sort = { by: 'date', descending: true };
        State.newSpeciesFilter = false;
        State.ratingFilter = 0;

        vi.clearAllMocks();
        pushStateSpy.mockClear();
        replaceStateSpy.mockClear();
    });

    it('setMode should update current mode', () => {
        Router.setMode(Constants.MODE_INSECT);
        expect(State.currentMode).toBe(Constants.MODE_INSECT);
    });

    it('showStoriesPage should update UI', () => {
        Router.showStoriesPage();
        expect($('.home .featured').hasClass('collapsed')).toBe(true);
        expect($('.stories').hasClass('expanded')).toBe(true);
    });

    it('showAboutPage should update UI', () => {
        Router.showAboutPage();
        expect($('.home .featured').hasClass('collapsed')).toBe(true);
    });

    it('clearExploreMenu should update UI', () => {
        Router.clearExploreMenu();
        expect($('.home .featured').hasClass('collapsed')).toBe(false);
        expect($('.explore-menu').hasClass('expanded')).toBe(false);
    });

    it('clearStoriesPage should update UI', () => {
        Router.clearStoriesPage();
        expect($('.stories').hasClass('expanded')).toBe(false);
    });

    describe('Right Pane', () => {
        it('should hideRightPane if visible', () => {
            $('.right-pane').show();
            // Mock jQuery .is() to return true for :visible checks in JSDOM
            const originalIs = $.fn.is;
            $.fn.is = vi.fn(function (selector) {
                if (selector === ":visible") return true;
                return originalIs.apply(this, arguments);
            });

            Router.hideRightPane();
            
            expect($('.right-pane').hasClass('slide-out')).toBe(true);
            
            // Restore
            $.fn.is = originalIs;
        });

        it('should toggleRightPane to visible and populate if empty', () => {
            $('.right-pane').hide();
            Router.toggleRightPane();
            
            expect($('.right-pane').html()).toContain('Index by Location');
            expect($('.right-pane').html()).toContain('Index by Year');
            expect($('.right-pane').html()).toContain('Rock Pigeon');
            
            // JSDOM doesn't support :visible well, so we check CSS
            expect($('.right-pane').css('display')).not.toBe('none');
        });
    });

    describe('getUrlFromState', () => {
        it('should return HOME url', () => {
            const url = Router.getUrlFromState({ page: Constants.HOME });
            expect(url).toContain(window.location.origin);
        });

        it('should return complex URL', () => {
            const state = {
                page: Constants.EXPLORE_PAGE,
                params: { family: 'Corvidae', story: 'test-story' },
                filter: { sighting: 'Jay', place: 'Park', date: '2023' },
                sort: { by: 'name', descending: true }
            };
            State.currentMode = Constants.MODE_INSECT;
            State.newSpeciesFilter = true;
            State.ratingFilter = 5;

            const url = Router.getUrlFromState(state);
            expect(url).toContain('?page=explore_page');
            expect(url).toContain('&mode=insect');
            expect(url).toContain('&family=Corvidae');
            expect(url).toContain('&sort_by=name');
            expect(url).toContain('&sort_descending=true');
            expect(url).toContain('&newspecies=true');
            expect(url).toContain('&rating=5');
        });

        it('should return URL for ARCHIVE page with filters', () => {
            const state = {
                page: Constants.ARCHIVE,
                filter: { sighting: 'Jay', place: 'Park', date: '2023', camera_model: 'Sony A1' },
                sort: { by: 'date', descending: true }
            };
            const url = Router.getUrlFromState(state);
            expect(url).toContain('page=feed');
            expect(url).toContain('&sighting=Jay');
            expect(url).toContain('&place=Park');
            expect(url).toContain('&date=2023');
            expect(url).toContain('&camera_model=Sony%20A1');
        });
    });

    describe('updateStorySlug', () => {
        it('should update URL with story slug using replaceState', () => {
            vi.spyOn(window.history, 'state', 'get').mockReturnValue({ page: Constants.STORIES, sort: { by: 'date', descending: true } });
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({ story: 'old-slug' });
            
            Router.updateStorySlug('new-slug');
            
            expect(replaceStateSpy).toHaveBeenCalled();
            const lastCallParams = replaceStateSpy.mock.calls[0];
            expect(lastCallParams[2]).toContain('story=new-slug');
            expect(lastCallParams[2]).toContain('page=stories');
        });

        it('should not update URL if slug is same', () => {
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({ story: 'same-slug' });
            
            Router.updateStorySlug('same-slug');
            
            expect(replaceStateSpy).not.toHaveBeenCalled();
        });

        it('should handle falsy history.state in updateStorySlug', () => {
            Object.defineProperty(Object.prototype, 'sort', {
                value: { by: 'date', descending: true },
                configurable: true
            });
            vi.spyOn(window.history, 'state', 'get').mockReturnValue(null);
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({ story: 'old-slug' });
            Router.updateStorySlug('new-slug');
            expect(replaceStateSpy).toHaveBeenCalled();
            delete Object.prototype.sort;
        });
    });

    describe('story-in-view event listener', () => {
        it('should call updateStorySlug when story-in-view event is dispatched', () => {
            // Set current page to STORIES
            State.currentPage = Constants.STORIES;
            vi.spyOn(window.history, 'state', 'get').mockReturnValue({ page: Constants.STORIES, sort: { by: 'date', descending: true } });
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({ page: Constants.STORIES, story: 'old-slug' });

            window.dispatchEvent(new CustomEvent('story-in-view', { detail: { slug: 'test-slug' } }));

            expect(replaceStateSpy).toHaveBeenCalled();
            expect(replaceStateSpy.mock.calls[0][2]).toContain('story=test-slug');
        });

        it('should not call updateStorySlug if not on STORIES page', () => {
            State.currentPage = Constants.HOME;
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({ page: Constants.HOME });

            window.dispatchEvent(new CustomEvent('story-in-view', { detail: { slug: 'test-slug' } }));

            expect(replaceStateSpy).not.toHaveBeenCalled();
        });
    });

    describe('retrieveStateFromUrlParams', () => {
        it('should fetch variables from Util.getUrlParams', () => {
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({
                page: Constants.ARCHIVE,
                mode: Constants.MODE_BIRD,
                sort_by: 'name',
                sort_descending: 'true',
                newspecies: 'true',
                rating: '4',
                sighting: 'Jay',
                place: 'Park',
                date: '2023'
            });

            Router.retrieveStateFromUrlParams();

            expect(State.currentPage).toBe(Constants.ARCHIVE);
            expect(State.currentMode).toBe(Constants.MODE_BIRD);
            expect(State.newSpeciesFilter).toBe('true');
            expect(State.ratingFilter).toBe('4');
            expect(Filters.setSort).toHaveBeenCalledWith({ by: 'name', descending: true });
        });

        it('should handle missing sort_by or unsupported page by setting default sort', () => {
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({
                page: Constants.HOME,
                mode: Constants.MODE_BIRD
            });

            Router.retrieveStateFromUrlParams();

            expect(Filters.setSort).toHaveBeenCalledWith({ by: 'date', descending: true });
        });

        it('should assign camera_model from urlParams to input if present', async () => {
            // Add camera_model input to DOM
            $('.filter').append('<input data-value="camera_model" />');

            vi.spyOn(Util, 'getUrlParams').mockReturnValue({
                page: Constants.ARCHIVE,
                camera_model: 'Sony%20A1'
            });

            Router.retrieveStateFromUrlParams();

            // Wait for jQuery .ready() to process callbacks
            await new Promise(resolve => setTimeout(resolve, 10));

            expect($(".filter input[data-value='camera_model']").val()).toBe('Sony A1');
            expect($(".filter input[data-value='camera_model']").hasClass('button-active')).toBe(true);
        });

        it('should handle false sort_descending correctly', async () => {
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({
                page: Constants.ARCHIVE,
                sort_by: 'name',
                sort_descending: ''
            });

            Router.retrieveStateFromUrlParams();

            expect(Filters.setSort).toHaveBeenCalledWith({ by: 'name', descending: false });
        });

        it('should handle undefined page and mode in getUrlParams', () => {
            vi.spyOn(Util, 'getUrlParams').mockReturnValue({});
            Router.retrieveStateFromUrlParams();
            expect(State.currentPage).toBe(Constants.HOME);
            expect(State.currentMode).toBe(Constants.MODE_BIRD);
        });

        it('should handle falsy rating in retrieveStateFromUrlParams via getter', () => {
            let ratingCalls = 0;
            const mockParams = {
                page: Constants.ARCHIVE,
                get rating() {
                    ratingCalls++;
                    return ratingCalls === 1 ? '4' : 0;
                }
            };
            vi.spyOn(Util, 'getUrlParams').mockReturnValue(mockParams);
            Router.retrieveStateFromUrlParams();
            expect(State.ratingFilter).toBe(0);
        });
    });

    describe('showPage', () => {
        it('should correctly trigger page loads and history push', async () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); // immediately cb with {}
            const params = { place: 'Park' };

            Router.showPage(Constants.ARCHIVE, params, false);

            expect(history.pushState).toHaveBeenCalled();
            expect(State.currentPage).toBe(Constants.ARCHIVE);
            expect(Util.readJSONFiles).toHaveBeenCalled();
            // Should call filters and rendering
            expect(Filters.filterAndSortData).toHaveBeenCalled();
            expect(Filters.setFilters).toHaveBeenCalled();
        });
        
        it('should handle HOME page load', async () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); 
            State.updateCurrentPage(Constants.ARCHIVE);

            Router.showPage(Constants.HOME, null, true); // PopState true means no history push

            expect(history.pushState).not.toHaveBeenCalled();
            expect(State.currentPage).toBe(Constants.HOME);
        });

        it('should handle EXPLORE_PAGE page load', async () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); 

            Router.showPage(Constants.EXPLORE_PAGE, null, true);

            expect(State.currentPage).toBe(Constants.EXPLORE_PAGE);
        });

        it('should handle MAP page load', async () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); 

            Router.showPage(Constants.MAP, null, true);

            expect(State.currentPage).toBe(Constants.MAP);
        });

        it('should handle EXPLORE_MENU page load', () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); 
            Router.showPage(Constants.EXPLORE_MENU, null, true);
            expect(State.currentPage).toBe(Constants.EXPLORE_MENU);
        });

        it('should handle MAP_MENU page load', () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); 
            Router.showPage(Constants.MAP_MENU, null, true);
            expect(State.currentPage).toBe(Constants.MAP_MENU);
        });

        it('should handle STORIES page load with and without params', () => {
            vi.spyOn(Util, 'readJSONFiles').mockImplementation((files, callback) => callback({})); 
            Router.showPage(Constants.STORIES, { story: 'my-story' }, true);
            expect(State.currentPage).toBe(Constants.STORIES);

            // Without params
            Router.showPage(Constants.STORIES, null, true);
            expect(State.currentPage).toBe(Constants.STORIES);
        });
    });
});
