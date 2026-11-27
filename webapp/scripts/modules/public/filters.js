import Util from '../util.js';
import Constants from '../constants.js';
import { Autocomplete } from './autocomplete.js';
import State from './state.js';
import { removePreviewImage } from './preview.js';
import { updateMobileFilterToggleBadge, syncDesktopHeaderHeight, updateSortToggleLabel } from './ui-helpers.js';

export function filterAndSortData(filter, params) {
    removePreviewImage();

    if (params && params.family) {
        State.updateSightingFamilyFilter(params.family);

        //remove other filters
        $(".filter input").removeClass("button-active").val("");
    } else {
        State.updateSightingFamilyFilter(null);
    }

    State.data.filter = JSON.parse(JSON.stringify(filter));
    State.data.sort = JSON.parse(JSON.stringify(State.sort));

    let filteredSightings = State.data.sightings;

    //filter only new species
    if (!filter.date && !filter.place) {
        State.updateNewSpeciesFilter(false);
        setNewSpeciesFilterState();
    }
    if (State.newSpeciesFilter) {
        filteredSightings = filteredSightings.filter(b => b.newSpecies);
    }

    //family filter
    if (State.sightingFamilyFilter) {
        filteredSightings = filteredSightings.filter(b => (b.species?.family || '').toLowerCase() == State.sightingFamilyFilter.toLowerCase());
    }

    //sighting filter
    if (filter.sighting) {
        filteredSightings = filteredSightings.filter(b => {
            const name = b.species?.name || '';
            const family = b.species?.family || '';
            const tags = b.species?.tags || [];
            return Util.tagMatchesSubstring(name, filter.sighting)
                || Util.tagMatches(name, filter.sighting)
                || (family && (Util.tagMatches(family, filter.sighting) || Util.tagMatchesSubstring(family, filter.sighting)))
                || (tags.length > 0 && tags.some(t => Util.tagMatches(t, filter.sighting) || Util.tagMatchesSubstring(t, filter.sighting)));
        });
    }

    //place filter
    if (filter.place) {
        const placesRegex = '\\b(' + filter.place.toLowerCase().replaceAll(',\\s*', '|') + ')\\b';
        const places = filter.place.toLowerCase().split(/,\\s*/);
        filteredSightings = filteredSightings.filter(b =>
            b.place && b.place.toLowerCase().match(placesRegex)
            || b.city && places.indexOf(b.city.toLowerCase()) >= 0
            || b.state && (places.indexOf(b.state.toLowerCase()) >= 0 || places.indexOf(Util.getStateFullName(b.country, b.state, State.data.countries).toLowerCase()) >= 0)
            || b.country && (places.indexOf(b.country.toLowerCase()) >= 0 || places.indexOf(Util.getCountryFullName(b.country, State.data.countries).toLowerCase()) >= 0)
        );
    }

    //date filter
    if (filter.date) {
        filteredSightings = filteredSightings.filter(b => b.dateString.match('.*\\b' + filter.date));
    }

    //rating filter
    if (State.ratingFilter) {
        filteredSightings = filteredSightings.filter(b => (b.rating || 0) >= State.ratingFilter);
    }

    //trip_id filter (URL/state only, not visible as filter on UI)
    const tripIdFilter = (params && params.trip_id !== undefined ? params.trip_id : (filter && filter.trip_id)) || State.tripIdFilter || '';
    if (tripIdFilter) {
        const tripIdLower = String(tripIdFilter).trim().toLowerCase();
        filteredSightings = filteredSightings.filter(b => b.trip_id && String(b.trip_id).trim().toLowerCase() === tripIdLower);
    }

    //camera_model filter
    if (filter.camera_model) {
        filteredSightings = filteredSightings.filter(b => b.media && b.media.some(m => {
            const rawModel = (m.camera_model || (m.exif_data && m.exif_data.camera_model) || '').toLowerCase();
            if (rawModel.includes(filter.camera_model.toLowerCase())) return true;

            // Check resolved names from mapping (e.g. S7RV -> Sony α7rmV)
            const resolvedModel = Util.resolveCameraModel(rawModel, State.data.camera_model);
            return resolvedModel.toLowerCase().includes(filter.camera_model.toLowerCase());
        }));
    }

    //sort
    switch (State.sort.by) {
        case 'name':
            filteredSightings.sort((a, b) => (State.sort.descending ? -1 : 1) * Util.compare(a.species.name, b.species.name, Util.compare(a.key, b.key)));
            break;
        case 'rating':
            filteredSightings.sort((a, b) => (State.sort.descending ? -1 : 1) * Util.compare(Number(a.rating) || 0, Number(b.rating) || 0, Util.compare(b.index, a.index)));
            break;
        case 'shuffle':
            filteredSightings = Util.shuffle(filteredSightings);
            break;
        default:
            filteredSightings.sort((a, b) => (State.sort.descending ? -1 : 1) * Util.compare(a[State.sort.by], b[State.sort.by], Util.compare(b.index, a.index)));
            break;
    }

    // Place pinned sightings at top regardless of sorting, while preserving the active sort order among themselves
    const pinnedSightings = filteredSightings.filter(b => b.pinned);
    const unpinnedSightings = filteredSightings.filter(b => !b.pinned);
    filteredSightings = [...pinnedSightings, ...unpinnedSightings];

    // Update data wrapper with filtered result
    State.data.filteredSightings = filteredSightings;

    //clear right panel for recalculation
    $(".right-pane").html('');
}

export function triggerFilter(type, value) {
    if (type == 'place' && State.currentPage == Constants.MAP_MENU) {
        if (window.showPage) window.showPage('map', { place: value });
        setFilter(type, value);
    } else if (type == 'rating') {
        State.updateRatingFilter(value || 0);
        if (window.showPage) window.showPage(State.currentPage, { rating: value });
    } else {
        if ($('.filter').length) {
            setFilter(type, value);
            filterOnChange(type);
        }
        if (window.hideRightPane) window.hideRightPane();
    }
}

const TRIP_MONTH_TOKENS = new Set(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']);
const TRIP_UPPERCASE_TOKENS = new Set(['lrk', 'dnp']);

export function formatTripIdForDisplay(tripId) {
    if (!tripId) return '';
    const tokens = String(tripId).trim().split('-').filter(Boolean);
    if (!tokens.length) return '';

    const firstDateIdx = tokens.findIndex(t => TRIP_MONTH_TOKENS.has(t.toLowerCase()) || /^\d{4}$/.test(t));
    const formatPlaceToken = (t) => {
        const lower = t.toLowerCase();
        if (TRIP_UPPERCASE_TOKENS.has(lower)) return lower.toUpperCase();
        return Util.capitalize(lower);
    };

    if (firstDateIdx <= 0) {
        return tokens.map(formatPlaceToken).join(' ');
    }

    const placePart = tokens.slice(0, firstDateIdx).map(formatPlaceToken).join(' ');
    const dateTokens = tokens.slice(firstDateIdx);
    const yearTokens = dateTokens.filter(t => /^\d{4}$/.test(t));
    const monthTokens = dateTokens.filter(t => !/^\d{4}$/.test(t)).map(t => Util.capitalize(t.toLowerCase()));

    const datePart = [monthTokens.join('-'), yearTokens.join(' ')].filter(Boolean).join(' ');
    return datePart ? `${placePart}, ${datePart}` : placePart;
}

export function updateActiveFilterBadges() {
    const sighting = getFilter('sighting');
    const place = getFilter('place');
    const date = getFilter('date');
    const rating = State.ratingFilter || 0;
    const family = State.sightingFamilyFilter || '';
    const tripId = State.tripIdFilter || '';

    const $nameBadge = $('.name-filter-badge');
    const $placeBadge = $('.place-filter-badge');
    const $familyBadge = $('.family-filter-badge');
    const $tripBadge = $('.trip-filter-badge');
    const $dateBadge = $('.date-filter');
    const $ratingBadge = $('.rating-filter');

    if ($nameBadge.length) {
        if (sighting) {
            $nameBadge.removeClass('hidden').addClass('active button-active').html(sighting);
            $nameBadge.closest('.filter-name-component').addClass('has-active-filter');
        } else {
            $nameBadge.addClass('hidden').removeClass('active button-active').empty();
            $nameBadge.closest('.filter-name-component').removeClass('has-active-filter');
        }
    }

    if ($placeBadge.length) {
        if (place) {
            $placeBadge.removeClass('hidden').addClass('active button-active').html(place);
            $placeBadge.closest('.filter-location-component').addClass('has-active-filter');
            $('.filter-panel').addClass('has-place-filter');
        } else {
            $placeBadge.addClass('hidden').removeClass('active button-active').empty();
            $placeBadge.closest('.filter-location-component').removeClass('has-active-filter');
            $('.filter-panel').removeClass('has-place-filter');
        }
    }

    if ($familyBadge.length) {
        if (family) {
            $familyBadge.removeClass('hidden').addClass('active button-active').html(family);
            $familyBadge.closest('.filter-family-component').addClass('has-active-filter');
            $('.filter-panel').addClass('has-family-filter');
        } else {
            $familyBadge.addClass('hidden').removeClass('active button-active').empty();
            $familyBadge.closest('.filter-family-component').removeClass('has-active-filter');
            $('.filter-panel').removeClass('has-family-filter');
        }
    }

    if ($tripBadge.length) {
        if (tripId) {
            $tripBadge.removeClass('hidden').addClass('active button-active').text(formatTripIdForDisplay(tripId));
            $tripBadge.closest('.filter-trip-component').addClass('has-active-filter');
            $('.filter-panel').addClass('has-trip-filter');
        } else {
            $tripBadge.addClass('hidden').removeClass('active button-active').empty();
            $tripBadge.closest('.filter-trip-component').removeClass('has-active-filter');
            $('.filter-panel').removeClass('has-trip-filter');
        }
    }

    if ($dateBadge.length) {
        if (date) {
            $dateBadge.removeClass('hidden').addClass('active button-active').html(date);
            $('.filter-date-component').addClass('active');
            $('.filter-panel').addClass('has-date-filter');
        } else {
            $dateBadge.addClass('hidden').removeClass('active button-active');
            $('.filter-date-component').removeClass('active');
            $('.filter-panel').removeClass('has-date-filter');
        }
    }

    if ($ratingBadge.length) {
        if (rating > 0) {
            $ratingBadge.removeClass('hidden').addClass('active button-active').show();
            $ratingBadge.find('.rating-label').html('Grade:&nbsp;');
            $ratingBadge.find('.rating').html(rating + '+');
            $('.filter-rating-component').addClass('active has-active-filter');
            $('.filter-panel').addClass('has-rating-filter');
        } else {
            $ratingBadge.addClass('hidden').removeClass('active button-active').hide();
            $ratingBadge.find('.rating').empty();
            $('.filter-rating-component').removeClass('active has-active-filter');
            $('.filter-panel').removeClass('has-rating-filter');
        }
    }

    if (sighting || place || date || rating > 0 || family || tripId) {
        $('.filter-panel').addClass('has-active-filters');
    } else {
        $('.filter-panel').removeClass('has-active-filters');
    }

    if (typeof syncDesktopHeaderHeight === 'function') {
        syncDesktopHeaderHeight();
    }
}

export function filterOnChange(type) {
    let value = $('.filter input[data-value=' + type + ']')[0].value
    if (value != "") $(".filter input[data-value='" + type + "']").addClass("button-active").val(Util.capitalize(value).trim());
    else $(".filter input[data-value='" + type + "']").removeClass("button-active");
    updateActiveFilterBadges();
    refresh();
}

// Helper refresh
function refresh() {
    if (window.showPage) window.showPage(State.currentPage);
}

export function getFilter(type) {
    if ($('.filter input[data-value=' + type + ']').length) {
        return $('.filter input[data-value=' + type + ']')[0].value;
    } else {
        const urlParams = Util.getUrlParams();
        if (urlParams[type]) return decodeURIComponent(urlParams[type]);
    }
}

export function getFilters() {
    return {
        sighting: getFilter('sighting') || '',
        place: getFilter('place') || '',
        date: getFilter('date') || '',
        camera_model: getFilter('camera_model') || '',
        trip_id: State.tripIdFilter || getFilter('trip_id') || '',
        newspecies: State.newSpeciesFilter,
        rating: State.ratingFilter
    };
}

export function setFilter(type, value) {
    if (type == 'rating') {
        State.updateRatingFilter(value || 0);
    } else if (type == 'trip_id') {
        State.updateTripIdFilter(value ? String(value).trim() : null);
    } else {
        const input = $(".filter input[data-value='" + type + "']");
        if (input.length) {
            input[0].value = value ? value : null;
            if (value) {
                input.addClass("button-active");
                input.next("button").removeClass("hidden");
                if (type == 'date') {
                    input.next("button").addClass("button-active").html(value);
                    input.closest(".filter-date-component").addClass("active");
                    $(".filter-panel").addClass("has-date-filter");
                }
            } else {
                input.removeClass("button-active");
                if (type == 'date') {
                    input.next("button").addClass("hidden");
                    input.closest(".filter-date-component").removeClass("active");
                    $(".filter-panel").removeClass("has-date-filter");
                }
            }
        }
    }
    updateActiveFilterBadges();
    if (typeof updateMobileFilterToggleBadge === 'function') {
        updateMobileFilterToggleBadge();
    }
}

export function setFilters(filter) {
    if (filter) {
        setFilter('sighting', filter.sighting);
        setFilter('place', filter.place);
        setFilter('date', filter.date);
        setFilter('rating', filter.rating);
        setFilter('camera_model', filter.camera_model);
        setFilter('trip_id', filter.trip_id);
    }
}

export function clearFilter(type) {
    const $input = $(".filter input[data-value='" + type + "']");
    if ($input.length) {
        $input.removeClass("button-active").val("");
        if (type == 'date') {
            $input.next("button").addClass("hidden");
            $input.closest(".filter-date-component").removeClass("active");
            $(".filter-panel").removeClass("has-date-filter");
        }
        if (type == 'place' && State.currentPage === Constants.MAP) {
            if (window.showPage) window.showPage(Constants.MAP_MENU);
        } else {
            refresh();
        }
        updateActiveFilterBadges();
        if (typeof updateMobileFilterToggleBadge === 'function') {
            updateMobileFilterToggleBadge();
        }
        if ($input.is(':visible')) $input.focus();
    }
}

export function clearFamilyFilter() {
    State.updateSightingFamilyFilter(null);
    updateActiveFilterBadges();
    if (typeof updateMobileFilterToggleBadge === 'function') {
        updateMobileFilterToggleBadge();
    }
    if (window.showPage) {
        window.showPage(Constants.EXPLORE_MENU);
    }
}

export function clearTripFilter() {
    State.updateTripIdFilter(null);
    updateActiveFilterBadges();
    if (typeof updateMobileFilterToggleBadge === 'function') {
        updateMobileFilterToggleBadge();
    }
    if (window.showPage) {
        window.showPage(State.currentPage, { ...getFilters(), trip_id: '' });
    }
}

export function sortByOnChange(value) {
    $(".sortby button[data-value]").removeClass("button-active");
    $(".sortby button[data-value='" + value + "']").addClass("button-active");
    let newSort = { ...State.sort };
    if (newSort.by != value) {
        newSort.descending = (value !== 'name');
    } else {
        newSort.descending = !newSort.descending;
    }
    newSort.by = value;
    if (newSort.descending) {
        $(".sortby button[data-value='" + value + "'] span.order").addClass('desc').removeClass('asc');
    } else {
        $(".sortby button[data-value='" + value + "'] span.order").removeClass('desc').addClass('asc');
    }
    State.updateSort(newSort);
    $('.sortby').removeClass('sortby-open');
    updateSortToggleLabel();
    refresh();
}

export function setSort(newSort) {
    State.updateSort(newSort);
    $(".sortby button[data-value]").removeClass("button-active");
    $(".sortby button[data-value='" + newSort.by + "']").addClass("button-active");
    if (newSort.descending) {
        $(".sortby button[data-value='" + newSort.by + "'] span.order").addClass('desc').removeClass('asc');
    } else {
        $(".sortby button[data-value='" + newSort.by + "'] span.order").removeClass('desc').addClass('asc');
    }
    updateSortToggleLabel();
}

export function setNewSpeciesFilterState() {
    if (State.newSpeciesFilter) {
        $('.newspeciesfilter').addClass('active');
    } else {
        $('.newspeciesfilter').removeClass('active');
    }
}

export function toggleNewSpeciesFilter() {
    State.updateNewSpeciesFilter(!State.newSpeciesFilter);
    setNewSpeciesFilterState();
    refresh();
}

export function resetRatingFilter() {
    if (State.ratingFilter != 0) State.updateRatingFilter(0);
    updateActiveFilterBadges();
    if (typeof updateMobileFilterToggleBadge === 'function') {
        updateMobileFilterToggleBadge();
    }
    refresh();
}

let sightingAutocompleteInstance = null;
let placeAutocompleteInstance = null;

export function initAutocomplete() {
    var sightingAutocomplete = [];
    var placeAutocomplete = [];

    // Sighting autocomplete
    $.each(State.data.sightings, function (i, sighting) {
        if (sighting.species && sighting.species.name) {
            sightingAutocomplete.push(sighting.species.name);
        }
        if (sighting.species && sighting.species.tags) {
            sightingAutocomplete = sightingAutocomplete.concat(sighting.species.tags.map(t => Util.capitalize(t)));
        }
    });

    // Place autocomplete
    $.each(State.data.sightings, function (i, sighting) {
        const components = [
            sighting.place,
            sighting.city,
            sighting.state,
            Util.getStateFullName(sighting.country, sighting.state, State.data.countries),
            Util.getCountryFullName(sighting.country, State.data.countries)
        ];
        // Filter out null/undefined and empty strings
        placeAutocomplete = placeAutocomplete.concat(components.filter(e => e));

        // Original logic also split place by comma
        if (sighting.place) {
            placeAutocomplete.push(sighting.place.split(",")[0]);
        }
        if (sighting.city) {
            placeAutocomplete.push(Util.capitalize(sighting.city.trim()));
        }
    });

    // De-duplicate and sort
    sightingAutocomplete = [...new Set(sightingAutocomplete.map(b => Util.capitalize(b.replaceAll('-', ' '))).filter(n => n))].sort();
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

    State.updateAutocompleteInitialized(true);
}
