var DATA_PER_PAGE = 12;
var TAG_TYPES = ["subspecies", "variation", "plumage", "age"];
var FILES = [getData("data/birds.json"), getData("data/species.json"), getData("data/families.json"), getData("data/places.json")];
var MEDIA_TYPE_VIDEO = 'video';
var MIN_COUNT_FOR_RIGHT_PANE_PLACE_LISTING = 5;
var DEFAULT_PLUMAGE = ""; //"Basic/Adult";

var data = { "birds": [] };
var sort = { by: undefined, descending: undefined };
var currentRenderOffset = 0;
var noMoreDataToRender = false;
var birdFamilyFilter = null;

var HOME = "home";
var ARCHIVE = "archive";
var EXPLORE_MENU = "explore_menu";
var EXPLORE_PAGE = "explore_page";
var VIDEOS = "videos";
var ABOUT = "about";
var currentPage = HOME;


function getSpeciesCount(birds) {
	return [...new Set(birds.map(b => b.species.name))].length;
}

function computeInternalDataFields() {
	$.each(data.birds, function(index, bird) {
		bird.index = index;
		//moment
		bird.date = moment(bird.date, "DD-MM-yyyy");
		bird.dateString = bird.date.format("D MMMM, YYYY");
		//tags
		bird.species = data.species[bird.species];
		bird.species.tags = (bird.species.tags || []).sort((a,b) => compare(b.length, a.length));
		//images
		bird.media.forEach(function(m) {
			m.src = getMedia(m.src);
			if(m.thumbnail) m.thumbnail = getMedia(m.thumbnail);
		});
	});
	//add families not in data
	var familyNames = data.families.map(f => f.name);
	data.families.concat(data.birds.filter(b => !familyNames.includes(b.species.family)).map(function(b) { return {name: b.family}; }));
	//fix missing family images or paths
	data.families.forEach(function(family) {
		if(!family.imagesrc) {
			family.imagesrc = data.birds.filter(b => b.species.family == family).slice(-1)[0].images[0].src;
		}
		family.count = data.birds.filter(b => b.species.family == family).length;
	})
	//sort families
	data.families.sort((a, b) => compare(a.name, b.name));

	//remove hidden
	data.birds = data.birds.filter(b => !b.hidden);

	//places
	if(!data.countries.IN.count) {
		countries={}
		Object.keys(data.countries).sort().forEach(function(countryCode) {
			countries[countryCode] = {
				name: data.countries[countryCode].name,
				count: getSpeciesCount(data.birds.filter(b => b.country == countryCode)),
				states: {}
			};
			Object.keys(data.countries[countryCode].states).sort().forEach(function(stateCode) {
				countries[countryCode].states[stateCode] = {
					name: data.countries[countryCode].states[stateCode].name,
					count: getSpeciesCount(data.birds.filter(b => b.state == stateCode)),
					cities: {}
				};
				if(countries[countryCode].states[stateCode].count > 0) {
					[...new Set(data.birds.filter(b => b.country == countryCode && b.state == stateCode).map(b => b.city))].forEach(function(city) {
						countries[countryCode].states[stateCode].cities[city] = {
							count: getSpeciesCount(data.birds.filter(b => b.country == countryCode && b.state == stateCode && b.city == city)),
							places: {}
						};
						[...new Set(data.birds.filter(b => b.place && b.country == countryCode && b.state == stateCode && b.city == city).map(b => b.place))].forEach(function(place) {
							countries[countryCode].states[stateCode].cities[city].places[place] = {
								count: getSpeciesCount(data.birds.filter(b => b.country == countryCode && b.state == stateCode && b.city == city && b.place == place))
							}
						});
					});
				}
			});
		});
		data.countries = countries;
	}
}

function filterAndSortData(filter, params) {
	removePreviewImage();

	if(params && params.family) {
		birdFamilyFilter = params.family;
		
		//remove other filters
		$(".filter input").removeClass("button-active").val("");
	} else {
		birdFamilyFilter = null;
	}

	data.filter = JSON.parse(JSON.stringify(filter));
	data.sort = JSON.parse(JSON.stringify(sort));
	
	data.filteredBirds = data.birds;
	
	//family filter
	if(birdFamilyFilter) {
		data.filteredBirds = data.filteredBirds.filter(b => b.species.family.toLowerCase() == birdFamilyFilter.toLowerCase());
	}
	
	//bird filter
	if(filter.bird) {
		data.filteredBirds = data.filteredBirds.filter(b => 
				tagMatchesSubstring(b.species.name, filter.bird)
			|| 	tagMatches(b.species.name, filter.bird)
			||	b.species.family.toLowerCase() == filter.bird.toLowerCase()
			|| 	b.species.tags && b.species.tags.map(t => tagMatches(t, filter.bird)).reduce((a,b) => a || b)
		);
	}
	
	//place filter
	if(filter.place) {
		data.filteredBirds = data.filteredBirds.filter(b => 
				b.place && b.place.toLowerCase().match('\\b' + filter.place.toLowerCase() + '\\b')
			||	b.city && b.city.toLowerCase() == filter.place.toLowerCase()
			||	b.state && (b.state.toLowerCase() == filter.place.toLowerCase() || getStateFullName(b.country, b.state).toLowerCase() == filter.place.toLowerCase())
			||	b.country && (b.country.toLowerCase() == filter.place.toLowerCase() || getCountryFullName(b.country).toLowerCase() == filter.place.toLowerCase())
		);
	}
	
	//place filter
	if(filter.date) {
		data.filteredBirds = data.filteredBirds.filter(b => b.dateString.endsWith(filter.date));
	}
	
	//sort
	switch(sort.by) {
		case 'name': 	
			data.filteredBirds.sort((a,b) => (sort.descending ? -1 : 1) * compare(a.species.name, b.species.name, compare(a.key, b.key)));
			break;
		default: 	
			data.filteredBirds.sort((a,b) => (sort.descending ? -1 : 1) * compare(a[sort.by], b[sort.by], compare(b.index, a.index)));				
			break;
	}
}

function rollCarousal(image, direction) {
	var images = $(image).parent().find('.bird-image')
	var index = 0;
	images.each(function(i, img) {
		if(!$(img).hasClass('hidden')) {
			index = i;
		}
	});
	images.addClass('hidden');
	var newIndex = (index + direction + images.length) % images.length;
	images.eq(newIndex).removeClass('hidden');
	$('.birds-list video:visible').trigger('play');
}

// Archive page Carousal
function makeCarousal(container) {
	if($(container).children().length > 1) {
		$(container).children().addClass('hidden');
		$(container).children().eq(0).removeClass('hidden');
		container.append('<button class="carousal-button-left" onclick="rollCarousal(this, -1)"></button>');
		container.append('<button class="carousal-button-right" onclick="rollCarousal(this, 1)"></button>');
	}
}

function initAutocomplete() {
	var birdAutocomplete = [];
	var placeAutocomplete = [];
	$.each(data.birds, function(i, bird) {
		birdAutocomplete = birdAutocomplete.concat([bird.species.name]).concat(bird.species.tags.map(t => capitalize(t)));
		placeAutocomplete = placeAutocomplete.concat([bird.place, bird.city, bird.state, getStateFullName(bird.country, bird.state), getCountryFullName(bird.country)].filter(e => e));
		if(bird.city) {
			placeAutocomplete.push(capitalize(bird.city.trim()));
		}
	});
	birdAutocomplete = [...new Set(birdAutocomplete)].sort();
	placeAutocomplete = [...new Set(placeAutocomplete)].sort();
	autocomplete($(".filter input[data-value='bird']")[0], birdAutocomplete);
	autocomplete($(".filter input[data-value='place']")[0], placeAutocomplete);
}

function fillStats() {
	$(".sightings-count").html(data.filteredBirds.length);

	var selectedSpecies = [...new Set(data.filteredBirds.map(b => b.species.name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "")))];
	$(".species-count").html(selectedSpecies.length);

	var filters = getFilters();
	if(filters.date || filters.place) {
		var oldestDate = data.filteredBirds[0].date;
		data.filteredBirds.forEach(function(b) {
			if(b.date<oldestDate) oldestDate = b.date;
		});
		var oldSpecies = [...new Set(data.birds.filter(b => b.date<oldestDate).map(b => b.species.name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "")))]
		var newSpecies = selectedSpecies.filter(s => oldSpecies.indexOf(s)<0);
		$(".new-species-count").parent().show();
		$(".new-species-count").html(newSpecies.length);
	} else {
		$(".new-species-count").parent().hide();
	}
}

function sortByOnChange(value) {
	$(".sortby button").removeClass("button-active");
	$(".sortby button[data-value='" + value + "']").addClass("button-active");
	if(sort.by != value) {
		sort.descending = (sort.by != "date");
	} else {
		sort.descending = !sort.descending;
	}
	sort.by = value;
	if(sort.descending) {
		$(".sortby button[data-value='" + value + "'] span.order").addClass('desc').removeClass('asc');
	} else {
		$(".sortby button[data-value='" + value + "'] span.order").removeClass('desc').addClass('asc');
	}
	refresh();
}

function renderBirdDetails(birdLabelDiv, bird, inPreviewPage) {
	var nameSplit = bird.species.name.split(' ');
	var nameFirst = nameSplit.reverse().splice(1).reverse().join(' ');
	var nameLast = nameSplit.splice(-1);
	birdLabelDiv.append('<div class="bird-name"><a>' + nameFirst + '</a> <a>' + nameLast + '</a></div>');
	birdLabelDiv.find('a:first-child').click(function() { triggerFilter('bird', bird.species.name); })
	birdLabelDiv.find('a:last-child').click(function() { triggerFilter('bird', nameLast); })
	var birdNameDiv = birdLabelDiv.find(".bird-name");
	
	if((bird.gender||"").toUpperCase().startsWith("M")) {
		birdNameDiv.append('<span class="male" title="Male"/>');
	} else if((bird.gender||"").toUpperCase().startsWith("F")) {
		birdNameDiv.append('<span class="female" title="Female"/>');
	}
	
	$(TAG_TYPES).each(function(i, tagType) {
		if(bird[tagType]) {
			birdNameDiv.append('<span class="tags" title="' + capitalize(tagType) + '">' + bird[tagType] + '</span> ');
		}
	});
	
	var aPlace = (bird.place ? ('<a class="place" onclick="triggerFilter(\'place\', \'' + bird.place + '\')">' + (inPreviewPage ? bird.place : trimPlaceName(bird.place)) + '</a>, ') : '');
	var aCity = (bird.city ? ('<a class="city" onclick="triggerFilter(\'place\', \'' + bird.city + '\')">' + bird.city + '</a>, ') : '');
	var stateFullName = getStateFullName(bird.country, bird.state);
	var aState = '<a class="state" onclick="triggerFilter(\'place\', \'' + stateFullName + '\')">' + stateFullName + '</a>, ';
	var countryFullName = getCountryFullName(bird.country);
	var aCountry = '<a class="country" onclick="triggerFilter(\'place\', \'' + countryFullName + '\')">' + countryFullName + '</a>';
	birdLabelDiv.append('<div class="bird-desc">' + aPlace + aCity + aState + aCountry + '</div>');

	var dateSplit = bird.dateString.split(/, | /);
	var aDay = '<a onclick="triggerFilter(\'date\', \'' + bird.date.format('D MMMM, YYYY') + '\')">' + dateSplit[0] + '</a> ';
	var aMonth = '<a onclick="triggerFilter(\'date\', \'' + bird.date.format('MMMM, YYYY') + '\')">' + dateSplit[1] + '</a>, ';
	var aYear = '<a onclick="triggerFilter(\'date\', \'' + bird.date.format('YYYY') + '\')">' + dateSplit[2] + '</a>';
	birdLabelDiv.append('<div class="bird-desc">' + aDay + aMonth + aYear + '</div>');
}

function renderBird(birdDiv, bird) {
	birdDiv.append('<div class="bird-image-carousal"></div>');
	var birdCarousal = birdDiv.find(".bird-image-carousal");
	$.each(bird.media, function(i, image) {
		birdCarousal.append('<div class="bird-image" onclick="previewImage(\'' + image.src + '\', \'' + bird.key + '\')"></div>');
		var mediaDiv = birdCarousal.find('.bird-image');
		if(image.type == MEDIA_TYPE_VIDEO) {
			mediaDiv.append('<video class="fadein" loop muted autoplay controls><source src="' + image.src + '" type="video/mp4"></video>');
		} else {
			mediaDiv.append('<img class="fadein" src="' + image.src + '" alt="' + bird.species.name + '" onload="this.style.opacity=1"/>');
		}
	});
	makeCarousal(birdCarousal);
	
	birdDiv.append('<div class="bird-label"></div>');
	var birdLabelDiv = birdDiv.find(".bird-label");

	renderBirdDetails(birdLabelDiv, bird);
}

function renderBirds(offset, pageSize) {
	if(offset == 0) {
		$(".birds-list").html('');
		currentRenderOffset = 0;
		noMoreDataToRender = false;
	}
	if(noMoreDataToRender) {
		return;
	}
	var dataToRender = data.filteredBirds.slice(offset, offset + pageSize);
	if(dataToRender.length < DATA_PER_PAGE) {
		noMoreDataToRender = true;
	}
	//console.log("Rendering from offset:" + offset + ", data:[" + dataToRender.map(b => b.species.name) + "]");
	$.each(dataToRender, function(i, bird) {
		$(".birds-list").append('<div id="' + bird.key + '" class="bird-panel"></div>');
		var birdDiv = $("#" + bird.key);
		renderBird(birdDiv, bird)
	});
	currentRenderOffset += DATA_PER_PAGE;
}

function getBirdPhotoTitle(bird, image) {
	if(image.title) return image.title;
	var plumage = [];
	TAG_TYPES.forEach(function(type) {
		if(bird[type]) plumage.push(capitalize(bird[type]));
	});
	if(bird.gender) plumage.push({"M": "Male", "F": "Female"}[bird.gender]);
	return plumage.length ? plumage.join(" ").trim() : DEFAULT_PLUMAGE;
}

function renderBirdOtherPhotos(div, bird, exclude) {
	div.append('<div class="photos"></div>');
	var photosDiv = div.find('.photos');
	data.birds.filter(b => b.species.name.toLowerCase() == bird.species.name.toLowerCase()).forEach(function(b) {
		b.media.forEach(function(media) {
			if(!exclude.includes(media.src)) {
				var mediaDiv;
				if(media.type == MEDIA_TYPE_VIDEO) {
					if(!media.thumbnail) {
						console.log("thumbnail missing for " + media.src);
					}
					mediaDiv = "<img class='video-thumbnail' src='" + media.thumbnail + "'></img><img class='play-icon' src='icons/play.png'></img>";
				} else {
					mediaDiv = "<img class='image-thumbnail' src='" + media.src + "'/></img>";
				}
				photosDiv.append("<div onclick=\"previewImage('" + media.src + "', '" + b.key + "')\"><span>" + getBirdPhotoTitle(b, media) + "</span>" + mediaDiv + "</div>");
			}
		});
	});
}

function renderExtendedBirdDetails(birdLabelDiv, bird) {
	birdLabelDiv.append("<div class='bird-tags'></div>");
	var tagsDiv = birdLabelDiv.find(".bird-tags");
	if(bird.species.tags && bird.species.tags.length) {
		tagsDiv.append("Tagged ");
		bird.species.tags.forEach(function(t) {
			tagsDiv.append('<span class="tags" title="Tag" onclick="triggerFilter(\'bird\', \'' + t + '\')">' + t + '</span> ');
		});
		tagsDiv.append(" ");
	}
	tagsDiv.append('in <span class="tags" title="Family" onclick="triggerFilter(\'bird\', \'' + bird.species.family + '\')">' + bird.species.family + '</span>');
}

function previewImage(imageSrc, birdKey) {
	if(isDeviceOnLandscapeOrientation()) {
		var visible = $('.preview-image').is(':visible');
		if(visible) {
			$('.preview-image').remove();
			$('.preview-image-desc').remove();
		}
		$('.overlay').show();
		var bird = data.birds.filter(b => b.key == birdKey)[0];
		var media = bird.media.filter(m => m.src == imageSrc)[0];
		var mediaTag = '';
		if(media.type == MEDIA_TYPE_VIDEO) {
			mediaTag = '<video controls loop autoplay ' + (media.mute ? ' mute' : '') + '><source src="' + imageSrc + '" type="video/mp4"></video>';
		} else {
			mediaTag = '<img src="' + imageSrc + '" title="' + bird.species.name + '" alt="' + bird.species.name + '"></img>';
		}
		var index = data.filteredBirds.map((b,i) => (b.key == birdKey) ? i : null).filter(k => k != null)[0];
		$('body').append('<div class="preview-image' + (visible ? '' : ' slide-in') + '" data-index="' + index + '">' + mediaTag + '</div>');
		$('body').append('<div class="preview-image-desc' + (visible ? '' : ' slide-in') + '"></div>');
		$('.preview-image-desc').append('<button class="close-button" onclick="removePreviewImage()"><img src="icons/close.png"/></button>');
		$('.preview-image-desc').append('<button class="left-button" onclick="scrollPreviewImageBird(-1)"></button>');
		$('.preview-image-desc').append('<button class="right-button" onclick="scrollPreviewImageBird(1)"></button>');
		renderBirdDetails($('.preview-image-desc'), bird, true);
		renderBirdOtherPhotos($('.preview-image-desc'), bird, [imageSrc]);
		renderExtendedBirdDetails($('.preview-image-desc'), bird);
		if(!isTouchDevice()) disableScroll();
		$('.birds-list video').trigger('pause');
	}
}

function scrollPreviewImageBird(direction) {
	if($('.preview-image').is(':visible')) {
		var index = parseInt($('.preview-image').attr('data-index'));
		index = index + direction;
		if(index >= 0 && index < data.filteredBirds.length) {
			var bird = data.filteredBirds[index];
			previewImage(bird.media[0].src, bird.key);
		}
	}
}

function removePreviewImage() {
	$('.preview-image, .preview-image-desc').addClass('slide-out');
	$('.overlay').addClass('fadeout');
	setTimeout(function() {
		$('.preview-image').remove();
		$('.preview-image-desc').remove();
		$('.overlay').removeClass('fadeout').hide();
		$('.birds-list video:visible').trigger('play');
		enableScroll();
	}, 250);
}

function setSort(newSort) {
	sort = newSort;
	$(".sortby button").removeClass("button-active");
	$(".sortby button[data-value='" + newSort.by + "']").addClass("button-active");
}

function filterOnChange(type) {
	var value = $('.filter input[data-value=' + type + ']')[0].value
	if(value != "") $(".filter input[data-value='" + type + "']").addClass("button-active").val(capitalize(value).trim());
	else $(".filter input[data-value='" + type + "']").removeClass("button-active");
	refresh();
}

function getFilter(type) {
	if($('.filter input[data-value=' + type + ']').length) {
		return $('.filter input[data-value=' + type + ']')[0].value;
	} else {
		var urlParams = getUrlParams();
		if(urlParams[type]) return decodeURIComponent(urlParams[type]);
	}
}

function getFilters() {
	return {
		bird: getFilter('bird') || '',
		place: getFilter('place') || '',
		date: getFilter('date') || '',
	};
}

function setFilter(type, value) {
	$(".filter input[data-value='" + type + "']")[0].value = value ? value : null;
	if(value) {
		$(".filter input[data-value='" + type + "']").addClass("button-active");
		$(".filter input[data-value='" + type + "'] + button").removeClass("hidden");
		if(type == 'date') $(".filter input[data-value='" + type + "'] + button").addClass("button-active").html(value);
	} else {
		$(".filter input[data-value='" + type + "']").removeClass("button-active");
		if(type == 'date') $(".filter input[data-value='" + type + "'] + button").addClass("hidden");
	}
}

function setFilters(filter) {
	if(filter) {
		setFilter('bird', filter.bird);
		setFilter('place', filter.place);
		setFilter('date', filter.date);
	}
}

function clearFilter(type) {
	if($(".filter").is(':visible')) {
		$(".filter input[data-value='" + type + "']").removeClass("button-active").val("");
		if(type == 'date') {
			$(".filter input[data-value='" + type + "'] + button").addClass("hidden");
		}
		refresh();
		$(".filter input[data-value='" + type + "']").focus();
	}
}

function triggerFilter(type, value) {
	if($('.filter').is(':visible')) {
		setFilter(type, value);
		filterOnChange(type);
	}
	hideRightPane();
}

function renderExploreMenu() {
	$('.featured').addClass('collapsed');
	$('.explore-menu').addClass('expanded');

	if($('.explore-menu').html() == '') {
		data.families.forEach(function(family, i) {
			var span = "<span>" + family.name + "</span>";
			var img = "<img src='" + getMedia(family.imagesrc) + "' alt='" + family.name + "'></img>";
			var div = "<div class='bird-family' onclick='showPage(\"explore_page\", {family:\"" + family.name + "\"})'>" + span + img + "</div>";
			$('.explore-menu').append(div);
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

function renderHome() {
	$('.home .featured').removeClass('hidden');
	clearExploreMenu();
	clearVideosPage();
}

function hideRightPane() {
	if($('.right-pane').is(":visible")) {
		toggleRightPane();
	}
}

function toggleRightPane() {
	if($(".right-pane").html() == '') {
		$(".right-pane").append("<h1>Index by Location</h1>");
		Object.keys(data.countries).forEach(function(countryCode) {
			var country = data.countries[countryCode];
			var count = data.countries[countryCode].count;
			if(count > 0) {
				$(".right-pane").append("<button class='country' onclick='triggerFilter(\"place\", \"" + country.name + "\")'><span>" + country.name + "</span><span class='count'>" + count + "</span></button>");
				Object.keys(country.states).sort((a,b) => compare(country.states[b].count, country.states[a].count)).forEach(function(stateCode) {
					var state = country.states[stateCode];
					var count = country.states[stateCode].count;
					if(count > 0) {
						$(".right-pane").append("<div><div class='hierarchy l1'></div><button class='state' onclick='triggerFilter(\"place\", \"" + state.name + "\")'><span>" + state.name + "</span><span class='count'>" + count + "</span></button></div>");
						Object.keys(state.cities).sort((a,b) => compare(state.cities[b].count, state.cities[a].count)).forEach(function(cityName) {
							var city = state.cities[cityName];
							var count = state.cities[cityName].count;
							if(count >= MIN_COUNT_FOR_RIGHT_PANE_PLACE_LISTING) {
								if(!invalidName(cityName)) {
									$(".right-pane").append("<div><div class='hierarchy l2'></div><button class='city' onclick='triggerFilter(\"place\", \"" + cityName + "\")'><span>" + cityName + "</span><span class='count'>" + count + "</span></button></div>");
								}
								Object.keys(city.places).sort((a,b) => compare(city.places[b].count, city.places[a].count)).forEach(function(placeName) {
									var count = city.places[placeName].count;
									if(count >= MIN_COUNT_FOR_RIGHT_PANE_PLACE_LISTING) {
										$(".right-pane").append("<div><div class='hierarchy " + (invalidName(cityName) ? 'l2' : 'l3' ) + "'></div><button class='" + (invalidName(cityName) ? 'city' : 'place' ) + "' onclick='triggerFilter(\"place\", \"" + placeName + "\")'><span>" + placeName + "</span><span class='count'>" + count + "</span></button></div>");
									}
								});
							}
						});
					}
				});
			}
		});
		$(".right-pane").append("<h1>Index by Category</h1>");
		data.families.forEach(function(family) {
			var count = getSpeciesCount(data.birds.filter(b => b.species.family == family.name));
			$(".right-pane").append("<div class='families'><button class='family' onclick='triggerFilter(\"bird\", \"" + family.name + "\")'><span>" + family.name + "</span><span class='count'>" + count + "</span></button></div>");
		});
		$(".right-pane").append("<h1>All Species<span class='count'>" + getSpeciesCount(data.birds) + "<span></h1>");
		Object.keys(data.species).sort().forEach(function(species) {
			$(".right-pane").append("<div class='species'><button class='family' onclick='triggerFilter(\"bird\", \"" + data.species[species].name + "\")'><span>" + data.species[species].name + "</span></button></div>");
		});
	}

	if($(".right-pane").is(":visible")) {
		$(".right-pane-button").removeClass('button-active');
		$(".right-pane").addClass("slide-out");
		setTimeout(function() {
			$(".right-pane").hide();
		}, 250);
		// $('.overlay').hide();
		// document.body.style.overflow = 'visible';
	} else {
		$(".right-pane-button").addClass('button-active');
		$(".right-pane").removeClass("slide-out").show();
		// $('.overlay').show();
		// document.body.style.overflow = 'hidden';
	}
}

function handleMobileSpecificRendering() {
	if(!isDeviceOnLandscapeOrientation()) {
		if(currentPage == ARCHIVE) {
			$('.site-header .site-logo').hide();
			$('.site-header .page-name').css('transform', 'translateY(-50px)');
			$('.site-header .filter-panel').css('transform', 'translateY(-40px)');
		} else if(currentPage == EXPLORE_PAGE) {
			$('.site-header .site-logo').hide();
			$('.site-header .page-name').css('transform', 'translateY(-50px)');
			$('.site-header .filter-panel').css('transform', 'translateY(-20px)');
		} else {
			$('.site-header .site-logo').show();
			$('.site-header .page-name').css('transform', 'translateY(10px)');
		}
	} else {
		$('.site-header .site-logo').show();
		$('.site-header .page-name, .site-header .filter-panel').css('transform', 'translateY(0)');
	}
}

function renderPageName(currentPage, params) {
	var delim = "<span class='delim'><</span>";
	switch(currentPage) {
	  case EXPLORE_PAGE:
		var icon = "<img class='icon' src='icons/bino-icon.png'/>";
		$('.page-name').html(icon + "<span class='active'>" + params.family + "</span> " + delim + " <a onclick=\"showPage('explore_menu')\">Explore Birds</a> " + delim + " <a onclick=\"showPage('home')\">Home</a>");
		break;
	  case EXPLORE_MENU:
		var icon = "<img class='icon' src='icons/bino-icon.png'/>";
		$('.page-name').html(icon + "<span class='active'>Explore Birds</span> " + delim + " <a onclick=\"showPage('home')\">Home</a>");
		break;
	  case ABOUT:
		var icon = "<img class='icon' src='icons/about-icon.png'/>";
		$('.page-name').html(icon + "<span class='active'>About</span> " + delim + " <a onclick=\"showPage('home')\">Home</a>");
		break;
	  case ARCHIVE:
		var icon = "<img class='icon' src='icons/archive-icon.png'/>";
		$('.page-name').html(icon + "<span class='active'>Bird Archive</span> " + delim + " <a onclick=\"showPage('home')\">Home</a>");
		break;
	  case VIDEOS:
		var icon = "<img class='icon' src='icons/video-icon.png'/>";
		$('.page-name').html(icon + "<span class='active'>Birding Trips</span> " + delim + " <a onclick=\"showPage('home')\">Home</a>");
		break;
	  default:
		var icon = "<img class='icon' src='icons/home-icon.png'/>";
		$('.page-name').html(icon + "<span class='active'>Home</span>");
	}
}

function showPage(page, params, isPopstate) {
	var filter = getFilters();

	if(!isPopstate) {
		var state = {page: page, params: params, filter: filter, sort: sort};
		history.pushState(state, '', getUrlFromState(state));
	}

	if(page == currentPage && JSON.stringify(filter) == JSON.stringify(data.filter) && JSON.stringify(sort) == JSON.stringify(data.sort)) {
		// dont reload page if all content are same 
		return;
	}

	currentPage = page;
	readJSONFiles(FILES, function(json) {
		data = json;
		computeInternalDataFields();
		initAutocomplete();
		renderPageName(page, params);
		handleMobileSpecificRendering();
		switch(currentPage) {
		  case ARCHIVE:
			$('.home .explore-menu, .home .menu, .about-page, .videos').hide();
			$('.home, .birds-list, .filter-panel, .filter-panel .filter, .filter-panel .sortby, .filter-panel .stats').show();
			$('.home .featured').addClass('hidden');
			birdFamilyFilter = null;
			filterAndSortData(filter);
			fillStats();
			renderBirds(0, DATA_PER_PAGE);
			break;
		  case EXPLORE_PAGE:
			$('.home .explore-menu, .home .menu, .about-page, .filter-panel .filter, .filter-panel .sortby, .videos').hide();
			$('.home, .birds-list, .filter-panel, .filter-panel .stats').show();
			$('.home .featured').addClass('hidden');
			setFilters({});
			filterAndSortData(filter, params);
			fillStats();
			renderBirds(0, DATA_PER_PAGE, params);
			break;
		  case EXPLORE_MENU:
			$('.filter-panel, .birds-list, .home .menu, .about-page, .videos').hide();
			$('.home, .home .explore-menu').show();
			$('.home .featured').removeClass('hidden');
			setFilters({});
			renderExploreMenu();
			break;
		  case VIDEOS:
			$('.filter-panel, .home .menu, .birds-list, .about-page').hide();
			$('.videos, .home').show();
			setFilters({});
			showVideosPage();
			break;
		  case ABOUT:
			$('.filter-panel, .birds-list, .home .explore-menu, .home .menu, .videos').hide();
			$('.home, .about-page').show();
			setFilters({});
			break;
		  default:
			$('.filter-panel, .birds-list, .home .explore-menu, .about-page, .videos').hide();
			$('.home, .home .menu').show();
			setFilters({});
			renderHome();
		}
	});
}

function refresh() {
	showPage(currentPage);
}

function getUrlFromState(state) {
	if(state.page == HOME) return (window.location.origin + window.location.pathname); //blank url
	var url = "?page=" + encodeURIComponent(state.page);
	if([EXPLORE_PAGE].includes(state.page) && state.params && state.params.family) url += "&family=" + encodeURIComponent(state.params.family);
	if([ARCHIVE].includes(state.page) && state.filter && state.filter.bird) url += "&bird=" + encodeURIComponent(state.filter.bird);
	if([ARCHIVE].includes(state.page) && state.filter && state.filter.place) url += "&place=" + encodeURIComponent(state.filter.place);
	if([ARCHIVE].includes(state.page) && state.filter && state.filter.date) url += "&date=" + encodeURIComponent(state.filter.date);
	if(!(state.sort.by == 'date' && state.sort.descending)) {
		if([EXPLORE_PAGE, ARCHIVE].includes(state.page) && state.sort && state.sort.by) url += "&sort_by=" + encodeURIComponent(state.sort.by);
		if([EXPLORE_PAGE, ARCHIVE].includes(state.page) && state.sort && state.sort.descending) url += "&sort_descending=" + encodeURIComponent(state.sort.descending);
	}
	return url;
}

function retrieveStateFromUrlParams() {
	var urlParams = getUrlParams();
	// var page = window.location.pathname.slice(1);
	currentPage = urlParams.page ? decodeURIComponent(urlParams.page) : HOME;
	if([EXPLORE_PAGE, ARCHIVE].includes(urlParams.page) && urlParams.sort_by) {
		sort.by = decodeURIComponent(urlParams.sort_by);
		sort.descending = !!urlParams.sort_descending;
		$(".sortby").ready(function() {
			$(".sortby button").removeClass("button-active");
			$(".sortby button[data-value='" + decodeURIComponent(urlParams.sort_by) + "']").addClass("button-active");
			if(urlParams.sort_descending) {
				$(".sortby button[data-value='" + urlParams.sort_by + "'] span.order").addClass('desc').removeClass('asc');
			} else {
				$(".sortby button[data-value='" + urlParams.sort_by + "'] span.order").removeClass('desc').addClass('asc');
			}
		});
	} else {
		sort = { by: 'date', descending: true};
		$(".sortby").ready(function() {
			$(".sortby button[data-value='date'] span.order").addClass('desc').removeClass('asc');
		});
	}
	if([ARCHIVE].includes(urlParams.page)) {
		$(".filter").ready(function() {
			if(urlParams.bird) $(".filter input[data-value='bird']").addClass("button-active").val(capitalize(decodeURIComponent(urlParams.bird)).trim());
			if(urlParams.place) $(".filter input[data-value='place']").addClass("button-active").val(capitalize(decodeURIComponent(urlParams.place)).trim());
			if(urlParams.date) {
				$(".filter input[data-value='date']").val(capitalize(decodeURIComponent(urlParams.date)).trim());
				$(".filter input[data-value='date'] + button").removeClass("hidden").addClass("button-active").html(capitalize(decodeURIComponent(urlParams.date)).trim());
			}
		});
	}
}

(function($) {
	retrieveStateFromUrlParams();
	showPage(currentPage, { family: decodeURIComponent(getUrlParams().family) }, false);

	window.onpopstate = function(state) {
		if(state.state) {
			setFilters(state.state.filter);
			setSort(state.state.sort);
			showPage(state.state.page, state.state.params, true);
		}
	};

	window.addEventListener('resize', handleMobileSpecificRendering);
})(jQuery);


$(document).ready(function() {
	//archive lazy load on scroll
	$(window).scroll(function() {
	   if($(window).scrollTop() > $(document).height() - window.innerWidth * 2) {
		   if([ARCHIVE, EXPLORE_PAGE].includes(currentPage)) {
			   renderBirds(currentRenderOffset, DATA_PER_PAGE);
		   }
	   }
	});

	//autoscroll explore menu
	autoScroll($('.explore-menu'), 200);

	//autoscroll right pane
	// autoScroll($(".right-pane"), 800);

	//hide right pane for mobile
	if(!isDeviceOnLandscapeOrientation()) {
		$(".component:has(.right-pane-button)").hide();
	}

	//close right preview pane on clicking outside
	$('html').click(function(e) {
	   if(!$(e.target).hasClass('right-pane') && !$(e.target).parents('.right-pane').length && !$(e.target).hasClass('right-pane-button')){
	       hideRightPane();
	   }
	});

	//navigate/close preview image
	$('body').keydown(function(e) {
		if(['Enter', 'Escape'].includes(e.code)) 		removePreviewImage();
		if(['ArrowLeft'].includes(e.code)) 				scrollPreviewImageBird(-1);
		if(['ArrowRight'].includes(e.code)) 			scrollPreviewImageBird(1);
	});
});