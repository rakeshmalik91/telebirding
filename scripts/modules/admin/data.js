import Constants from '../constants.js';
import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import { showOverlay } from '../ui-helpers.js';

export let data = {};
export const currentMode = Util.getUrlParams().mode || Constants.MODE_BIRD;
export let lastUpdatedSpecies = (currentMode == Constants.MODE_INSECT) ? "unidentified" : 'rock-pigeon';

const IMAGE_SIZE = 1000;
const SYNC_SCHEDULE_TIME = 60000;
let syncRef;

let renderCallback = () => { };

export function setRenderCallback(callback) {
    renderCallback = callback;
}

export function refreshData() {
    Util.clearFileCache();
    data = {};
    Util.readJSONFiles([
        Util.getData("data/" + currentMode + "-sightings.json"),
        Util.getData("data/" + currentMode + "-species.json"),
        Util.getData("data/" + currentMode + "-families.json"),
        Util.getData("data/" + currentMode + "-likes.json"),
        Util.getData("data/places.json")
    ], function (json) {
        data = json;
        renderCallback();
        $(".overlay").hide();
    });
}

function refresh() {
    refreshData();
}

export function uploadJSONData(type) {
    showOverlay("Saving");
    let fileData = {};
    fileData[type] = data[type];

    fileData = JSON.stringify(fileData);
    if (fileData.length < 100) {
        alert("Unknown error while uploading (file data too small) ...");
        return;
    }
    fileData = [fileData];


    const file = new File(fileData, type + ".json");
    firebase.storage().ref("data/" + currentMode + "-" + type + ".json").put(file).then(() => {
        console.log("uploaded data/" + currentMode + "-" + type + ".json");
        refresh();
    }).catch(e => {
        alert(e.message);
        $(".overlay").hide();
    });
}

export function backup() {
    showOverlay("Backing up...");
    console.log("Backing up...");
    let backedUp = 0;
    const date = moment(Date.now()).format(Constants.BACKUP_DATE_FORMAT);
    const filesToBackup = ["species", "families", "sightings", "likes"];
    for (const file of filesToBackup) {
        let fileData = {};
        fileData[file] = data[file];
        const fileName = currentMode + "-" + file + ".json";
        FirebaseApi.getFirebase().storage()
            .ref("backup/" + date + "/" + fileName)
            .put(new File(JSON.stringify(fileData, null, '\t').split('\n').map(l => l + '\n'), fileName))
            .then(() => {
                if (++backedUp == filesToBackup.length) {
                    refresh();
                    console.log("Backup completed");
                }
            });
    }
}


export function syncSightingsData(scheduleAfter) {
    $('.save').removeAttr("disabled");
    clearTimeout(syncRef);
    syncRef = setTimeout(function () {
        uploadJSONData('sightings');
        syncRef = undefined;
        $('.save').attr("disabled", "disabled");
    }, scheduleAfter);
}

export function uploadMedia(sightingKey, files) {
    showOverlay("Uploading Media");
    let watermark = null;
    if ($('input[name=watermark-on]').is(":checked")) {
        watermark = {
            text: $('input[name=watermark]').val().replace("${author}", (data.sightings.filter(b => b.key == sightingKey)[0].author || Constants.DEFAULT_AUTHOR)).trim(),
            color: $('input[name=watermark-color]').val() + "33"
        };
    }
    Array.from(files).forEach(function (file) {
        let mediaSrc;
        if (file.type.match(/image.*/)) {
            const speciesKey = data.species[data.sightings.filter(b => b.key == sightingKey)[0].species].key;
            mediaSrc = 'images/' + speciesKey + "-" + Math.floor(Date.now() / 1000) + ".jpg";
            console.log("uploading image " + file.name + " for " + sightingKey + " as " + mediaSrc);
            Util.resizeImage(file, IMAGE_SIZE, watermark).then((resizedImage) => {
                firebase.storage().ref(mediaSrc).put(resizedImage).then(() => {
                    console.log("uploaded image " + mediaSrc);
                    data.sightings.forEach(function (sighting) {
                        if (sighting.key == sightingKey) {
                            sighting.media.push({
                                src: mediaSrc
                            });
                        }
                    });
                    syncSightingsData(0);
                }).catch(e => {
                    alert(e.message + "\n (Possible reason: Unsupported media or Invalid media file size)");
                    $(".overlay").hide();
                });
            });
        }
    });
}

export function deleteMedia(sightingKey, mediaSrc) {
    if (!mediaSrc.toLowerCase().endsWith(".jpg")) {
        alert("Unsupported!!!");
        return;
    }
    if (confirm("You are about to delete this media.")) {
        showOverlay("Deleting Media");
        data.sightings.forEach(function (sighting) {
            if (sighting.key != sightingKey) return;
            sighting.media = sighting.media.filter(m => m.src != mediaSrc);
        });
        firebase.storage().ref(mediaSrc).delete().then(() => {
            syncSightingsData(0);
        }, (error) => {
            if (error.code === 'storage/object-not-found') {
                syncSightingsData(0);
            } else {
                alert(error.message);
            }
        })
    }
}

export function moveMediaLeft(sightingKey, mediaSrc) {
    data.sightings.forEach(function (sighting) {
        if (sighting.key != sightingKey) return;
        let index = sighting.media.map(m => m.src).indexOf(mediaSrc);
        if (index > 0) {
            sighting.media = [sighting.media.slice(0, index - 1), [sighting.media[index]], [sighting.media[index - 1]], sighting.media.slice(index + 1)].flat();
            syncSightingsData(0);
            return;
        }
    });
}

export function updateField(sightingKey, field, value) {
    data.sightings.forEach(function (sighting) {
        if (sighting.key != sightingKey) return;
        if (field == 'date') {
            sighting[field] = moment(value, 'yyyy-mm-DD').format('DD-mm-yyyy');
        } else if (field == 'hidden') {
            sighting[field] = !value;
        } else {
            sighting[field] = value;
        }
    });
    syncSightingsData(SYNC_SCHEDULE_TIME);
}

export function updateMediaProperty(sightingKey, mediaSrc, property, value) {
    data.sightings.forEach(function (sighting) {
        if (sighting.key != sightingKey) return;
        sighting.media.forEach(media => {
            if (media.src == mediaSrc) {
                media[property] = value;
            }
        });
    });
    syncSightingsData(SYNC_SCHEDULE_TIME);
}

export function addSighting(filterSightingVal) {
    data.sightings.unshift({
        "key": ("s" + Math.floor(Date.now() / 1000)),
        "species": lastUpdatedSpecies,
        "date": (data.sightings[0] || {}).date || moment(Date.now()).format(Constants.DATA_DATE_FORMAT),
        "place": (data.sightings[0] || {}).place,
        "city": (data.sightings[0] || {}).city || "Howrah",
        "state": (data.sightings[0] || {}).state || "West Bengal",
        "country": (data.sightings[0] || {}).country || "India",
        "author": (data.sightings[0] || {}).author || Constants.DEFAULT_AUTHOR,
        "unconfirmed": false,
        "time_of_day": "Day",
        "weather": (data.sightings[0] || {}).weather || null,
        "hidden": true,
        "media": []
    });
    syncSightingsData(0);
}


export function deleteSighting(sightingKey) {
    if (confirm("You are about to delete this sighting.")) {
        data.sightings.filter(b => b.key == sightingKey)[0].media.forEach(function (media) {
            deleteMedia(sightingKey, media.src);
        });
        data.sightings = data.sightings.filter(b => b.key != sightingKey);
        syncSightingsData(0);
    }
}

export function saveSpecies(key, name, tags, family, latin_name, ebird_code) {
    if (!name || !tags || !family) {
        alert("All fields are mandatory");
    } else {
        name = name.replaceAll("’", "'");
        const newKey = key || name.toLowerCase().replaceAll(/\s+/ig, "-").replaceAll('\'', "");
        tags = tags.replaceAll("’", "'");
        data.species[newKey] = {
            key: newKey,
            name: name,
            tags: tags.split(/\s*,\s*/ig),
            family: family,
            latin_name: (latin_name ? latin_name.toLowerCase().trim() : null),
            ebird_code: (ebird_code || null)
        };
        data.species = Object.fromEntries(Object.entries(data.species).sort());
        uploadJSONData("species");
        lastUpdatedSpecies = newKey;
    }
}

export function addFamily(name) {
    if (!name) {
        alert("Name is mandatory");
    } else {
        data.families = data.families.filter(f => f.name != name);
        if (name.trim()) {
            data.families.push({
                name: name
            });
        }
        data.families = data.families.sort((f1, f2) => f1.name.localeCompare(f2.name));
        uploadJSONData("families");
    }
}

export function moveSighting(sightingKey, value) {
    let sighting = data.sightings.filter(b => b.key == sightingKey)[0];
    let index = data.sightings.map(b => b.key).indexOf(sightingKey);
    if (value > 0 && index < data.sightings.length - value) { // move down
        data.sightings = [data.sightings.slice(0, index), data.sightings.slice(index + 1, index + value + 1), [sighting], data.sightings.slice(index + value + 1)].flat();
        syncSightingsData(0);
    } else if (value < 0 && index >= value) { // move up
        data.sightings = [data.sightings.slice(0, index + value), [sighting], data.sightings.slice(index + value, index), data.sightings.slice(index + 1)].flat();
        syncSightingsData(0);
    }
}

export function sortByDate() {
    data.sightings.sort((a, b) => Util.compare(moment(b.date, Constants.DATA_DATE_FORMAT), moment(a.date, Constants.DATA_DATE_FORMAT)));
    syncSightingsData(0);
}

export function sightingMatches(sighting, searchKey) {
    searchKey = searchKey.toLowerCase().trim();
    if (searchKey == "hidden") {
        return sighting.hidden;
    } else if (searchKey == "unconfirmed") {
        return sighting.unconfirmed;
    } else if (searchKey.match(/^rating=/i)) {
        return sighting.rating == searchKey.split("=")[1] || 0;
    }
    return sighting.key.indexOf(searchKey) >= 0
        || data.species[sighting.species].name.toLowerCase().indexOf(searchKey) >= 0
        || data.species[sighting.species].tags.map(t => t.toLowerCase().indexOf(searchKey) >= 0).reduce((a, b) => a || b)
        || (sighting.place && sighting.place.toLowerCase().indexOf(searchKey) >= 0)
        || (sighting.city && sighting.city.toLowerCase().indexOf(searchKey) >= 0)
        || sighting.state.toLowerCase().indexOf(searchKey) >= 0
        || sighting.country.toLowerCase().indexOf(searchKey) >= 0
        || (sighting.variation && sighting.variation.toLowerCase().indexOf(searchKey) >= 0)
        || (sighting.subspecies && sighting.subspecies.toLowerCase().indexOf(searchKey) >= 0)
        || (sighting.plumage && sighting.plumage.toLowerCase().indexOf(searchKey) >= 0)
        || (sighting.age && sighting.age.toLowerCase().indexOf(searchKey) >= 0);
}

export function getCurrentMode() {
    return currentMode;
}
