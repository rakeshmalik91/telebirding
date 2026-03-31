import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Filters from '../../scripts/modules/public/filters.js';
import State from '../../scripts/modules/public/state.js';
import * as Preview from '../../scripts/modules/public/preview.js';
import Util from '../../scripts/modules/util.js';
import Constants from '../../scripts/modules/constants.js';

vi.mock('../../scripts/modules/public/autocomplete.js', () => ({
    Autocomplete: vi.fn().mockImplementation((el, list, callback) => {
        const type = $(el).data('value');
        window.callbackCaptor = window.callbackCaptor || {};
        window.callbackCaptor[type] = callback;
        return { arr: list };
    })
}));

const originalIs = $.fn.is;
$.fn.is = vi.fn(function (selector) {
    if (selector === ':visible') return true;
    return originalIs.apply(this, arguments);
});



vi.mock('../../scripts/modules/public/preview.js', () => ({
    removePreviewImage: vi.fn(),
}));

describe('Filters Module', () => {

    beforeEach(() => {
        document.body.innerHTML = `
            <div class="filter" style="display: block;">
                <input data-value="place" />
                <button class="hidden"></button>
                <input data-value="sighting" />
                <input data-value="date" />
                <button class="hidden"></button>
            </div>
            <div class="sortby">
                <button data-value="date"><span class="order asc"></span></button>
                <button data-value="name"><span class="order"></span></button>
                <button data-value="shuffle"><span class="order"></span></button>
            </div>
            <div class="right-pane"></div>
            <div class="newspeciesfilter"></div>
        `;

        // Reset State
        State.data = {
            sightings: [
                {
                    key: 's1',
                    species: { name: 'Rock Pigeon', family: 'Columbidae', tags: ['feral'] },
                    place: 'Central Park',
                    city: 'New York',
                    state: 'NY',
                    country: 'US',
                    dateString: '1 Jan 2023',
                    rating: 3,
                    newSpecies: true,
                    index: 1,
                },
                {
                    key: 's2',
                    species: { name: 'Blue Jay', family: 'Corvidae', tags: ['common'] },
                    place: 'Backyard',
                    city: 'Boston',
                    state: 'MA',
                    country: 'US',
                    dateString: '2 Jan 2023',
                    rating: 5,
                    newSpecies: false,
                    index: 2,
                }
            ],
            countries: {
                'US': { name: 'United States', states: { 'NY': { name: 'New York' }, 'MA': { name: 'Massachusetts' } } }
            },
            filter: {},
            filteredSightings: []
        };
        State.sort = { by: 'date', descending: true };
        State.sightingFamilyFilter = null;
        State.newSpeciesFilter = false;
        State.ratingFilter = 0;
        State.currentPage = Constants.ARCHIVE;

        // Reset mocks
        vi.clearAllMocks();
    });

    describe('filterAndSortData', () => {
        it('should call removePreviewImage', () => {
            Filters.filterAndSortData({});
            expect(Preview.removePreviewImage).toHaveBeenCalled();
        });

        it('should handle family params', () => {
            Filters.filterAndSortData({}, { family: 'Corvidae' });
            expect(State.sightingFamilyFilter).toBe('Corvidae');
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].species.name).toBe('Blue Jay');
        });

        it('should filter by sighting (name)', () => {
            Filters.filterAndSortData({ sighting: 'Rock Pigeon' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].species.name).toBe('Rock Pigeon');
        });

        it('should filter by sighting tag', () => {
            Filters.filterAndSortData({ sighting: 'feral' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].species.name).toBe('Rock Pigeon');
        });

        it('should filter by sighting family name', () => {
            Filters.filterAndSortData({ sighting: 'Corvidae' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].species.name).toBe('Blue Jay');
        });

        it('should filter by place', () => {
            Filters.filterAndSortData({ place: 'Central Park' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].place).toBe('Central Park');
        });

        it('should filter by city', () => {
            Filters.filterAndSortData({ place: 'Boston' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].city).toBe('Boston');
        });

        it('should filter by state full name', () => {
            Filters.filterAndSortData({ place: 'New York' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].state).toBe('NY');
        });

        it('should filter by country full name', () => {
            Filters.filterAndSortData({ place: 'United States' });
            expect(State.data.filteredSightings.length).toBe(2);
        });

        it('should filter by date', () => {
             Filters.filterAndSortData({ date: '2 Jan 2023' });
             expect(State.data.filteredSightings.length).toBe(1);
             expect(State.data.filteredSightings[0].species.name).toBe('Blue Jay');
        });

        it('should filter by newSpecies', () => {
            State.newSpeciesFilter = true;
            Filters.filterAndSortData({ place: 'Central Park' });
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].species.name).toBe('Rock Pigeon');
        });

        it('should clear newSpeciesFilter when no date or place', () => {
            State.newSpeciesFilter = true;
            Filters.filterAndSortData({});
            expect(State.newSpeciesFilter).toBe(false);
        });

        it('should filter by rating', () => {
            State.ratingFilter = 4;
            Filters.filterAndSortData({});
            expect(State.data.filteredSightings.length).toBe(1);
            expect(State.data.filteredSightings[0].species.name).toBe('Blue Jay');
        });

        it('should sort by name descending', () => {
            State.sort = { by: 'name', descending: true };
            Filters.filterAndSortData({});
            expect(State.data.filteredSightings[0].species.name).toBe('Rock Pigeon');
            expect(State.data.filteredSightings[1].species.name).toBe('Blue Jay');
        });

        it('should sort by name ascending', () => {
            State.sort = { by: 'name', descending: false };
            Filters.filterAndSortData({});
            expect(State.data.filteredSightings[0].species.name).toBe('Blue Jay');
            expect(State.data.filteredSightings[1].species.name).toBe('Rock Pigeon');
        });

        it('should sort by shuffle', () => {
            State.sort = { by: 'shuffle', descending: false };
            Filters.filterAndSortData({});
            expect(State.data.filteredSightings.length).toBe(2);
        });

        it('should sort by key attribute (default sort behavior)', () => {
            State.sort = { by: 'rating', descending: true };
            Filters.filterAndSortData({});
            expect(State.data.filteredSightings[0].rating).toBe(5);
            expect(State.data.filteredSightings[1].rating).toBe(3);
        });

        it('should empty the right pane', () => {
            $('.right-pane').html('some content');
            Filters.filterAndSortData({});
            expect($('.right-pane').html()).toBe('');
        });
    });

    describe('triggerFilter', () => {
        it('should handle place filter on MAP_MENU', () => {
            State.currentPage = Constants.MAP_MENU;
            window.showPage = vi.fn();
            Filters.triggerFilter('place', 'NYC');
            expect(window.showPage).toHaveBeenCalledWith('map', { place: 'NYC' });
        });

        it('should handle rating filter', () => {
            window.showPage = vi.fn();
            Filters.triggerFilter('rating', 3);
            expect(State.ratingFilter).toBe(3);
            expect(window.showPage).toHaveBeenCalled();
        });

        it('should handle rating filter with falsy value', () => {
            window.showPage = vi.fn();
            Filters.triggerFilter('rating', 0);
            expect(State.ratingFilter).toBe(0);
        });

        it('should handle sighting filter when filter is visible', () => {
            window.showPage = vi.fn();
            window.hideRightPane = vi.fn();
            const originalIs = $.fn.is;
            $.fn.is = function(sel) {
                if (sel === ':visible') return true;
                return originalIs.apply(this, arguments);
            };

            $(".filter input[data-value='sighting']").val('test');
            Filters.triggerFilter('sighting', 'Jay');
            expect(window.hideRightPane).toHaveBeenCalled();

            $.fn.is = originalIs;
        });
    });

    describe('filterOnChange', () => {
        it('should apply button-active class for non-empty value', () => {
            window.showPage = vi.fn();
            $(".filter input[data-value='sighting']").val('Pigeon');
            Filters.filterOnChange('sighting');
            expect($(".filter input[data-value='sighting']").hasClass('button-active')).toBe(true);
        });

        it('should remove button-active class for empty value', () => {
            window.showPage = vi.fn();
            $(".filter input[data-value='sighting']").val('').addClass('button-active');
            Filters.filterOnChange('sighting');
            expect($(".filter input[data-value='sighting']").hasClass('button-active')).toBe(false);
        });
    });

    describe('setFilter and getFilter', () => {
        it('should set and get simple filter values', () => {
            Filters.setFilter('place', 'Boston');
            expect($('.filter input[data-value="place"]').val()).toBe('Boston');
            expect(Filters.getFilter('place')).toBe('Boston');
        });

        it('should clear old value if null', () => {
            Filters.setFilter('place', 'Boston');
            Filters.setFilter('place', null);
            expect($('.filter input[data-value="place"]').val()).toBe('');
            expect($('.filter input[data-value="place"]').hasClass('button-active')).toBe(false);
        });

        it('should retrieve multiple filters correctly', () => {
            Filters.setFilter('place', 'Boston');
            Filters.setFilter('sighting', 'Jay');
            const f = Filters.getFilters();
            expect(f.place).toBe('Boston');
            expect(f.sighting).toBe('Jay');
        });

        it('should handle date filter with button visibility', () => {
            Filters.setFilter('date', '2023');
            expect($(".filter input[data-value='date']").hasClass('button-active')).toBe(true);
        });

        it('should clear date button on null', () => {
            Filters.setFilter('date', '2023');
            Filters.setFilter('date', null);
            expect($(".filter input[data-value='date']").hasClass('button-active')).toBe(false);
        });

        it('should handle rating filter through setFilter', () => {
            Filters.setFilter('rating', 4);
            expect(State.ratingFilter).toBe(4);
        });

        it('should use URL params as fallback for getFilter', () => {
            // Remove the filter inputs for a specific type to force URL fallback
            $(".filter input[data-value='sighting']").remove();
            // URL params won't have anything set in jsdom, so undefined expected
            const result = Filters.getFilter('sighting');
            expect(result).toBeUndefined();
        });
    });

    describe('setFilters', () => {
        it('should set multiple filters at once', () => {
            Filters.setFilters({ sighting: 'Jay', place: 'Park', date: '2023', rating: 3 });
            expect($('.filter input[data-value="sighting"]').val()).toBe('Jay');
            expect($('.filter input[data-value="place"]').val()).toBe('Park');
            expect(State.ratingFilter).toBe(3);
        });

        it('should handle null filter object gracefully', () => {
            Filters.setFilters(null);
            // Should not throw
        });
    });

    describe('clearFilter', () => {
        it('should clear specific filter and trigger refresh', () => {
            const originalIs = $.fn.is;
            $.fn.is = function(selector) {
                if (selector === ':visible') return true;
                return originalIs.apply(this, arguments);
            };

            window.showPage = vi.fn();
            Filters.setFilter('place', 'Boston');
            Filters.clearFilter('place');
            expect($('.filter input[data-value="place"]').val()).toBe('');
            expect($('.filter input[data-value="place"]').hasClass('button-active')).toBe(false);
            expect(window.showPage).toHaveBeenCalledWith(Constants.ARCHIVE);

            $.fn.is = originalIs;
        });

        it('should handle clearing date filter with button hide', () => {
            const originalIs = $.fn.is;
            $.fn.is = function(selector) {
                if (selector === ':visible') return true;
                return originalIs.apply(this, arguments);
            };

            window.showPage = vi.fn();
            Filters.setFilter('date', '2023');
            Filters.clearFilter('date');
            expect($('.filter input[data-value="date"]').val()).toBe('');

            $.fn.is = originalIs;
        });
    });

    describe('sortByOnChange', () => {
        it('should toggle descending flag when clicking the same active sort', () => {
            window.showPage = vi.fn();
            Filters.setSort({ by: 'date', descending: true });

            Filters.sortByOnChange('date');

            expect(State.sort.descending).toBe(false);
            expect($(".sortby button[data-value='date'] span.order").hasClass('asc')).toBe(true);
            expect(window.showPage).toHaveBeenCalled();
        });

        it('should change sort by when clicking an inactive sort', () => {
            window.showPage = vi.fn();
            Filters.setSort({ by: 'date', descending: true });

            Filters.sortByOnChange('name');

            expect(State.sort.by).toBe('name');
            expect(State.sort.descending).toBe(false);
            expect($(".sortby button[data-value='name']").hasClass('button-active')).toBe(true);
            expect(window.showPage).toHaveBeenCalled();
        });

        it('should set descending when switching from date to non-date sort', () => {
            window.showPage = vi.fn();
            Filters.setSort({ by: 'name', descending: false });

            Filters.sortByOnChange('date');

            // When switching to 'date' from non-date, descending = (by !== 'date') which is true
            expect(State.sort.by).toBe('date');
            expect(State.sort.descending).toBe(true);
        });
    });

    describe('setNewSpeciesFilterState and toggle', () => {
        it('should toggle new species filter state', () => {
            window.showPage = vi.fn();
            expect(State.newSpeciesFilter).toBe(false);
            Filters.toggleNewSpeciesFilter();
            expect(State.newSpeciesFilter).toBe(true);
            expect($('.newspeciesfilter').hasClass('active')).toBe(true);
            expect(window.showPage).toHaveBeenCalled();
        });

        it('should toggle back to off', () => {
            window.showPage = vi.fn();
            State.newSpeciesFilter = true;
            Filters.toggleNewSpeciesFilter();
            expect(State.newSpeciesFilter).toBe(false);
            expect($('.newspeciesfilter').hasClass('active')).toBe(false);
        });
    });

    describe('resetRatingFilter', () => {
        it('should reset rating filter to 0 and refresh', () => {
            window.showPage = vi.fn();
            State.ratingFilter = 3;
            Filters.resetRatingFilter();
            expect(State.ratingFilter).toBe(0);
            expect(window.showPage).toHaveBeenCalled();
        });

        it('should still refresh even if already 0', () => {
            window.showPage = vi.fn();
            State.ratingFilter = 0;
            Filters.resetRatingFilter();
            expect(window.showPage).toHaveBeenCalled();
        });
    });

    describe('setSort', () => {
        it('should update sort state and buttons', () => {
            Filters.setSort({ by: 'name', descending: true });
            expect(State.sort.by).toBe('name');
            expect($(".sortby button[data-value='name']").hasClass('button-active')).toBe(true);
        });
    });

    describe('setNewSpeciesFilterState', () => {
        it('should add active class when filter is true', () => {
            State.newSpeciesFilter = true;
            Filters.setNewSpeciesFilterState();
            expect($('.newspeciesfilter').hasClass('active')).toBe(true);
        });

        it('should remove active class when filter is false', () => {
            State.newSpeciesFilter = false;
            Filters.setNewSpeciesFilterState();
            expect($('.newspeciesfilter').hasClass('active')).toBe(false);
        });
    });

    describe('initAutocomplete', () => {
        it('should initialize autocomplete with sighting and place data and callbacks', () => {
            window.callbackCaptor = {};
            
            document.body.innerHTML += `
                <div class="filter">
                    <input data-value="sighting" />
                    <input data-value="place" />
                </div>
            `;

            Filters.initAutocomplete();
            expect(State.autocompleteInitialized).toBe(true);

            window.showPage = vi.fn();
            // Trigger callbacks
            if (window.callbackCaptor.sighting) window.callbackCaptor.sighting('Pigeon');
            if (window.callbackCaptor.place) window.callbackCaptor.place('Park');

            expect(window.showPage).toHaveBeenCalled();
        });
    });
});


