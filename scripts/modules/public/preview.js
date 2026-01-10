import Constants from '../constants.js';
import State from './state.js';
import Util from '../util.js';
import { enableScroll, disableScroll } from '../ui-helpers.js';
import { renderSightingDetails, renderSightingThumbnailsAndDescription, renderSightingTags } from './rendering.js';

let slideshowIntervalId = null;
let currentPreviewSightingKey = null;  // Track current sighting key

function isSlideshowPlaying() {
    return slideshowIntervalId != null;
}

export function toggleSlideshow() {
    if (isSlideshowPlaying()) {
        clearInterval(slideshowIntervalId);
        slideshowIntervalId = null;
        $('.slideshow-button img').attr('src', 'icons/play.png');
    } else {
        slideshowIntervalId = setInterval(() => { scrollPreviewImage(1) }, 5000);
        $('.slideshow-button img').attr('src', 'icons/pause.png');
    }
}

export function removePreviewImage() {
    if ($('.preview-image').length > 0) {
        if (isSlideshowPlaying()) toggleSlideshow();
        enableScroll();
        $('body').removeClass('no-scroll');
        currentPreviewSightingKey = null;  // Reset current sighting key
        // Slide out sideways instead of up
        $('.preview-image, .preview-image-desc').addClass('slide-out');
        setTimeout(() => {
            $('.preview-image').remove();
            $('.preview-image-desc').remove();
        }, 150);
        $('.overlay').hide();
        $('.sightings-list video').trigger('play');
    }
}

export function scrollPreviewImage(offset) {
    // Find selected thumbnail in photos section
    const selectedDivs = $('.preview-image-desc .photos div.selected');
    if (selectedDivs.length > 0) {
        const selectedDiv = selectedDivs.first();
        const currentSelectedIndex = selectedDiv.index();
        const items = selectedDiv.parent().find('> div');
        const nextIndex = currentSelectedIndex + offset;

        // If within bounds, navigate to next/prev image within same sighting
        if (nextIndex >= 0 && nextIndex < items.length) {
            items.eq(nextIndex).click();
        } else {
            // At edge of images, scroll to next/prev sighting
            scrollPreviewImageSighting(offset);
        }
    } else {
        // No thumbnail selected, try scrolling sighting
        scrollPreviewImageSighting(offset);
    }
}

export function scrollPreviewImageSighting(offset) {
    const index = $('.preview-image').data('index');
    const nextIndex = index + offset;
    if (!State.data.filteredSightings) {
        console.error("filteredSightings is undefined");
        return;
    }
    // Block navigation at first/last sighting boundaries
    if (nextIndex < 0 || nextIndex >= State.data.filteredSightings.length) {
        return; // Block navigation at boundaries
    }
    const sighting = State.data.filteredSightings[nextIndex];
    previewImage(sighting.key, sighting.media[0].src, nextIndex, true);
}

// Update navigation buttons visibility based on current position
function updateNavigationButtons(index) {
    if (!State.data.filteredSightings) return;

    // Hide left button on first sighting
    if (index <= 0) {
        $('.preview-image-desc .left-button').hide();
    } else {
        $('.preview-image-desc .left-button').show();
    }

    // Hide right button on last sighting
    if (index >= State.data.filteredSightings.length - 1) {
        $('.preview-image-desc .right-button').hide();
    } else {
        $('.preview-image-desc .right-button').show();
    }
}

export function previewImage(sightingKey, imageSrc, index, skipAnimation) {
    if (State.IS_MOBILE_DEVICE) {
        return;
    }
    // If same sighting but different image, just update the main image without any animation
    if ($('.preview-image').length && sightingKey === currentPreviewSightingKey) {
        updatePreviewMedia(sightingKey, imageSrc);
        return;
    }

    const createNewPreview = function () {
        $('.overlay').show();
        const sighting = State.data.sightings.filter(b => b.key == sightingKey)[0];
        if (!sighting) {
            console.error("Sighting not found for key:", sightingKey);
            return;
        }

        currentPreviewSightingKey = sightingKey;  // Store current sighting key

        const media = sighting.media.filter(m => m.src == imageSrc)[0];
        let mediaTag = '';
        if (media.type == Constants.MEDIA_TYPE_VIDEO) {
            mediaTag = '<video controls loop autoplay ' + (media.mute ? ' muted' : '') + '><source src="' + imageSrc + '" type="video/mp4"></video>';
        } else {
            mediaTag = '<img src="' + imageSrc + '" title="' + sighting.species.name + '" alt="' + sighting.species.name + '"></img>';
        }
        if (index == undefined) {
            //this check makes sure selecting a media from a different sighting does not move the flow to that sighting 
            index = State.data.filteredSightings.map((b, i) => (b.key == sightingKey) ? i : null).filter(k => k != null)[0];
        }
        $('body').append('<div class="preview-image" data-index="' + index + '">' + mediaTag + '</div>');
        $('body').append('<div class="preview-image-desc"></div>');
        $('.preview-image-desc').append('<button class="close-button" onclick="removePreviewImage()"><img src="icons/close.png" title="Close"/></button>');
        $('.preview-image-desc').append('<button class="slideshow-button" onclick="toggleSlideshow()"><img src="icons/' + (isSlideshowPlaying() ? "pause" : "play") + '.png" title="Slideshow"/></button>');
        $('.preview-image-desc').append('<button class="left-button" onclick="scrollPreviewImageSighting(-1)"></button>');
        $('.preview-image-desc').append('<button class="right-button" onclick="scrollPreviewImageSighting(1)"></button>');
        renderSightingDetails($('.preview-image-desc'), sighting, true);
        renderSightingThumbnailsAndDescription($('.preview-image-desc'), sighting, [imageSrc], index);
        renderSightingTags($('.preview-image-desc'), sighting);

        // Update navigation buttons visibility
        updateNavigationButtons(index);

        if (!Util.isTouchDevice()) disableScroll();
        $('.sightings-list video').trigger('pause');
    };

    if ($('.preview-image').length) {
        // When navigating between sightings, don't use slide-out animation - just replace content quickly
        if (skipAnimation) {
            $('.preview-image').remove();
            $('.preview-image-desc').remove();
            createNewPreview();
        } else {
            $('.preview-image, .preview-image-desc').addClass('slide-out');
            setTimeout(() => {
                $('.preview-image').remove();
                $('.preview-image-desc').remove();
                createNewPreview();
            }, 150);
        }
    } else {
        createNewPreview();
    }
}

// Update just the main preview image/video without recreating the whole preview
function updatePreviewMedia(sightingKey, imageSrc) {
    const sighting = State.data.sightings.filter(b => b.key == sightingKey)[0];
    if (!sighting) return;

    const media = sighting.media.filter(m => m.src == imageSrc)[0];
    if (!media) return;

    // Update main preview image/video
    const previewImageDiv = $('.preview-image');
    let mediaTag = '';
    if (media.type == Constants.MEDIA_TYPE_VIDEO) {
        mediaTag = '<video controls loop autoplay ' + (media.mute ? ' muted' : '') + '><source src="' + imageSrc + '" type="video/mp4"></video>';
    } else {
        mediaTag = '<img src="' + imageSrc + '" title="' + sighting.species.name + '" alt="' + sighting.species.name + '"></img>';
    }
    previewImageDiv.html(mediaTag);

    // Update thumbnail selection
    $('.preview-image-desc .photos div').removeClass('selected');
    $('.preview-image-desc .photos div').each(function () {
        const onclick = $(this).attr('onclick') || '';
        if (onclick.includes(imageSrc)) {
            $(this).addClass('selected');
        }
    });
}
