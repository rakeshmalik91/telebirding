let _pageLoaderShownAt = 0;
const PAGE_LOADER_MIN_MS = 150;
let _loaderBlockers = new Set();

export function ensurePageLoader() {
    if (jQuery('#page-loader').length) return;
    const loaderHtml = '<div id="page-loader" aria-hidden="true"><div class="page-loader-overlay"></div><div class="loader-content"><div class="loader-binoculars"><div class="barrel"></div><div class="connector"></div><div class="barrel"></div></div><div class="loader-text"></div></div></div>';
    jQuery('body').append(loaderHtml);
}

export function resetLoader() {
    _loaderBlockers.clear();
}

export function showLoader(key, text) {
    if (key) _loaderBlockers.add(key);
    ensurePageLoader();

    // Update text if provided
    if (text) {
        jQuery('#page-loader .loader-text').text(text).show();
    } else {
        jQuery('#page-loader .loader-text').hide();
    }

    const loader = jQuery('#page-loader');
    loader.show().css('display', 'flex');
    // Force reflow/repaint for iOS
    if (loader[0]) void loader[0].offsetHeight;

    _pageLoaderShownAt = Date.now();
}

export function hideLoader(key) {
    if (key) _loaderBlockers.delete(key);
    if (_loaderBlockers.size > 0) return;

    const elapsed = Date.now() - (_pageLoaderShownAt || 0);
    const remaining = PAGE_LOADER_MIN_MS - elapsed;
    if (remaining > 0) {
        setTimeout(function () {
            if (_loaderBlockers.size === 0) {
                jQuery('#page-loader').fadeOut(150);
                _pageLoaderShownAt = 0;
            }
        }, remaining);
    } else {
        jQuery('#page-loader').fadeOut(150);
        _pageLoaderShownAt = 0;
    }
}
