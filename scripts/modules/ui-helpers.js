export function showOverlay(text) {
    $(".overlay span").html((text || "Please Wait") + "...");
    $(".overlay").show();
}

export function getSelectOptionsDOM(field, options, value) {
    let dom = "";
    for (const [k, v] of Object.entries(options)) {
        let name = v instanceof Object ? v.name : v;
        dom += "<option value='" + k + "' " + (k == value ? 'selected' : '') + ">" + name + "</option>";
    }
    return dom;
}

export function getSelectDOM(field, options, value, width) {
    let dom = "<select data-field='" + field + "' style='width:" + width + "'>";
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
