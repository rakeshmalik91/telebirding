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
		if(FIREBASE_ENABLED) {
			return "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/" + path.replaceAll("/", "%2F") + "?alt=media";
		} else {
			return path;
		}
}