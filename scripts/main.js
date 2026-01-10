// Import dependencies (jQuery and moment are loaded as regular scripts in HTML)
import {
	MODE_BIRD, MODE_INSECT, MODE, DEFAULT_MODE,
	HOME, ARCHIVE, EXPLORE_MENU, EXPLORE_PAGE, MAP_MENU, MAP, VIDEOS, ABOUT,
	PAGE,
	DATA_DATE_FORMAT, DISPLAY_DATE_FORMAT, FILTER_MONTH_FORMAT, FILTER_YEAR_FORMAT, BACKUP_DATE_FORMAT,
	TAG_SUBSPECIES, TAG_VARIATION, TAG_PLUMAGE, TAG_AGE,
	OPT_RATING, OPT_GENDER, OPT_AGE, OPT_PLUMAGE, OPT_TIME_OF_DAY, OPT_WEATHER,
	RATING_DISPLAY_NAME, RATING_CSS_CLASS_MAPPING,
	EBIRD_SPECIES_BASE_URL,
	DEFAULT_AUTHOR, AUTHOR_URL,
	LIKE_ENABLED
} from './constants.js';
import { Autocomplete } from './util/autocomplete.js';
import { getUrlParams, getData, getMedia, readJSONFiles, setCookie, getCookie, eraseCookie, capitalize, shuffle, compare, isMobileDevice, isDeviceOnLandscapeOrientation, getCountryFullName, getStateFullName, toggleCollpasible, getFirebase, getClientId, autoScroll, tagMatches, tagMatchesSubstring, trimPlaceName, shortenPlumage } from './util/util.js';
import { disableScroll, enableScroll } from './util/disable-scroll.js';
import { showCarousalImage } from './site-data.js';

const DATA_PER_PAGE = 12;
const TAG_TYPES = ["subspecies", "variation", "plumage", "age"];
const MEDIA_TYPE_VIDEO = 'video';
const MIN_COUNT_FOR_LOCATION_LISTING = 5;
const DEFAULT_PLUMAGE = "";

let data = { "sightings": [] };
let sort = { by: undefined, descending: undefined };
let currentRenderOffset = 0;
let noMoreDataToRender = false;
let sightingFamilyFilter = null;
let newSpeciesFilter = false;
let ratingFilter = 0;
let autocompleteInitialized = false;

let currentPage = HOME;
let currentMode = MODE_BIRD;

const IS_MOBILE = !isDeviceOnLandscapeOrientation();

function getSpeciesCount(sightings) {
	return [...new Set(sightings.map(b => b.species.name))].length;
}

function computeInternalDataFields() {
	//remove hidden
	data.sightings = data.sightings.filter(b => !b.hidden);

	$.each(data.sightings, function (index, sighting) {
		sighting.index = index;
		//moment
		sighting.date = moment(sighting.date, DATA_DATE_FORMAT);
		sighting.dateString = sighting.date.format(DISPLAY_DATE_FORMAT);
		//tags
		sighting.species = data.species[sighting.species];
		sighting.species.tags = (sighting.species.tags || []).sort((a, b) => compare(b.length, a.length));
		//images
		sighting.media.forEach(function (m) {
			m.src = getMedia(m.src);
			if (m.thumbnail) m.thumbnail = getMedia(m.thumbnail);
		});
		//new species flag
		sighting.newSpecies = (data.sightings.slice(index + 1).map(b => b.species).indexOf(sighting.species.key) < 0);
	});
	//add missing families
	let familyNames = data.families.map(f => f.name);
	data.families.concat(data.sightings.filter(b => !familyNames.includes(b.species.family)).map(function (b) { return { name: b.family }; }));
	//fix missing family images or paths
	data.families.forEach(function (family) {
		family.imagesrc = ((((data.sightings.filter(b => b.species.family == family.name) || [])[0] || {}).media || []).filter(m => m.type !== 'video')[0] || {}).src;
		family.count = data.sightings.filter(b => b.species.family == family).length;
	})

	//sort families
	//data.families.sort((a, b) => compare(a.name, b.name));

	//places
	if (!Object.entries(data.countries)[0][1].count) {
		let countries = {}
		Object.keys(data.countries).sort().forEach(function (countryCode) {
			countries[countryCode] = {
				name: data.countries[countryCode].name,
				count: getSpeciesCount(data.sightings.filter(b => b.country == countryCode)),
				states: {}
			};
			Object.keys(data.countries[countryCode].states).sort().forEach(function (stateCode) {
				countries[countryCode].states[stateCode] = {
					name: data.countries[countryCode].states[stateCode].name,
					count: getSpeciesCount(data.sightings.filter(b => b.state == stateCode)),
					cities: {}
				};
				if (countries[countryCode].states[stateCode].count > 0) {
					[...new Set(data.sightings.filter(b => b.country == countryCode && b.state == stateCode).map(b => b.city))].forEach(function (city) {
						if (!city) {
							[...new Set(data.sightings.filter(b => b.place && b.country == countryCode && b.state == stateCode && !b.city).map(b => b.place))].forEach(function (place) {
								countries[countryCode].states[stateCode].cities[place] ||= { places: {} };
								countries[countryCode].states[stateCode].cities[place].count = getSpeciesCount(data.sightings.filter(b => b.country == countryCode && b.state == stateCode && (b.city == place || b.place == place)));
							});
						} else {
							countries[countryCode].states[stateCode].cities[city] = {
								count: getSpeciesCount(data.sightings.filter(b => b.country == countryCode && b.state == stateCode && (b.city == city || !b.city && b.place == city))),
								places: {}
							};
							[...new Set(data.sightings.filter(b => b.place && b.country == countryCode && b.state == stateCode && b.city == city).map(b => b.place))].forEach(function (place) {
								countries[countryCode].states[stateCode].cities[city].places[place] = {
									count: getSpeciesCount(data.sightings.filter(b => b.country == countryCode && b.state == stateCode && b.city == city && b.place == place))
								}
							});
						}
					});
				}
			});
		});
		data.countries = countries;
	}

	//years
	data.years = {};
	[...new Set(data.sightings.map(b => b.date.format(FILTER_YEAR_FORMAT)))].forEach(function (year) {
		let yearSightings = data.sightings.filter(b => b.date.format(FILTER_YEAR_FORMAT) == year);
		let yearSpecies = [...new Set(yearSightings.map(b => b.species.key))];
		let oldestDate = yearSightings[0].date;
		yearSightings.forEach(b => oldestDate = (b.date < oldestDate) ? b.date : oldestDate);
		let oldSpecies = [...new Set(data.sightings.filter(b => b.date < oldestDate).map(b => b.species.key))];
		data.years[year] = {
			sighting_count: yearSightings.length,
			new_species_count: yearSpecies.filter(s => oldSpecies.indexOf(s) < 0).length
		};
	});
}

function filterAndSortData(filter, params) {
	removePreviewImage();

	if (params && params.family) {
		sightingFamilyFilter = params.family;

		//remove other filters
		$(".filter input").removeClass("button-active").val("");
	} else {
		sightingFamilyFilter = null;
	}

	data.filter = JSON.parse(JSON.stringify(filter));
	data.sort = JSON.parse(JSON.stringify(sort));

	data.filteredSightings = data.sightings;

	//filter only new species
	if (!filter.date && !filter.place) {
		newSpeciesFilter = false;
		setNewSpeciesFilterState();
	}
	if (newSpeciesFilter) {
		data.filteredSightings = data.filteredSightings.filter(b => b.newSpecies);
	}

	//family filter
	if (sightingFamilyFilter) {
		data.filteredSightings = data.filteredSightings.filter(b => b.species.family.toLowerCase() == sightingFamilyFilter.toLowerCase());
	}

	//sighting filter
	if (filter.sighting) {
		data.filteredSightings = data.filteredSightings.filter(b =>
			tagMatchesSubstring(b.species.name, filter.sighting)
			|| tagMatches(b.species.name, filter.sighting)
			|| b.species.family.toLowerCase() == filter.sighting.toLowerCase()
			|| b.species.tags && b.species.tags.map(t => tagMatches(t, filter.sighting)).reduce((a, b) => a || b)
		);
	}

	//place filter
	if (filter.place) {
		const placesRegex = '\\b(' + filter.place.toLowerCase().replaceAll(',\\s*', '|') + ')\\b';
		const places = filter.place.toLowerCase().split(/,\\s*/);
		data.filteredSightings = data.filteredSightings.filter(b =>
			b.place && b.place.toLowerCase().match(placesRegex)
			|| b.city && places.indexOf(b.city.toLowerCase()) >= 0
			|| b.state && (places.indexOf(b.state.toLowerCase()) >= 0 || places.indexOf(getStateFullName(b.country, b.state, data.countries).toLowerCase()) >= 0)
			|| b.country && (places.indexOf(b.country.toLowerCase()) >= 0 || places.indexOf(getCountryFullName(b.country, data.countries).toLowerCase()) >= 0)
		);
	}

	//date filter
	if (filter.date) {
		data.filteredSightings = data.filteredSightings.filter(b => b.dateString.match('.*\\b' + filter.date));
	}

	//rating filter
	if (ratingFilter) {
		data.filteredSightings = data.filteredSightings.filter(b => (b.rating || 0) >= ratingFilter);
	}

	//sort
	switch (sort.by) {
		case 'name':
			data.filteredSightings.sort((a, b) => (sort.descending ? -1 : 1) * compare(a.species.name, b.species.name, compare(a.key, b.key)));
			break;
		case 'shuffle':
			data.filteredSightings = shuffle(data.filteredSightings);
			break;
		default:
			data.filteredSightings.sort((a, b) => (sort.descending ? -1 : 1) * compare(a[sort.by], b[sort.by], compare(b.index, a.index)));
			break;
	}

	//clear right panel for recalculation
	$(".right-pane").html('');
}

function rollCarousal(image, direction) {
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

// Archive page Carousal
function makeCarousal(container) {
	if ($(container).children().length > 1) {
		$(container).children().addClass('hidden');
		$(container).children().eq(0).removeClass('hidden');
		container.append('<button tabindex="-1" class="carousal-button-left" onclick="rollCarousal(this, -1)"></button>');
		container.append('<button tabindex="-1" class="carousal-button-right" onclick="rollCarousal(this, 1)"></button>');
	}
}

let sightingAutocompleteInstance = null;
let placeAutocompleteInstance = null;

function initAutocomplete() {
	var sightingAutocomplete = [];
	var placeAutocomplete = [];

	// Sighting autocomplete
	// Restore original logic: iterate values, not keys
	$.each(data.sightings, function (i, sighting) {
		if (sighting.species && sighting.species.name) {
			sightingAutocomplete.push(sighting.species.name);
		}
		if (sighting.species && sighting.species.tags) {
			sightingAutocomplete = sightingAutocomplete.concat(sighting.species.tags.map(t => capitalize(t)));
		}
	});

	// Place autocomplete
	$.each(data.sightings, function (i, sighting) {
		const components = [
			sighting.place,
			sighting.city,
			sighting.state,
			getStateFullName(sighting.country, sighting.state, data.countries),
			getCountryFullName(sighting.country, data.countries)
		];
		// Filter out null/undefined and empty strings
		placeAutocomplete = placeAutocomplete.concat(components.filter(e => e));

		// Original logic also split place by comma
		if (sighting.place) {
			placeAutocomplete.push(sighting.place.split(",")[0]);
		}
		if (sighting.city) {
			placeAutocomplete.push(capitalize(sighting.city.trim()));
		}
	});

	// De-duplicate and sort
	sightingAutocomplete = [...new Set(sightingAutocomplete.map(b => capitalize(b.replaceAll('-', ' '))).filter(n => n))].sort();
	placeAutocomplete = [...new Set(placeAutocomplete.map(p => p.trim()).filter(p => p))].sort();

	// Initialize or Update Instances
	if (!sightingAutocompleteInstance) {
		sightingAutocompleteInstance = new Autocomplete($(".filter input[data-value='sighting']")[0], sightingAutocomplete, function (val) {
			triggerFilter('sighting', val);
		});
	} else {
		sightingAutocompleteInstance.arr = sightingAutocomplete;
	}

	if (!placeAutocompleteInstance) {
		placeAutocompleteInstance = new Autocomplete($(".filter input[data-value='place']")[0], placeAutocomplete, function (val) {
			triggerFilter('place', val);
		});
	} else {
		placeAutocompleteInstance.arr = placeAutocomplete;
	}

	autocompleteInitialized = true;
}

function resetRatingFilter() {
	if (ratingFilter != 0) ratingFilter = 0;
	// ratingFilter = (Number(ratingFilter) + 1) % 6;
	refresh();
}

function fillStats() {
	$(".sightings-count").html(data.filteredSightings.length);

	let selectedSpecies = [...new Set(data.filteredSightings.map(b => b.species.name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "")))];
	$(".species-count").html(selectedSpecies.length);

	(ratingFilter > 0) ? $(".rating").parent().show() : $(".rating").parent().hide();
	$(".rating").html((ratingFilter == 0) ? "All" : (ratingFilter + " +"));

	let filters = getFilters();
	if (filters.date || filters.place) {
		$(".new-species-count").parent().show();
		$(".new-species-count").html(data.filteredSightings.filter(b => b.newSpecies).length);
	} else {
		$(".new-species-count").parent().hide();
	}
}

function sortByOnChange(value) {
	$(".sortby button").removeClass("button-active");
	$(".sortby button[data-value='" + value + "']").addClass("button-active");
	if (sort.by != value) {
		sort.descending = (sort.by != "date");
	} else {
		sort.descending = !sort.descending;
	}
	sort.by = value;
	if (sort.descending) {
		$(".sortby button[data-value='" + value + "'] span.order").addClass('desc').removeClass('asc');
	} else {
		$(".sortby button[data-value='" + value + "'] span.order").removeClass('desc').addClass('asc');
	}
	refresh();
}

function renderSightingDetails(sightingLabelDiv, sighting, inPreviewPage) {
	const ti = inPreviewPage ? "" : " tabindex='-1'";
	let nameSplit = sighting.species.name.replace(/\bunidentified\b\s*/gi, '').split(' ');
	let nameFirst = nameSplit.reverse().splice(1).reverse().join(' ');
	let nameLast = nameSplit.splice(-1);

	if (inPreviewPage) {
		sightingLabelDiv.append('<div class="vgap30px"></div> ');
	}
	let unidentifiedSpan = sighting.species.name.match(/.*\bunidentified\b.*/gi) ? '<a' + ti + ' class="unidentified">Unidentified</a> ' : '';
	sightingLabelDiv.append('<div class="sighting-name">' + unidentifiedSpan + '<a' + ti + '>' + nameFirst + '</a> <a' + ti + '>' + nameLast + '</a></div> ');
	sightingLabelDiv.find('a.unidentified:not(:last-child)').click(function () { triggerFilter('sighting', sighting.species.name); })
	sightingLabelDiv.find('a:not(.unidentified):not(:last-child)').click(function () { triggerFilter('sighting', nameFirst + " " + nameLast); })
	sightingLabelDiv.find('a:last-child').click(function () { triggerFilter('sighting', nameLast); })
	let sightingNameDiv = sightingLabelDiv.find(".sighting-name");

	if ((sighting.gender || "").toUpperCase().startsWith("M")) {
		sightingNameDiv.append('<span class="male" title="Male"/>');
	} else if ((sighting.gender || "").toUpperCase().startsWith("F")) {
		sightingNameDiv.append('<span class="female" title="Female"/>');
	}

	if (sighting.newSpecies && !inPreviewPage) {
		sightingNameDiv.append('<span class="new-species" title="New Species"/>');
	}

	if (sighting.unconfirmed) {
		sightingNameDiv.append('<span class="unconfirmed" title="Identification yet to be confirmed">Unconfirmed</span>');
	}

	$(TAG_TYPES).each(function (i, tagType) {
		if (sighting[tagType]) {
			if ((tagType == TAG_VARIATION && sighting[TAG_SUBSPECIES]) // skip variation if subspecies is available
				|| (tagType == TAG_SUBSPECIES && inPreviewPage)) {	// skip subspecies in preview page
				return;
			}
			let tagValue = inPreviewPage ? sighting[tagType] : shortenPlumage(sighting[tagType]);
			if (tagType == TAG_SUBSPECIES && sighting[TAG_VARIATION]) { // append variarion to subspecies, if available
				tagValue += ' (' + sighting[TAG_VARIATION] + ')';
			}
			sightingNameDiv.append('<span class="tags" title="' + capitalize(tagType) + '">' + tagValue + '</span> ');
		}
	});

	if (inPreviewPage && (sighting.species.latin_name || sighting.species.ebird_code)) {
		let refDiv = '<div class="sighting-desc margin-bottom-10px">';
		if (sighting.species.latin_name) {
			let latin_name = sighting.species.latin_name;
			if (sighting[TAG_SUBSPECIES]) { // append subspecies to latin name, if available
				latin_name += ' ' + sighting[TAG_SUBSPECIES];
			}
			refDiv += '<span class="latin-name">' + latin_name + '</span>';
		}
		if (sighting.species.ebird_code) {
			refDiv += '<a class="ref" href="' + EBIRD_SPECIES_BASE_URL + sighting.species.ebird_code + '" target="_blank">( 🔗eBird )</a>';
		}
		refDiv += '</div>';
		sightingLabelDiv.append(refDiv);
	}

	let aPlace = (sighting.place ? ("<a" + ti + " class='place' onclick=\"triggerFilter('place', '" + sighting.place + "')\">" + (inPreviewPage ? sighting.place : trimPlaceName(sighting.place, 25)) + "</a>, ") : "");
	let aCity = (sighting.city ? ("<a" + ti + " class='city' onclick=\"triggerFilter('place', '" + sighting.city + "')\">" + (inPreviewPage ? sighting.city : trimPlaceName(sighting.city, (sighting.place ? 15 : 25))) + "</a>, ") : "");
	let stateFullName = getStateFullName(sighting.country, sighting.state, data.countries);
	let aState = "<a" + ti + " class='state' onclick=\"triggerFilter('place', '" + stateFullName + "')\">" + (inPreviewPage ? stateFullName : trimPlaceName(stateFullName, 15)) + "</a>, ";
	let countryFullName = getCountryFullName(sighting.country, data.countries);
	let aCountry = "<a" + ti + " class='country' onclick=\"triggerFilter('place', '" + countryFullName + "')\">" + countryFullName + "</a>";
	if (stateFullName == countryFullName) aState = '';
	sightingLabelDiv.append('<div class="sighting-desc">' + aPlace + aCity + aState + aCountry + '</div>');

	let dateSplit = sighting.dateString.split(/, | /);
	let aDay = '<a' + ti + ' onclick="triggerFilter(\'date\', \'' + sighting.date.format(DISPLAY_DATE_FORMAT) + '\')">' + dateSplit[0] + '</a> ';
	let aMonth = '<a' + ti + ' onclick="triggerFilter(\'date\', \'' + sighting.date.format(FILTER_MONTH_FORMAT) + '\')">' + dateSplit[1] + '</a>, ';
	let aYear = '<a' + ti + ' onclick="triggerFilter(\'date\', \'' + sighting.date.format(FILTER_YEAR_FORMAT) + '\')">' + dateSplit[2] + '</a>';
	sightingLabelDiv.append('<div class="sighting-desc">' + aDay + aMonth + aYear + '</div>');

	if (inPreviewPage) {
		let author = sighting.author || DEFAULT_AUTHOR;
		sightingLabelDiv.append('<div class="sighting-desc">Photographed by <a href="' + (AUTHOR_URL[author] || '') + '" target="_blank">' + author + '</a></div>');
	}

	sighting.rating = sighting.rating || 0;
	// var rating = [...Array(Number(sighting.rating)).keys().map(k => "★")].join("");			// Not working on iOS chrome/firefox
	let rating = RATING_DISPLAY_NAME[currentMode][sighting.rating];
	if (inPreviewPage) {
		rating += " ( ";
		for (let i = 0; i < Number(sighting.rating); i++) rating += "★";
		for (let i = 0; i < 5 - Number(sighting.rating); i++) rating += "✰";
		rating += " )";
	}
	if (LIKE_ENABLED && data.likes) {
		const likes = data.likes[sighting.key] || [];
		const likeText = ' Like' + (likes.length == 1 ? '' : 's');
		sightingLabelDiv.append('<div class="sighting-desc likes" title="' + likes.length + likeText + '">'
			+ '<span onclick="like(\'' + sighting.key + '\')" class="heart ' + (likes.indexOf(getClientId()) >= 0 ? '' : ' hollow') + '"></span>'
			+ '<span class="count">' + likes.length + '</span>'
			+ (inPreviewPage ? likeText : '')
			+ '</div>');
		sightingLabelDiv.append('<span class="text-seperator">|</span>');
	}
	const ratingIconSpan = '<span class="' + RATING_CSS_CLASS_MAPPING[sighting.rating] + '"></span>';
	const ratingHtml = '<a' + ti + ' onclick="triggerFilter(\'rating\', ' + (sighting.rating) + ')" title="Photograph Graded ' + sighting.rating + '/5 (Click to Filter by ' + sighting.rating + '+ Grade)">' + ratingIconSpan + rating + '</a>';
	sightingLabelDiv.append('<div class="sighting-desc rating">' + ratingHtml + '</div>');
	if (sighting.time_of_day || sighting.weather) {
		let weather = (((sighting.time_of_day == 'Day' && sighting.weather) ? (sighting.weather + ' ') : '') + (sighting.time_of_day || 'Day')).toLowerCase()
		sightingLabelDiv.append('<span class="text-seperator">|</span>');
		sightingLabelDiv.append('<div class="sighting-desc weather ' + weather.replace(' ', '-') + '" title="Shot on ' + weather + '"></div>');
		if (inPreviewPage) {
			sightingLabelDiv.append('<span class="text-seperator">Shot on ' + weather + '</span>');
		}
	}
	if (!inPreviewPage && (sighting.author && sighting.author != DEFAULT_AUTHOR)) {
		let author = sighting.author || DEFAULT_AUTHOR;
		sightingLabelDiv.append('<span class="text-seperator">|</span>');
		sightingLabelDiv.append('<span class="sighting-desc opacity-30pc">by <a ' + ti + ' href="' + (AUTHOR_URL[author] || '') + '" target="_blank">' + author + '</a></div>');
	}
}

let likeLocked = false;
let remainingLikes = 25; // to rate limit
function like(key) {
	if (!LIKE_ENABLED || likeLocked || remainingLikes <= 0) {
		console.log("like " + key + " skipped");
		return;
	}
	likeLocked = true;
	data.likes = data.likes || {};
	data.likes[key] = data.likes[key] || [];
	let clientId = getClientId();
	let liked = false;
	if (data.likes[key].indexOf(clientId) >= 0) {
		data.likes[key] = data.likes[key].filter(el => el !== clientId);
	} else {
		data.likes[key] = data.likes[key].concat([clientId]);
		liked = true;
	}
	const fileData = [JSON.stringify({ likes: data.likes })];
	const file = new File(fileData, currentMode + "-likes.json");
	getFirebase().storage().ref("data/" + currentMode + "-likes.json").put(file).then(() => {
		let likeDiv = jQuery(".preview-image-desc, #" + key).find(".sighting-desc.likes");
		let count = likeDiv.find("span.count").eq(0).text() * 1;
		if (liked) {
			likeDiv.find("span.count").text(count + 1);
			likeDiv.find("span.heart").removeClass("hollow");
		} else {
			likeDiv.find("span.count").text(count - 1);
			likeDiv.find("span.heart").addClass("hollow");
		}
		remainingLikes--;
		console.log("liked " + key);
		setTimeout(() => { likeLocked = false; }, 300); // to rate limit
	}).catch(e => {
		console.log("like " + key + " failed");
		setTimeout(() => { likeLocked = false; }, 60000); // as circuit breaker
	});
}

function renderSighting(sightingDiv, sighting) {
	sightingDiv.append('<div class="sighting-image-carousal"></div>');
	let sightingCarousal = sightingDiv.find(".sighting-image-carousal");
	$.each(sighting.media, function (i, image) {
		sightingCarousal.append('<div class="sighting-image" onclick="previewImage(\'' + image.src + '\', \'' + sighting.key + '\')"></div>');
		let mediaDiv = sightingCarousal.find('.sighting-image');
		if (image.type == MEDIA_TYPE_VIDEO) {
			mediaDiv.append('<video class="fadein" loop muted autoplay controls><source src="' + image.src + '" type="video/mp4"></video>');
		} else {
			mediaDiv.append('<img class="fadein" src="' + image.src + '" alt="' + sighting.species.name + '" onload="this.style.opacity=1"/>');
		}
	});
	makeCarousal(sightingCarousal);

	sightingDiv.append('<div class="sighting-label"></div>');
	let sightingLabelDiv = sightingDiv.find(".sighting-label");

	renderSightingDetails(sightingLabelDiv, sighting);
	if (IS_MOBILE) {
		renderSightingTags(sightingLabelDiv, sighting);
	}
}

function renderSightings(offset, pageSize) {
	if (offset == 0) {
		$(".sightings-list").html('');
		currentRenderOffset = 0;
		noMoreDataToRender = false;
	}
	if (noMoreDataToRender) {
		return;
	}
	let dataToRender = data.filteredSightings.slice(offset, offset + pageSize);
	if (dataToRender.length < DATA_PER_PAGE) {
		noMoreDataToRender = true;
	}
	//console.log("Rendering from offset:" + offset + ", data:[" + dataToRender.map(b => b.species.name) + "]");
	$.each(dataToRender, function (i, sighting) {
		$(".sightings-list").append('<div id="' + sighting.key + '" class="sighting-panel"></div>');
		let sightingDiv = $("#" + sighting.key);
		renderSighting(sightingDiv, sighting)
	});
	currentRenderOffset += DATA_PER_PAGE;
}

function getSightingPhotoTitle(sighting, image) {
	if (image.title) return image.title;
	let plumage = [];
	TAG_TYPES.forEach(function (type) {
		if (sighting[type]) plumage.push(shortenPlumage(capitalize(sighting[type])));
	});
	if (sighting.gender) plumage.push({ "M": "Male", "F": "Female" }[sighting.gender]);
	return plumage.length ? plumage.join(" ").trim() : DEFAULT_PLUMAGE;
}

function renderSightingThumbnail(photosDiv, sightingToRender, mediaToRender, selectedMedia, baseSightingIndex) {
	let mediaDiv;
	if (mediaToRender.type == MEDIA_TYPE_VIDEO) {
		if (!mediaToRender.thumbnail) {
			console.log("thumbnail missing for " + mediaToRender.src);
		}
		mediaDiv = "<img class='video-thumbnail' src='" + mediaToRender.thumbnail + "'></img><img class='play-icon' src='icons/play.png'></img>";
	} else {
		mediaDiv = "<img class='image-thumbnail' src='" + mediaToRender.src + "'/></img>";
	}
	const classes = selectedMedia.includes(mediaToRender.src) ? 'selected' : '';
	photosDiv.append("<div class='" + classes + "' onclick=\"previewImage('" + mediaToRender.src + "', '" + sightingToRender.key + "', " + baseSightingIndex + ")\"><span>" + getSightingPhotoTitle(sightingToRender, mediaToRender) + "</span>" + mediaDiv + "</div>");
}

function renderSightingThumbnailsAndDescription(div, selectedSighting, selectedMedia, baseSightingIndex) {
	div.append('<div class="sighting-desc description"><span>' + (selectedSighting.description || '') + '</span></div>');

	if (selectedSighting.species.ebird_code) {
		// TODO
		// div.append('<div class="sighting-desc description"></div>')
	}

	selectedSighting.species.media = [];
	div.append('<div class="photos section-1"></div>');
	let photosDiv = div.find('.photos.section-1');
	const baseSighting = data.filteredSightings[baseSightingIndex];
	baseSighting.media.forEach(function (media) {
		selectedSighting.species.media.push({ sightingKey: baseSighting.key, media: media });
		renderSightingThumbnail(photosDiv, baseSighting, media, selectedMedia, baseSightingIndex);
	});

	const otherSightings = data.sightings.filter(b => b.species.name.toLowerCase() == selectedSighting.species.name.toLowerCase() && b.key != baseSighting.key);
	if (otherSightings.length > 0) {
		div.append('<span class="sighting-desc">Other sightings:</span>');
		div.append('<div class="photos section-2"></div>');
		photosDiv = div.find('.photos.section-2');
		otherSightings.forEach(function (b) {
			b.media.forEach(function (media) {
				selectedSighting.species.media.push({ sightingKey: b.key, media: media });
				renderSightingThumbnail(photosDiv, b, media, selectedMedia, baseSightingIndex);
			});
		});
	}
}

function renderSightingTags(sightingLabelDiv, sighting) {
	sightingLabelDiv.append("<div class='sighting-tags'></div>");
	let tagsDiv = sightingLabelDiv.find(".sighting-tags");
	if (sighting.species.tags && sighting.species.tags.length) {
		tagsDiv.append("Tagged ");
		sighting.species.tags.forEach(function (t) {
			tagsDiv.append('<span class="tags" title="Tag" onclick="triggerFilter(\'sighting\', \'' + t + '\')">' + t + '</span> ');
		});
		tagsDiv.append(" ");
	}
	tagsDiv.append('in <span class="tags" title="Family" onclick="triggerFilter(\'sighting\', \'' + sighting.species.family + '\')">' + sighting.species.family + '</span>');
}

function previewImage(imageSrc, sightingKey, index) {
	if (!IS_MOBILE) {
		let visible = $('.preview-image').is(':visible');
		if (visible) {
			$('.preview-image').remove();
			$('.preview-image-desc').remove();
		}
		$('.overlay').show();
		const sighting = data.sightings.filter(b => b.key == sightingKey)[0];
		const media = sighting.media.filter(m => m.src == imageSrc)[0];
		let mediaTag = '';
		if (media.type == MEDIA_TYPE_VIDEO) {
			mediaTag = '<video controls loop autoplay ' + (media.mute ? ' muted' : '') + '><source src="' + imageSrc + '" type="video/mp4"></video>';
		} else {
			mediaTag = '<img src="' + imageSrc + '" title="' + sighting.species.name + '" alt="' + sighting.species.name + '"></img>';
		}
		if (index == undefined) {
			//this check makes sure selecting a media from a different sighting does not move the flow to that sighting 
			index = data.filteredSightings.map((b, i) => (b.key == sightingKey) ? i : null).filter(k => k != null)[0];
		}
		$('body').append('<div class="preview-image' + (visible ? '' : ' slide-in') + '" data-index="' + index + '">' + mediaTag + '</div>');
		$('body').append('<div class="preview-image-desc' + (visible ? '' : ' slide-in') + '"></div>');
		$('.preview-image-desc').append('<button class="close-button" onclick="removePreviewImage()"><img src="icons/close.png" title="Close"/></button>');
		$('.preview-image-desc').append('<button class="slideshow-button" onclick="toggleSlideshow()"><img src="icons/' + (isSlideshowPlaying() ? "pause" : "play") + '.png" title="Slideshow"/></button>');
		$('.preview-image-desc').append('<button class="left-button" onclick="scrollPreviewImageSighting(-1)"></button>');
		$('.preview-image-desc').append('<button class="right-button" onclick="scrollPreviewImageSighting(1)"></button>');
		renderSightingDetails($('.preview-image-desc'), sighting, true);
		renderSightingThumbnailsAndDescription($('.preview-image-desc'), sighting, [imageSrc], index);
		renderSightingTags($('.preview-image-desc'), sighting);
		if (!isTouchDevice()) disableScroll();
		$('.sightings-list video').trigger('pause');
	}
}

let slideshowIntervalId = null;
function isSlideshowPlaying() {
	return slideshowIntervalId != null;
}
function startSlideshow() {
	slideshowIntervalId = setInterval(function () { scrollPreviewImage(1, true); }, 6000);
	$('button.slideshow-button img').attr("src", "icons/pause.png");
}
function stopSlideshow() {
	if (isSlideshowPlaying()) {
		clearInterval(slideshowIntervalId);
	}
	slideshowIntervalId = null;
	$('button.slideshow-button img').attr("src", "icons/play.png");
}
function toggleSlideshow() {
	isSlideshowPlaying() ? stopSlideshow() : startSlideshow();
}

// called on click of arrow button in preview page
// scrolls through sightings
function scrollPreviewImageSighting(direction) {
	if ($('.preview-image').is(':visible')) {
		let index = parseInt($('.preview-image').attr('data-index'));
		index = index + direction;
		if (index >= 0 && index < data.filteredSightings.length) {
			const sighting = data.filteredSightings[index];
			previewImage(sighting.media[0].src, sighting.key);
		}
	}
}

// called on arrow key press
// scrolls through images inside sightings
function scrollPreviewImage(direction, wrap) {
	if ($('.preview-image').is(':visible')) {
		let index = parseInt($('.preview-image').attr('data-index'));
		let sighting = data.filteredSightings[index];
		let mediaSrc = $('.preview-image').find('img, video source').attr('src');
		let mediaIndex = data.filteredSightings[index].media.map((m, i) => (m.src == mediaSrc) ? i : null).filter(k => k != null)[0];
		mediaIndex += direction;
		if (mediaIndex >= 0 && mediaIndex < data.filteredSightings[index].media.length) {
			const media = data.filteredSightings[index].media[mediaIndex];
			previewImage(media.src, sighting.key, index);
		} else {
			if (wrap) {
				index = (index + 1 + data.filteredSightings.length) % data.filteredSightings.length;
			} else {
				index += direction;
			}
			if (index >= 0 && index < data.filteredSightings.length) {
				sighting = data.filteredSightings[index];
				previewImage(sighting.media[0].src, sighting.key);
			}
		}
	}
}

// UNUSED METHOD
// scrolls through images inside sightings, then through other sightings as well
function scrollPreviewImageIncludingOtherSightings(direction, wrap) {
	if ($('.preview-image').is(':visible')) {
		let index = parseInt($('.preview-image').attr('data-index'));
		let sighting = data.filteredSightings[index];
		let mediaSrc = $('.preview-image').find('img, video source').attr('src');
		let mediaIndex = data.filteredSightings[index].species.media.map((m, i) => (m.media.src == mediaSrc) ? i : null).filter(k => k != null)[0];
		mediaIndex += direction;
		if (mediaIndex >= 0 && mediaIndex < data.filteredSightings[index].species.media.length) {
			const media = data.filteredSightings[index].species.media[mediaIndex];
			previewImage(media.media.src, media.sightingKey, index);
		} else {
			if (wrap) {
				index = (index + 1 + data.filteredSightings.length) % data.filteredSightings.length;
			} else {
				index += direction;
			}
			if (index >= 0 && index < data.filteredSightings.length) {
				sighting = data.filteredSightings[index];
				previewImage(sighting.media[0].src, sighting.key);
			}
		}
	}
}

function removePreviewImage() {
	stopSlideshow();
	$('.preview-image, .preview-image-desc').addClass('slide-out');
	$('.overlay').addClass('fadeout');
	setTimeout(function () {
		$('.preview-image').remove();
		$('.preview-image-desc').remove();
		$('.overlay').removeClass('fadeout').hide();
		$('.sightings-list video:visible').trigger('play');
		enableScroll();
	}, 250);
}

function setSort(newSort) {
	sort = newSort;
	$(".sortby button").removeClass("button-active");
	$(".sortby button[data-value='" + newSort.by + "']").addClass("button-active");
}

function filterOnChange(type) {
	let value = $('.filter input[data-value=' + type + ']')[0].value
	if (value != "") $(".filter input[data-value='" + type + "']").addClass("button-active").val(capitalize(value).trim());
	else $(".filter input[data-value='" + type + "']").removeClass("button-active");
	refresh();
}

function getFilter(type) {
	if ($('.filter input[data-value=' + type + ']').length) {
		return $('.filter input[data-value=' + type + ']')[0].value;
	} else {
		const urlParams = getUrlParams();
		if (urlParams[type]) return decodeURIComponent(urlParams[type]);
	}
}

function getFilters() {
	return {
		sighting: getFilter('sighting') || '',
		place: getFilter('place') || '',
		date: getFilter('date') || '',
		newspecies: newSpeciesFilter,
		rating: ratingFilter
	};
}

function setFilter(type, value) {
	if (type == 'rating') {
		ratingFilter = value || 0;
	} else {
		$(".filter input[data-value='" + type + "']")[0].value = value ? value : null;
		if (value) {
			$(".filter input[data-value='" + type + "']").addClass("button-active");
			$(".filter input[data-value='" + type + "'] + button").removeClass("hidden");
			if (type == 'date') $(".filter input[data-value='" + type + "'] + button").addClass("button-active").html(value);
		} else {
			$(".filter input[data-value='" + type + "']").removeClass("button-active");
			if (type == 'date') $(".filter input[data-value='" + type + "'] + button").addClass("hidden");
		}
	}
}

function setFilters(filter) {
	if (filter) {
		setFilter('sighting', filter.sighting);
		setFilter('place', filter.place);
		setFilter('date', filter.date);
		setFilter('rating', filter.rating);
	}
}

function clearFilter(type) {
	if ($(".filter").is(':visible')) {
		$(".filter input[data-value='" + type + "']").removeClass("button-active").val("");
		if (type == 'date') {
			$(".filter input[data-value='" + type + "'] + button").addClass("hidden");
		}
		refresh();
		$(".filter input[data-value='" + type + "']").focus();
	}
}

function triggerFilter(type, value) {
	if (type == 'place' && currentPage == MAP_MENU) {
		showPage(MAP, { place: value });
		setFilter(type, value);
	} else if (type == 'rating') {
		ratingFilter = value || 0;
		showPage(currentPage, { rating: value });
	} else {
		if ($('.filter').is(':visible')) {
			setFilter(type, value);
			filterOnChange(type);
		}
		hideRightPane();
	}
}

function setNewSpeciesFilterState() {
	if (newSpeciesFilter) {
		$('.newspeciesfilter').addClass('active');
	} else {
		$('.newspeciesfilter').removeClass('active');
	}
}

function toggleNewSpeciesFilter() {
	newSpeciesFilter = !newSpeciesFilter;
	setNewSpeciesFilterState();
	refresh();
}

function renderExploreMenu() {
	$('.featured').addClass('collapsed');
	$('.explore-menu').addClass('expanded');

	if ($('.explore-menu .list').html() == '') {
		data.families.forEach(function (family, i) {
			const nameSpan = "<span class='name'>" + family.name + "</span>";
			const count = data.sightings.filter(b => !b.hidden && b.species.family == family.name).length;
			const countSpan = "<span class='count'>" + count + "</span>";
			const img = "<img class='fadein-50percent' src='" + getMedia(family.imagesrc) + "' alt='" + family.name + "'></img>";
			const div = "<div class='sighting-family' onclick='showPage(\"explore_page\", {family:\"" + family.name + "\"})'>" + nameSpan + countSpan + img + "</div>";
			$('.explore-menu .list').append(div);
		});
	}
}

function clearExploreMenu() {
	$('.home .featured').removeClass('collapsed');
	$('.explore-menu').removeClass('expanded');
}

function showVideosPage() {
	$('.home .featured').addClass('collapsed');
	$('.videos').addClass('expanded');
}

function clearVideosPage() {
	$('.videos').removeClass('expanded');
}

function showAboutPage() {
	$('.home .featured').addClass('collapsed');
}

function renderHome() {
	$('.home .featured').removeClass('hidden');
	clearExploreMenu();
	clearVideosPage();
}

function hideRightPane() {
	if ($('.right-pane').is(":visible")) {
		toggleRightPane();
	}
}

function renderMapPage() {
	// $('input[data-value=place]').parent().hide();
	renderSightings(0, DATA_PER_PAGE);
}

function renderMapMenu() {
	$('.home .featured').addClass('collapsed');
	$('.map-menu').show();
	if ($('.map-menu').html() == '') {
		$('.map-menu').append("<h1>Species Observed by Location</h1>");
		renderLocationList($('.map-menu'));
	}
}

function renderLocationList(container) {
	container.append("<div class='location-list'></div>")
	container = container.find('.location-list');
	let html = "";
	Object.keys(data.countries).forEach(function (countryCode, l1Index) {
		const country = data.countries[countryCode];
		const count = data.countries[countryCode].count;
		if (count > 0) {
			html += "<div class='location-item country'>";
			html += "<button class='country' onclick='triggerFilter(\"place\", \"" + country.name + "\")'><span>" + country.name + "</span><span class='count'>" + count + "</span></button>";
			const l2Children = Object.keys(country.states).filter(s => country.states[s].count > 0).sort((a, b) => compare(country.states[b].count, country.states[a].count));
			l2Children.forEach(function (stateCode, l2Index) {
				const state = country.states[stateCode];
				const count = country.states[stateCode].count;
				const l3Children = Object.keys(state.cities).filter(c => state.cities[c].count >= MIN_COUNT_FOR_LOCATION_LISTING).sort((a, b) => compare(state.cities[b].count, state.cities[a].count));
				html += "<div class='location-item'>";
				html += "<div class='ver-line l2'></div>";
				html += "<div class='hor-line l2'></div>";
				if (l3Children.length > 0) html += "<button class='expand state'/>";
				html += "<button class='state' onclick='triggerFilter(\"place\", \"" + state.name + "\")'><span>" + state.name + "</span><span class='count'>" + count + "</span></button>";
				l3Children.forEach(function (cityName, l3Index) {
					const city = state.cities[cityName];
					const count = state.cities[cityName].count;
					const l4Children = Object.keys(city.places).filter(p => city.places[p].count >= MIN_COUNT_FOR_LOCATION_LISTING).sort((a, b) => compare(city.places[b].count, city.places[a].count));
					html += "<div class='location-item' style='display: none;'>";
					if (l2Index < l2Children.length - 1) html += "<div class='ver-line l2'></div>";
					html += "<div class='ver-line l3'></div>";
					html += "<div class='hor-line l3'></div>";
					if (l4Children.length > 0) html += "<button class='expand city'/>";
					html += "<button class='city' onclick='triggerFilter(\"place\", \"" + cityName + "\")'><span>" + cityName + "</span><span class='count'>" + count + "</span></button>";
					l4Children.forEach(function (placeName, l4Index) {
						const count = city.places[placeName].count;
						html += "<div class='location-item' style='display: none;'>";
						if (l2Index < l2Children.length - 1) html += "<div class='ver-line l2'></div>";
						if (l3Index < l3Children.length - 1) html += "<div class='ver-line l3'></div>";
						html += "<div class='ver-line l4'></div>";
						html += "<div class='hor-line l4'></div>";
						html += "<button class='place' onclick='triggerFilter(\"place\", \"" + placeName + "\")'><span>" + placeName + "</span><span class='count'>" + count + "</span></button>";
						html += "</div>";
					});
					html += "</div>";
				});
				html += "</div>";
			});
			html += "</div>";
		}
	});
	container.append(html);
	container.find(".location-item button.expand").click(function () {
		let clickedButton = $(this);
		let children = clickedButton.parent().find("> .location-item");
		if (children.is(":visible")) {
			children.find(".location-item").hide();
			children.find("button.expand").removeClass("expanded");
			setTimeout(function () {
				children.hide();
				clickedButton.removeClass("expanded");
			}, 100);
		} else {
			children.show();
			clickedButton.addClass("expanded");
			setTimeout(function () {
				children.find(".location-item").show();
				children.find("button.expand").addClass("expanded");
			}, 100);
		}
	});
}

function renderYearList(container) {
	container.append("<div class='date-list'></div>")
	container = container.find('.date-list');
	let html = "";
	Object.keys(data.years).reverse().forEach(function (year, index) {
		const sighting_count = data.years[year].sighting_count;
		const new_species_count = data.years[year].new_species_count;
		html += "<div class='date-item country'>";
		html += "<button class='country' onclick='triggerFilter(\"date\", \"" + year + "\")'><span>" + year + "</span><span class='count'>New species: " + new_species_count + " / Total sightings: " + sighting_count + "</span></button>";
		html += "</div>";
	});
	container.append(html);
}

function toggleRightPane() {

	if ($(".right-pane").is(":visible")) {
		$(".right-pane-button").removeClass('button-active');
		$(".right-pane").addClass("slide-out");
		setTimeout(function () {
			$(".right-pane").hide();
		}, 250);
		$('.overlay-on-body').addClass('fadeout');
		setTimeout(function () { $('.overlay-on-body').removeClass('fadeout').hide() }, 250);
		// document.body.style.overflow = 'visible';
	} else {
		if ($(".right-pane").html() == '') {

			$(".right-pane").append("<h1>Index by Location</h1>");
			renderLocationList($(".right-pane"));

			$(".right-pane").append("<h1>Index by Year</h1>");
			renderYearList($(".right-pane"));

			const filteredSpecies = [...new Set(data.filteredSightings.map(b => b.species.key))];
			$(".right-pane").append("<h1>Species List<span class='count'>" + filteredSpecies.length + "<span></h1>");
			filteredSpecies.sort().forEach(function (species) {
				$(".right-pane").append("<div class='species'><button class='family' onclick='triggerFilter(\"sighting\", \"" + data.species[species].name + "\")'><span>" + data.species[species].name + "</span></button></div>");
			});

			/*$(".right-pane").append("<h1>Index by Category</h1>");
			data.families.forEach(function(family) {
				var count = getSpeciesCount(data.sightings.filter(b => b.species.family == family.name));
				$(".right-pane").append("<div class='families'><button class='family' onclick='triggerFilter(\"sighting\", \"" + family.name + "\")'><span>" + family.name + "</span><span class='count'>" + count + "</span></button></div>");
			});*/

			$(".right-pane").append("<h1></h1>");
		}
		$(".right-pane-button").addClass('button-active');
		$(".right-pane").removeClass("slide-out").show();
		$('.overlay-on-body').show();
		// document.body.style.overflow = 'hidden';
	}
}

function renderPageName(currentPage, params) {
	params = params || {};
	const delim = "<span class='delim'><</span>";
	let icon = "";
	switch (currentPage) {
		case EXPLORE_PAGE:
			icon = "<img class='icon' src='icons/bino-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + params.family + "</span> " + delim + " <a onclick=\"showPage('explore_menu')\">" + PAGE[EXPLORE_MENU].name + "</a> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		case EXPLORE_MENU:
			icon = "<img class='icon' src='icons/bino-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + PAGE[EXPLORE_MENU].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		case ABOUT:
			icon = "<img class='icon' src='icons/about-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + PAGE[ABOUT].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		case ARCHIVE:
			icon = "<img class='icon' src='icons/archive-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + PAGE[ARCHIVE].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		case VIDEOS:
			icon = "<img class='icon' src='icons/video-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + PAGE[VIDEOS].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		case MAP_MENU:
			icon = "<img class='icon' src='icons/map-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + PAGE[MAP_MENU].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		case MAP:
			icon = "<img class='icon' src='icons/map-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>" + (params.place || getFilter('place') || 'All') + "</span> " + delim + " <a onclick=\"showPage('map_menu')\">" + PAGE[MAP].name + "</a> " + delim + " <a onclick=\"showPage('home')\">" + PAGE[HOME].name + "</a>");
			break;
		default:
			icon = "<img class='icon' src='icons/home-icon.png'/>";
			$('.page-name').html(icon + "<span class='active'>Home</span>");
	}
}

function stopYoutubeVideos() {
	$('.youtube').each(function () {
		if (this.contentWindow) {
			this.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
		}
	});
}

function showPage(page, params, isPopstate) {
	// window.scrollTo(0, 0);
	stopYoutubeVideos();

	var filter = getFilters();
	if (params) {
		filter.place = params.place || filter.place || '';
		filter.date = params.date || filter.date || '';
		filter.sighting = params.sighting || filter.sighting || '';
		filter.newspecies = params.newspecies;
		filter.rating = params.rating;
	}

	if (!isPopstate) {
		var state = { page: page, params: params, filter: filter, sort: sort };
		history.pushState(state, '', getUrlFromState(state));
	}

	if (page == currentPage && JSON.stringify(filter) == JSON.stringify(data.filter) && JSON.stringify(sort) == JSON.stringify(data.sort)) {
		// dont reload page if all content are same 
		return;
	}

	currentPage = page;
	if ([ARCHIVE, EXPLORE_PAGE, MAP].includes(page)) {
		showLoader();
	}
	var files = [
		getData("data/" + currentMode + "-sightings.json"),
		getData("data/" + currentMode + "-species.json"),
		getData("data/" + currentMode + "-families.json"),
		getData("data/" + currentMode + "-likes.json"),
		getData("data/places.json")
	];
	readJSONFiles(files, function (json) {
		data = json;
		computeInternalDataFields();
		initAutocomplete();
		renderPageName(page, params);
		if (params) {
			setFilters(filter);
		}
		switch (currentPage) {
			case ARCHIVE:
				$('.home .explore-menu, .home .menu, .about-page, .videos, .home-page').hide();
				$('.home, .sightings-list, .filter-panel, .filter-panel .filter, .filter-panel .sortby, .filter-panel .stats').show();
				$('.home .featured').addClass('hidden');
				sightingFamilyFilter = null;
				filterAndSortData(filter);
				fillStats();
				renderSightings(0, DATA_PER_PAGE);
				break;
			case EXPLORE_MENU:
				$('.filter-panel, .sightings-list, .home .menu, .about-page, .videos, .home-page').hide();
				$('.home, .home .explore-menu').show();
				$('.home .featured').removeClass('hidden');
				setFilters({});
				renderExploreMenu();
				break;
			case EXPLORE_PAGE:
				$('.home .explore-menu, .home .menu, .about-page, .filter-panel .filter, .filter-panel .sortby, .videos, .home-page').hide();
				$('.home, .sightings-list, .filter-panel, .filter-panel .stats').show();
				$('.home .featured').addClass('hidden');
				setFilters({});
				filterAndSortData(filter, params);
				fillStats();
				renderSightings(0, DATA_PER_PAGE, params);
				break;
			case MAP_MENU:
				$('.filter-panel, .sightings-list, .home .menu, .about-page, .videos, .home-page').hide();
				$('.home, .home .map-menu').show();
				$('.home .featured').removeClass('hidden');
				setFilters({});
				renderMapMenu();
				break;
			case MAP:
				$('.home .explore-menu, .home .menu, .about-page, .videos, .map-menu, .home-page').hide();
				$('.home, .sightings-list, .filter-panel, .filter-panel .filter, .filter-panel .sortby, .filter-panel .stats').show();
				$('.home .featured').addClass('hidden');
				sightingFamilyFilter = null;
				filterAndSortData(filter);
				fillStats();
				renderMapPage();
				break;
			case VIDEOS:
				$('.filter-panel, .home .menu, .sightings-list, .about-page, .home-page').hide();
				$('.videos, .home').show();
				setFilters({});
				showVideosPage();
				break;
			case ABOUT:
				$('.filter-panel, .sightings-list, .home .explore-menu, .home .menu, .videos, .home-page').hide();
				$('.home, .about-page').show();
				setFilters({});
				showAboutPage();
				break;
			default:
				$('.filter-panel, .sightings-list, .home .explore-menu, .about-page, .videos, .map-menu').hide();
				$('.home, .home .menu').show();
				if (!IS_MOBILE) {
					$('.home-page').show();
				}
				setFilters({});
				renderHome();
				setMode(DEFAULT_MODE);
		}

		setSiteLogo();

		if (currentPage != HOME) {
			$('.scroll-up-highlighter').remove();
		}
		hideLoader();
	});
}

function refresh() {
	showPage(currentPage);
}

function getUrlFromState(state) {
	if (state.page == HOME) return (window.location.origin + window.location.pathname); //blank url
	var url = "?page=" + encodeURIComponent(state.page);
	if (currentMode != MODE_BIRD) {
		url += "&mode=" + currentMode;
	}
	if ([EXPLORE_PAGE].includes(state.page) && state.params && state.params.family) url += "&family=" + encodeURIComponent(state.params.family);
	if ([ARCHIVE, MAP].includes(state.page) && state.filter && state.filter.sighting) url += "&sighting=" + encodeURIComponent(state.filter.sighting);
	if ([ARCHIVE, MAP].includes(state.page) && state.filter && state.filter.place) url += "&place=" + encodeURIComponent(state.filter.place);
	if ([ARCHIVE, MAP].includes(state.page) && state.filter && state.filter.date) url += "&date=" + encodeURIComponent(state.filter.date);
	if (!(state.sort.by == 'date' && state.sort.descending)) {
		if ([EXPLORE_PAGE, ARCHIVE, MAP].includes(state.page) && state.sort && state.sort.by) url += "&sort_by=" + encodeURIComponent(state.sort.by);
		if ([EXPLORE_PAGE, ARCHIVE, MAP].includes(state.page) && state.sort && state.sort.descending) url += "&sort_descending=" + encodeURIComponent(state.sort.descending);
	}
	if (newSpeciesFilter) url += "&newspecies=true";
	if (ratingFilter) url += "&rating=" + ratingFilter;
	return url;
}

function retrieveStateFromUrlParams() {
	var urlParams = getUrlParams();
	currentPage = urlParams.page ? decodeURIComponent(urlParams.page) : HOME;
	currentMode = urlParams.mode ? decodeURIComponent(urlParams.mode) : MODE_BIRD;
	if ([EXPLORE_PAGE, ARCHIVE, MAP].includes(urlParams.page) && urlParams.sort_by) {
		sort.by = decodeURIComponent(urlParams.sort_by);
		sort.descending = !!urlParams.sort_descending;
		$(".sortby").ready(function () {
			$(".sortby button").removeClass("button-active");
			$(".sortby button[data-value='" + decodeURIComponent(urlParams.sort_by) + "']").addClass("button-active");
			if (urlParams.sort_descending) {
				$(".sortby button[data-value='" + urlParams.sort_by + "'] span.order").addClass('desc').removeClass('asc');
			} else {
				$(".sortby button[data-value='" + urlParams.sort_by + "'] span.order").removeClass('desc').addClass('asc');
			}
		});
	} else {
		sort = { by: 'date', descending: true };
		$(".sortby").ready(function () {
			$(".sortby button[data-value='date'] span.order").addClass('desc').removeClass('asc');
		});
	}
	if ([EXPLORE_PAGE, ARCHIVE, MAP].includes(urlParams.page) && urlParams.newspecies) {
		newSpeciesFilter = urlParams.newspecies;
		$('.newspeciesfilter').ready(setNewSpeciesFilterState);
	}
	if ([EXPLORE_PAGE, ARCHIVE, MAP].includes(urlParams.page) && urlParams.rating) {
		ratingFilter = urlParams.rating || 0;
	}
	if ([ARCHIVE, MAP].includes(urlParams.page)) {
		$(".filter").ready(function () {
			if (urlParams.sighting) $(".filter input[data-value='sighting']").addClass("button-active").val(capitalize(decodeURIComponent(urlParams.sighting)).trim());
			if (urlParams.place) $(".filter input[data-value='place']").addClass("button-active").val(capitalize(decodeURIComponent(urlParams.place)).trim());
			if (urlParams.date) {
				$(".filter input[data-value='date']").val(capitalize(decodeURIComponent(urlParams.date)).trim());
				$(".filter input[data-value='date'] + button").removeClass("hidden").addClass("button-active").html(capitalize(decodeURIComponent(urlParams.date)).trim());
			}
		});
	}
}

function showMore() {
	jQuery('.home-page .hidden-story').show();
	jQuery('.home-page .show-more').hide();
}

function setMode(mode) {
	currentMode = mode;
}
function setSiteLogo() {
	jQuery('a.site-logo img').attr("src", MODE[currentMode].logo).attr("title", MODE[currentMode].title).attr("alt", MODE[currentMode].title);
}

function ensurePageLoader() {
	if (jQuery('#page-loader').length) return;
	const loaderHtml = '<div id="page-loader" aria-hidden="true"><div class="page-loader-overlay"></div><div class="spinner" role="status" aria-label="Loading"></div></div>';
	jQuery('body').append(loaderHtml);
}

let _pageLoaderShownAt = 0;
const PAGE_LOADER_MIN_MS = 150; // keep loader visible at least this long to ensure it paints
function showLoader() {
	ensurePageLoader();
	jQuery('#page-loader').show();
	_pageLoaderShownAt = Date.now();
}
function hideLoader() {
	const elapsed = Date.now() - (_pageLoaderShownAt || 0);
	const remaining = PAGE_LOADER_MIN_MS - elapsed;
	if (remaining > 0) {
		setTimeout(function () { jQuery('#page-loader').fadeOut(150); _pageLoaderShownAt = 0; }, remaining);
	} else {
		jQuery('#page-loader').fadeOut(150);
		_pageLoaderShownAt = 0;
	}
}

// Initialize the application
showLoader();
retrieveStateFromUrlParams();
const params = getUrlParams();
showPage(currentPage, {
	family: params.family ? decodeURIComponent(params.family) : undefined,
	newspecies: params.newspecies ? decodeURIComponent(params.newspecies) : undefined,
	rating: ratingFilter,
	sighting: params.sighting ? decodeURIComponent(params.sighting) : undefined,
	place: params.place ? decodeURIComponent(params.place) : undefined,
	date: params.date ? decodeURIComponent(params.date) : undefined,
	sort_by: params.sort_by ? decodeURIComponent(params.sort_by) : undefined,
	sort_descending: params.sort_descending
}, false);

window.onpopstate = function (state) {
	if (state.state) {
		setFilters(state.state.filter);
		setSort(state.state.sort);
		showPage(state.state.page, state.state.params, true);
	}
};

// Expose functions that are called from HTML onclick handlers
window.showPage = showPage;
window.toggleCollpasible = toggleCollpasible;
window.showCarousalImage = showCarousalImage;
window.rollCarousal = rollCarousal;
window.previewImage = previewImage;
window.removePreviewImage = removePreviewImage;
window.scrollPreviewImageSighting = scrollPreviewImageSighting;
// make accessible to window
window.showPage = showPage;
window.toggleSlideshow = toggleSlideshow;
window.triggerFilter = triggerFilter;
window.sortByOnChange = sortByOnChange;
window.filterOnChange = filterOnChange;
window.clearFilter = clearFilter;
window.resetRatingFilter = resetRatingFilter;
window.toggleNewSpeciesFilter = toggleNewSpeciesFilter;
window.renderPageName = renderPageName; // Used in HTML?
window.toggleRightPane = toggleRightPane;
window.hideRightPane = hideRightPane;
window.setMode = setMode;
window.showMore = showMore;
window.like = like;

function isAdmin() {
	return getCookie("credentials") != null;
}


$(document).ready(function () {
	showLoader();
	setSiteLogo();

	//feed infinite scroll
	$(window).scroll(function () {
		if ($(window).scrollTop() > $(document).height() - window.innerHeight * 2) {
			if ([ARCHIVE, EXPLORE_PAGE, MAP].includes(currentPage)) {
				renderSightings(currentRenderOffset, DATA_PER_PAGE);
			}
		}
	});

	//autoscroll explore menu
	autoScroll($('.explore-menu'), 200);

	//close right preview pane on clicking outside
	$('html').click(function (e) {
		if (!$(e.target).hasClass('right-pane') && !$(e.target).parents('.right-pane').length && !$(e.target).hasClass('right-pane-button')) {
			hideRightPane();
		}
	});

	//navigate/close preview image
	$('body').keydown(function (e) {
		if ($('.preview-image').is(':visible')) {
			if (['Enter', 'Escape', 'Space'].includes(e.code)) {
				e.preventDefault();
				removePreviewImage();
			}
			if (['ArrowLeft'].includes(e.code)) {
				e.shiftKey ? scrollPreviewImageSighting(-1) : scrollPreviewImage(-1);
			}
			if (['ArrowRight'].includes(e.code)) {
				e.shiftKey ? scrollPreviewImageSighting(1) : scrollPreviewImage(1);
			}
		}
	});

	if (isAdmin()) {
		$("#admin-button").show();
		$("#admin-button").click(function () {
			window.open("/admin", "_blank");
		});
	}

	// remove scroll-up-highlighter on scroll/click
	$(".home").scroll(() => { $('.scroll-up-highlighter').remove(); $(".home").off("scroll"); $(".home").off("click"); });
	$(".home").click(() => { $('.scroll-up-highlighter').remove(); $(".home").off("scroll"); $(".home").off("click"); });
});
