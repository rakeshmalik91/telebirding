var FILE_CACHE = {};
// var FIREBASE_ENABLED = !window.location.origin.match(/.*(localhost|:5000).*/ig);
var FIREBASE_ENABLED = true;
var FIREBASE_APPCHECK_ENABLED = false;

function readTextFile(file, callback) {
	if(FILE_CACHE[file]) {
		callback(FILE_CACHE[file]);
		return;
	}
		let rawFile = new XMLHttpRequest();
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
	let fileRead = [];
	let allJSON = {};
	files.forEach(function(file) {
		readTextFile(file, function(text) {
			fileRead.push(file);
			const json = JSON.parse(text);
			Object.keys(json).forEach(k => allJSON[k] = json[k]);
			if(fileRead.length == files.length) {
				callback(allJSON);
			}
		})
	});
}

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function capitalize(string) {
	return string.split(" ").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function isTouchDevice() {
  return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
}

function isDeviceOnLandscapeOrientation() {
	return (window.innerHeight / window.innerWidth) < (13 / 9);
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
    	let parts = item.split('=');
    	res[parts[0]] = parts[1];
    	return res;
    }, {});
}

function plural(word) {
	return word.match(/(s|sh|ch|z)$/g) ? (word + "es") : (word + "s");
}

var TAG_NORMALIZE_REPLACE_MAPPING = {
	"-": " ",
	"'": "",
	"+": " ",
	"gray": "grey" 
};

function normalizeForTagMatch(tag) {
	tag = tag.toLowerCase();
	Object.keys(TAG_NORMALIZE_REPLACE_MAPPING).forEach((s) => { tag = tag.replaceAll(s, TAG_NORMALIZE_REPLACE_MAPPING[s]); });
	return tag;
}

function tagMatches(tag, search) {
	tag = normalizeForTagMatch(tag);
	search = normalizeForTagMatch(search);
	return tag == search || plural(tag) == search;
}

function tagMatchesSubstring(tag, search) {
	tag = normalizeForTagMatch(tag);
	search = normalizeForTagMatch(search);
	return tag.match("\\b" + search + "\\b");
}

var SHORTEN_LIST = [
	[/\bNational\s+Park\b/gi, "N.P."],
	[/\bBiological\s+Park\b/gi, "B.P."],
	[/\bZoological\s+Park\b/gi, "Zoo"],
	[/\bBotanical\s+Garden\b/gi, "B.G."],
	[/\bWildlife\s+Sanctuary\b/gi, "W.S."],
	[/\bBird\s+Sanctuary\b/gi, "B.S."],
	[/\bTiger\s+Reserve\b/gi, "T.R."],
	[/\bConservation\s+Reserve\b/gi, "C.R."],
	[/\bNorth(|ern)\b/gi, "N."],
	[/\bSouth(|ern)\b/gi, "S."],
	[/\bEast(|ern)\b/gi, "E."],
	[/\bWest(|ern)\b/gi, "W."],
	[/\bIslands\b/gi, "Isl."],
	[/\band\b/gi, "&"]
];

var SHORTEN_BLOCK_LIST = ["Isl.", "Monastery", "Zoo"];

function trimPlaceName(name, threshold) {
	if(name.length <= threshold) {
		return name;
	} else {
		SHORTEN_LIST.forEach((s) => name = name.replaceAll(s[0], s[1]));
		if(name.length <= threshold) {
			return name;
		} else {
				let tokens = name.split(' ');
				let trimmed = tokens[0].length > threshold ? (tokens.splice(0, threshold-3) + "...") : '';
			if(tokens.length > 1) {
				//tokens.splice(1).forEach(t => trimmed += ' ' + t[0].toUpperCase() + (t.length>1?'.':''));
				tokens.forEach(t => trimmed += ((SHORTEN_BLOCK_LIST.indexOf(t) < 0) ? t[0].toUpperCase() : (" " + t)));
			}
			return trimmed;
		}
	}
}

var PLUMAGE_SHORTEN_LIST = [
	[/\bJuvenile\b/gi, "Juv."],
	[/\bImmature\b/gi, "Imm."],
	[/\bBreeding(-Male|)\b/gi, "Br."],
	[/\bEclipse\b/gi, "Ecl."],
	[/\bMale\b/gi, "M"],
	[/\bFemale\b/gi, "F"]
];

function shortenPlumage(plumage) {
	PLUMAGE_SHORTEN_LIST.forEach((s) => plumage = plumage.replaceAll(s[0], s[1]));
	return plumage;
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
			let val = (e.pageY - container.offset().top) / container.height() - 0.5;
			if(val > 0.4) 		container.attr('data-scroll', '+=' + (amount * (val - 0.4)));
			else if(val < -0.4) container.attr('data-scroll', '+=' + (amount * (val + 0.4)));
			else 			container.attr('data-scroll', null);
		});
		container.hover(function() {
			
		}, function() {
			container.attr('data-scroll', null);
		});
	}
}




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
	let expires = "";
    if (days) {
		const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
	const nameEQ = name + "=";
	const ca = document.cookie.split(';');
	for(let i=0;i < ca.length;i++) {
		let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function dataURLToBlob(dataURL) {
	const BASE64_MARKER = ';base64,';
	if (dataURL.indexOf(BASE64_MARKER) == -1) {
		const parts = dataURL.split(',');
		const contentType = parts[0].split(':')[1];
		const raw = parts[1];

		return new Blob([raw], {type: contentType});
	}

	const parts = dataURL.split(BASE64_MARKER);
	const contentType = parts[0].split(':')[1];
	const raw = window.atob(parts[1]);
	const rawLength = raw.length;

	const uInt8Array = new Uint8Array(rawLength);

	for (let i = 0; i < rawLength; ++i) {
		uInt8Array[i] = raw.charCodeAt(i);
	}

	return new Blob([uInt8Array], {type: contentType});
}

function resizeImage(file, size, watermark) {
	const reader = new FileReader();
	const image = new Image();
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	const dataURItoBlob = function (dataURI) {
		const bytes = dataURI.split(',')[0].indexOf('base64') >= 0 ?
			atob(dataURI.split(',')[1]) :
			unescape(dataURI.split(',')[1]);
		const mime = dataURI.split(',')[0].split(':')[1].split(';')[0];
		const max = bytes.length;
		const ia = new Uint8Array(max);
		for (let i = 0; i < max; i++)
			ia[i] = bytes.charCodeAt(i);
		return new Blob([ia], { type: mime });
	};
	const resize = function () {
		let width = image.width;
		let height = image.height;
		if(width <= size && height <= size && height == width && !watermark) {
			return dataURItoBlob(image.src);
		}
		canvas.width = size;
		canvas.height = size;
		if(width >= height) {
			ctx.drawImage(image, (width-height)/2, 0, height, height, 0, 0, size, size);
		} else {
			ctx.drawImage(image, 0, (height-width)/2, width, width, 0, 0, size, size);
		}
		if(watermark) {
			ctx.font = '20px Calibri';
			ctx.fillStyle = watermark.color;
			ctx.fillText(watermark.text, size * 0.75, size * 0.95);
		}
		const dataUrl = canvas.toDataURL('image/jpeg');
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

function toggleCollpasible(container) {
	target = jQuery(container).parent().find('.collapsible')
	if(jQuery(target).is(':visible')) {
		jQuery(target).hide();
		jQuery(container).removeClass('active')
	} else {
		jQuery(target).show();
		jQuery(container).addClass('active')
	}
}

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function getClientId() {
  const key = 'my_app_client_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(key, id);
  }
  return id;
}

var firebaseInitialized = false;
function getFirebase() {
	if(firebaseInitialized)
		return firebase;
	var config = {
		apiKey: "AIzaSyApVjVcNDeMkA-oz-tYa46Lm-Ja7qCCVjQ",
		authDomain: "telebirding-49623.firebaseapp.com",
		projectId: "telebirding-49623",
		storageBucket: "telebirding-49623.appspot.com",
		messagingSenderId: "660434055884",
		appId: "1:660434055884:web:43dd0ca8c46f8280250869",
		measurementId: "G-MRPL6NX33K"
	};
	firebase.initializeApp(config);
	if(FIREBASE_APPCHECK_ENABLED) {
		firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider("6LdY-eIrAAAAAPBNq0RoVnRfRGLUZ3VqissKhq5r"), true);	// TODO app check enforcement
	}
	firebaseInitialized = true;
	return firebase;
}