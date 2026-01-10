import Util from '../util.js';

export function stopYoutubeVideos() {
    $('.youtube').each(function () {
        if (this.contentWindow) {
            this.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        }
    });
}

export function rollCarousal(image, direction) {
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

export function makeCarousal(container) {
    if ($(container).children().length > 1) {
        $(container).children().addClass('hidden');
        $(container).children().eq(0).removeClass('hidden');
        container.append('<button tabindex="-1" class="carousal-button-left" onclick="rollCarousal(this, -1)"></button>');
        container.append('<button tabindex="-1" class="carousal-button-right" onclick="rollCarousal(this, 1)"></button>');
    }
}

export function showMore() {
    jQuery('.home-page .hidden-story').show();
    jQuery('.home-page .show-more').hide();
}

export function setSiteLogo(modeConfig, currentMode) {
    jQuery('a.site-logo img').attr("src", modeConfig[currentMode].logo).attr("title", modeConfig[currentMode].title).attr("alt", modeConfig[currentMode].title);
}

export function ensurePageLoader() {
    if (jQuery('#page-loader').length) return;
    const loaderHtml = '<div id="page-loader" aria-hidden="true"><div class="page-loader-overlay"></div><div class="spinner" role="status" aria-label="Loading"></div></div>';
    jQuery('body').append(loaderHtml);
}

let _pageLoaderShownAt = 0;
const PAGE_LOADER_MIN_MS = 150;

export function showLoader() {
    ensurePageLoader();
    jQuery('#page-loader').show();
    _pageLoaderShownAt = Date.now();
}

export function hideLoader() {
    const elapsed = Date.now() - (_pageLoaderShownAt || 0);
    const remaining = PAGE_LOADER_MIN_MS - elapsed;
    if (remaining > 0) {
        setTimeout(function () { jQuery('#page-loader').fadeOut(150); _pageLoaderShownAt = 0; }, remaining);
    } else {
        jQuery('#page-loader').fadeOut(150);
        _pageLoaderShownAt = 0;
    }
}

export var carousalVisibleIndex;

export function showCarousalImage(index) {
    let images = $('.home .featured .image');
    $(images[carousalVisibleIndex]).hide();
    carousalVisibleIndex = index;
    $(images[carousalVisibleIndex]).show();
    $('.home .featured .carousal-buttons button').removeClass('active-carousal-button');
    $($('.home .featured .carousal-buttons button').get(carousalVisibleIndex)).addClass('active-carousal-button');
}

export function playCarousal() {
    let images = $('.home .featured .image');
    showCarousalImage((carousalVisibleIndex + 1 + images.length) % images.length);
}

export function renderHomePageCarousal(featured) {
    featured.forEach(function (image, index) {
        $('.home .featured .images').append('<div class="image carousal-animation" style="opacity:0;"><img src="' + Util.getMedia(image.src) + '" alt="' + image.alt + '" title="' + image.alt + '"/><span class="title">' + image.titleLine1 + '<br>' + image.titleLine2 + '</span></div>');
        $('.home .featured .carousal-buttons').append('<button type="button" onclick="showCarousalImage(' + index + ')"></button>');
    });
}

export function renderTrips(trips) {
    const div = $('.videos');
    trips.forEach(function (trip) {
        const videoHtml = '<iframe class="youtube" src="https://www.youtube.com/embed/' + trip.youtubeVideoId + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="true" allowscriptaccess="always"></iframe>';
        const video = $(videoHtml).get(0);
        $('.videos').append('<div class="video"><h1>' + trip.title + '</h1>' + video.outerHTML + '</div>');
    });
}

export function initSiteData() {
    Util.readJSONFile(Util.getData('data/site-data.json'), function (json) {
        renderHomePageCarousal(json.featured);

        carousalVisibleIndex = -1;
        // carousalVisibleIndex = Math.floor(Math.random() * $('.home .featured .image').length)
        $('.home .featured .image').hide();

        playCarousal();

        setInterval(function () {
            playCarousal();
        }, 30000);

        renderTrips(json.trips);
    });
}
