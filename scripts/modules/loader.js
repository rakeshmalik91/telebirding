let _pageLoaderShownAt = 0;
const PAGE_LOADER_MIN_MS = 150;
let _loaderBlockers = new Set();

export function ensurePageLoader() {
    if (jQuery('#page-loader').length) return;
    const loaderHtml = '<div id="page-loader" aria-hidden="true"><div class="page-loader-overlay"></div><div class="loader-binoculars"><div class="barrel"></div><div class="connector"></div><div class="barrel"></div></div></div>';
    jQuery('body').append(loaderHtml);
}

export function resetLoader() {
    _loaderBlockers.clear();
}

export function showLoader(key) {
    if (key) _loaderBlockers.add(key);
    ensurePageLoader();
    jQuery('#page-loader').show().css('display', 'flex');
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
