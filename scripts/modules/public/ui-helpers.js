import Util from '../util.js';
import Constants from '../constants.js';
import { renderStories } from './rendering.js';
import { showLoader, hideLoader } from '../loader.js';

// ----------------- archive page sighting carousal -----------------

export function rollSightingCarousal(image, direction) {
    let images = $(image).parent().find('.sighting-image')
    let index = 0;
    images.each(function (i, img) {
        if (!$(img).hasClass('hidden')) {
            index = i;
        }
    });
    images.addClass('hidden');
    let newIndex = (index + direction + images.length) % images.length;
    images.eq(newIndex).removeClass('hidden');
    $('.sightings-list video:visible').trigger('play');
}

export function initSightingCarousal(container) {
    if ($(container).children().length > 1) {
        $(container).children().addClass('hidden');
        $(container).children().eq(0).removeClass('hidden');
        container.append('<button tabindex="-1" class="carousal-button-left" onclick="rollSightingCarousal(this, -1)"></button>');
        container.append('<button tabindex="-1" class="carousal-button-right" onclick="rollSightingCarousal(this, 1)"></button>');
    }
}

// ----------------- home page carousal -----------------

export var _homePageCarousalIndex;
var _homePageCarousalInterval;

function resetHomePageCarousalTimer() {
    if (_homePageCarousalInterval) clearInterval(_homePageCarousalInterval);
    _homePageCarousalInterval = setInterval(function () {
        playHomePageCarousal();
    }, Constants.HOME_PAGE_SLIDESHOW_INTERVAL);
}

export function rollHomePageCarousal(index) {
    resetHomePageCarousalTimer();
    if (_homePageCarousalIndex == index) return;
    let images = $('.home .featured .image');
    let oldIndex = _homePageCarousalIndex;
    _homePageCarousalIndex = index;

    $('.home .featured .carousal-buttons button').removeClass('active-carousal-button');
    $($('.home .featured .carousal-buttons button').get(_homePageCarousalIndex)).addClass('active-carousal-button');

    let titleColor = $(images[index]).attr('data-title-color');
    $('.home .featured .carousal-buttons button').css('color', titleColor ? titleColor : '');

    if (oldIndex >= 0) {
        $(images[oldIndex]).fadeOut(Constants.HOME_PAGE_SLIDESHOW_FADE_INTERVAL, function () {
            $(images[index]).fadeIn(Constants.HOME_PAGE_SLIDESHOW_FADE_INTERVAL);
        });
    } else {
        $(images[index]).fadeIn(Constants.HOME_PAGE_SLIDESHOW_FADE_INTERVAL);
    }
}

export function playHomePageCarousal() {
    let images = $('.home .featured .image');
    rollHomePageCarousal((_homePageCarousalIndex + 1 + images.length) % images.length);
}

export function renderHomePageCarousal(featured) {
    featured.forEach(function (image, index) {
        let titleStyle = image.titleColor ? ' style="color: ' + image.titleColor + ';"' : '';
        let dataAttr = image.titleColor ? ' data-title-color="' + image.titleColor + '"' : '';
        $('.home .featured .images').append('<div class="image"' + dataAttr + '><img src="' + Util.getMedia(image.src) + '" alt="' + image.alt + '" title="' + image.alt + '"/><span class="title"' + titleStyle + '>' + image.titleLine1 + '<br>' + image.titleLine2 + '</span></div>');
        $('.home .featured .carousal-buttons').append('<button type="button" onclick="rollHomePageCarousal(' + index + ')"></button>');
    });
}

export function initHomePageCarousal() {
    showLoader('home-carousel');
    Util.readJSONFile(Util.getData('data/site-data.json'), function (json) {
        renderHomePageCarousal(json.featured);

        _homePageCarousalIndex = -1;
        // _homePageCarousalIndex = Math.floor(Math.random() * $('.home .featured .image').length)
        $('.home .featured .image').hide();

        let images = $('.home .featured .image');

        const imgs = images.find('img');
        let loadedCount = 0;
        const totalImages = imgs.length;

        const startSlideshow = () => {
            hideLoader('home-carousel');
            if (totalImages > 0) {
                playHomePageCarousal();
            }
        };

        const onImageLoaded = () => {
            loadedCount++;
            if (loadedCount >= totalImages) {
                startSlideshow();
            }
        };

        if (totalImages === 0) {
            startSlideshow();
        } else {
            imgs.each(function () {
                if (this.complete) {
                    onImageLoaded();
                } else {
                    $(this).on('load error', onImageLoaded);
                }
            });
        }
    });
}

// ----------------- home page -----------------

export function showMore() {
    jQuery('.hidden-story').show();
    jQuery('.show-more').hide();
}

export function setSiteLogo(modeConfig, currentMode) {
    jQuery('a.site-logo img').attr("src", modeConfig[currentMode].logo).attr("title", modeConfig[currentMode].title).attr("alt", modeConfig[currentMode].title);
}

// ----------------- youtube videos -----------------

export function stopYoutubeVideos() {
    $('.youtube').each(function () {
        if (this.contentWindow) {
            this.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        }
    });
}

export function copyStoryLink(slug) {
    const url = window.location.origin + window.location.pathname + "?page=" + Constants.STORIES + "&story=" + slug;
    navigator.clipboard.writeText(url).then(function () {
        // Optional: Show a toast or feedback
        const toast = $('<div class="toast">Link copied to clipboard</div>');
        $('body').append(toast);
        setTimeout(() => {
            toast.addClass('show');
            setTimeout(() => {
                toast.removeClass('show');
                setTimeout(() => toast.remove(), 500);
            }, 2000);
        }, 100);
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}
