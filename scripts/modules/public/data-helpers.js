import Constants from '../constants.js';
import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import State from './state.js';

export function getSpeciesCount(sightings) {
    return [...new Set(sightings.map(b => b.species.key))].length;
}

export function computeInternalDataFields() {
    //remove hidden
    State.data.sightings = State.data.sightings.filter(b => !b.hidden);

    $.each(State.data.sightings, function (index, sighting) {
        sighting.index = index;
        //moment
        sighting.date = moment(sighting.date, Constants.DATA_DATE_FORMAT);
        sighting.dateString = sighting.date.format(Constants.DISPLAY_DATE_FORMAT);
        //tags
        sighting.species = State.data.species[sighting.species];
        sighting.species.tags = (sighting.species.tags || []).sort((a, b) => Util.compare(b.length, a.length));
        //images
        sighting.media.forEach(function (m) {
            m.src = Util.getMedia(m.src);
            if (m.thumbnail) m.thumbnail = Util.getMedia(m.thumbnail);
        });
        //new species flag
        sighting.newSpecies = (State.data.sightings.slice(index + 1).map(b => b.species).indexOf(sighting.species.key) < 0);
    });
    //add missing families
    let familyNames = State.data.families.map(f => f.name);
    State.data.families.concat(State.data.sightings.filter(b => !familyNames.includes(b.species.family)).map(function (b) { return { name: b.family }; }));
    //fix missing family images or paths
    State.data.families.forEach(function (family) {
        family.imagesrc = ((((State.data.sightings.filter(b => b.species.family == family.name) || [])[0] || {}).media || []).filter(m => m.type !== 'video')[0] || {}).src;
        family.count = State.data.sightings.filter(b => b.species.family == family).length;
    })

    //places
    if (!Object.entries(State.data.countries)[0][1].count) {
        let countries = {}
        Object.keys(State.data.countries).sort().forEach(function (countryCode) {
            countries[countryCode] = {
                name: State.data.countries[countryCode].name,
                count: getSpeciesCount(State.data.sightings.filter(b => b.country == countryCode)),
                states: {}
            };
            Object.keys(State.data.countries[countryCode].states).sort().forEach(function (stateCode) {
                countries[countryCode].states[stateCode] = {
                    name: State.data.countries[countryCode].states[stateCode].name,
                    count: getSpeciesCount(State.data.sightings.filter(b => b.state == stateCode)),
                    cities: {}
                };
                if (countries[countryCode].states[stateCode].count > 0) {
                    [...new Set(State.data.sightings.filter(b => b.country == countryCode && b.state == stateCode).map(b => b.city))].forEach(function (city) {
                        if (!city) {
                            [...new Set(State.data.sightings.filter(b => b.place && b.country == countryCode && b.state == stateCode && !b.city).map(b => b.place))].forEach(function (place) {
                                countries[countryCode].states[stateCode].cities[place] ||= { places: {} };
                                countries[countryCode].states[stateCode].cities[place].count = getSpeciesCount(State.data.sightings.filter(b => b.country == countryCode && b.state == stateCode && (b.city == place || b.place == place)));
                            });
                        } else {
                            countries[countryCode].states[stateCode].cities[city] = {
                                count: getSpeciesCount(State.data.sightings.filter(b => b.country == countryCode && b.state == stateCode && (b.city == city || !b.city && b.place == city))),
                                places: {}
                            };
                            [...new Set(State.data.sightings.filter(b => b.place && b.country == countryCode && b.state == stateCode && b.city == city).map(b => b.place))].forEach(function (place) {
                                countries[countryCode].states[stateCode].cities[city].places[place] = {
                                    count: getSpeciesCount(State.data.sightings.filter(b => b.country == countryCode && b.state == stateCode && b.city == city && b.place == place))
                                }
                            });
                        }
                    });
                }
            });
        });
        State.data.countries = countries;
    }

    //years
    State.data.years = {};
    [...new Set(State.data.sightings.map(b => b.date.format(Constants.FILTER_YEAR_FORMAT)))].forEach(function (year) {
        let yearSightings = State.data.sightings.filter(b => b.date.format(Constants.FILTER_YEAR_FORMAT) == year);
        let yearSpecies = [...new Set(yearSightings.map(b => b.species.key))];
        let oldestDate = yearSightings[0].date;
        yearSightings.forEach(b => oldestDate = (b.date < oldestDate) ? b.date : oldestDate);
        let oldSpecies = [...new Set(State.data.sightings.filter(b => b.date < oldestDate).map(b => b.species.key))];
        State.data.years[year] = {
            sighting_count: yearSightings.length,
            new_species_count: yearSpecies.filter(s => oldSpecies.indexOf(s) < 0).length
        };
    });
}

export function like(key) {
    if (!Constants.LIKE_ENABLED || State.likeLocked || State.remainingLikes <= 0) {
        console.log("like " + key + " skipped");
        return;
    }
    State.updateLikeLocked(true);

    let likes = State.data.likes || {};
    likes[key] = likes[key] || [];
    let clientId = Util.getClientId();
    let liked = false;
    if (likes[key].indexOf(clientId) >= 0) {
        likes[key] = likes[key].filter(el => el !== clientId);
    } else {
        likes[key] = likes[key].concat([clientId]);
        liked = true;
    }
    // Update data wrapper
    let newData = { ...State.data };
    newData.likes = likes;
    State.updateData(newData);

    const fileData = [JSON.stringify({ likes: likes })];
    const file = new File(fileData, State.currentMode + "-likes.json");
    FirebaseApi.getFirebase().storage().ref("data/" + State.currentMode + "-likes.json").put(file).then(() => {
        let likeDiv = jQuery(".preview-image-desc, #" + key).find(".sighting-desc.likes");
        let count = likeDiv.find("span.count").eq(0).text() * 1;
        if (liked) {
            likeDiv.find("span.count").text(count + 1);
            likeDiv.find("span.heart").removeClass("hollow");
        } else {
            likeDiv.find("span.count").text(count - 1);
            likeDiv.find("span.heart").addClass("hollow");
        }

        State.updateRemainingLikes(State.remainingLikes - 1);
        console.log("liked " + key);
        setTimeout(() => { State.updateLikeLocked(false); }, 300); // to rate limit
    }).catch(e => {
        console.log("like " + key + " failed");
        setTimeout(() => { State.updateLikeLocked(false); }, 60000); // as circuit breaker
    });
}
