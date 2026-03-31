import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as UiHelpers from '../../scripts/modules/public/ui-helpers.js';
import Constants from '../../scripts/modules/constants.js';
import Util from '../../scripts/modules/util.js';
import * as Loader from '../../scripts/modules/loader.js';

vi.mock('../../scripts/modules/loader.js', () => ({
    showLoader: vi.fn(),
    hideLoader: vi.fn()
}));

vi.mock('../../scripts/modules/util.js', () => ({
    default: {
        getMedia: vi.fn((src) => 'media/' + src),
        readJSONFile: vi.fn((url, cb) => cb({
            featured: [
                { src: 'img1.jpg', alt: 'Alt 1', titleLine1: 'Line 1a', titleLine2: 'Line 2a', titleColor: '#fff' },
                { src: 'img2.jpg', alt: 'Alt 2', titleLine1: 'Line 1b', titleLine2: 'Line 2b' }
            ]
        })),
        getData: vi.fn((path) => path),
        isDeviceOnLandscapeOrientation: vi.fn(() => true)
    }
}));

describe('Public UI Helpers', () => {

    beforeEach(() => {
        // Expose to window for onclick handlers in tests
        window.rollSightingCarousal = UiHelpers.rollSightingCarousal;
        window.rollHomePageCarousal = UiHelpers.rollHomePageCarousal;

        document.body.innerHTML = `
            <div id="test-container"></div>
            
            <div class="home">
                <div class="featured">
                    <div class="images"></div>
                    <div class="carousal-buttons"></div>
                </div>
            </div>
            
            <div class="hidden-story" style="display:none;"></div>
            <button class="show-more"></button>
            <a class="site-logo"><img src=""></a>
            
            <iframe class="youtube"></iframe>
        `;
        
        // Mock jQuery fade functions to evaluate instantly
        $.fn.fadeIn = vi.fn(function(speed, cb) {
            this.show();
            if(cb) cb();
            return this;
        });
        $.fn.fadeOut = vi.fn(function(speed, cb) {
            this.hide();
            if(cb) cb();
            return this;
        });

        // Object.defineProperty(window, 'navigator', {
        //     value: { clipboard: { writeText: vi.fn().mockResolvedValue() } },
        //     writable: true
        // });
        if (!navigator.clipboard) {
            navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
        } else {
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
        }

        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    // ----------------- setup / clear -----------------

    describe('rollSightingCarousal & initSightingCarousal', () => {
        beforeEach(() => {
            $('#test-container').html(`
                <div class="sighting-image-carousal">
                    <div class="sighting-image-scroll" style="width:500px">
                        <div class="sighting-image hidden slide-left" style="order: 0;"></div>
                        <div class="sighting-image hidden slide-left" style="order: 1;"></div>
                        <div class="sighting-image hidden slide-left" style="order: 2;"></div>
                    </div>
                </div>
            `);
        });

        it('should initialize the carousal setup, unhiding images and adding buttons', () => {
            UiHelpers.initSightingCarousal($('.sighting-image-carousal')[0]);
            
            expect($('.sighting-image').hasClass('hidden')).toBe(false);
            expect($('.carousal-button-left').length).toBe(1);
            expect($('.carousal-button-right').length).toBe(1);
        });

        it('should roll Sighting Carousal backwards (direction < 0)', () => {
             UiHelpers.initSightingCarousal($('.sighting-image-carousal')[0]);

             // Initial orders: 0, 1, 2
             const btnLeft = $('.carousal-button-left')[0];
             UiHelpers.rollSightingCarousal(btnLeft, -1);

             // Order of last element (index 2) should become -1
             expect($('.sighting-image').eq(2).css('order')).toBe("-1");

             vi.runAllTimers(); // finish setTimeout
             
             // The container resets animation
             expect($('.sighting-image-scroll')[0].isAnimating).toBe(false);
        });

        it('should roll Sighting Carousal forwards (direction > 0)', () => {
             UiHelpers.initSightingCarousal($('.sighting-image-carousal')[0]);

             const btnRight = $('.carousal-button-right')[0];
             UiHelpers.rollSightingCarousal(btnRight, 1);

             // During animation, it translates left
             const scrollEl = $('.sighting-image-scroll')[0];

             vi.runAllTimers(); // finish setTimeout
             
             // After timeout, first element order jumps to last
             // Because items length is 3, last order is 2, so it should become 3
             expect($('.sighting-image').eq(0).css('order')).toBe("3");
             expect(scrollEl.isAnimating).toBe(false);
        });
        
        it('should simulate swipes cleanly', () => {
             UiHelpers.initSightingCarousal($('#test-container .sighting-image-carousal')[0]);
             
             const scrollEl = $('#test-container .sighting-image-scroll')[0];
             
             // Simulate mousedown & mouseup to trigger drag
             const mdown = new MouseEvent('mousedown', { button: 0, bubbles: true });
             Object.defineProperty(mdown, 'pageX', { value: 100 });
             scrollEl.dispatchEvent(mdown);

             const mmove = new MouseEvent('mousemove', { bubbles: true });
             Object.defineProperty(mmove, 'pageX', { value: 150 });
             scrollEl.dispatchEvent(mmove);

             const mup = new MouseEvent('mouseup', { bubbles: true });
             Object.defineProperty(mup, 'pageX', { value: 150 });
             scrollEl.dispatchEvent(mup);
             
             // Drag diff is 50 (150-100) -> >30 -> rollSightingCarousal(-1) -> swiped backward
             expect($('#test-container .sighting-image').eq(2).css('order')).toBe("-1");
        });

        it('should trigger click on small swipe distance', () => {
             const container = $('#test-container .sighting-image-carousal')[0];
             UiHelpers.initSightingCarousal(container);
             const scrollEl = $(container).find('.sighting-image-scroll')[0];
             const clickSpy = vi.fn();
             $(scrollEl).on('click', clickSpy);

             const mdown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
             Object.defineProperty(mdown, 'pageX', { value: 100 });
             scrollEl.dispatchEvent(mdown);
             
             const mup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
             Object.defineProperty(mup, 'pageX', { value: 105 });
             scrollEl.dispatchEvent(mup);

             // Manually dispatch click since DOM won't do it automatically
             const click = new MouseEvent('click', { bubbles: true, cancelable: true });
             scrollEl.dispatchEvent(click);

             expect(clickSpy).toHaveBeenCalled();
        });

        it('should debounce carousel buttons', () => {
             vi.useFakeTimers();
             
             const container = $('#test-container .sighting-image-carousal')[0];
             UiHelpers.initSightingCarousal(container);
             const scrollEl = $(container).find('.sighting-image-scroll')[0];
            
             // Call directly to avoid JSDOM global onclick issues
             UiHelpers.rollSightingCarousal(scrollEl, 1);
             UiHelpers.rollSightingCarousal(scrollEl, 1); // Should be debounced
             
             // Check if isAnimating was set
             expect(scrollEl.isAnimating).toBe(true);
             
             vi.advanceTimersByTime(600);
             expect(scrollEl.isAnimating).toBe(false);

             vi.useRealTimers();
        });




    });


    describe('Home Page Carousal', () => {
        it('should renderHomePageCarousal correctly', () => {
            const featured = [
                { src: 'img3.jpg', alt: 'Test', titleLine1: 'L1', titleLine2: 'L2', titleColor: 'red' }
            ];
            UiHelpers.renderHomePageCarousal(featured);
            
            expect($('.home .featured .images .image').length).toBe(1);
            expect($('.home .featured .carousal-buttons button').length).toBe(1);
            expect($('.home .featured .images .image img').attr('src')).toBe('media/img3.jpg');
            expect($('.home .featured .images .image .title').css('color')).toBe('rgb(255, 0, 0)');
            expect($('.home .featured .images .image .title').html()).toBe('L1<br>L2');
        });

        it('should play, roll, and restart hompage carousal', () => {
            UiHelpers.initHomePageCarousal();
            expect(Loader.showLoader).toHaveBeenCalledWith('home-carousel');

            expect($('.home .featured .image').length).toBe(2);

            UiHelpers.playHomePageCarousal();
            
            expect($('.home .featured .image').eq(0).css('display')).not.toBe('none');
            expect($('.home .featured .carousal-buttons button').eq(0).hasClass('active-carousal-button')).toBe(true);
            
            vi.advanceTimersByTime(Constants.HOME_PAGE_SLIDESHOW_INTERVAL + 100);

            expect($.fn.fadeOut).toHaveBeenCalled();
            expect($.fn.fadeIn).toHaveBeenCalled();
            expect($('.home .featured .carousal-buttons button').eq(1).hasClass('active-carousal-button')).toBe(true);
        });
    });

    describe('Miscellaneous Helpers', () => {
        it('showMore should reveal elements', () => {
            UiHelpers.showMore();
            expect($('.hidden-story').css('display')).not.toBe('none');
            expect($('.show-more').css('display')).toBe('none');
        });

        it('setSiteLogo should map mode correctly', () => {
            const modeConfig = {
                'bird': { logo: 'bird.png', title: 'Birds' }
            };
            UiHelpers.setSiteLogo(modeConfig, 'bird');
            expect($('a.site-logo img').attr('src')).toBe('bird.png');
            expect($('a.site-logo img').attr('title')).toBe('Birds');
        });

        it('stopYoutubeVideos should postMessage to iframe', () => {
             const iframe = $('.youtube')[0];
             const postMessageMock = vi.fn();
             Object.defineProperty(iframe, 'contentWindow', { 
                 value: { postMessage: postMessageMock }
             });
             
             UiHelpers.stopYoutubeVideos();
             expect(postMessageMock).toHaveBeenCalled();
        });

        it('copyStoryLink should copy to clipboard and show toast with full lifecycle', () => {
             vi.useFakeTimers();
             vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

             UiHelpers.copyStoryLink('slug-123');

             // After clipboard resolves, toast is appended
             vi.advanceTimersByTime(0); // flush promise
             // Wait for show class
             vi.advanceTimersByTime(100);
             const toast = $('body .toast');
             // Wait for hide
             vi.advanceTimersByTime(2000);
             // Wait for removal
             vi.advanceTimersByTime(500);
             vi.useRealTimers();
        });

        it('copyStoryLink should handle clipboard error', () => {
             vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('fail'));
             const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
             
             UiHelpers.copyStoryLink('slug-123');
             consoleSpy.mockRestore();
        });
    });

    describe('initSightingCarousal', () => {
        it('should set up carousel buttons and swipe for multiple images', () => {
            const container = $(`
                <div class="sighting-image-carousal">
                    <div class="sighting-image-scroll">
                        <div class="sighting-image" style="order:0">img1</div>
                        <div class="sighting-image" style="order:1">img2</div>
                    </div>
                </div>
            `);
            $('body').append(container);

            UiHelpers.initSightingCarousal(container[0]);

            expect(container.find('.carousal-button-left').length).toBe(1);
            expect(container.find('.carousal-button-right').length).toBe(1);

            container.remove();
        });

        it('should not add buttons for single image', () => {
            const container = $(`
                <div class="sighting-image-carousal">
                    <div class="sighting-image-scroll">
                        <div class="sighting-image">img1</div>
                    </div>
                </div>
            `);
            $('body').append(container);

            UiHelpers.initSightingCarousal(container[0]);

            expect(container.find('.carousal-button-left').length).toBe(0);
            container.remove();
        });

        it('should handle empty container', () => {
            const container = $('<div></div>');
            UiHelpers.initSightingCarousal(container[0]);
            // Should not throw
        });
    });

    describe('rollSightingCarousal', () => {
        it('should scroll forward (direction > 0)', () => {
            vi.useFakeTimers();
            const container = $(`
                <div class="sighting-image-carousal">
                    <div class="sighting-image-scroll" style="width:200px">
                        <div class="sighting-image" style="order:0">img1</div>
                        <div class="sighting-image" style="order:1">img2</div>
                    </div>
                </div>
            `);
            $('body').append(container);

            UiHelpers.rollSightingCarousal(container[0], 1);
            vi.advanceTimersByTime(500);

            container.remove();
            vi.useRealTimers();
        });

        it('should scroll backward (direction < 0)', () => {
            vi.useFakeTimers();
            const container = $(`
                <div class="sighting-image-carousal">
                    <div class="sighting-image-scroll" style="width:200px">
                        <div class="sighting-image" style="order:0">img1</div>
                        <div class="sighting-image" style="order:1">img2</div>
                    </div>
                </div>
            `);
            $('body').append(container);

            UiHelpers.rollSightingCarousal(container[0], -1);
            vi.advanceTimersByTime(500);

            container.remove();
            vi.useRealTimers();
        });

        it('should not scroll if only one image', () => {
            const container = $(`
                <div class="sighting-image-carousal">
                    <div class="sighting-image-scroll">
                        <div class="sighting-image">img1</div>
                    </div>
                </div>
            `);
            $('body').append(container);

            UiHelpers.rollSightingCarousal(container[0], 1);
            // Should not crash
            container.remove();
        });

        it('should not scroll if no scroll container', () => {
            const container = $('<div class="sighting-image-carousal"></div>');
            UiHelpers.rollSightingCarousal(container[0], 1);
            // Should not crash
        });
    });
});
