import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Preview from '../../scripts/modules/public/preview.js';
import State from '../../scripts/modules/public/state.js';
import * as UiHelpers from '../../scripts/modules/ui-helpers.js';
import * as Rendering from '../../scripts/modules/public/rendering.js';

vi.mock('../../scripts/modules/ui-helpers.js', () => ({
    enableScroll: vi.fn(),
    disableScroll: vi.fn()
}));

vi.mock('../../scripts/modules/public/rendering.js', () => ({
    renderSightingDetails: vi.fn(),
    renderSightingThumbnailsAndDescription: vi.fn(),
    renderSightingTags: vi.fn()
}));

describe('Preview Module', () => {

    beforeEach(() => {
        document.body.innerHTML = `
            <div class="overlay" style="display:none;"></div>
            <div class="sightings-list">
                <video></video>
            </div>
        `;

        State.IS_MOBILE_DEVICE = false;

        State.data = {
            sightings: [
                {
                    key: 's1',
                    species: { name: 'Rock Pigeon' },
                    author: 'John Doe',
                    media: [
                        { src: 'img1.jpg', type: 'image', exif_data: { camera_model: 'Sony A1' } },
                        { src: 'vid1.mp4', type: 'video', mute: true }
                    ]
                },
                {
                    key: 's2',
                    species: { name: 'Blue Jay' },
                    author: '',
                    media: [
                        { src: 'img2.jpg', type: 'image' }
                    ]
                }
            ],
            filteredSightings: [
                {
                    key: 's1',
                    media: [ { src: 'img1.jpg' } ]
                },
                {
                    key: 's2',
                    media: [ { src: 'img2.jpg' } ]
                }
            ],
            camera_model: {
                'Sony A1': 'Sony Alpha 1'
            }
        };

        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('previewImage', () => {
        it('should do nothing if on mobile device', () => {
             State.IS_MOBILE_DEVICE = true;
             Preview.previewImage('s1', 'img1.jpg', 0);
             expect($('.preview-wrapper').length).toBe(0);
        });

        it('should create preview wrapper and render components', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);

            expect($('.preview-wrapper').length).toBe(1);
            expect($('.preview-image').data('index')).toBe(0);
            
            // Check that EXIF info icon was built properly
            expect($('.preview-image').html()).toContain('exif-info-icon');
            expect($('.preview-image').html()).toContain('Sony Alpha 1');

            expect(UiHelpers.disableScroll).toHaveBeenCalled();
        });

        it('should update preview media without recreating if same sighting key', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            expect($('.preview-wrapper').length).toBe(1);

            // Navigate to second media (video) in same sighting
            Preview.previewImage('s1', 'vid1.mp4', 0);
            expect($('.preview-wrapper').length).toBe(1); // Should still be 1
            expect($('.preview-image video').length).toBe(1); // Now showing video
        });

        it('should replace preview with slide-out animation if different sighting', () => {
            Preview.previewImage('s1', 'img1.jpg', 0, false);
            expect($('.preview-wrapper').length).toBe(1);

            Preview.previewImage('s2', 'img2.jpg', 1, false);
            
            // Should add slide-out class to old one
            expect($('.preview-wrapper').hasClass('slide-out')).toBe(true);

            // Fast forward timer to complete remove/recreate
            vi.runAllTimers();

            // After timeout it should create the new one
            expect($('.preview-image').data('index')).toBe(1);
        });
        
        it('should replace instantly if skipAnimation is true', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            
            Preview.previewImage('s2', 'img2.jpg', 1, true);
            // Replaced instantly without timeout
            expect($('.preview-image').data('index')).toBe(1);
        });
    });

    describe('removePreviewImage', () => {
        it('should remove preview image and clean up state', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            expect($('.preview-wrapper').length).toBe(1);

            Preview.removePreviewImage();
            
            expect($('.preview-wrapper').hasClass('slide-out')).toBe(true);
            vi.runAllTimers();
            expect($('.preview-wrapper').length).toBe(0);

            expect(UiHelpers.enableScroll).toHaveBeenCalled();
            expect($('body').hasClass('no-scroll')).toBe(false);
            expect($('.overlay').is(':visible')).toBe(false);
        });
    });

    describe('toggleSlideshow', () => {
        it('should start and stop slideshow timer', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            
            Preview.toggleSlideshow();
            expect($('.slideshow-button img').attr('src')).toBe('icons/pause.png');
            
            // Ensure timer scrolls
            vi.advanceTimersByTime(5000); 

            Preview.toggleSlideshow();
            expect($('.slideshow-button img').attr('src')).toBe('icons/play.png');
        });

        it('should stop slideshow if removed', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            Preview.toggleSlideshow();
            
            Preview.removePreviewImage();
            
            // Should reset the slideshow button state
            expect($('.slideshow-button img').attr('src')).toBe('icons/play.png');
        });
    });

    describe('scrollPreviewImageSighting', () => {
        it('should scroll to next sighting preview', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            
            Preview.scrollPreviewImageSighting(1);
            
            // Now looking at s2
            expect($('.preview-image').data('index')).toBe(1);
        });

        it('should stay if scrolling out of bounds', () => {
            Preview.previewImage('s1', 'img1.jpg', 0);
            
            Preview.scrollPreviewImageSighting(-1); // Out of bounds
            
            // Still looking at s1
            expect($('.preview-image').data('index')).toBe(0);
        });
    });

    describe('scrollPreviewImage', () => {
        it('should scroll next/prev thumbnails inside the same sighting if selected', () => {
             Preview.previewImage('s1', 'img1.jpg', 0);

             // Inject dummy thumbnails logic
             $('.preview-image-desc').append(`
                <div class="photos">
                    <div class="selected"><img></div>
                    <div class="unselected" onclick="console.log('clicked second thumb')"><img></div>
                </div>
             `);

             // We spy on the click event of the adjacent thumbnail
             const clickSpy = vi.fn();
             $('.photos div').eq(1).on('click', clickSpy);

             Preview.scrollPreviewImage(1);
             
             // It reached next thumbnail natively inside sighting
             expect(clickSpy).toHaveBeenCalled();
        });

        it('should fallback to sighting scroll if thumbnail hits edge bounds', () => {
             Preview.previewImage('s1', 'img1.jpg', 0);

             $('.preview-image-desc').append(`
                <div class="photos">
                    <div class="unselected"><img></div>
                    <div class="selected"><img></div>
                </div>
             `);

             Preview.scrollPreviewImage(1); // beyond last thumbnail
             
             // Switched to 's2' natively via scrollPreviewImageSighting
             expect($('.preview-image').data('index')).toBe(1);
        });

        it('should highlight selected thumbnail in updatePreviewMedia', () => {
             Preview.previewImage('s1', 'img1.jpg', 0);
             
             // Suppose thumbnails are rendered
             $('.preview-image-desc').append(`
                <div class="photos">
                    <div onclick="previewImage('s1', 'img1.jpg')" class="unselected"></div>
                    <div onclick="previewImage('s1', 'vid1.mp4')" class="unselected"></div>
                </div>
             `);

             // Trigger updatePreviewMedia logic (internally called by previewImage)
             Preview.previewImage('s1', 'vid1.mp4', 0);
             
             expect($('.preview-image-desc .photos div').eq(1).hasClass('selected')).toBe(true);
             expect($('.preview-image-desc .photos div').eq(0).hasClass('selected')).toBe(false);
        });
    });
});

