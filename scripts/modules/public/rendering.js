import Constants from '../constants.js';
import Util from '../util.js';
import State from './state.js';
import { initSightingCarousal } from './ui-helpers.js';
import { getFilter } from './filters.js';

export function getSightingPhotoTitle(sighting, image) {
    if (image.title) return image.title;
    let plumage = [];
    Constants.TAG_TYPES.forEach(function (type) {
        if (sighting[type]) plumage.push(Util.shortenPlumage(Util.capitalize(sighting[type])));
    });
    if (sighting.gender) plumage.push({ "M": "Male", "F": "Female" }[sighting.gender]);
    return plumage.length ? plumage.join(" ").trim() : Constants.DEFAULT_PLUMAGE;
}

export function renderSightingTags(sightingLabelDiv, sighting) {
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

export function renderSightingDetails(sightingLabelDiv, sighting, inPreviewPage) {
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

    $(Constants.TAG_TYPES).each(function (i, tagType) {
        if (sighting[tagType]) {
            if ((tagType == Constants.TAG_VARIATION && sighting[Constants.TAG_SUBSPECIES]) // skip variation if subspecies is available
                || (tagType == Constants.TAG_SUBSPECIES && inPreviewPage)) {	// skip subspecies in preview page
                return;
            }
            let tagValue = inPreviewPage ? sighting[tagType] : Util.shortenPlumage(sighting[tagType]);
            if (tagType == Constants.TAG_SUBSPECIES && sighting[Constants.TAG_VARIATION]) { // append variarion to subspecies, if available
                tagValue += ' (' + sighting[Constants.TAG_VARIATION] + ')';
            }
            sightingNameDiv.append('<span class="tags" title="' + Util.capitalize(tagType) + '">' + tagValue + '</span> ');
        }
    });

    if (inPreviewPage && (sighting.species.latin_name || sighting.species.ebird_code)) {
        let refDiv = '<div class="sighting-desc margin-bottom-10px">';
        if (sighting.species.latin_name) {
            let latin_name = sighting.species.latin_name;
            if (sighting[Constants.TAG_SUBSPECIES]) { // append subspecies to latin name, if available
                latin_name += ' ' + sighting[Constants.TAG_SUBSPECIES];
            }
            refDiv += '<span class="latin-name">' + latin_name + '</span>';
        }
        if (sighting.species.ebird_code) {
            refDiv += '<a class="ref" href="' + Constants.EBIRD_SPECIES_BASE_URL + sighting.species.ebird_code + '" target="_blank">( 🔗eBird )</a>';
        }
        refDiv += '</div>';
        sightingLabelDiv.append(refDiv);
    }

    let aPlace = (sighting.place ? ("<a" + ti + " class='place' onclick=\"triggerFilter('place', '" + sighting.place + "')\">" + (inPreviewPage ? sighting.place : Util.trimPlaceName(sighting.place, 25)) + "</a>, ") : "");
    let aCity = (sighting.city ? ("<a" + ti + " class='city' onclick=\"triggerFilter('place', '" + sighting.city + "')\">" + (inPreviewPage ? sighting.city : Util.trimPlaceName(sighting.city, (sighting.place ? 15 : 25))) + "</a>, ") : "");
    let stateFullName = Util.getStateFullName(sighting.country, sighting.state, State.data.countries);
    let aState = "<a" + ti + " class='state' onclick=\"triggerFilter('place', '" + stateFullName + "')\">" + (inPreviewPage ? stateFullName : Util.trimPlaceName(stateFullName, 15)) + "</a>, ";
    let countryFullName = Util.getCountryFullName(sighting.country, State.data.countries);
    let aCountry = "<a" + ti + " class='country' onclick=\"triggerFilter('place', '" + countryFullName + "')\">" + countryFullName + "</a>";
    if (stateFullName == countryFullName) aState = '';
    sightingLabelDiv.append('<div class="sighting-desc">' + aPlace + aCity + aState + aCountry + '</div>');

    let dateSplit = sighting.dateString.split(/, | /);
    let aDay = '<a' + ti + ' onclick="triggerFilter(\'date\', \'' + sighting.date.format(Constants.DISPLAY_DATE_FORMAT) + '\')">' + dateSplit[0] + '</a> ';
    let aMonth = '<a' + ti + ' onclick="triggerFilter(\'date\', \'' + sighting.date.format(Constants.FILTER_MONTH_FORMAT) + '\')">' + dateSplit[1] + '</a>, ';
    let aYear = '<a' + ti + ' onclick="triggerFilter(\'date\', \'' + sighting.date.format(Constants.FILTER_YEAR_FORMAT) + '\')">' + dateSplit[2] + '</a>';
    sightingLabelDiv.append('<div class="sighting-desc">' + aDay + aMonth + aYear + '</div>');



    sighting.rating = sighting.rating || 0;
    // var rating = [...Array(Number(sighting.rating)).keys().map(k => "★")].join("");			// Not working on iOS chrome/firefox
    let rating = Constants.RATING_DISPLAY_NAME[State.currentMode][sighting.rating];
    if (inPreviewPage) {
        rating += " ( ";
        for (let i = 0; i < Number(sighting.rating); i++) rating += "★";
        for (let i = 0; i < 5 - Number(sighting.rating); i++) rating += "✰";
        rating += " )";
    }
    sightingLabelDiv.append('<div class="sighting-meta-stats"></div>');
    let metaStatsDiv = sightingLabelDiv.find(".sighting-meta-stats");

    if (Constants.LIKE_ENABLED && State.data.likes) {
        const likes = State.data.likes[sighting.key] || [];
        const likeText = ' Like' + (likes.length == 1 ? '' : 's');
        metaStatsDiv.append('<div class="sighting-desc likes" title="' + likes.length + likeText + '">'
            + '<span onclick="like(\'' + sighting.key + '\')" class="heart ' + (likes.indexOf(Util.getClientId()) >= 0 ? '' : ' hollow') + '"></span>'
            + '<span class="count">' + likes.length + '</span>'
            + (inPreviewPage ? likeText : '')
            + '</div>');
        metaStatsDiv.append('<span class="text-seperator">|</span>');
    }
    const ratingIconSpan = '<span class="' + Constants.RATING_CSS_CLASS_MAPPING[sighting.rating] + '"></span>';
    const ratingHtml = '<a' + ti + ' onclick="triggerFilter(\'rating\', ' + (sighting.rating) + ')" title="Photograph Graded ' + sighting.rating + '/5 (Click to Filter by ' + sighting.rating + '+ Grade)">' + ratingIconSpan + rating + '</a>';
    metaStatsDiv.append('<div class="sighting-desc rating">' + ratingHtml + '</div>');
    if (sighting.time_of_day || sighting.weather) {
        let weather = (((sighting.time_of_day == 'Day' && sighting.weather) ? (sighting.weather + ' ') : '') + (sighting.time_of_day || 'Day')).toLowerCase()
        metaStatsDiv.append('<span class="text-seperator">|</span>');
        metaStatsDiv.append('<div class="sighting-desc weather ' + weather.replace(' ', '-') + '" title="Shot on ' + weather + '"></div>');
        if (inPreviewPage) {
            metaStatsDiv.append('<span class="text-seperator">Shot on ' + weather + '</span>');
        }
    }
    if (!inPreviewPage && (sighting.author && sighting.author != Constants.DEFAULT_AUTHOR)) {
        let author = sighting.author || Constants.DEFAULT_AUTHOR;
        metaStatsDiv.append('<span class="text-seperator">|</span>');
        metaStatsDiv.append('<span class="sighting-desc opacity-30pc">by <a ' + ti + ' href="' + ((State.data.author && State.data.author[author]) || '') + '" target="_blank">' + author + '</a></div>');
    }
}

export function renderSighting(sightingDiv, sighting) {
    sightingDiv.append('<div class="sighting-image-carousal"><div class="sighting-image-scroll"></div></div>');
    let sightingCarousal = sightingDiv.find(".sighting-image-carousal");
    let sightingScroll = sightingDiv.find(".sighting-image-scroll");
    $.each(sighting.media, function (i, image) {
        sightingScroll.append('<div class="sighting-image" onclick="previewImage(\'' + sighting.key + '\', \'' + image.src + '\')"></div>');
        let mediaDiv = sightingScroll.find('.sighting-image').last();
        if (image.type == Constants.MEDIA_TYPE_VIDEO) {
            mediaDiv.append('<video class="fadein" loop muted autoplay controls><source src="' + image.src + '" type="video/mp4"></video>');
        } else {
            mediaDiv.append('<img class="fadein" src="' + image.src + '" alt="' + sighting.species.name + '" onload="this.style.opacity=1"/>');
        }
    });
    initSightingCarousal(sightingCarousal);

    sightingDiv.append('<div class="sighting-label"></div>');
    let sightingLabelDiv = sightingDiv.find(".sighting-label");

    renderSightingDetails(sightingLabelDiv, sighting);
    if (State.IS_MOBILE_DEVICE) {
        renderSightingTags(sightingLabelDiv, sighting);
    }
}

export function renderSightings(offset, pageSize) {
    if (offset == 0) {
        $(".sightings-list").html('');
        State.updateCurrentRenderOffset(0);
        State.updateNoMoreDataToRender(false);
    }
    if (State.noMoreDataToRender) {
        return;
    }
    let dataToRender = State.data.filteredSightings.slice(offset, offset + pageSize);
    if (dataToRender.length < Constants.ARCHIVE_DATA_PER_PAGE) {
        State.updateNoMoreDataToRender(true);
    }

    $.each(dataToRender, function (i, sighting) {
        $(".sightings-list").append('<div id="' + sighting.key + '" class="sighting-panel"></div>');
        let sightingDiv = $("#" + sighting.key);
        renderSighting(sightingDiv, sighting)
    });
    State.updateCurrentRenderOffset(State.currentRenderOffset + Constants.ARCHIVE_DATA_PER_PAGE);
}

export function renderSightingThumbnail(photosDiv, sightingToRender, mediaToRender, selectedMedia, baseSightingIndex) {
    let mediaDiv;
    if (mediaToRender.type == Constants.MEDIA_TYPE_VIDEO) {
        if (!mediaToRender.thumbnail) {
            console.log("thumbnail missing for " + mediaToRender.src);
        }
        mediaDiv = "<img class='video-thumbnail' src='" + mediaToRender.thumbnail + "'></img><img class='play-icon' src='icons/play.png'></img>";
    } else {
        mediaDiv = "<img class='image-thumbnail' src='" + mediaToRender.src + "'/></img>";
    }
    const classes = selectedMedia.includes(mediaToRender.src) ? 'selected' : '';
    photosDiv.append("<div class='" + classes + "' onclick=\"previewImage('" + sightingToRender.key + "', '" + mediaToRender.src + "', " + baseSightingIndex + ", true)\"><span>" + getSightingPhotoTitle(sightingToRender, mediaToRender) + "</span>" + mediaDiv + "</div>");
}

export function renderSightingThumbnailsAndDescription(div, selectedSighting, selectedMedia, baseSightingIndex) {
    div.append('<div class="sighting-desc description"><span>' + (selectedSighting.description || '') + '</span></div>');

    selectedSighting.species.media = [];
    div.append('<div class="photos section-1"></div>');
    let photosDiv = div.find('.photos.section-1');
    const baseSighting = State.data.filteredSightings[baseSightingIndex];
    baseSighting.media.forEach(function (media) {
        selectedSighting.species.media.push({ sightingKey: baseSighting.key, media: media });
        renderSightingThumbnail(photosDiv, baseSighting, media, selectedMedia, baseSightingIndex);
    });

    const otherSightings = State.data.sightings.filter(b => b.species.name.toLowerCase() == selectedSighting.species.name.toLowerCase() && b.key != baseSighting.key);
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

export function renderExploreMenu() {
    $('.featured').addClass('collapsed');
    $('.explore-menu').addClass('expanded');

    if ($('.explore-menu .list').html() == '') {
        State.data.families.forEach(function (family, i) {
            const nameSpan = "<span class='name'>" + family.name + "</span>";
            const sciNameSpan = family.sci_name ? "<span class='sci-name'>" + family.sci_name + "</span>" : "";
            const count = State.data.sightings.filter(b => !b.hidden && b.species.family == family.name).length;
            const countSpan = "<span class='count'>" + count + "</span>";
            const img = "<img class='fadein-50percent' src='" + Util.getMedia(family.imagesrc) + "' alt='" + family.name + "'></img>";
            const div = "<div class='sighting-family' onclick='showPage(\"explore_page\", {family:\"" + family.name + "\"})'>" + nameSpan + sciNameSpan + countSpan + img + "</div>";
            $('.explore-menu .list').append(div);
        });
    }
}

export function renderHome() {
    $('.home .featured').removeClass('hidden');
    // clearExploreMenu(); // these are from router, need to check dependencies.
    // clearStoriesPage(); // Moving these logic to router or keeping them in main. 
    // Actually renderHome does UI manipulation mostly.
    $('.home .featured').removeClass('collapsed');
    $('.explore-menu').removeClass('expanded');
    $('.stories').removeClass('expanded');

    renderStories('.home-stories', 5);
}

export function renderMapPage() {
    // $('input[data-value=place]').parent().hide();
    renderSightings(0, Constants.ARCHIVE_DATA_PER_PAGE);
}

export function renderLocationList(container) {
    container.append("<div class='location-list'></div>")
    container = container.find('.location-list');
    let html = "";
    Object.keys(State.data.countries).forEach(function (countryCode, l1Index) {
        const country = State.data.countries[countryCode];
        const count = State.data.countries[countryCode].count;
        if (count > 0) {
            html += "<div class='location-item country'>";
            html += "<button class='country' onclick='triggerFilter(\"place\", \"" + country.name + "\")'><span>" + country.name + "</span><span class='count'>" + count + "</span></button>";
            const l2Children = Object.keys(country.states).filter(s => country.states[s].count > 0).sort((a, b) => Util.compare(country.states[b].count, country.states[a].count));
            l2Children.forEach(function (stateCode, l2Index) {
                const state = country.states[stateCode];
                const count = country.states[stateCode].count;
                const l3Children = Object.keys(state.cities).filter(c => state.cities[c].count >= Constants.MIN_COUNT_FOR_LOCATION_LISTING).sort((a, b) => Util.compare(state.cities[b].count, state.cities[a].count));
                html += "<div class='location-item'>";
                html += "<div class='ver-line l2'></div>";
                html += "<div class='hor-line l2'></div>";
                if (l3Children.length > 0) html += "<button class='expand state'/>";
                html += "<button class='state' onclick='triggerFilter(\"place\", \"" + state.name + "\")'><span>" + state.name + "</span><span class='count'>" + count + "</span></button>";
                l3Children.forEach(function (cityName, l3Index) {
                    const city = state.cities[cityName];
                    const count = state.cities[cityName].count;
                    const l4Children = Object.keys(city.places).filter(p => city.places[p].count >= Constants.MIN_COUNT_FOR_LOCATION_LISTING).sort((a, b) => Util.compare(city.places[b].count, city.places[a].count));
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

export function renderMapMenu() {
    $('.home .featured').addClass('collapsed');
    $('.map-menu').show();
    if ($('.map-menu').html() == '') {
        $('.map-menu').append("<h1>Species Observed by Location</h1>");
        renderLocationList($('.map-menu'));
    }
}

export function renderYearList(container) {
    container.append("<div class='date-list'></div>")
    container = container.find('.date-list');
    let html = "";
    Object.keys(State.data.years).reverse().forEach(function (year, index) {
        const sighting_count = State.data.years[year].sighting_count;
        const new_species_count = State.data.years[year].new_species_count;
        html += "<div class='date-item country'>";
        html += "<button class='country' onclick='triggerFilter(\"date\", \"" + year + "\")'><span>" + year + "</span><span class='count'>New species: " + new_species_count + " / Total sightings: " + sighting_count + "</span></button>";
        html += "</div>";
    });
    container.append(html);
}

export function renderPageName(currentPage, params) {
    params = params || {};
    const delim = "<span class='delim'><</span>";
    let icon = "";
    switch (currentPage) {
        case Constants.EXPLORE_PAGE:
            icon = "<img class='icon' src='icons/bino-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + params.family + "</span> " + delim + " <a onclick=\"showPage('explore_menu')\">" + Constants.PAGE[Constants.EXPLORE_MENU].name + "</a> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        case Constants.EXPLORE_MENU:
            icon = "<img class='icon' src='icons/bino-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + Constants.PAGE[Constants.EXPLORE_MENU].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        case Constants.ABOUT:
            icon = "<img class='icon' src='icons/about-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + Constants.PAGE[Constants.ABOUT].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        case Constants.ARCHIVE:
            icon = "<img class='icon' src='icons/archive-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + Constants.PAGE[Constants.ARCHIVE].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        case Constants.STORIES:
            icon = "<img class='icon' src='icons/video-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + Constants.PAGE[Constants.STORIES].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        case Constants.MAP_MENU:
            icon = "<img class='icon' src='icons/map-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + Constants.PAGE[Constants.MAP_MENU].name + "</span> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        case Constants.MAP:
            icon = "<img class='icon' src='icons/map-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>" + (params.place || getFilter('place') || 'All') + "</span> " + delim + " <a onclick=\"showPage('map_menu')\">" + Constants.PAGE[Constants.MAP].name + "</a> " + delim + " <a onclick=\"showPage('home')\">" + Constants.PAGE[Constants.HOME].name + "</a>");
            break;
        default:
            icon = "<img class='icon' src='icons/home-icon.png'/>";
            $('.page-name').html(icon + "<span class='active'>Home</span>");
    }
}

export function fillStats(ratingFilter, newSpeciesFilter, getFilters) {
    $(".sightings-count").html(State.data.filteredSightings.length);

    let selectedSpecies = [...new Set(State.data.filteredSightings.map(b => b.species.name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "")))];
    $(".species-count").html(selectedSpecies.length);

    (ratingFilter > 0) ? $(".rating").parent().show() : $(".rating").parent().hide();
    $(".rating").html((ratingFilter == 0) ? "All" : (ratingFilter + " +"));

    let filters = getFilters();
    if (filters.date || filters.place) {
        $(".new-species-count").parent().show();
        $(".new-species-count").html(State.data.filteredSightings.filter(b => b.newSpecies).length);
    } else {
        $(".new-species-count").parent().hide();
    }
}

export function renderStories(containerSelector = '.stories', limit = 0, targetStory = null) {
    let stories = State.data.stories || [];
    const div = $(containerSelector);
    div.empty();

    if (containerSelector === '.stories') {
        div.append('<h1>Stories</h1><hr class="heading-hr" />');
    }

    const isHomePage = containerSelector === '.home-stories';

    const generateStoryHtml = (story, index) => {
        let mediaHtml = '';
        if (story.youtubeVideoId) {
            mediaHtml = `<iframe class="youtube" src="https://tube.rvere.com/embed?v=${story.youtubeVideoId}" title="${story.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else if (story.images && story.images.length > 0) {
            story.images.forEach(img => {
                mediaHtml += `<div class="image-container"><img style="width: 100%; padding: 5px; border: 1px solid white;" src="${img}" alt="${story.title}" /></div>`;
            });
        }

        let itineraryHtml = '';
        if (story.itinerary && story.itinerary.length > 0) {
            const shouldExpand = !isHomePage || story.itineraryExpanded;
            const buttonClass = shouldExpand ? 'collpasible-section-button active' : 'collpasible-section-button';
            const contentClass = shouldExpand ? 'collapsible' : 'collapsible hide';

            const rows = story.itinerary.map(item => `<tr><td>${item.date}</td><td>${item.activity}</td></tr>`).join('');
            itineraryHtml = `<p><a class='${buttonClass}' onclick='toggleCollpasible(this)'>Itinerary</a><br /><table class='${contentClass}'>${rows}</table>`;
        } else if (story.itineraryHtml) {
            // Fallback for legacy data if any
            const shouldExpand = !isHomePage || story.itineraryExpanded;
            const buttonClass = shouldExpand ? 'collpasible-section-button active' : 'collpasible-section-button';

            itineraryHtml = `<p><a class='${buttonClass}' onclick='toggleCollpasible(this)'>Itinerary</a><br />${story.itineraryHtml}`;
        }

        let sightingsHtml = '';
        if (story.sightings && story.sightings.length > 0) {
            const links = story.sightings.map(s => {
                // Convert params object back to JS object string usage with single quotes to match original style if needed
                // or just use valid object literal syntax
                const paramsStr = JSON.stringify(s.params).replace(/"/g, "'");
                return `<a onclick="showPage('feed', ${paramsStr})">${s.text}</a>`;
            }).join(' | ');
            sightingsHtml = `<p>${links} >></p>`;
        }

        const slug = Util.slugify(story.title + " " + story.date);
        let html = `
        <div class="video" id="${slug}">
            <h1>${story.title} <a href="javascript:void(0)" onclick="copyStoryLink('${slug}')" title="Copy Link to Story">🔗</a></h1>
            <div class="date">${story.date}</div>
            <div class="story-media">
                ${mediaHtml}
            </div>
            <div class="text">
                ${story.storyHtml}
                ${sightingsHtml}
                ${itineraryHtml}
            </div>
            <hr />
        </div>
        `;
        return html;
    };

    let renderedCount = 0;
    const BATCH_SIZE = 5;
    let initialCount = BATCH_SIZE;

    if (targetStory) {
        const targetIndex = stories.findIndex(s => {
            const fullSlug = Util.slugify(s.title + " " + s.date);
            const titleSlug = Util.slugify(s.title);
            // Match exact full slug OR match title-only slug (backward compatibility/relaxed matching)
            return fullSlug === targetStory || titleSlug === targetStory;
        });
        if (targetIndex >= 0) {
            initialCount = Math.max(BATCH_SIZE, targetIndex + 1);
        }
    }

    const renderNextBatch = (forcedCount) => {
        const remainingInStories = stories.length - renderedCount;
        const remainingInLimit = limit > 0 ? (limit - renderedCount) : Infinity;
        const countToRender = Math.min(forcedCount || BATCH_SIZE, remainingInStories, remainingInLimit);

        if (countToRender <= 0) return;

        const end = renderedCount + countToRender;
        for (let i = renderedCount; i < end; i++) {
            div.append(generateStoryHtml(stories[i], i));
        }
        renderedCount = end;

        if (limit > 0 && renderedCount >= limit) return;

        div.find('.scroll-sentinel').remove();
        if (renderedCount < stories.length) {
            const sentinel = $('<div class="scroll-sentinel" style="height: 20px;"></div>');
            div.append(sentinel);

            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    observer.disconnect();
                    renderNextBatch();
                }
            });
            observer.observe(sentinel[0]);
        }
    };

    renderNextBatch(initialCount);

    if (targetStory) {
        setTimeout(() => {
            let targetEl = document.getElementById(targetStory);
            // If strict match fails, try finding by title-part match
            if (!targetEl) {
                // Find the story that matched in logic above
                const matchedStory = stories.find(s => Util.slugify(s.title) === targetStory);
                if (matchedStory) {
                    const fullSlug = Util.slugify(matchedStory.title + " " + matchedStory.date);
                    targetEl = document.getElementById(fullSlug);
                }
            }

            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        }, 500);
    }
}
