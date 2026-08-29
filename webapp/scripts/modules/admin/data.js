import Constants from '../constants.js';
import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import { showLoader, hideLoader } from '../loader.js';
import { UndoRedoManager } from './history.js';
import { lookupLocation, geoService, fetchStatesForCountry } from '../geo-service.js';

export let data = {};
export let loadedEtags = {};
export let currentMode = Util.getUrlParams().mode || Constants.MODE_BIRD;
export function setCurrentMode(mode) {
    currentMode = mode;
}
export let lastUpdatedSpecies = (currentMode == Constants.MODE_INSECT) ? "unidentified" : 'rock-pigeon';

export const historyManager = new UndoRedoManager(50);
historyManager.onChange = (canUndo, canRedo) => {
    $('#undo-btn').prop('disabled', !canUndo);
    $('#redo-btn').prop('disabled', !canRedo);
};

let isCommitPending = false;
let preChangeSnapshot = null;
export function snapshotSightings() {
    if (!preChangeSnapshot && data.sightings) {
        preChangeSnapshot = JSON.parse(JSON.stringify(data.sightings));
    }
}

export function commitSightingsChange() {
    if (!isCommitPending && preChangeSnapshot) {
        isCommitPending = true;
        queueMicrotask(() => {
            if (preChangeSnapshot && data.sightings) {
                historyManager.pushState(preChangeSnapshot, data.sightings);
                preChangeSnapshot = null;
            }
            isCommitPending = false;
        });
    }
}

export function undoSighting() {
    if (data.sightings) {
        data.sightings = historyManager.undo(data.sightings);
        renderCallback();
        syncSightingsData(SYNC_SCHEDULE_TIME, true);
    }
}

export function redoSighting() {
    if (data.sightings) {
        data.sightings = historyManager.redo(data.sightings);
        renderCallback();
        syncSightingsData(SYNC_SCHEDULE_TIME, true);
    }
}

const IMAGE_SIZE = 1000;
const SYNC_SCHEDULE_TIME = 3000;
let syncRef;

import { removeUnwantedValues, applySpeciesTags } from './data-cleanup.js';
import { customAlert, customConfirm, showToast } from './ui.js';


let renderCallback = () => { };

export function setRenderCallback(callback) {
    renderCallback = callback;
}

export function triggerRender() {
    renderCallback();
}

export function refreshData() {
    showLoader("refresh", "Loading Data...");
    Util.clearFileCache();
    data = {};
    historyManager.resetMemory();
    preChangeSnapshot = null;
    Util.readJSONFiles([
        Util.getData("data/" + currentMode + "-sightings.json"),
        Util.getData("data/" + currentMode + "-species.json"),
        Util.getData("data/" + currentMode + "-families.json"),
        Util.getData("data/" + currentMode + "-likes.json"),
        Util.getData("data/places.json"),
        Util.getData("data/site-data.json")
    ], function (json) {
        data = json;
        for (let key in data) {
            let fileData = {};
            fileData[key] = data[key];
            fileData = removeUnwantedValues(fileData) || {};
            lastUploadedData[key] = JSON.stringify(fileData);
            
            if (Constants.ADMIN_USE_ETAG && ['sightings', 'species', 'families', 'likes'].includes(key)) {
                FirebaseApi.getFirebase().storage().ref("data/" + currentMode + "-" + key + ".json").getMetadata().then(metadata => {
                    loadedEtags[key] = metadata.generation;
                    if (key === 'sightings') {
                        historyManager.loadFromStorage(metadata.generation);
                    }
                }).catch(e => {
                    if (key === 'sightings') historyManager.loadFromStorage(null);
                });
            } else if (!Constants.ADMIN_USE_ETAG && key === 'sightings') {
                historyManager.loadFromStorage(null);
            }
        }
        if (data.sightings) {
            data.sightings.forEach(s => s.media = s.media || []);
        }
        const scrollY = window.scrollY;
        renderCallback();
        window.scrollTo(0, scrollY);
        hideLoader("refresh");
    });
}

function refresh() {
    refreshData();
}

let isUploading = {};
let pendingUpload = {};
export let lastUploadedData = {};

export function uploadJSONData(type, skipRefresh) {
    if (isUploading[type]) {
        if (pendingUpload[type] !== undefined) {
            pendingUpload[type] = pendingUpload[type] && skipRefresh;
        } else {
            pendingUpload[type] = skipRefresh;
        }
        return;
    }
    isUploading[type] = true;

    $('.save').text('Saving...').attr('disabled', 'disabled');
    $('#sync-spinner').css('display', 'flex');
    $('#sync-spinner .sync-text').text('Saving...');
    $('#sync-spinner-icon').show();

    // --- Pre-upload cleanup (ported from data-cleanup.py) ---
    // Apply species-specific tag rules when uploading species data
    if (type === 'species' && data[type]) {
        applySpeciesTags(data[type]);
    }

    let fileData = {};
    if (type === 'places') {
        fileData = { countries: data.countries };
    } else {
        fileData[type] = data[type];
    }

    // Remove unwanted values (null, false, [], "", {}) before upload
    fileData = removeUnwantedValues(fileData) || {};

    fileData = JSON.stringify(fileData);

    if (fileData === lastUploadedData[type]) {
        console.log("No changes detected for " + type + ", skipping upload.");
        isUploading[type] = false;
        
        if (pendingUpload[type] !== undefined) {
            delete pendingUpload[type];
        }

        if (!skipRefresh) renderCallback();
        if (!hasUnsavedChanges()) {
            $('.save').text('Saved!');
            $('#sync-spinner .sync-text').text('Saved!');
            $('#sync-spinner-icon').hide();
            setTimeout(() => { 
                if ($('.save').first().text() === 'Saved!') $('.save').text('Save'); 
                if ($('#sync-spinner .sync-text').text() === 'Saved!') $('#sync-spinner').fadeOut(300);
            }, 2000);
        }
        return;
    }

    if (fileData.length < 100) {
        customAlert("Unknown error while uploading (file data too small) ...");
        isUploading[type] = false;
        $('.save').text('Error').removeAttr('disabled');
        $('#sync-spinner .sync-text').text('Error');
        $('#sync-spinner-icon').hide();
        setTimeout(() => { 
            if ($('#sync-spinner .sync-text').text() === 'Error') $('#sync-spinner').fadeOut(300);
        }, 2000);
        return;
    }
    lastUploadedData[type] = fileData;
    fileData = [fileData];

    const fileName = (type === 'places') ? "places.json" : (currentMode + "-" + type + ".json");
    const file = new File(fileData, fileName);
    const storagePath = (type === 'places') ? "data/places.json" : ("data/" + currentMode + "-" + type + ".json");

    const finishUpload = () => {
        isUploading[type] = false;
        if (pendingUpload[type] !== undefined) {
            let nextSkip = pendingUpload[type];
            delete pendingUpload[type];
            uploadJSONData(type, nextSkip);
            return;
        }
        if (!hasUnsavedChanges()) {
            $('.save').text('Saved!');
            $('#sync-spinner .sync-text').text('Saved!');
            $('#sync-spinner-icon').hide();
            setTimeout(() => { 
                if ($('.save').first().text() === 'Saved!') $('.save').text('Save'); 
                if ($('#sync-spinner .sync-text').text() === 'Saved!') $('#sync-spinner').fadeOut(300);
            }, 2000);
        }
    };

    const doUpload = () => {
        FirebaseApi.getFirebase().storage().ref(storagePath).put(file).then((snapshot) => {
            console.log("uploaded " + storagePath);
            
            if (Constants.ADMIN_USE_ETAG) {
                const newGen = snapshot && snapshot.metadata ? snapshot.metadata.generation : null;
                if (newGen) {
                    loadedEtags[type] = newGen;
                    if (type === 'sightings') {
                        historyManager.etag = newGen;
                        historyManager.saveToStorage();
                    }
                }
            } else if (type === 'sightings') {
                historyManager.etag = null;
                historyManager.saveToStorage();
            }
            finishUpload();
        }).catch(e => {
            isUploading[type] = false;
            customAlert(e.message);
            $('.save').text('Error').removeAttr('disabled');
            $('#sync-spinner .sync-text').text('Error');
            $('#sync-spinner-icon').hide();
            setTimeout(() => { 
                if ($('#sync-spinner .sync-text').text() === 'Error') $('#sync-spinner').fadeOut(300);
            }, 2000);
        });
    };

    if (Constants.ADMIN_USE_ETAG) {
        const expectedGen = loadedEtags[type];
        if (!expectedGen) {
            doUpload();
            return;
        }

        FirebaseApi.getFirebase().storage().ref("data/" + currentMode + "-" + type + ".json").getMetadata().then(metadata => {
            const currentGen = metadata.generation;
            if (currentGen && currentGen !== expectedGen) {
                console.warn("Generation mismatch! Expected:", expectedGen, "Got:", currentGen);
                isUploading[type] = false;
                customAlert("Data was modified in another tab or device. Please refresh the page to get the latest changes before saving again.");
                $('.save').text('Conflict').removeAttr('disabled');
                $('#sync-spinner .sync-text').text('Conflict');
                $('#sync-spinner-icon').hide();
                setTimeout(() => { 
                    if ($('#sync-spinner .sync-text').text() === 'Conflict') $('#sync-spinner').fadeOut(300);
                }, 3000);
            } else {
                doUpload();
            }
        }).catch(err => {
            console.warn("Could not check metadata, proceeding with upload...", err);
            doUpload();
        });
    } else {
        doUpload();
    }
}

export function backup() {
    showLoader("backup", "Backing up...");
    console.log("Backing up...");
    let backedUp = 0;
    const date = moment(Date.now()).format(Constants.BACKUP_DATE_FORMAT);
    const filesToBackup = ["species", "families", "sightings", "likes", "places"];
    for (const file of filesToBackup) {
        let fileData = {};
        let fileName = "";
        if (file === "places") {
            fileData = { countries: data.countries || {} };
            fileName = "places.json";
        } else {
            fileData[file] = data[file];
            fileName = currentMode + "-" + file + ".json";
        }
        FirebaseApi.getFirebase().storage()
            .ref("backup/" + date + "/" + fileName)
            .put(new File(JSON.stringify(fileData, null, '\t').split('\n').map(l => l + '\n'), fileName))
            .then(() => {
                if (++backedUp == filesToBackup.length) {
                    refresh();
                    console.log("Backup completed");
                    hideLoader("backup");
                    showToast(`Backup created successfully for ${date}!`, "success");
                }
            }).catch(e => {
                console.error("Backup failed for " + fileName, e);
                if (++backedUp == filesToBackup.length) {
                    hideLoader("backup");
                    showToast("Backup encountered an error: " + e.message, "error");
                }
            });
    }
}


export function isInputActive() {
    const active = document.activeElement;
    const isEditingInput = active && (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName) ||
        active.isContentEditable ||
        $(active).closest('.ss-wrapper, .ss-dropdown, .chip-input-container').length > 0
    );
    const isDropdownOpen = $('.ss-dropdown.open').length > 0;
    return Boolean(isEditingInput || isDropdownOpen);
}

export function delayPendingSave() {
    if (typeof syncRef !== 'undefined') {
        syncSightingsData(SYNC_SCHEDULE_TIME, true);
    }
}

export function syncSightingsData(scheduleAfter, skipRefresh = false) {
    clearTimeout(syncRef);
    if (scheduleAfter > 0) {
        // Delayed save - enable save button to show pending changes
        $('.save').removeAttr("disabled");
        if ($('.save').first().text() === 'Saved!') $('.save').text('Save');
    }
    syncRef = setTimeout(function () {
        if (scheduleAfter > 0 && isInputActive()) {
            syncSightingsData(SYNC_SCHEDULE_TIME, skipRefresh);
            return;
        }
        if ($('#auto-sort-btn').hasClass('active') && data && data.sightings) {
            let originalKeys = data.sightings.map(s => s.key).join(',');
            data.sightings.sort((a, b) => Util.compare(moment(b.date, Constants.DATA_DATE_FORMAT), moment(a.date, Constants.DATA_DATE_FORMAT)));
            if (originalKeys !== data.sightings.map(s => s.key).join(',')) {
                renderCallback();
            }
        }
        syncRef = undefined;
        uploadJSONData('sightings', skipRefresh);
        $('.save').attr("disabled", "disabled");
    }, scheduleAfter);
}

function getSightingDateFromExif(file) {
    return new Promise((resolve) => {
        EXIF.getData(file, function () {
            const dateOriginal = EXIF.getTag(this, "DateTimeOriginal") ||
                EXIF.getTag(this, "DateTimeDigitized") ||
                EXIF.getTag(this, "DateTime");
            if (dateOriginal) {
                console.log("dateOriginal:", dateOriginal);
                const parts = dateOriginal.split(' ')[0].split(':');
                if (parts.length === 3) {
                    const date = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    console.log("Extracted date from EXIF:", date);
                    resolve(date);
                    return;
                }
            }
            resolve(null);
        });
    });
}

export function uploadMedia(sightingKey, files) {
    $('#sync-spinner').css('display', 'flex');
    $('#sync-spinner .sync-text').text('Uploading Media...');
    $('#sync-spinner-icon').show();

    const sighting = data.sightings.find(s => s.key === sightingKey);

    let watermark = null;
    if ($('input[name=watermark-on]').is(":checked")) {
        watermark = {
            text: $('input[name=watermark]').val().replace("${author}", (data.sightings.filter(b => b.key == sightingKey)[0].author || Constants.DEFAULT_AUTHOR)).trim(),
            color: $('input[name=watermark-color]').val() + "33"
        };
    }
    Array.from(files).forEach(function (file) {
        let mediaSrc;
        const speciesKey = data.species[data.sightings.filter(b => b.key == sightingKey)[0].species].key;

        if (file.type.match(/image.*/)) {
            mediaSrc = 'images/' + speciesKey + "-" + Math.floor(Date.now() / 1000) + ".jpg";
            console.log("uploading image " + file.name + " for " + sightingKey + " as " + mediaSrc);
            Util.resizeImage(file, IMAGE_SIZE, watermark).then((resizedImage) => {
                FirebaseApi.getFirebase().storage().ref(mediaSrc).put(resizedImage).then(async () => {
                    console.log("uploaded image " + mediaSrc);
                    snapshotSightings();
                    let currentSighting = data.sightings.find(s => s.key == sightingKey);
                    if (!currentSighting) {
                        customAlert("Media uploaded, but the sighting was deleted or is no longer available.");
                        return;
                    }
                    if (!currentSighting.media) currentSighting.media = [];
                    
                    if (currentSighting.media.length === 0) {
                        const date = await getSightingDateFromExif(file);
                        if (date) currentSighting.date = date;
                    }
                    let inheritedCamera = Constants.DEFAULT_CAMERA_MODEL;
                    if (currentSighting.media && currentSighting.media.length > 0) {
                        let lastMedia = currentSighting.media[currentSighting.media.length - 1];
                        if (lastMedia.exif_data && lastMedia.exif_data.camera_model) {
                            inheritedCamera = lastMedia.exif_data.camera_model;
                        }
                    }

                    currentSighting.media.push({
                        src: mediaSrc,
                        exif_data: {
                            "camera_model": inheritedCamera
                        }
                    });
                    commitSightingsChange();
                    renderCallback();
                    syncSightingsData(0, true);
                }).catch(e => {
                    customAlert(e.message + "\n (Possible reason: Unsupported media or Invalid media file size)");
                    if ($('#sync-spinner .sync-text').text() === 'Uploading Media...') $('#sync-spinner').fadeOut(300);
                });
            });
        } else if (file.type.match(/video.*/)) {
            // Upload video as is
            mediaSrc = 'videos/' + speciesKey + "-" + Math.floor(Date.now() / 1000) + ".mp4";
            console.log("uploading video " + file.name + " for " + sightingKey + " as " + mediaSrc);

            FirebaseApi.getFirebase().storage().ref(mediaSrc).put(file).then(() => {
                console.log("uploaded video " + mediaSrc);
                snapshotSightings();
                let currentSighting = data.sightings.find(s => s.key == sightingKey);
                if (!currentSighting) {
                    customAlert("Media uploaded, but the sighting was deleted or is no longer available.");
                    return;
                }
                if (!currentSighting.media) currentSighting.media = [];
                
                let inheritedCamera = Constants.DEFAULT_CAMERA_MODEL;
                if (currentSighting.media && currentSighting.media.length > 0) {
                    let lastMedia = currentSighting.media[currentSighting.media.length - 1];
                    if (lastMedia.exif_data && lastMedia.exif_data.camera_model) {
                        inheritedCamera = lastMedia.exif_data.camera_model;
                    }
                }

                currentSighting.media.push({
                    src: mediaSrc,
                    type: 'video',
                    mute: true,
                    thumbnail: currentSighting.media.find(m => m.type !== 'video')?.src || null, // Use first image as thumbnail if available, else null
                    exif_data: {
                        "camera_model": inheritedCamera
                    }
                });
                
                commitSightingsChange();
                renderCallback();
                syncSightingsData(0, true);
            }).catch(e => {
                customAlert(e.message + "\n (Possible reason: Unsupported media or Invalid media file size)");
                if ($('#sync-spinner .sync-text').text() === 'Uploading Media...') $('#sync-spinner').fadeOut(300);
            });
        }
    });
}

export function deleteMedia(sightingKey, mediaSrc, skipConfirm = false) {
    if (!mediaSrc.toLowerCase().endsWith(".jpg") && !mediaSrc.toLowerCase().endsWith(".mp4")) {
        customAlert("Unsupported!!!");
        return;
    }
    
    const executeDelete = () => {
        $('#sync-spinner').css('display', 'flex');
        $('#sync-spinner .sync-text').text('Deleting Media...');
        $('#sync-spinner-icon').show();

        data.sightings.forEach(function (sighting) {
            if (sighting.key != sightingKey) return;
            snapshotSightings();
            sighting.media = sighting.media.filter(m => m.src != mediaSrc);
            commitSightingsChange();
        });
        FirebaseApi.getFirebase().storage().ref(mediaSrc).delete().then(() => {
            renderCallback();
            syncSightingsData(0);
        }, (error) => {
            if (error.code === 'storage/object-not-found') {
                renderCallback();
                syncSightingsData(0);
            } else {
                customAlert(error.message);
                if ($('#sync-spinner .sync-text').text() === 'Deleting Media...') $('#sync-spinner').fadeOut(300);
            }
        });
    };

    if (skipConfirm) {
        executeDelete();
    } else {
        customConfirm("You are about to delete this media.", executeDelete);
    }
}

export function moveMediaToTarget(sourceSightingKey, targetSightingKey, draggedSrc, targetSrc, dropAfter) {
    let sourceSighting = data.sightings.find(s => s.key == sourceSightingKey);
    let targetSighting = data.sightings.find(s => s.key == targetSightingKey);
    
    if (!sourceSighting || !targetSighting) return;
    
    let draggedIndex = sourceSighting.media.findIndex(m => m.src === draggedSrc);
    if (draggedIndex === -1) return;
    
    snapshotSightings();
    let draggedItem = sourceSighting.media.splice(draggedIndex, 1)[0];
    
    if (!targetSrc) {
        targetSighting.media.push(draggedItem);
    } else {
        let targetIndex = targetSighting.media.findIndex(m => m.src === targetSrc);
        if (targetIndex !== -1) {
            if (sourceSightingKey == targetSightingKey) {
                targetIndex = targetSighting.media.findIndex(m => m.src === targetSrc);
            }
            let newIndex = dropAfter ? targetIndex + 1 : targetIndex;
            targetSighting.media.splice(newIndex, 0, draggedItem);
        } else {
            targetSighting.media.push(draggedItem);
        }
    }
    
    commitSightingsChange();
    renderCallback();
    syncSightingsData(SYNC_SCHEDULE_TIME, true);
}

export function updateField(sightingKey, field, value) {
    snapshotSightings();
    data.sightings.forEach(function (sighting) {
        if (sighting.key != sightingKey) return;

        if (field == 'species' && sighting.species !== value) {
            renameSightingMedia(sighting, sighting.species, value);
        }

        if (field == 'date') {
            sighting[field] = moment(value, 'yyyy-mm-DD').format('DD-mm-yyyy');
        } else if (field == 'hidden') {
            sighting[field] = !value;
        } else {
            sighting[field] = value;
        }
    });
    commitSightingsChange();
    syncSightingsData(SYNC_SCHEDULE_TIME, true);
}

function renameSightingMedia(sighting, oldSpeciesKey, newSpeciesKey) {
    $('#sync-spinner').css('display', 'flex');
    $('#sync-spinner .sync-text').text('Renaming Media...');
    $('#sync-spinner-icon').show();

    const promises = [];
    const errors = [];

    sighting.media.forEach((media, index) => {
        const parts = media.src.split('/');
        const filename = parts[parts.length - 1];

        // Only rename if it matches the pattern <oldSpeciesKey>-<timestamp>.{jpg|mp4}
        // and avoid partial matches by checking the boundary (hyphen)
        if (filename.startsWith(oldSpeciesKey + "-") && (media.src.toLowerCase().endsWith(".jpg") || media.src.toLowerCase().endsWith(".mp4"))) {
            const newFilename = filename.replace(oldSpeciesKey, newSpeciesKey);
            const newSrc = media.src.replace(filename, newFilename);

            console.log(`Renaming ${media.src} to ${newSrc}`);

            const p = FirebaseApi.moveFile(media.src, newSrc).then(() => {
                snapshotSightings();
                media.src = newSrc;
                if (media.type === 'video' && media.thumbnail && media.thumbnail.includes(oldSpeciesKey)) {
                    // Try to update thumbnail path if it was also renamed (though thumbnail is usually a separate image src, 
                    // if it points to an image that was just renamed, we should update it too. 
                    // However, the Thumbnail string usually mimics an image src. 
                    // If the thumbnail is one of the images we are renaming, its string update might need care.
                    // But here we are just updating the reference in the media object.
                    const thumbParts = media.thumbnail.split('/');
                    const thumbFilename = thumbParts[thumbParts.length - 1];
                    if (thumbFilename.startsWith(oldSpeciesKey + "-")) {
                        const newThumbFilename = thumbFilename.replace(oldSpeciesKey, newSpeciesKey);
                        media.thumbnail = media.thumbnail.replace(thumbFilename, newThumbFilename);
                    }
                }
                commitSightingsChange();
            }).catch(err => {
                console.error("Failed to move " + media.src, err);
                errors.push(`Failed to move ${media.src}: ${err.message}`);
            });
            promises.push(p);
        }
    });

    if (promises.length > 0) {
        Promise.all(promises).then(() => {
            if (errors.length > 0) {
                customAlert("Some files could not be renamed:\n" + errors.join("\n"));
                if ($('#sync-spinner .sync-text').text() === 'Renaming Media...') $('#sync-spinner').fadeOut(300);
            }
            syncSightingsData(0, true); // Force immediate sync to save new paths
            console.log("Renaming process completed.");
        });
    } else {
        if ($('#sync-spinner .sync-text').text() === 'Renaming Media...') $('#sync-spinner').fadeOut(300);
    }
}

export function updateMediaProperty(sightingKey, mediaSrc, property, value) {
    snapshotSightings();
    data.sightings.forEach(function (sighting) {
        if (sighting.key != sightingKey) return;
        sighting.media.forEach(media => {
            if (media.src == mediaSrc) {
                const keys = property.split('.');
                let obj = media;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!obj[keys[i]]) obj[keys[i]] = {};
                    obj = obj[keys[i]];
                }
                obj[keys[keys.length - 1]] = value;
            }
        });
    });
    commitSightingsChange();
    syncSightingsData(SYNC_SCHEDULE_TIME, true);
}

export function addSighting(filterSightingVal) {
    snapshotSightings();
    data.sightings.unshift({
        "key": ("s" + Math.floor(Date.now() / 1000)),
        "species": lastUpdatedSpecies,
        "date": (data.sightings[0] || {}).date || moment(Date.now()).format(Constants.DATA_DATE_FORMAT),
        "place": (data.sightings[0] || {}).place,
        "city": (data.sightings[0] || {}).city || "Howrah",
        "state": (data.sightings[0] || {}).state || "West Bengal",
        "country": (data.sightings[0] || {}).country || "India",
        "author": null,
        "unconfirmed": false,
        "time_of_day": "Day",
        "weather": (data.sightings[0] || {}).weather || null,
        "hidden": true,
        "media": []
    });
    commitSightingsChange();
    renderCallback();
    syncSightingsData(SYNC_SCHEDULE_TIME, true);
}


export function deleteSighting(sightingKey) {
    let sighting = data.sightings.find(b => b.key == sightingKey);
    let numMedia = sighting.media ? sighting.media.length : 0;
    
    let message = "You are about to delete this sighting.";
    if (numMedia > 0) {
        message += `<br><br>This will also permanently delete the following ${numMedia} media file${numMedia > 1 ? 's' : ''}:<br><div style='display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; justify-content:center;'>`;
        (sighting.media || []).forEach(m => {
            let src = m.type === 'video' ? (m.thumbnail || m.src) : m.src;
            message += `<img src='${Util.getMedia(src)}' style='max-height: 60px; max-width: 60px; border-radius: 4px; object-fit: cover;'>`;
        });
        message += `</div>`;
    }

    customConfirm(message, () => {
        snapshotSightings();
        (sighting.media || []).forEach(function (media) {
            deleteMedia(sightingKey, media.src, true);
        });
        data.sightings = data.sightings.filter(b => b.key != sightingKey);
        commitSightingsChange();
        renderCallback();
        syncSightingsData(SYNC_SCHEDULE_TIME, true);
    });
}

export function saveSpecies(key, name, tags, family, latin_name, ebird_code) {
    if (!name || !tags || !family) {
        customAlert("All fields are mandatory");
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
        showToast(`Species '${name}' saved successfully.`, 'success');
    }
}

export function addFamily(name, ebirdCode, sciName) {
    if (!name) {
        customAlert("Name is mandatory");
    } else {
        data.families = data.families.filter(f => f.name != name);
        if (name.trim()) {
            let fam = { name: name };
            if (ebirdCode) fam.ebird_code = ebirdCode;
            if (sciName) fam.sci_name = sciName;
            data.families.push(fam);
        }
        data.families = data.families.sort((f1, f2) => f1.name.localeCompare(f2.name));
        uploadJSONData("families", true);
        showToast(`Family '${name}' saved successfully.`, 'success');
    }
}

export function deleteFamily(name, onSuccess) {
    if (!name) return;
    if (Object.values(data.species).some(s => s.family == name)) {
        customAlert("Cannot delete family '" + name + "' as it is used by one or more species.");
        return;
    }
    customConfirm("Are you sure you want to delete family '" + name + "'?", () => {
        data.families = data.families.filter(f => f.name != name);
        uploadJSONData("families", true);
        if (onSuccess) onSuccess();
        showToast("Family deleted successfully.", 'success');
    });
}

export function deleteSpecies(key, onSuccess) {
    if (!key) return;
    if (data.sightings.some(s => s.species == key)) {
        customAlert("Cannot delete species '" + key + "' as it has sightings.");
        return;
    }
    customConfirm("Are you sure you want to delete species '" + key + "'?", () => {
        delete data.species[key];
        uploadJSONData("species", true);
        if (onSuccess) onSuccess();
        showToast("Species deleted successfully.", 'success');
    });
}

export function moveSighting(sightingKey, value) {
    let sighting = data.sightings.filter(b => b.key == sightingKey)[0];
    let index = data.sightings.map(b => b.key).indexOf(sightingKey);
    if (index === -1) return;
    
    snapshotSightings();
    if (value > 0 && index < data.sightings.length - 1) { // move down
        let newIndex = Math.min(index + value, data.sightings.length - 1);
        data.sightings = [data.sightings.slice(0, index), data.sightings.slice(index + 1, newIndex + 1), [sighting], data.sightings.slice(newIndex + 1)].flat();
        commitSightingsChange();
        renderCallback();
        syncSightingsData(SYNC_SCHEDULE_TIME, true);
    } else if (value < 0 && index > 0) { // move up
        let newIndex = Math.max(index + value, 0);
        data.sightings = [data.sightings.slice(0, newIndex), [sighting], data.sightings.slice(newIndex, index), data.sightings.slice(index + 1)].flat();
        commitSightingsChange();
        renderCallback();
        syncSightingsData(SYNC_SCHEDULE_TIME, true);
    }
}

export function moveSightingToTarget(draggedKey, targetKey, dropAfter) {
    let index = data.sightings.map(b => b.key).indexOf(draggedKey);
    let targetIndex = data.sightings.map(b => b.key).indexOf(targetKey);
    if (index === -1 || targetIndex === -1) return;
    if (index === targetIndex) return;

    snapshotSightings();
    let sighting = data.sightings[index];
    data.sightings.splice(index, 1);
    
    let newTargetIndex = data.sightings.map(b => b.key).indexOf(targetKey);
    
    if (dropAfter) {
        data.sightings.splice(newTargetIndex + 1, 0, sighting);
    } else {
        data.sightings.splice(newTargetIndex, 0, sighting);
    }
    commitSightingsChange();
    renderCallback();
    syncSightingsData(SYNC_SCHEDULE_TIME, true);
}

export function sortByDate() {
    snapshotSightings();
    data.sightings.sort((a, b) => Util.compare(moment(b.date, Constants.DATA_DATE_FORMAT), moment(a.date, Constants.DATA_DATE_FORMAT)));
    commitSightingsChange();
    renderCallback();
    syncSightingsData(SYNC_SCHEDULE_TIME, true);
}

export function sightingMatches(sighting, searchKey) {
    searchKey = searchKey.toLowerCase().trim();
    if (searchKey == "hidden") {
        return !!sighting.hidden;
    } else if (searchKey == "unconfirmed") {
        return sighting.unconfirmed;
    } else if (searchKey.match(/^rating=/i)) {
        return sighting.rating == searchKey.split("=")[1] || 0;
    }
    return sighting.key.indexOf(searchKey) >= 0
        || data.species[sighting.species].name.toLowerCase().indexOf(searchKey) >= 0
        || (data.species[sighting.species].tags && data.species[sighting.species].tags.length > 0 && data.species[sighting.species].tags.some(t => t.toLowerCase().indexOf(searchKey) >= 0))
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

export function hasUnsavedChanges() {
    if (typeof syncRef !== 'undefined') return true;
    if (Object.values(isUploading).some(v => v === true)) return true;
    if (Object.values(pendingUpload).some(v => v !== undefined)) return true;
    return false;
}

window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});

/**
 * Save coordinates for a country, state, city, or place in data.countries and sync to Firebase
 */
export function savePlaceGeo({ country, state, city, place, lat, lng, radius, skipUpload = false }) {
    if (!country) return false;

    data.countries = data.countries || {};
    if (!data.countries[country]) {
        data.countries[country] = { name: country, states: {} };
    }
    const countryObj = data.countries[country];

    // 1. Country level
    if (!state) {
        countryObj.lat = parseFloat(lat);
        countryObj.lng = parseFloat(lng);
        countryObj.radius = Math.min(Math.max(Math.round(radius || 1000), 50), 2000);
        if (!skipUpload) uploadJSONData('places', true);
        return true;
    }

    // 2. State level
    countryObj.states = countryObj.states || {};
    if (!countryObj.states[state]) {
        countryObj.states[state] = { name: state, cities: {} };
    }
    const stateObj = countryObj.states[state];

    if (!city) {
        stateObj.lat = parseFloat(lat);
        stateObj.lng = parseFloat(lng);
        stateObj.radius = Math.min(Math.max(Math.round(radius || 150), 25), 200);
        if (!skipUpload) uploadJSONData('places', true);
        return true;
    }

    // 3. City level
    stateObj.cities = stateObj.cities || {};
    if (!stateObj.cities[city]) {
        stateObj.cities[city] = { name: city, places: {} };
    }
    const cityObj = stateObj.cities[city];

    if (!place || !place.trim()) {
        cityObj.lat = parseFloat(lat);
        cityObj.lng = parseFloat(lng);
        cityObj.radius = Math.min(Math.max(Math.round(radius || 20), 5), 40);
        if (!skipUpload) uploadJSONData('places', true);
        return true;
    }

    // 4. Place level
    cityObj.places = cityObj.places || {};
    cityObj.places[place] = {
        name: place,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: Math.min(Math.max(Math.round(radius || 5), 1), 20)
    };

    if (!skipUpload) uploadJSONData('places', true);
    return true;
}

/**
 * Check if a location already has coordinates in data.countries
 */
export function getLocationGeo({ country, state, city, place }) {
    if (!data.countries || !data.countries[country]) return null;
    const countryObj = data.countries[country];

    if (!state) {
        return (countryObj.lat && countryObj.lng) ? countryObj : null;
    }

    if (!countryObj.states || !countryObj.states[state]) return null;
    const stateObj = countryObj.states[state];

    if (!city) {
        return (stateObj.lat && stateObj.lng) ? stateObj : null;
    }

    if (!stateObj.cities || !stateObj.cities[city]) return null;
    const cityObj = stateObj.cities[city];

    if (place && place.trim()) {
        if (cityObj.places && cityObj.places[place] && cityObj.places[place].lat) {
            return cityObj.places[place];
        }
        return null;
    }

    return (cityObj.lat && cityObj.lng) ? cityObj : null;
}

/**
 * Retrieve the node in data.countries hierarchy regardless of whether coordinates are populated
 */
export function getPlaceNode({ country, state, city, place }) {
    if (!data.countries || !country || !data.countries[country]) return null;
    const countryObj = data.countries[country];
    if (!state) return countryObj;

    if (!countryObj.states || !countryObj.states[state]) return null;
    const stateObj = countryObj.states[state];
    if (!city) return stateObj;

    if (!stateObj.cities || !stateObj.cities[city]) return null;
    const cityObj = stateObj.cities[city];
    if (!place || !place.trim()) return cityObj;

    if (cityObj.places && cityObj.places[place]) {
        return cityObj.places[place];
    }
    return null;
}

/**
 * Lookup coordinates for a location via swappable GeoService and save into places
 */
export async function geocodeAndSaveLocation({ country, state, city, place }) {
    let type = 'place';
    if (place && place.trim()) {
        type = 'place';
    } else if (city && city.trim()) {
        type = 'city';
    } else if (state && state.trim()) {
        type = 'state';
    } else if (country && country.trim()) {
        type = 'country';
    } else {
        return null;
    }

    const result = await lookupLocation({ place, city, state, country, type });
    if (!result) return null;

    savePlaceGeo({
        country,
        state: state || null,
        city: city || null,
        place: place || null,
        lat: result.lat,
        lng: result.lng,
        radius: result.radius
    });

    return result;
}

/**
 * Add a new Country to data.countries with optional automated state fetching and geocoding
 */
export async function addNewCountry({ country, fetchStates = true, geocode = true, geocodeStates = false, onProgress = null }) {
    if (!country || !country.trim()) throw new Error('Country name is required.');
    const countryName = country.trim();

    data.countries = data.countries || {};
    if (data.countries[countryName]) {
        throw new Error(`Country "${countryName}" already exists.`);
    }

    data.countries[countryName] = {
        name: countryName,
        states: {}
    };

    let geocoded = false;
    let statesCount = 0;

    // 1. Geocode country
    if (geocode) {
        try {
            const geo = await lookupLocation({ country: countryName, type: 'country' });
            if (geo) {
                data.countries[countryName].lat = geo.lat;
                data.countries[countryName].lng = geo.lng;
                data.countries[countryName].radius = geo.radius || 1000;
                geocoded = true;
            }
        } catch (e) {
            console.warn('[addNewCountry] Could not geocode country:', e);
        }
    }

    // 2. Fetch states
    if (fetchStates) {
        try {
            const states = await fetchStatesForCountry(countryName);
            if (Array.isArray(states) && states.length > 0) {
                for (let i = 0; i < states.length; i++) {
                    const stateName = states[i];
                    const cleanName = typeof stateName === 'string' ? stateName.trim() : stateName?.name?.trim();
                    if (cleanName && !data.countries[countryName].states[cleanName]) {
                        data.countries[countryName].states[cleanName] = {
                            name: cleanName,
                            cities: {}
                        };
                        statesCount++;

                        if (geocodeStates) {
                            if (typeof onProgress === 'function') onProgress(i + 1, states.length, cleanName);
                            try {
                                const sGeo = await lookupLocation({ country: countryName, state: cleanName, type: 'state' });
                                if (sGeo) {
                                    data.countries[countryName].states[cleanName].lat = sGeo.lat;
                                    data.countries[countryName].states[cleanName].lng = sGeo.lng;
                                    data.countries[countryName].states[cleanName].radius = sGeo.radius || 150;
                                }
                            } catch (e) {
                                console.warn(`[addNewCountry] Could not geocode state "${cleanName}":`, e);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[addNewCountry] Could not fetch states for country:', e);
        }
    }

    uploadJSONData('places', true);
    return { country: countryName, geocoded, statesCount };
}

/**
 * Add a new State under an existing country in data.countries
 */
export async function addNewState({ country, state, geocode = true }) {
    if (!country || !country.trim()) throw new Error('Country is required.');
    if (!state || !state.trim()) throw new Error('State name is required.');
    const countryName = country.trim();
    const stateName = state.trim();

    data.countries = data.countries || {};
    if (!data.countries[countryName]) {
        data.countries[countryName] = { name: countryName, states: {} };
    }
    data.countries[countryName].states = data.countries[countryName].states || {};

    if (data.countries[countryName].states[stateName]) {
        throw new Error(`State "${stateName}" already exists in ${countryName}.`);
    }

    const stateObj = {
        name: stateName,
        cities: {}
    };

    let geocoded = false;
    if (geocode) {
        try {
            const geo = await lookupLocation({ country: countryName, state: stateName, type: 'state' });
            if (geo) {
                stateObj.lat = geo.lat;
                stateObj.lng = geo.lng;
                stateObj.radius = geo.radius || 150;
                geocoded = true;
            }
        } catch (e) {
            console.warn('[addNewState] Could not geocode state:', e);
        }
    }

    data.countries[countryName].states[stateName] = stateObj;
    uploadJSONData('places', true);
    return { country: countryName, state: stateName, geocoded };
}


