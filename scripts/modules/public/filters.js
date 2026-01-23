import Util from '../util.js';
import Constants from '../constants.js';
import { Autocomplete } from './autocomplete.js';
import State from './state.js';
import { removePreviewImage } from './preview.js';

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
        filteredSightings = filteredSightings.filter(b => b.species.family.toLowerCase() == State.sightingFamilyFilter.toLowerCase());
    }

    //sighting filter
    if (filter.sighting) {
        filteredSightings = filteredSightings.filter(b =>
            Util.tagMatchesSubstring(b.species.name, filter.sighting)
            || Util.tagMatches(b.species.name, filter.sighting)
            || b.species.family.toLowerCase() == filter.sighting.toLowerCase()
            || b.species.tags && b.species.tags.some(t => Util.tagMatches(t, filter.sighting))
        );
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

    //sort
    switch (State.sort.by) {
        case 'name':
            filteredSightings.sort((a, b) => (State.sort.descending ? -1 : 1) * Util.compare(a.species.name, b.species.name, Util.compare(a.key, b.key)));
            break;
        case 'shuffle':
            filteredSightings = Util.shuffle(filteredSightings);
            break;
        default:
            filteredSightings.sort((a, b) => (State.sort.descending ? -1 : 1) * Util.compare(a[State.sort.by], b[State.sort.by], Util.compare(b.index, a.index)));
            break;
    }

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
        if ($('.filter').is(':visible')) {
            setFilter(type, value);
            filterOnChange(type);
        }
        if (window.hideRightPane) window.hideRightPane();
    }
}

export function filterOnChange(type) {
    let value = $('.filter input[data-value=' + type + ']')[0].value
    if (value != "") $(".filter input[data-value='" + type + "']").addClass("button-active").val(Util.capitalize(value).trim());
    else $(".filter input[data-value='" + type + "']").removeClass("button-active");
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
        newspecies: State.newSpeciesFilter,
        rating: State.ratingFilter
    };
}

export function setFilter(type, value) {
    if (type == 'rating') {
        State.updateRatingFilter(value || 0);
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

export function setFilters(filter) {
    if (filter) {
        setFilter('sighting', filter.sighting);
        setFilter('place', filter.place);
        setFilter('date', filter.date);
        setFilter('rating', filter.rating);
    }
}

export function clearFilter(type) {
    if ($(".filter").is(':visible')) {
        $(".filter input[data-value='" + type + "']").removeClass("button-active").val("");
        if (type == 'date') {
            $(".filter input[data-value='" + type + "'] + button").addClass("hidden");
        }
        refresh();
        $(".filter input[data-value='" + type + "']").focus();
    }
}

export function sortByOnChange(value) {
    $(".sortby button").removeClass("button-active");
    $(".sortby button[data-value='" + value + "']").addClass("button-active");
    let newSort = { ...State.sort };
    if (newSort.by != value) {
        newSort.descending = (newSort.by != "date");
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
    refresh();
}

export function setSort(newSort) {
    State.updateSort(newSort);
    $(".sortby button").removeClass("button-active");
    $(".sortby button[data-value='" + newSort.by + "']").addClass("button-active");
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
