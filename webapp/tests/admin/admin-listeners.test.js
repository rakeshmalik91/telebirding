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
    sightingMatches: vi.fn(() => true),
    undoSighting: vi.fn(),
    redoSighting: vi.fn(),
    delayPendingSave: vi.fn(),
    deleteMedia: vi.fn(),
    getMaxPinnedCount: vi.fn(() => 3),
    setMaxPinnedCount: vi.fn((val) => parseInt(val, 10) || 3)
}));

describe('Admin Listeners Module', () => {
    let renderFn;
    let viewState;

    beforeEach(() => {
        vi.useFakeTimers();
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
            <input type="number" name="max-pinned" value="3" />
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

    describe('max-pinned configuration', () => {
        it('should initialize input with getMaxPinnedCount and call setMaxPinnedCount on change', () => {
            expect($('input[name=max-pinned]').val()).toBe('3');
            $('input[name=max-pinned]').val('5').trigger('change');
            expect(AdminData.setMaxPinnedCount).toHaveBeenCalledWith('5');
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
            vi.runAllTimers();
            expect(viewState.offset).toBe(0);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not render when already at offset 0', () => {
            viewState.offset = 0;
            $('button.first-page').trigger('click');
            vi.runAllTimers();
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('previous button', () => {
        it('should decrease offset by rows and render', () => {
            viewState.offset = 10;
            viewState.rows = 5;
            $('button.previous').trigger('click');
            vi.runAllTimers();
            expect(viewState.offset).toBe(5);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not go below 0', () => {
            viewState.offset = 3;
            viewState.rows = 5;
            $('button.previous').trigger('click');
            vi.runAllTimers();
            expect(viewState.offset).toBe(0);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not render when already at offset 0', () => {
            viewState.offset = 0;
            $('button.previous').trigger('click');
            vi.runAllTimers();
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('next button', () => {
        it('should increase offset by rows when more data exists', () => {
            viewState.offset = 0;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.next').trigger('click');
            vi.runAllTimers();
            expect(viewState.offset).toBe(10);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not increase when at the end', () => {
            viewState.offset = 20;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.next').trigger('click');
            vi.runAllTimers();
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
            vi.runAllTimers();
            // 30 sightings, 10 per page -> Math.floor(30/10) * 10 = 30
            expect(viewState.offset).toBe(30);
            expect(renderFn).toHaveBeenCalled();
        });

        it('should not change if already on last page', () => {
            viewState.offset = 20;
            viewState.rows = 10;
            AdminData.sightingMatches.mockReturnValue(true);

            $('button.last-page').trigger('click');
            vi.runAllTimers();
            expect(viewState.offset).toBe(20);
            expect(renderFn).not.toHaveBeenCalled();
        });
    });

    describe('page-size select', () => {
        it('should update rows from select value and render', () => {
            $('select[name=page-size]').val('5').trigger('change');
            vi.runAllTimers();
            expect(viewState.rows).toBe(5);
            expect(renderFn).toHaveBeenCalled();
        });
    });

    describe('filter-sighting input', () => {
        it('should reset offset and render on change', () => {
            viewState.offset = 15;
            const input = $('input[name=filter-sighting]');
            input.val('pigeon').trigger('change');
            vi.runAllTimers();
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

    describe('media-popup keyboard navigation', () => {
        beforeEach(() => {
            AdminData.data.species = {
                'rock-pigeon': { name: 'Rock Pigeon' }
            };
            AdminData.data.camera_model = {
                'a1': 'Sony A1'
            };
            AdminData.data.sightings[0] = {
                key: 's0',
                species: 'rock-pigeon',
                date: '26-11-2026',
                place: 'Wetland',
                country: 'India',
                rating: 4,
                media: [
                    { src: 'images/img1.jpg', type: 'image', title: 'Perching', exif_data: { camera_model: 'a1' } },
                    { src: 'videos/vid1.mp4', type: 'video', title: 'Flying' },
                    { src: 'images/img2.jpg', type: 'image', title: 'Portrait' }
                ]
            };
            document.body.innerHTML += `
                <table>
                    <tr>
                        <td>
                            <div class="thumbnail" data-sightingkey="s0" data-mediasrc="images/img1.jpg" data-fullsrc="img1.jpg" data-mediatype="image"></div>
                            <div class="thumbnail" data-sightingkey="s0" data-mediasrc="videos/vid1.mp4" data-fullsrc="vid1.mp4" data-mediatype="video"></div>
                            <div class="thumbnail" data-sightingkey="s0" data-mediasrc="images/img2.jpg" data-fullsrc="img2.jpg" data-mediatype="image"></div>
                        </td>
                    </tr>
                </table>
                <div id="media-popup" style="display: none;">
                    <div class="media-popup-overlay"></div>
                    <div class="media-popup-content">
                        <button class="media-popup-close">✕</button>
                        <div class="media-popup-stage">
                            <button class="media-popup-nav media-popup-prev" style="display:none;">‹</button>
                            <img src="" id="media-popup-img" style="display:none;" />
                            <video src="" id="media-popup-video" style="display:none;"></video>
                            <button class="media-popup-nav media-popup-next" style="display:none;">›</button>
                        </div>
                        <div id="media-popup-details" class="media-popup-details" style="display: none;">
                            <div id="media-popup-details-body" class="media-popup-details-body"></div>
                            <div class="media-popup-details-footer">
                                <button type="button" id="media-popup-delete" class="media-popup-delete-btn">🗑️ Delete Media</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            setupDashboardListeners(renderFn, viewState);
        });

        it('should render media details on the right side and navigate with ArrowRight and ArrowLeft', () => {
            $('.thumbnail').eq(0).trigger('click');
            expect($('#media-popup-img').attr('src')).toBe('img1.jpg');
            expect($('#media-popup-details').css('display')).not.toBe('none');
            expect($('#media-popup-details-body').text()).toContain('Rock Pigeon');
            expect($('#media-popup-details-body').text()).toContain('Perching');
            expect($('#media-popup-details-body').text()).toContain('Sony A1');
            expect($('#media-popup-details-body').text()).toContain('1 / 3');

            $(document).trigger($.Event('keydown', { key: 'ArrowRight' }));
            expect($('#media-popup-video').attr('src')).toBe('vid1.mp4');
            expect($('#media-popup-img').attr('src')).toBe('');
            expect($('#media-popup-details-body').text()).toContain('2 / 3');

            $(document).trigger($.Event('keydown', { key: 'ArrowRight' }));
            expect($('#media-popup-img').attr('src')).toBe('img2.jpg');

            // Wraps around forward and backward
            $(document).trigger($.Event('keydown', { key: 'ArrowRight' }));
            expect($('#media-popup-img').attr('src')).toBe('img1.jpg');

            $(document).trigger($.Event('keydown', { key: 'ArrowLeft' }));
            expect($('#media-popup-img').attr('src')).toBe('img2.jpg');
        });

        it('should delete current media via delete button or Delete key and advance preview', () => {
            AdminData.deleteMedia.mockImplementation((_key, _src, _skip, onDeleted) => {
                if (typeof onDeleted === 'function') onDeleted();
            });

            $('.thumbnail').eq(0).trigger('click');
            expect($('#media-popup-img').attr('src')).toBe('img1.jpg');

            // Delete via button click -> advances to vid1.mp4
            $('#media-popup-delete').trigger('click');
            expect(AdminData.deleteMedia).toHaveBeenCalledWith('s0', 'images/img1.jpg', false, expect.any(Function));
            expect($('#media-popup-video').attr('src')).toBe('vid1.mp4');

            // Delete via Delete key -> advances to img2.jpg
            $(document).trigger($.Event('keydown', { key: 'Delete' }));
            expect(AdminData.deleteMedia).toHaveBeenCalledWith('s0', 'videos/vid1.mp4', false, expect.any(Function));
            expect($('#media-popup-img').attr('src')).toBe('img2.jpg');

            // Delete last remaining media -> closes popup
            $(document).trigger($.Event('keydown', { key: 'Delete' }));
            vi.runAllTimers();
            expect($('#media-popup').css('display')).toBe('none');
        });

        it('should close media popup on Escape', () => {
            $('.thumbnail').eq(0).trigger('click');
            expect($('#media-popup').css('display')).not.toBe('none');

            $(document).trigger($.Event('keydown', { key: 'Escape' }));
            vi.runAllTimers();
            expect($('#media-popup').css('display')).toBe('none');
        });
    });
});
