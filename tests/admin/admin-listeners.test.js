import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupDashboardListeners } from '../../scripts/modules/admin/listeners.js';
import * as AdminData from '../../scripts/modules/admin/data.js';

vi.mock('../../scripts/modules/admin/data.js', () => ({
    data: {
        sightings: [],
        species: {}
    },
    syncSightingsData: vi.fn(),
    addSighting: vi.fn(),
    backup: vi.fn(),
    sortByDate: vi.fn(),
    sightingMatches: vi.fn(() => true)
}));

describe('Admin Listeners Module', () => {
    let renderFn;
    let viewState;

    beforeEach(() => {
        document.body.innerHTML = `
            <button class="save" disabled></button>
            <button class="sort-by-date"></button>
            <button class="add-sighting"></button>
            <button class="backup"></button>
            <button class="first-page"></button>
            <button class="previous"></button>
            <button class="next"></button>
            <button class="last-page"></button>
            <select name="page-size"><option value="5">5</option><option value="10" selected>10</option></select>
            <input name="filter-sighting" value="" />
        `;

        renderFn = vi.fn();
        viewState = { offset: 5, rows: 10 };

        AdminData.data.sightings = [];
        for (let i = 0; i < 30; i++) {
            AdminData.data.sightings.push({ key: 's' + i, species: 'rock-pigeon' });
        }

        vi.clearAllMocks();
        setupDashboardListeners(renderFn, viewState);
    });

    describe('save button', () => {
        it('should call syncSightingsData(0) on click', () => {
            $('button.save').trigger('click');
            expect(AdminData.syncSightingsData).toHaveBeenCalledWith(0);
        });
    });

    describe('sort-by-date button', () => {
        it('should call sortByDate on click', () => {
            $('button.sort-by-date').trigger('click');
            expect(AdminData.sortByDate).toHaveBeenCalled();
        });
    });

    describe('add-sighting button', () => {
        it('should reset offset and add sighting', () => {
            viewState.offset = 10;
            $('button.add-sighting').trigger('click');
            expect(viewState.offset).toBe(0);
            expect(AdminData.addSighting).toHaveBeenCalled();
        });
    });

    describe('backup button', () => {
        it('should call backup on click', () => {
            $('button.backup').trigger('click');
            expect(AdminData.backup).toHaveBeenCalled();
        });
    });

    describe('first-page button', () => {
        it('should set offset to 0 and render when offset > 0', () => {
            viewState.offset = 10;
            $('button.first-page').trigger('click');
            expect(viewState.offset).toBe(0);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not render when already at offset 0', () => {
            viewState.offset = 0;
            $('button.first-page').trigger('click');
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('previous button', () => {
        it('should decrease offset by rows and render', () => {
            viewState.offset = 10;
            viewState.rows = 5;
            $('button.previous').trigger('click');
            expect(viewState.offset).toBe(5);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not go below 0', () => {
            viewState.offset = 3;
            viewState.rows = 5;
            $('button.previous').trigger('click');
            expect(viewState.offset).toBe(0);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not render when already at offset 0', () => {
            viewState.offset = 0;
            $('button.previous').trigger('click');
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('next button', () => {
        it('should increase offset by rows when more data exists', () => {
            viewState.offset = 0;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.next').trigger('click');
            expect(viewState.offset).toBe(10);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not increase when at the end', () => {
            viewState.offset = 20;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.next').trigger('click');
            expect(viewState.offset).toBe(20);
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('last-page button', () => {
        it('should jump to last page', () => {
            viewState.offset = 0;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.last-page').trigger('click');
            // 30 sightings, 10 per page -> Math.floor(30/10) * 10 = 30
            expect(viewState.offset).toBe(30);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not change if already on last page', () => {
            viewState.offset = 20;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.last-page').trigger('click');
            expect(viewState.offset).toBe(20);
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('page-size select', () => {
        it('should update rows from select value and render', () => {
            $('select[name=page-size]').val('5').trigger('click');
            expect(viewState.rows).toBe(5);
            expect(renderFn).toHaveBeenCalled();
        });
    });

    describe('filter-sighting input', () => {
        it('should reset offset and render on change', () => {
            viewState.offset = 15;
            const input = $('input[name=filter-sighting]');
            input.val('pigeon').trigger('change');
            expect(viewState.offset).toBe(0);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should select all text on focus', () => {
            const input = $('input[name=filter-sighting]');
            input.val('test');
            const selectSpy = vi.spyOn($.fn, 'select');
            input.trigger('focus');
            expect(selectSpy).toHaveBeenCalled();
            selectSpy.mockRestore();
        });
    });
});
