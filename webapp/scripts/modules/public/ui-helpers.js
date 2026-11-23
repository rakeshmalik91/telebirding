import Util from '../util.js';
import Constants from '../constants.js';
import { renderStories } from './rendering.js';
import { showLoader, hideLoader } from '../loader.js';
import State from './state.js';

// ----------------- archive page sighting carousal -----------------

export function rollSightingCarousal(btn, direction) {
    let containerOuter = $(btn).hasClass('sighting-image-carousal') ? $(btn) : $(btn).parent();
    let container = containerOuter.find('.sighting-image-scroll');
    if (!container.length) return;
    let elem = container[0];
    let images = container.children('.sighting-image');
    if (images.length <= 1) return;

    if (elem.isAnimating) return;
    elem.isAnimating = true;

    // Get current items sorted by their flex `order`
    let items = Array.from(images).sort((a, b) => {
        let orderA = parseInt(a.style.order || "0", 10);
        let orderB = parseInt(b.style.order || "0", 10);
        return orderA - orderB;
    });

    let width = elem.clientWidth;

    if (direction < 0) {
        // Going backwards (swipe right)
        let lastItem = items[items.length - 1];
        let firstOrder = parseInt(items[0].style.order || "0", 10);

        // Put last item at the front logically
        lastItem.style.order = firstOrder - 1;

        // Instantly shift container left to counteract the layout shift
        elem.style.transition = 'none';
        elem.style.transform = `translateX(-${width}px)`;

        // Force reflow
        elem.offsetHeight;

        // Animate container back to 0
        elem.style.transition = 'transform 0.4s ease-in-out';
        elem.style.transform = 'translateX(0)';
    } else {
        // Going forwards (swipe left)
        // Animate container to the left by 1 width
        elem.style.transition = 'transform 0.4s ease-in-out';
        elem.style.transform = `translateX(-${width}px)`;
    }

    setTimeout(() => {
        if (direction > 0) {
            // After forward animation finishes:
            let lastOrder = parseInt(items[items.length - 1].style.order || "0", 10);
            let firstItem = items[0];

            // Put first item at the back logically
            firstItem.style.order = lastOrder + 1;

            // Instantly reset container shift
            elem.style.transition = 'none';
            elem.style.transform = 'translateX(0)';
        }
        elem.isAnimating = false;
        $('.sightings-list video:visible').trigger('play');
    }, 400);
}

export function initSightingCarousal(containerOuter) {
    let container = $(containerOuter).find('.sighting-image-scroll');
    if (!container.length) return;

    let images = container.children('.sighting-image');
    images.removeClass('hidden slide-left');

    images.each(function (i, img) {
        img.style.order = i;
    });

    if (images.length > 1) {
        $(containerOuter).append('<button tabindex="-1" class="carousal-button-left" onclick="rollSightingCarousal(this, -1)"></button>');
        $(containerOuter).append('<button tabindex="-1" class="carousal-button-right" onclick="rollSightingCarousal(this, 1)"></button>');
    }
    setupSwipe(container[0]);
}

function setupSwipe(el) {
    let startX = 0;
    let isDown = false;
    let dragged = false;

    // Mouse events - we do custom drag logic to mimic swipe clicks
    el.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.button !== 0) {
            dragged = false;
            return;
        }
        isDown = true;
        dragged = false;
        startX = e.pageX;
        e.preventDefault(); // Prevents native ghost image drag
    });

    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const x = e.pageX;
        if (Math.abs(x - startX) > 5) {
            dragged = true;
        }
    });

    el.addEventListener('mouseup', (e) => {
        if (!isDown) return;
        isDown = false;
        handleDragEnd(el, startX, e.pageX);
        setTimeout(() => { dragged = false; }, 0);
    });

    el.addEventListener('mouseleave', () => {
        isDown = false;
        dragged = false;
    });

    // Touch events - native scroll-snap handles slide, we just enforce the cycle wrappers on ends.
    let touchStartX = 0;
    el.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'BUTTON') {
            dragged = false;
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        dragged = false;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        const x = e.changedTouches[0].screenX;
        if (Math.abs(x - touchStartX) > 5) {
            dragged = true;
        }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
        let touchEndX = e.changedTouches[0].screenX;
        handleDragEnd(el, touchStartX, touchEndX);
        setTimeout(() => { dragged = false; }, 0);
    });

    // Prevent click on drag
    el.addEventListener('click', (e) => {
        if (dragged) {
            e.preventDefault();
            e.stopPropagation();
            dragged = false;
        }
    }, true);
}

function handleDragEnd(el, start, end) {
    let diff = end - start;
    if (Math.abs(diff) > 30) {
        if (diff > 0) {
            rollSightingCarousal(el, -1);
        } else {
            rollSightingCarousal(el, 1);
        }
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

/**
 * Renders (or re-renders) the global mode toggle from Constants.MODES across all .mode-toggle containers.
 * Designed to be extensible: just add entries to Constants.MODES + Constants.MODE.
 */
export function renderModeToggle(currentMode) {
    const $containers = $('.mode-toggle');
    if (!$containers.length) return;

    $containers.each(function () {
        const $container = $(this);
        $container.empty();
        Constants.MODES.forEach(function (mode) {
            const config = Constants.MODE[mode];
            if (!config) return;
            const isActive = mode === currentMode;
            const label = config.label || mode;
            const $btn = $('<button type="button" class="mode-toggle-btn" role="tab"></button>')
                .attr('data-mode', mode)
                .attr('aria-selected', isActive ? 'true' : 'false')
                .attr('aria-label', label)
                .attr('title', label)
                .toggleClass('active', isActive);
            if (isActive) {
                $btn.attr('tabindex', '0');
            } else {
                $btn.attr('tabindex', '-1');
            }

            if (config.svg) {
                $btn.html(config.svg);
            } else if (config.icon) {
                const $img = $('<img>')
                    .addClass('icon mode-toggle-icon')
                    .attr('src', config.icon)
                    .attr('alt', label)
                    .attr('aria-hidden', 'true');
                $btn.append($img);
            } else {
                $btn.text(label);
            }
            $container.append($btn);
        });
    });
}

/**
 * Updates the active tab indicator in the mobile bottom navigation bar.
 */
export function updateMobileNavActiveTab(page) {
    const $nav = $('#mobile-bottom-nav');
    if (!$nav.length) return;
    $nav.find('.mobile-nav-btn').removeClass('active');

    let target = page;
    if (page === Constants.EXPLORE_PAGE) target = Constants.EXPLORE_MENU;
    if (page === Constants.MAP) target = Constants.MAP_MENU;
    if ((page === Constants.HOME || page === 'f') && State.IS_MOBILE_DEVICE) {
        target = Constants.ARCHIVE;
    }

    $nav.find(`.mobile-nav-btn[data-page="${target}"]`).addClass('active');
}

/**
 * Toggles mobile filter panel expanded/collapsed state.
 */
export function toggleMobileFilters() {
    const $panel = $('.filter-panel');
    const isExpanded = $panel.hasClass('mobile-filters-expanded');
    $panel.toggleClass('mobile-filters-expanded', !isExpanded);
    $('.mobile-filter-toggle-btn').toggleClass('active', !isExpanded);
}

/**
 * Updates the filter count badge on the mobile filter toggle button.
 */
export function updateMobileFilterToggleBadge() {
    const $btn = $('.mobile-filter-toggle-btn');
    if (!$btn.length) return;
    const placeVal = $('.filter input[data-value="place"]').val() || '';
    const nameVal = $('.filter input[data-value="sighting"]').val() || '';
    const dateVal = $('.filter input[data-value="date"]').val() || '';
    const ratingVal = State.ratingFilter || 0;
    const familyVal = State.sightingFamilyFilter || '';
    let count = 0;
    if (placeVal.trim()) count++;
    if (nameVal.trim()) count++;
    if (dateVal.trim()) count++;
    if (ratingVal > 0) count++;
    if (familyVal.trim()) count++;

    const $badge = $btn.find('.mobile-filter-badge');
    if (count > 0) {
        $btn.addClass('has-filters');
        $badge.text(count).show();
    } else {
        $btn.removeClass('has-filters');
        $badge.hide();
    }
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
