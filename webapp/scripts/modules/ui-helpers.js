export function showOverlay(text) {
    // Legacy text overlay support removed/ignored in favor of Binoculars Loader
    // Check if the binoculars loader exists, if not, append it
    if ($("#page-loader").length === 0) {
        const loaderHtml = '<div id="page-loader" aria-hidden="true"><div class="page-loader-overlay"></div><div class="loader-binoculars"><div class="barrel"></div><div class="connector"></div><div class="barrel"></div></div></div>';
        $('body').append(loaderHtml);
    }

    // Show the binoculars loader
    $("#page-loader").css('display', 'flex').fadeIn(100);

    // Ensure the old text overlay is hidden if it exists
    $(".overlay:not(#crop-modal)").hide();
}

export function hideOverlay() {
    $("#page-loader").fadeOut(150);
    $(".overlay:not(#crop-modal)").hide();
}

export function getSelectOptionsDOM(field, options, value) {
    let dom = "";
    for (const [k, v] of Object.entries(options)) {
        let name = v instanceof Object ? v.name : v;
        let iconHtml = "";
        if (field === 'time_of_day' && k && k !== '-') {
            iconHtml = `<div class="sighting-desc weather ${k.toLowerCase()}"></div>`;
        } else if (field === 'weather' && k && k !== '-') {
            iconHtml = `<div class="sighting-desc weather ${k.toLowerCase().replace(' ', '-')}-day"></div>`;
        }
        dom += "<option value='" + k + "' " + (k == value ? 'selected' : '') + (iconHtml ? ` data-icon='${iconHtml}'` : '') + ">" + name + "</option>";
    }
    return dom;
}

export function getSelectDOM(field, options, value, width, extraAttrs = "") {
    let dom = "<select data-field='" + field + "' style='width:" + width + "'" + (extraAttrs ? " " + extraAttrs : "") + ">";
    dom += getSelectOptionsDOM(field, options, value);
    dom += "</select>";
    return dom;
}

function preventDefault(e) {
    e.preventDefault();
}

function preventDefaultForScrollKeys(e) {
    window.addEventListener("keydown", function (e) {
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
            e.preventDefault();
        }
    }, false);
}

// modern Chrome requires { passive: false } when adding event
var supportsPassive = false;
try {
    window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
        get: function () { supportsPassive = true; }
    }));
} catch (e) { }

var wheelOpt = supportsPassive ? { passive: false } : false;
var wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

// call this to Disable
export function disableScroll() {
    window.addEventListener('DOMMouseScroll', preventDefault, false); // older FF
    window.addEventListener(wheelEvent, preventDefault, wheelOpt); // modern desktop
    window.addEventListener('touchmove', preventDefault, wheelOpt); // mobile
    window.addEventListener('keydown', preventDefaultForScrollKeys, false);
}

// call this to Enable
export function enableScroll() {
    window.removeEventListener('DOMMouseScroll', preventDefault, false);
    window.removeEventListener(wheelEvent, preventDefault, wheelOpt);
    window.removeEventListener('touchmove', preventDefault, wheelOpt);
    window.removeEventListener('keydown', preventDefaultForScrollKeys, false);
}
