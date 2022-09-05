var FILE_CACHE = {};

function readTextFile(file, callback) {
	if(FILE_CACHE[file]) {
		callback(FILE_CACHE[file]);
		return;
	}
	var rawFile = new XMLHttpRequest();
	rawFile.overrideMimeType("application/json");
	rawFile.open("GET", file, true);
	rawFile.onreadystatechange = function() {
		if (rawFile.readyState === 4 && rawFile.status == "200") {
			FILE_CACHE[file] = rawFile.responseText;
			callback(rawFile.responseText);
		}
	}
	rawFile.send(null);
}

function clearFileCache() {
	FILE_CACHE = {};
}

function readJSONFile(file, callback) {
	readTextFile(file, function(text) {
		callback(JSON.parse(text));
	})
}

function readJSONFiles(files, callback) {
	var fileRead = [];
	var allJSON = {};
	files.forEach(function(file) {
		readTextFile(file, function(text) {
			fileRead.push(file);
			var json = JSON.parse(text);
			Object.keys(json).forEach(k => allJSON[k] = json[k]);
			if(fileRead.length == files.length) {
				callback(allJSON);
			}
		})
	});
}

function capitalize(string) {
	return string.split(" ").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function isTouchDevice() {
  return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
}

function isDeviceOnLandscapeOrientation() {
	return window.innerHeight < window.innerWidth;
}

function compare(a, b) {
	return (a > b) ? 1 : (a < b) ? -1 : 0;
}
function compare(a, b, defaultValue) {
	return (a > b) ? 1 : (a < b) ? -1 : defaultValue;
}

function setIntersect(x, y) {
	return new Set([...x].filter(i => !y.has(i)).concat([...y].filter(i => !x.has(i))));
}

function getUrlParams() {
	return window.location.search.slice(1).split('&').reduce(function (res, item) {
	    var parts = item.split('=');
	    res[parts[0]] = parts[1];
	    return res;
	}, {});
}

function plural(word) {
	return word.match(/[scz](h|)$/g) ? (word + "es") : (word + "s");
}

function tagMatches(tag, search) {
	tag = tag.toLowerCase().replaceAll("-", " ").replaceAll("'", "");
	search = search.toLowerCase().replaceAll("-", " ").replaceAll("'", "").replaceAll("+", " ");
	return tag == search || plural(tag) == search;
}

function tagMatchesSubstring(tag, search) {
	tag = tag.toLowerCase().replaceAll("-", " ").replaceAll("'", "");
	search = search.toLowerCase().replaceAll("-", " ").replaceAll("'", "").replaceAll("+", " ");
	return tag.match("\\b" + search + "\\b");
}

var PLACE_NAME_SIZE_THRESHOLD = 25;

function trimPlaceName(name) {
	if(name.length <= PLACE_NAME_SIZE_THRESHOLD) {
		return name;
	} else {
		name = name .replaceAll(/National\s+Park/gi, "NP")
								.replaceAll(/Wildlife\s+Sanctuary/gi, "WS")
								.replaceAll(/Bird\s+Sanctuary/gi, "BS");
		if(name.length <= PLACE_NAME_SIZE_THRESHOLD) {
			return name;
		} else {
			var tokens = name.split(' ');
			var trimmed = tokens[0].length > PLACE_NAME_SIZE_THRESHOLD ? (tokens.splice(0, PLACE_NAME_SIZE_THRESHOLD-3) + "...") : tokens[0];
			if(tokens.length > 1) {
				tokens.splice(1).forEach(t => trimmed += ' ' + t[0].toUpperCase() + '.');
			}
			return trimmed;
		}
	}
}

function getCountryFullName(country) {
	if(data.countries[country])
		return data.countries[country].name;
	else
		return country;
}
function getStateFullName(country, state) {
	if(data.countries[country] && data.countries[country].states[state])
		return data.countries[country].states[state].name;
	else
		return state;
}


function autoScroll(container, amount) {
	if(!isTouchDevice()) {
		setInterval(function() {
			if(container.attr('data-scroll'))
				container.animate({scrollTop: container.attr('data-scroll') }, 100, 'linear');
		}, 100);
		container.mousemove(function(e) {
			var val = (e.pageY - container.offset().top) / container.height() - 0.5;
			if(val > 0.4)		container.attr('data-scroll', '+=' + (amount * (val - 0.4)));
			else if(val < -0.4) container.attr('data-scroll', '+=' + (amount * (val + 0.4)));
			else 				container.attr('data-scroll', null);
		});
		container.hover(function() {
			
		}, function() {
			container.attr('data-scroll', null);
		});
	}
}

function invalidName(place) {
	return !place || place == 'undefined' || place == 'null';
}




var FIREBASE_ENABLED = true;

function getMedia(path) {
		return getData(path);
}

function getData(path) {
		if(path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
			return path
		} else if(FIREBASE_ENABLED) {
			return "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/" + path.replaceAll("/", "%2F") + "?alt=media";
		} else {
			return path;
		}
}

function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function dataURLToBlob(dataURL) {
    var BASE64_MARKER = ';base64,';
    if (dataURL.indexOf(BASE64_MARKER) == -1) {
        var parts = dataURL.split(',');
        var contentType = parts[0].split(':')[1];
        var raw = parts[1];

        return new Blob([raw], {type: contentType});
    }

    var parts = dataURL.split(BASE64_MARKER);
    var contentType = parts[0].split(':')[1];
    var raw = window.atob(parts[1]);
    var rawLength = raw.length;

    var uInt8Array = new Uint8Array(rawLength);

    for (var i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], {type: contentType});
}

function resizeImage(file, size) {
    var reader = new FileReader();
    var image = new Image();
    var canvas = document.createElement('canvas');
    var dataURItoBlob = function (dataURI) {
        var bytes = dataURI.split(',')[0].indexOf('base64') >= 0 ?
            atob(dataURI.split(',')[1]) :
            unescape(dataURI.split(',')[1]);
        var mime = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var max = bytes.length;
        var ia = new Uint8Array(max);
        for (var i = 0; i < max; i++)
            ia[i] = bytes.charCodeAt(i);
        return new Blob([ia], { type: mime });
    };
    var resize = function () {
        var width = image.width;
        var height = image.height;
        canvas.width = size;
        canvas.height = size;
        if(width >= height) {
        	canvas.getContext('2d').drawImage(image, (width-height)/2, 0, height, height, 0, 0, size, size);
        } else {
        	canvas.getContext('2d').drawImage(image, 0, (height-width)/2, width, width, 0, 0, size, size);
        }
        var dataUrl = canvas.toDataURL('image/jpeg');
        return dataURItoBlob(dataUrl);
    };
    return new Promise(function (ok, no) {
        if (!file.type.match(/image.*/)) {
            no(new Error("Not an image"));
            return;
        }
        reader.onload = function (readerEvent) {
            image.onload = function () { return ok(resize()); };
            image.src = readerEvent.target.result;
        };
        reader.readAsDataURL(file);
    });
}