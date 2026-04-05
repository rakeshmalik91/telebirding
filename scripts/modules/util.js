import FirebaseApi from './firebase-api.js';
import Constants from './constants.js';

export default class Util {
	static FILE_CACHE = {};

	static readTextFile(file, callback) {
		if (Util.FILE_CACHE[file]) {
			callback(Util.FILE_CACHE[file]);
			return;
		}
		let rawFile = new XMLHttpRequest();
		rawFile.overrideMimeType("application/json");
		rawFile.open("GET", file, true);
		rawFile.onreadystatechange = function () {
			if (rawFile.readyState === 4 && rawFile.status == "200") {
				Util.FILE_CACHE[file] = rawFile.responseText;
				callback(rawFile.responseText);
			}
		}
		rawFile.send(null);
	}

	static clearFileCache() {
		Util.FILE_CACHE = {};
	}

	static readJSONFile(file, callback) {
		Util.readTextFile(file, function (text) {
			callback(JSON.parse(text));
		})
	}

	static readJSONFiles(files, callback) {
		let fileRead = [];
		let allJSON = {};
		files.forEach(function (file) {
			Util.readTextFile(file, function (text) {
				fileRead.push(file);
				const json = JSON.parse(text);
				Object.keys(json).forEach(k => allJSON[k] = json[k]);
				if (fileRead.length == files.length) {
					callback(allJSON);
				}
			})
		});
	}

	static shuffle(array) {
		let currentIndex = array.length, randomIndex;
		while (currentIndex > 0) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;
			[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
		}
		return array;
	}

	static capitalize(string) {
		return string.split(" ").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
	}

	static slugify(text) {
		return text.toString().toLowerCase()
			.replace(/\s+/g, '-')           // Replace spaces with -
			.replace(/[^\w\-]+/g, '')       // Remove all non-word chars
			.replace(/\-\-+/g, '-')         // Replace multiple - with single -
			.replace(/^-+/, '')             // Trim - from start of text
			.replace(/-+$/, '');            // Trim - from end of text
	}

	static isTouchDevice() {
		return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
	}

	static isMobileDevice() {
		return Util.isTouchDevice();
	}

	static isDeviceOnLandscapeOrientation() {
		return (window.innerHeight / window.innerWidth) < (13 / 9);
	}

	static compare(a, b, defaultValue) {
		if (defaultValue !== undefined) {
			return (a > b) ? 1 : (a < b) ? -1 : defaultValue;
		}
		return (a > b) ? 1 : (a < b) ? -1 : 0;
	}

	static setIntersect(x, y) {
		return new Set([...x].filter(i => !y.has(i)).concat([...y].filter(i => !x.has(i))));
	}

	static getUrlParams() {
		return window.location.search.slice(1).split('&').reduce(function (res, item) {
			let parts = item.split('=');
			res[parts[0]] = parts[1];
			return res;
		}, {});
	}

	static plural(word) {
		return word.match(/[^aeiou]y$/i) ? (word.slice(0, -1) + "ies")
			: (word.match(/(s|sh|ch|z)$/g) ? (word + "es")
				: (word + "s"));
	}

	static normalizeForTagMatch(tag) {
		tag = tag.toLowerCase();
		Object.keys(Constants.TAG_NORMALIZE_REPLACE_MAPPING).forEach((s) => { tag = tag.replaceAll(s, Constants.TAG_NORMALIZE_REPLACE_MAPPING[s]); });
		return tag;
	}

	static tagMatches(tag, search) {
		tag = Util.normalizeForTagMatch(tag);
		search = Util.normalizeForTagMatch(search);
		return tag == search || Util.plural(tag) == search;
	}

	static tagMatchesSubstring(tag, search) {
		tag = Util.normalizeForTagMatch(tag);
		search = Util.normalizeForTagMatch(search);
		return tag.match("\\b" + search + "\\b");
	}

	static trimPlaceName(name, threshold) {
		if (name.length <= threshold) {
			return name;
		} else {
			Constants.LOCATION_SHORTEN_LIST.forEach((s) => name = name.replaceAll(s[0], s[1]));
			if (name.length <= threshold) {
				return name;
			} else {
				let tokens = name.split(' ');
				let trimmed = tokens[0].length > threshold ? (tokens.splice(0, threshold - 3) + "...") : '';
				if (tokens.length > 1) {
					tokens.forEach(t => trimmed += ((Constants.LOCATION_SHORTEN_BLOCK_LIST.indexOf(t) < 0) ? t[0].toUpperCase() : (" " + t)));
				}
				return trimmed;
			}
		}
	}

	static shortenPlumage(plumage) {
		Constants.PLUMAGE_SHORTEN_LIST.forEach((s) => plumage = plumage.replaceAll(s[0], s[1]));
		return plumage;
	}

	static getCountryFullName(country, countriesData) {
		if (countriesData && countriesData[country])
			return countriesData[country].name;
		else
			return country;
	}

	static getStateFullName(country, state, countriesData) {
		if (countriesData && countriesData[country] && countriesData[country].states && countriesData[country].states[state])
			return countriesData[country].states[state].name;
		else
			return state;
	}

	static autoScroll(container, amount) {
		if (!Util.isTouchDevice()) {
			setInterval(function () {
				if (container.attr('data-scroll'))
					container.animate({ scrollTop: container.attr('data-scroll') }, 100, 'linear');
			}, 100);
			container.mousemove(function (e) {
				let val = (e.pageY - container.offset().top) / container.height() - 0.5;
				if (val > 0.4) container.attr('data-scroll', '+=' + (amount * (val - 0.4)));
				else if (val < -0.4) container.attr('data-scroll', '+=' + (amount * (val + 0.4)));
				else container.attr('data-scroll', null);
			});
			container.hover(function () {

			}, function () {
				container.attr('data-scroll', null);
			});
		}
	}

	static getMedia(path) {
		return Util.getData(path);
	}

	static getData(path) {
		if (!path) return '';
		if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
			return path
		} else if (FirebaseApi.FIREBASE_ENABLED) {
			return "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/" + path.replaceAll("/", "%2F") + "?alt=media";
		} else {
			return path;
		}
	}

	static setCookie(name, value, days) {
		let expires = "";
		if (days) {
			const date = new Date();
			date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
			expires = "; expires=" + date.toUTCString();
		}
		document.cookie = name + "=" + (value || "") + expires + "; path=/";
	}

	static getCookie(name) {
		const nameEQ = name + "=";
		const ca = document.cookie.split(';');
		for (let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) == ' ') c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
		}
		return null;
	}

	static eraseCookie(name) {
		document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	}

	static dataURLToBlob(dataURL) {
		const BASE64_MARKER = ';base64,';
		if (dataURL.indexOf(BASE64_MARKER) == -1) {
			const parts = dataURL.split(',');
			const contentType = parts[0].split(':')[1];
			const raw = parts[1];

			return new Blob([raw], { type: contentType });
		}

		const parts = dataURL.split(BASE64_MARKER);
		const contentType = parts[0].split(':')[1];
		const raw = window.atob(parts[1]);
		const rawLength = raw.length;

		const uInt8Array = new Uint8Array(rawLength);

		for (let i = 0; i < rawLength; ++i) {
			uInt8Array[i] = raw.charCodeAt(i);
		}

		return new Blob([uInt8Array], { type: contentType });
	}

	static resizeImage(file, size, watermark) {
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
			if (width <= size && height <= size && height == width && !watermark) {
				return dataURItoBlob(image.src);
			}
			canvas.width = size;
			canvas.height = size;
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			if (width >= height) {
				ctx.drawImage(image, (width - height) / 2, 0, height, height, 0, 0, size, size);
			} else {
				ctx.drawImage(image, 0, (height - width) / 2, width, width, 0, 0, size, size);
			}
			if (watermark) {
				ctx.font = '20px Calibri';
				ctx.fillStyle = watermark.color;
				ctx.fillText(watermark.text, size * 0.75, size * 0.95);
			}
			const dataUrl = canvas.toDataURL('image/jpeg', Constants.IMAGE_COMPRESSION_QUALITY);
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

	static toggleCollpasible(container) {
		let target = jQuery(container).parent().find('.collapsible')
		if (jQuery(target).is(':visible')) {
			jQuery(target).hide();
			jQuery(container).removeClass('active')
		} else {
			jQuery(target).show();
			jQuery(container).addClass('active')
		}
	}

	/**
	 * Resolve a raw camera-model code string (e.g. "S7RV+200600") into
	 * human-readable names using the supplied mapping.
	 * Returns the resolved string joined by " + ".
	 */
	static resolveCameraModel(rawModel, cameraModelMapping) {
		if (!rawModel) return '';
		return rawModel.split('+').map(p => {
			const part = p.trim();
			return (cameraModelMapping && (cameraModelMapping[part] || cameraModelMapping[part.toUpperCase()])) || part;
		}).join(' + ');
	}

	static uuidv4() {
		return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
			(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}

	static getClientId() {
		const key = 'my_app_client_id';
		let id = localStorage.getItem(key);
		if (!id) {
			id = Util.uuidv4();
			localStorage.setItem(key, id);
		}
		return id;
	}
}
