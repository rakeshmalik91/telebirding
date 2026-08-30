import Constants from '../constants.js';
import Util from '../util.js';
import { getSelectDOM, getSelectOptionsDOM } from '../ui-helpers.js?v=20260713-0645';
import { showLoader, hideLoader } from '../loader.js';
import EbirdApi from '../ebird-api.js';
import { initSearchableSelect, initSearchableSelects } from '../searchable-select.js?v=20260829_1';
import { setChips } from './chip-input.js';
import {
    data, currentMode, uploadMedia, deleteMedia, moveMediaToTarget, updateField, updateMediaProperty,
    deleteSighting, moveSighting, moveSightingToTarget, sightingMatches, addFamily, saveSpecies, deleteFamily, deleteSpecies,
    syncSightingsData, triggerRender, geocodeAndSaveLocation, savePlaceGeo, addNewCountry, addNewState,
    uploadJSONData, getPlaceNode, getLocationGeo,
    ensureGeoBoundariesLoaded, getGeoBoundaryCoverage, getGeoBoundary, fetchBoundaryFromOSM, saveGeoBoundary
} from './data.js';
import { geoService, lookupLocation, setGeoProvider } from '../geo-service.js';
import { showToast, customAlert } from './ui.js';

import { openCropper } from '../cropper.js';

export function getValue(sighting, prop) {
    return sighting[prop] ? sighting[prop] : '';
}

export function validateUpdateSpeciesForm() {
    const updateSpeciesForm = $("#update-species-form");
    let name = updateSpeciesForm.find("select[data-field=name]").val();
    let family = updateSpeciesForm.find("select[data-field=family]").val();
    let tags = updateSpeciesForm.find("input[data-field=tags]").val();
    if (name && name.trim() && family && family.trim() && tags && tags.trim()) {
        updateSpeciesForm.find("button.submit").removeAttr("disabled");
    } else {
        updateSpeciesForm.find("button.submit").attr("disabled", "disabled");
    }
}

export function fillUpdateSpeciesForm() {
    const updateSpeciesForm = $("#update-species-form");
    let nameVal = updateSpeciesForm.find("select[data-field=name]").val();
    updateSpeciesForm.find("select[data-field=family] option").removeAttr("selected");

    // Check if the value is an existing key
    if (nameVal && data.species[nameVal]) {
        const key = nameVal;
        const species = data.species[key];
        setChips(updateSpeciesForm.find(".chip-input-container"), species.tags.join(", "));
        updateSpeciesForm.find("select[data-field=family]").val(species.family).trigger("change");
        updateSpeciesForm.find("select[data-field=family] option[value='" + species.family + "']").attr("selected", "selected").trigger("change");
        updateSpeciesForm.find("input[data-field=latin-name]").val(species.latin_name);
        updateSpeciesForm.find("input[data-field=ebird-code]").val(species.ebird_code);
        let count = data.sightings.filter(s => s.species == key).length;
        updateSpeciesForm.find("span[data-field=sighting-count]").text(count);
        updateSpeciesForm.find("button.submit").html("Update");
        if (count == 0) {
            updateSpeciesForm.find("button.delete").removeAttr("disabled");
        } else {
            updateSpeciesForm.find("button.delete").attr("disabled", "disabled");
        }
    } else {
        // New custom name
        setChips(updateSpeciesForm.find(".chip-input-container"), '');
        updateSpeciesForm.find("select[data-field=family]").val('').trigger("change");
        updateSpeciesForm.find("input[data-field=latin-name]").val('');
        updateSpeciesForm.find("input[data-field=ebird-code]").val('');
        updateSpeciesForm.find("span[data-field=sighting-count]").text('0');
        updateSpeciesForm.find("button.submit").html("Add");
        updateSpeciesForm.find("button.delete").attr("disabled", "disabled");

        // Auto-fill tags if possible
        if (nameVal && nameVal.trim() && !updateSpeciesForm.find("input[data-field=tags]").val()) {
            setChips(updateSpeciesForm.find(".chip-input-container"), nameVal.trim().split(/\s+/).slice(-1)[0]);
        }
    }
    
    validateUpdateSpeciesForm();
}

export function setupUpdateSpeciesForm() {
    const updateSpeciesForm = $("#update-species-form");

    if (currentMode != Constants.MODE_BIRD) {
        updateSpeciesForm.find("input[data-field=ebird-code]").closest('tr').hide();
    } else {
        updateSpeciesForm.find("input[data-field=ebird-code]").closest('tr').show();
    }

    updateSpeciesForm.find("select[data-field=family], select[data-field=name]").html('');
    updateSpeciesForm.find("select[data-field=family]").append("<option value=''></option>");
    (data.families || []).forEach(function (family) {
        updateSpeciesForm.find("select[data-field=family]").append("<option value='" + family.name + "'>" + family.name + "</option>");
    });

    updateSpeciesForm.find("select[data-field=name]").append("<option value=''></option>");
    Object.values(data.species || {}).forEach(function (species, i) {
        const searchTerms = [species.key, ...(species.tags || [])].join(" ");
        updateSpeciesForm.find("select[data-field=name]").append("<option value='" + species.key + "' data-search-terms='" + searchTerms + "'>" + species.name + "</option>");
    });

    fillUpdateSpeciesForm();
    updateSpeciesForm.find("select[data-field=name]").unbind("change").change(fillUpdateSpeciesForm);

    updateSpeciesForm.find("button.submit").unbind("click").click(function () {
        let nameVal = updateSpeciesForm.find("select[data-field=name]").val();
        let key = "";
        let name = nameVal;
        if (nameVal && data.species[nameVal]) {
            key = nameVal;
            name = data.species[nameVal].name;
        }
        saveSpecies(key, name,
            updateSpeciesForm.find("input[data-field=tags]").val(), updateSpeciesForm.find("select[data-field=family]").val(),
            updateSpeciesForm.find("input[data-field=latin-name]").val(), updateSpeciesForm.find("input[data-field=ebird-code]").val());
    });

    updateSpeciesForm.find("button.delete").unbind("click").click(function () {
        let key = updateSpeciesForm.find("select[data-field=name]").val();
        if (!key || !data.species[key]) return;
        deleteSpecies(key, () => {
            updateSpeciesForm.find("select[data-field=name] option[value='" + key + "']").remove();
            updateSpeciesForm.find("select[data-field=name]").val('').trigger('change');
        });
    });

    // Init searchable selects on species form dropdowns
    updateSpeciesForm.find("select[data-field=name]").attr("placeholder", "Select or type a species...");
    updateSpeciesForm.find("select[data-field=family]").attr("placeholder", "Select or type a family...");
    initSearchableSelect(updateSpeciesForm.find("select[data-field=name]")[0]);
    initSearchableSelect(updateSpeciesForm.find("select[data-field=family]")[0]);

    updateSpeciesForm.find("select[data-field=name], select[data-field=family], input[data-field=tags]").on("change input", validateUpdateSpeciesForm);

    updateSpeciesForm.find("select[data-field=name]").change(function () {
        let v = $(this).val();
        if (!v || !v.trim()) return;

        let actualName = data.species[v] ? data.species[v].name : v;

        if (currentMode == Constants.MODE_INSECT) {
            let lastWord = actualName.trim().split(/\s+/).slice(-1)[0];
            let pluralWord = Util.plural(lastWord);
            let family = data.families.find(f => f.name.toLowerCase() == pluralWord.toLowerCase());
            if (family) {
                updateSpeciesForm.find("select[data-field=family]").val(family.name).trigger("change");
            }
        } else if (currentMode == Constants.MODE_BIRD && !data.species[v]) {
            showLoader("ebird-code", "Fetching eBird Code");
            EbirdApi.fetchEbirdCode(actualName).then(code => {
                if (code) updateSpeciesForm.find("input[data-field=ebird-code]").val(code).change();
            }).finally(() => hideLoader("ebird-code"));
        }
    });
    updateSpeciesForm.find("input[data-field=ebird-code]").unbind("change").change(function () {
        let v = $(this).val();
        if (!v || !v.trim()) return;

        if (currentMode == Constants.MODE_BIRD) {
            showLoader("sci-name", "Fetching Scientific Name & Family");
            EbirdApi.fetchEbirdSciName(v).then(s => {
                if (s) {
                    if (s.sciName) updateSpeciesForm.find("input[data-field=latin-name]").val(s.sciName).change();
                    if (s.familyComName) {
                        let familySelect = updateSpeciesForm.find("select[data-field=family]");
                        let matchingOption = familySelect.find("option").filter(function () {
                            return $(this).text() === s.familyComName;
                        });

                        if (matchingOption.length > 0) {
                            familySelect.val(matchingOption.val()).trigger('change');
                        } else {
                            // Family doesn't exist, add it
                            addFamily(s.familyComName, s.familyCode, s.familySciName);
                            // Re-populate and select
                            // Since addFamily updates data.families but we need to update UI dropdown
                            // We can either simple append option or refresh the whole select
                            familySelect.append("<option value='" + s.familyComName + "'>" + s.familyComName + "</option>");
                            familySelect.val(s.familyComName).trigger('change');
                            
                            // Also update the add-family-form's name dropdown
                            let addFamilySelect = $("#add-family-form select[data-field=name]");
                            if (addFamilySelect.length > 0 && addFamilySelect.find("option[value='" + s.familyComName + "']").length === 0) {
                                addFamilySelect.append("<option value='" + s.familyComName + "'>" + s.familyComName + "</option>");
                            }
                        }
                    }
                }
            }).finally(() => hideLoader("sci-name"));
        }
    });
    updateSpeciesForm.find("input[data-field=latin-name]").unbind("change").change(function () {
        let v = $(this).val();
        if (v != null && v != undefined) $(this).val(v.toLowerCase().trim());
    });
}

function getTextDOM(field, value, width, placeholder) {
    let html = `<div class='input-clear-wrapper ${value ? 'has-value' : ''}' style='width:${width}'>`;
    html += `<input type='text' data-field='${field}' value='${value}' style='width:100%' placeholder='${placeholder}'></input>`;
    html += `<button type='button' class='input-clear-btn' title='Clear' tabindex='-1'>✕</button>`;
    html += `</div>`;
    return html;
}

export function renderSightingsTable(OFFSET, ROWS) {
    const table = $("#sightings-table");
    table.html("");
    table.append("<tr>" +
        "<th class='noborder' style='width: 60px;'></th>" +
        "<th style='width: 246px;'>Species</th>" +
        "<th>Media</th>" +
        "<th style='width: 264px;'>Date & Place</th>" +
        "<th style='width: 130px;'>Properties</th>" +
        "<th class='noborder' style='width: 30px;'></th>" +
        "</tr>");
    const searchKey = $("input[name=filter-sighting]").val() || "";
    const filteredSightings = data.sightings.filter(b => sightingMatches(b, searchKey));

    // Update pagination text/buttons here or separate? 
    // The original code did it at the end of render(). 
    // I can do it here or split it.
    // Let's do table rows first.

    filteredSightings.slice(OFFSET, OFFSET + ROWS).forEach(function (sighting, i) {
        let row = "<tr id='" + sighting.key + "' class='draggable-sighting'>";

        row += "<td class='noborder' style='vertical-align: middle;'>"
        row += "<div style='display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 10px;'>"
        row += "<button class='delete-sighting' title='Delete sighting'>🗑️</button>";
        row += "<input class='hide-toggle' type='checkbox' data-field='hidden' " + (sighting.hidden ? "" : "checked") + " title='Hide/Unhide sighting'/>";
        row += "</div></td>";

        row += "<td>"
        row += getSelectDOM("species", data.species, getValue(sighting, 'species'), "246px", "data-no-clear='true'");
        row += "<br>";
        row += "<textarea data-field='description' style='width:246px;height:70px' placeholder='Enter Description'>" + getValue(sighting, 'description') + "</textarea>";
        row += getTextDOM("author", getValue(sighting, 'author'), "246px", Constants.DEFAULT_AUTHOR);
        // Star rating widget
        let currentRating = parseInt(getValue(sighting, 'rating')) || 0;
        row += "<div class='star-rating' style='margin-top:4px;'>";
        for (let s = 1; s <= 5; s++) {
            row += "<span class='star-btn" + (s <= currentRating ? " active" : "") + "' data-value='" + s + "'>★</span>";
        }
        row += "</div>";
        row += "<div style='margin-top:8px; display:flex; align-items:center;'><input class='unconfirmed-toggle' type='checkbox' data-field='unconfirmed' " + (sighting.unconfirmed ? "checked" : "") + " title='Unconfirmed'/> <span class='label'>Unconfirmed</span></div>";
        row += "</td>";

        row += "<td><div class='media-container' data-sightingkey='" + sighting.key + "' style='width: 100%; min-width: 300px; min-height: 50px; padding: 5px; border-radius: 4px; border: 1px dashed transparent;'>";
        (sighting.media || []).forEach(function (media, i) {
            row += "<div class='thumbnail' draggable='true' data-mediasrc='" + media.src + "' data-sightingkey='" + sighting.key + "' data-fullsrc='" + Util.getMedia(media.src) + "' data-mediatype='" + media.type + "'>";
            let ext = media.src.split('.').pop().toLowerCase();
            row += "<div class='media-header'>";
            row += "<span class='media-ext-badge'>." + ext + "</span>";
            row += "<button class='delete-media' data-mediasrc='" + media.src + "' title='Delete media'>🗑️</button>";
            row += "</div>";
            if (media.type == 'video') {
                if (media.thumbnail && media.thumbnail.toLowerCase().endsWith('.jpg')) {
                    row += "<div style='position: relative; display: block; margin-bottom: 5px; width: 80px; height: 80px;'>";
                    row += "<img src='" + Util.getMedia(media.thumbnail) + "' class='enlargeable-media' title='Click to enlarge' style='margin-bottom: 0;'/>";
                    row += "<div class='play-overlay' style='position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; color: white; opacity: 0.8; pointer-events: none; text-shadow: 0px 0px 4px black;'>▶️</div>";
                    row += "</div>";
                } else {
                    row += "<div class='video-placeholder enlargeable-media' title='Click to enlarge' style='width: 80px; height: 80px; background: #2b303b; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; margin-bottom: 5px; border-radius: 4px;'>📽️</div>";
                }
            } else {
                row += "<img src='" + Util.getMedia(media.src) + "' class='enlargeable-media' title='Click to enlarge'/>";
            }
            row += "<textarea class='title-textbox' data-mediasrc='" + media.src + "' style='font-size:0.8em;height:68px;width:80px;resize:none;overflow:hidden;' placeholder='Add title'>" + (media.title || "") + "</textarea>";
            let cameraModelParts = (media.exif_data ? (media.exif_data.camera_model || "") : "").split('+').map(x => x.trim()).filter(x => x);
            let camCount = cameraModelParts.length;

            // Combined Camera & Lens Multiselect
            row += "<div class='camera-select-wrapper' style='display:flex; justify-content: flex-start; align-items: center; gap: 4px; margin-top:2px;'>";
            row += "<select class='camera-model-select' data-icon-only='true' data-tags='true' data-mediasrc='" + media.src + "' multiple style='width:28px; font-size: 11px;' title='" + (media.exif_data?.camera_model || "Select Camera & Lens") + "'>";
            let foundParts = new Set();
            if (data.camera_model) {
                for (const [k, v] of Object.entries(data.camera_model)) {
                    const isSelected = cameraModelParts.includes(k);
                    if (isSelected) foundParts.add(k);
                    row += "<option value='" + k + "' " + (isSelected ? 'selected' : '') + " title='" + v + "'>" + v + "</option>";
                }
            }
            cameraModelParts.forEach(part => {
                if (!foundParts.has(part)) {
                    row += "<option value='" + part + "' selected title='" + part + "'>" + part + "</option>";
                }
            });
            row += "</select>";
            row += "<span class='camera-count'>" + (camCount > 0 ? camCount : "") + "</span>";

            if (media.type == 'video') {
                let availableImages = (sighting.media || []).filter(m => m.type !== 'video');
                if (availableImages.length > 0) {
                    row += "<select class='thumbnail-select' data-icon-only='true' data-display-icon='🖼️' data-mediasrc='" + media.src + "' title='Set Thumbnail' style='width:28px; font-size: 11px;'>";
                    row += "<option value='' " + (!media.thumbnail ? 'selected' : '') + " data-icon=\"<span style='font-size:16px; margin-right:4px;'>❌</span>\">Clear Thumbnail</option>";
                    availableImages.forEach((img, idx) => {
                        let isSelected = media.thumbnail === img.src;
                        let iconHtml = "<img src='" + Util.getMedia(img.src) + "' style='width: 30px; height: 30px; object-fit: cover; border-radius: 2px; margin-right:4px;' />";
                        row += "<option value='" + img.src + "' " + (isSelected ? 'selected' : '') + " data-icon=\"" + iconHtml + "\">Image " + (idx + 1) + "</option>";
                    });
                    row += "</select>";
                }
            }
            row += "</div>";
            row += "</div>";
        });
        row += "<button class='upload-button' title='Add media'>+</button>";
        row += "<input class='upload' type='file' accept='.jpg,.mp4' hidden/>";
        row += "</div></td>";

        row += "<td class='place-fields'>";
        row += "<input type='date' data-field='date' value='" + moment(sighting.date, 'DD-mm-yyyy').format('yyyy-mm-DD') + "' style='width:254px'></input><br>";
        row += getSelectDOM("time_of_day", Constants.OPT_TIME_OF_DAY, getValue(sighting, 'time_of_day'), "125px");
        row += getSelectDOM("weather", Constants.OPT_WEATHER, getValue(sighting, 'weather'), "125px") + "<br>";
        row += getSelectDOM("country", data.countries, getValue(sighting, 'country'), "254px", "data-no-clear='true'") + "<br>";
        row += getSelectDOM("state", (data.countries[sighting.country] ? data.countries[sighting.country].states : {}), getValue(sighting, 'state'), "254px", "data-no-clear='true'") + "<br>";
        row += getTextDOM("city", getValue(sighting, 'city'), "254px", "Add city") + "<br>";
        row += "<div style='display: flex; align-items: center; gap: 4px;'>";
        row += getTextDOM("place", getValue(sighting, 'place'), "220px", "Add place");
        row += "<button type='button' class='geocode-sighting-btn' data-sightingkey='" + sighting.key + "' title='Auto-fill coordinates for this place via Nominatim' style='padding: 4px 8px; font-size: 13px; cursor: pointer; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff;'>📍</button>";
        row += "</div>";
        row += "</td>";

        row += "<td class='property-fields'>";
        row += getSelectDOM("gender", Constants.OPT_GENDER, getValue(sighting, 'gender'), "120px");
        row += getSelectDOM("age", Constants.OPT_AGE[currentMode], getValue(sighting, 'age'), "120px");
        row += getSelectDOM("plumage", Constants.OPT_PLUMAGE[currentMode], getValue(sighting, 'plumage'), "120px");
        row += getTextDOM("variation", getValue(sighting, 'variation'), "120px", "Add variation");
        row += getTextDOM("subspecies", getValue(sighting, 'subspecies'), "120px", "Add subspecies");
        row += "</td>";

        row += "<td class='noborder'>";
        row += "<div class='drag-handle' draggable='true' title='Drag to reorder' style='font-size: 28px; cursor: grab; color: #64748b; padding: 10px 5px; text-align: center; user-select: none;'>⋮⋮</div>";
        row += "</td>";

        row += "</tr>";

        table.append(row);


        const sightingRow = $("#" + sighting.key);

        // Init searchable selects on large-option dropdowns
        initSearchableSelect(sightingRow.find("select[data-field=species]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=country]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=state]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=time_of_day]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=weather]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=gender]")[0]);

        sightingRow.find('.camera-model-select').each(function () {
            initSearchableSelect(this);
        });
        sightingRow.find('.thumbnail-select').each(function () {
            initSearchableSelect(this);
        });





        sightingRow.on('dragstart', function (e) {
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', sighting.key);
            let rect = this.getBoundingClientRect();
            e.originalEvent.dataTransfer.setDragImage(this, e.originalEvent.clientX - rect.left, e.originalEvent.clientY - rect.top);
            $(this).css('opacity', '0.5');
        });
        sightingRow.on('dragend', function (e) {
            $(this).css('opacity', '1');
            $("tr").removeClass('drag-over-top drag-over-bottom');
        });
        sightingRow.on('dragover', function (e) {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            let bounding = this.getBoundingClientRect();
            let offset = bounding.y + (bounding.height / 2);
            if (e.originalEvent.clientY > offset) {
                $(this).removeClass('drag-over-top').addClass('drag-over-bottom');
            } else {
                $(this).removeClass('drag-over-bottom').addClass('drag-over-top');
            }
        });
        sightingRow.on('dragleave', function (e) {
            $(this).removeClass('drag-over-top drag-over-bottom');
        });
        sightingRow.on('drop', function (e) {
            e.preventDefault();
            $(this).removeClass('drag-over-top drag-over-bottom');
            let draggedKey = e.originalEvent.dataTransfer.getData('text/plain');
            let targetKey = sighting.key;
            if (draggedKey && draggedKey !== targetKey) {
                let bounding = this.getBoundingClientRect();
                let offset = bounding.y + (bounding.height / 2);
                let dropAfter = e.originalEvent.clientY > offset;
                moveSightingToTarget(draggedKey, targetKey, dropAfter);
            }
        });

        sightingRow.find(".upload-button").click(function () {
            sightingRow.find(".upload").click();
        });
        sightingRow.find(".upload").change(function () {
            if (this.files[0] && this.files[0].type.match(/image.*/)) {
                openCropper(this.files[0], (croppedFile) => {
                    uploadMedia(sighting.key, [croppedFile]);
                });
                $(this).val(''); // Reset input
            } else {
                uploadMedia(sighting.key, this.files);
            }
        });
        sightingRow.find("input[type=text], input[type=date], input[type=date], input[type=checkbox], select, textarea").not(".thumbnail *").change(function () {
            let value = ($(this).attr('type') == 'checkbox') ? $(this).is(":checked") : $(this).val();
            updateField(sighting.key, $(this).attr("data-field"), value);
        });
        // Star rating click handler
        sightingRow.find(".star-btn").click(function () {
            let rating = $(this).data('value');
            // If clicking the same rating that's already set, clear it
            if (parseInt(getValue(sighting, 'rating')) === rating) {
                rating = 0;
            }
            updateField(sighting.key, 'rating', String(rating));
            // Update stars visually
            $(this).closest('.star-rating').find('.star-btn').each(function () {
                if ($(this).data('value') <= rating) {
                    $(this).addClass('active');
                } else {
                    $(this).removeClass('active');
                }
            });
        });
        sightingRow.find("select[data-field=country]").change(function () {
            const firstStateInCountry = Object.keys(data.countries[$(this).val()].states)[0];
            updateField(sighting.key, 'state', firstStateInCountry);
        });
        sightingRow.find(".geocode-sighting-btn").click(async function () {
            const $btn = $(this);
            const country = sightingRow.find("select[data-field=country]").val() || sighting.country;
            const state = sightingRow.find("select[data-field=state]").val() || sighting.state;
            const city = sightingRow.find("input[data-field=city]").val() || sighting.city;
            const place = sightingRow.find("input[data-field=place]").val() || sighting.place;

            if (!country || !state || (!city && !place)) {
                customAlert("Please specify at least Country, State, and City/Place to geocode.");
                return;
            }

            $btn.text("⏳").attr("disabled", "disabled");
            try {
                const res = await geocodeAndSaveLocation({ country, state, city, place });
                if (res) {
                    showToast(`📍 Geocoded ${place || city}: ${res.lat}, ${res.lng} (radius: ${res.radius}km) via ${res.provider}`, 'success');
                    $btn.text("✅");
                    setTimeout(() => $btn.text("📍").removeAttr("disabled"), 2500);
                } else {
                    customAlert(`Could not locate "${place || city}, ${state}, ${country}".`);
                    $btn.text("📍").removeAttr("disabled");
                }
            } catch (err) {
                console.error(err);
                customAlert("Geocoding failed: " + err.message);
                $btn.text("📍").removeAttr("disabled");
            }
        });
        sightingRow.find("button.delete-media").click(function () {
            deleteMedia(sighting.key, $(this).attr("data-mediasrc"));
        });
        sightingRow.find(".thumbnail").on('dragstart', function (e) {
            e.stopPropagation();
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
                src: $(this).attr('data-mediasrc'),
                sightingKey: $(this).attr('data-sightingkey')
            }));
            $(this).css('opacity', '0.5');
        }).on('dragend', function (e) {
            e.stopPropagation();
            $(this).css('opacity', '1');
            sightingRow.find(".thumbnail").removeClass('drag-over-left drag-over-right');
        }).on('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            let bounding = this.getBoundingClientRect();
            let offset = bounding.x + (bounding.width / 2);
            if (e.originalEvent.clientX > offset) {
                $(this).removeClass('drag-over-left').addClass('drag-over-right');
            } else {
                $(this).removeClass('drag-over-right').addClass('drag-over-left');
            }
        }).on('dragleave', function (e) {
            e.stopPropagation();
            $(this).removeClass('drag-over-left drag-over-right');
        }).on('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over-left drag-over-right');
            let draggedData = e.originalEvent.dataTransfer.getData('text/plain');
            let dragged;
            try {
                dragged = JSON.parse(draggedData);
            } catch (err) {
                return;
            }
            let targetSrc = $(this).attr('data-mediasrc');
            if (dragged.src && dragged.src !== targetSrc) {
                let bounding = this.getBoundingClientRect();
                let offset = bounding.x + (bounding.width / 2);
                let dropAfter = e.originalEvent.clientX > offset;
                moveMediaToTarget(dragged.sightingKey, sighting.key, dragged.src, targetSrc, dropAfter);
            }
        });

        sightingRow.find(".media-container").on('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            $(this).css('border-color', '#38bdf8');
        }).on('dragleave', function (e) {
            e.stopPropagation();
            $(this).css('border-color', 'transparent');
        }).on('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).css('border-color', 'transparent');
            if ($(e.target).closest('.thumbnail').length > 0) return; // Handled by thumbnail drop
            let draggedData = e.originalEvent.dataTransfer.getData('text/plain');
            let dragged;
            try {
                dragged = JSON.parse(draggedData);
            } catch (err) {
                return;
            }
            let targetSightingKey = $(this).attr('data-sightingkey');
            if (dragged.src) {
                moveMediaToTarget(dragged.sightingKey, targetSightingKey, dragged.src, null, true);
            }
        });
        sightingRow.find(".thumbnail .title-textbox").change(function () {
            updateMediaProperty(sighting.key, $(this).attr("data-mediasrc"), "title", $(this).val());
        });
        sightingRow.find(".thumbnail .thumbnail-select").change(function () {
            updateMediaProperty(sighting.key, $(this).attr("data-mediasrc"), "thumbnail", $(this).val());
            triggerRender();
        });
        sightingRow.find(".thumbnail .camera-model-select").change(function () {
            const mediaSrc = $(this).attr("data-mediasrc");
            let selectedVals = $(this).val() || [];
            if (!Array.isArray(selectedVals)) selectedVals = [selectedVals];

            let combinedValue = selectedVals.join("+");
            updateMediaProperty(sighting.key, mediaSrc, "exif_data.camera_model", combinedValue);

            // Update tooltip and count
            let tooltipNames = selectedVals.map(v => data.camera_model[v] || v).join(", ");
            $(this).attr("title", tooltipNames || "Select Camera & Lens");
            $(this).closest('.camera-select-wrapper').find('.camera-count').text(selectedVals.length > 0 ? selectedVals.length : "");
        });
        sightingRow.find(".delete-sighting").click(() => deleteSighting(sighting.key));
        sightingRow.find("select[data-field=country]").change(function () {
            sightingRow.find("select[data-field=state]").prop('innerHTML', getSelectOptionsDOM("state", data.countries[sighting.country].states, getValue(sighting, 'state')));
            sightingRow.find("select[data-field=state]").trigger('change');
        });
    });

}

export function updatePaginationControls(OFFSET, ROWS) {
    const searchKey = $("input[name=filter-sighting]").val() || "";
    const filteredSightings = data.sightings.filter(b => sightingMatches(b, searchKey));

    $('.page-number').html(OFFSET + " - " + Math.min(OFFSET + ROWS, filteredSightings.length) + " of " + filteredSightings.length);

    if (OFFSET == 0) {
        $('button.first-page, button.previous').attr("disabled", "disabled");
    } else {
        $('button.first-page, button.previous').removeAttr("disabled");
    }

    if (OFFSET + ROWS >= filteredSightings.length) {
        $('button.last-page, button.next').attr("disabled", "disabled");
    } else {
        $('button.last-page, button.next').removeAttr("disabled");
    }
}

export function validateAddFamilyForm() {
    const addFamilyForm = $("#add-family-form");
    let name = addFamilyForm.find("select[data-field=name]").val();
    if (name && name.trim()) {
        addFamilyForm.find("button.submit").removeAttr("disabled");
    } else {
        addFamilyForm.find("button.submit").attr("disabled", "disabled");
    }
}

// Helper to fill form based on selection
export function fillAddFamilyForm() {
    const addFamilyForm = $("#add-family-form");
    let name = addFamilyForm.find("select[data-field=name]").val();
    let nameVal = addFamilyForm.find("select[data-field=name]").val();
    let family = data.families.find(f => f.name == nameVal);
    if (family) {
        addFamilyForm.find("input[data-field=sci-name]").val(family.sci_name || "");
        addFamilyForm.find("input[data-field=ebird-code]").val(family.ebird_code || "");

        let count = Object.values(data.species).filter(s => s.family == nameVal).length;
        addFamilyForm.find("span[data-field=species-count]").text(count);

        addFamilyForm.find("button.submit").html("Update");
        if (count == 0) {
            addFamilyForm.find("button.delete").removeAttr("disabled");
        } else {
            addFamilyForm.find("button.delete").attr("disabled", "disabled");
        }
    } else {
        addFamilyForm.find("input[data-field=sci-name]").val("");
        addFamilyForm.find("input[data-field=ebird-code]").val('');
        addFamilyForm.find("span[data-field=species-count]").text("0");
        addFamilyForm.find("button.submit").html("Add");
        addFamilyForm.find("button.delete").attr("disabled", "disabled");
    }

    if (currentMode != Constants.MODE_BIRD) {
        addFamilyForm.find("input[data-field=ebird-code]").closest('tr').hide();
    } else {
        addFamilyForm.find("input[data-field=ebird-code]").closest('tr').show();
    }
    
    validateAddFamilyForm();
}

export function setupAddFamilyForm() {
    const addFamilyForm = $("#add-family-form");
    $("#add-family-section").show();

    // Populate family select
    let $famInput = addFamilyForm.find("select[data-field=name]");

    $famInput.html('');
    $famInput.append("<option value=''></option>");
    data.families.forEach(function (family) {
        $famInput.append("<option value=\"" + family.name + "\">" + family.name + "</option>");
    });

    $famInput.val('');
    fillAddFamilyForm();
    $famInput.unbind("change").on("change", fillAddFamilyForm);
    $famInput.on("change input", validateAddFamilyForm);

    $famInput.attr("placeholder", "Select or type a family...");
    initSearchableSelect($famInput[0]);

    addFamilyForm.find("input[data-field=ebird-code]").unbind("change").change(function () {
        let v = $(this).val();
        if (!v || !v.trim()) return;

        if (currentMode == Constants.MODE_BIRD) {
            showLoader("ebird-family", "Fetching Family from eBird");
            EbirdApi.fetchEbirdSciName(v).then(s => {
                if (s) {
                    let fName = s.category == 'family' ? s.comName : s.familyComName;
                    let fSciName = s.category == 'family' ? s.sciName : s.familySciName;
                    
                    if (fName) {
                        let nameInput = addFamilyForm.find("select[data-field=name]");
                        if (nameInput.find("option[value='" + fName + "']").length == 0) {
                            nameInput.append("<option value='" + fName + "'>" + fName + "</option>");
                        }
                        nameInput.val(fName).trigger('change');
                    }
                    if (fSciName) {
                        addFamilyForm.find("input[data-field=sci-name]").val(fSciName).change();
                    }
                }
            }).finally(() => hideLoader("ebird-family"));
        }
    });

    addFamilyForm.find("button.submit").unbind("click").click(function () {
        let name = $famInput.val();
        if (!name) return;

        addFamily(
            name,
            addFamilyForm.find("input[data-field=ebird-code]").val(),
            addFamilyForm.find("input[data-field=sci-name]").val()
        );

        // Refresh update species form dropdown if it's a new family
        let speciesFamilySelect = $("#update-species-form").find("select[data-field=family]");
        if (speciesFamilySelect.find("option[value='" + name + "']").length == 0) {
            speciesFamilySelect.append("<option value='" + name + "'>" + name + "</option>");
        }

        // Also update the select if it's new
        if ($famInput.find("option[value='" + name + "']").length == 0) {
            $famInput.append("<option value='" + name + "'>" + name + "</option>");
        }

        // Clear form
        $famInput.val('').trigger('change');
    });

    addFamilyForm.find("button.delete").unbind("click").click(function () {
        let name = $famInput.val();
        if (!name) return;

        deleteFamily(name, () => {
            // Remove from species form dropdown
            let speciesFamilySelect = $("#update-species-form").find("select[data-field=family]");
            speciesFamilySelect.find("option[value='" + name + "']").remove();

            // Remove from select and reset
            $famInput.find("option[value='" + name + "']").remove();
            $famInput.val('').trigger('change');
        });
    });
}

$(document).ready(function() {
    $(document).on('click', '.input-clear-btn', function () {
        let wrapper = $(this).closest('.input-clear-wrapper');
        let input = wrapper.find('input');
        input.val('').trigger('change');
        wrapper.removeClass('has-value');
    });

    $(document).on('input change', '.input-clear-wrapper input', function () {
        let wrapper = $(this).closest('.input-clear-wrapper');
        if ($(this).val()) {
            wrapper.addClass('has-value');
        } else {
            wrapper.removeClass('has-value');
        }
    });
});

/**
 * Setup and initialize the Places & Geocoding tab
 */
export function setupPlacesTab() {
    const $placesTab = $('#places-tab');
    if (!$placesTab.length) return;

    // Provider select
    const $providerSelect = $('#geo-provider-select');
    $providerSelect.val(geoService.getActiveProviderName());
    $providerSelect.off('change').on('change', function () {
        const newProvider = $(this).val();
        setGeoProvider(newProvider);
        $('#geo-provider-status').text(`Active provider: ${newProvider.charAt(0).toUpperCase() + newProvider.slice(1)}`);
        showToast(`Switched geocoding provider to ${newProvider}`, 'info');
    });

    // Populate Country, State, City, Place selectors
    const $countrySelect = $('#place-lookup-country');
    const $stateSelect = $('#place-lookup-state');
    const $cityInput = $('#place-lookup-city');
    const $cityList = $('#place-lookup-city-list');
    const $placeInput = $('#place-lookup-place');
    const $placeList = $('#place-lookup-place-list');
    const $newStateCountrySelect = $('#new-state-country-select');
    const $scanCountryFilter = $('#scan-country-filter');

    function updateCurrentCoordsBanner() {
        const country = $countrySelect.val();
        const state = $stateSelect.val();
        const city = $cityInput.val().trim();
        const place = $placeInput.val().trim();

        if (!country) {
            $('#place-current-coords-box').hide();
            $('#btn-batch-regeocode-sub').hide();
            $('#btn-fetch-geo').text('🔍 Fetch Coordinates');
            return;
        }

        const type = place ? 'place' : (city ? 'city' : (state ? 'state' : 'country'));
        const name = place || city || state || country;

        const node = getPlaceNode({ country, state, city, place });
        if (node) {
            if (node.lat && node.lng) {
                $('#place-current-coords-box').show();
                $('#place-current-coords-title').text(`Currently Saved (${type.toUpperCase()}): "${name}"`);
                $('#place-current-coords-text').html(
                    `📍 <strong>Lat:</strong> ${node.lat}, <strong>Lng:</strong> ${node.lng} &nbsp;|&nbsp; <strong>Radius:</strong> ${node.radius || '-'} km`
                );
                $('#btn-fetch-geo').text(`🔄 Re-Geocode ${type.charAt(0).toUpperCase() + type.slice(1)}`);
            } else {
                $('#place-current-coords-box').show();
                $('#place-current-coords-title').text(`Status (${type.toUpperCase()}): "${name}"`);
                $('#place-current-coords-text').html(`<span style="color: #f59e0b;">⚠️ In places.json, but coordinates are missing!</span>`);
                $('#btn-fetch-geo').text(`🔍 Geocode ${type.charAt(0).toUpperCase() + type.slice(1)}`);
            }
        } else {
            $('#place-current-coords-box').show();
            $('#place-current-coords-title').text(`New Location: "${name}"`);
            $('#place-current-coords-text').html(`<span style="color: #94a3b8;">ℹ️ Not saved in places.json yet</span>`);
            $('#btn-fetch-geo').text(`🔍 Fetch & Save Coordinates`);
        }

        // Check for batch sub-location re-geocoding options
        if (country && !state && !city && !place) {
            const statesCount = Object.keys(data.countries[country]?.states || {}).length;
            if (statesCount > 0) {
                $('#btn-batch-regeocode-sub').show().text(`⚡ Re-Geocode All ${statesCount} States in ${country}`);
            } else {
                $('#btn-batch-regeocode-sub').hide();
            }
        } else if (country && state && !city && !place) {
            const stateNode = data.countries[country]?.states?.[state];
            let subCount = 0;
            if (stateNode && stateNode.cities) {
                Object.keys(stateNode.cities).forEach(c => {
                    subCount++;
                    subCount += Object.keys(stateNode.cities[c].places || {}).length;
                });
            }
            if (subCount > 0) {
                $('#btn-batch-regeocode-sub').show().text(`⚡ Re-Geocode All (${subCount}) Cities & Places in ${state}`);
            } else {
                $('#btn-batch-regeocode-sub').hide();
            }
        } else {
            $('#btn-batch-regeocode-sub').hide();
        }
    }

    function updateCityDatalist() {
        const c = $countrySelect.val();
        const s = $stateSelect.val();
        let options = '';
        if (c && s && data.countries?.[c]?.states?.[s]?.cities) {
            Object.keys(data.countries[c].states[s].cities).sort().forEach(cityName => {
                options += `<option value="${cityName}">`;
            });
        }
        $cityList.html(options);
    }

    function updatePlaceDatalist() {
        const c = $countrySelect.val();
        const s = $stateSelect.val();
        const city = $cityInput.val().trim();
        let options = '';
        if (c && s && city && data.countries?.[c]?.states?.[s]?.cities?.[city]?.places) {
            Object.keys(data.countries[c].states[s].cities[city].places).sort().forEach(placeName => {
                options += `<option value="${placeName}">`;
            });
        }
        $placeList.html(options);
    }

    // ==========================================
    // Geo Boundaries Management Logic
    // ==========================================
    const $boundaryCountrySelect = $('#boundary-inspect-country');
    const $boundaryStateSelect = $('#boundary-inspect-state');
    const $boundaryStatusBox = $('#boundary-status-box');
    const $boundaryStatusText = $('#boundary-status-text');

    async function updateBoundaryCoverageUI() {
        await ensureGeoBoundariesLoaded();
        const coverage = getGeoBoundaryCoverage();

        const countryPct = coverage.countries.total > 0 ? Math.round((coverage.countries.covered / coverage.countries.total) * 100) : 0;
        const statePct = coverage.states.total > 0 ? Math.round((coverage.states.covered / coverage.states.total) * 100) : 0;

        $('#boundary-stat-countries').text(`${coverage.countries.covered} / ${coverage.countries.total} (${countryPct}%)`);
        $('#boundary-stat-states').text(`${coverage.states.covered} / ${coverage.states.total} (${statePct}%)`);

        if (coverage.countries.missing.length > 0) {
            $('#boundary-missing-alert').show().html(
                `⚠️ <strong>Missing country polygons (${coverage.countries.missing.length}):</strong> ${coverage.countries.missing.join(', ')} (falls back to circle on map)`
            );
        } else if (coverage.states.missing.length > 0) {
            $('#boundary-missing-alert').show().html(
                `⚠️ <strong>Missing state polygons (${coverage.states.missing.length}):</strong> ${coverage.states.missing.slice(0, 6).join(', ')}${coverage.states.missing.length > 6 ? '...' : ''}`
            );
        } else {
            $('#boundary-missing-alert').hide();
        }
    }

    function refreshBoundarySelects() {
        const countries = data.countries || {};
        let options = '<option value="">-- Select Country --</option>';
        Object.keys(countries).sort().forEach(c => {
            options += `<option value="${c}">${c}</option>`;
        });
        $boundaryCountrySelect.html(options);

        $boundaryCountrySelect.off('change').on('change', function () {
            const c = $(this).val();
            let stateOptions = '<option value="">(Country-level Boundary)</option>';
            if (c && countries[c] && countries[c].states) {
                Object.keys(countries[c].states).sort().forEach(s => {
                    stateOptions += `<option value="${s}">${s}</option>`;
                });
            }
            $boundaryStateSelect.html(stateOptions);
            updateBoundaryStatus();
        });

        $boundaryStateSelect.off('change').on('change', function () {
            updateBoundaryStatus();
        });
    }

    function updateBoundaryStatus() {
        const country = $boundaryCountrySelect.val();
        const state = $boundaryStateSelect.val();

        if (!country) {
            $boundaryStatusText.html('<span style="color: #94a3b8;">Select a location above to inspect its boundary.</span>');
            return;
        }

        const targetLabel = state ? `${state}, ${country}` : country;
        const level = state ? 'state' : 'country';
        const boundary = getGeoBoundary({ country, state });

        if (boundary) {
            const geom = boundary.geometry || {};
            let count = 0;
            if (geom.type === 'Polygon') {
                geom.coordinates?.forEach(r => count += r.length);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates?.forEach(p => p.forEach(r => count += r.length));
            }
            $boundaryStatusText.html(
                `<div style="color: #22c55e; font-weight: 600; margin-bottom: 4px;">✅ Boundary Polygon Present (${level.toUpperCase()})</div>` +
                `<div><strong>Name:</strong> ${targetLabel} &nbsp;|&nbsp; <strong>Geometry:</strong> ${geom.type || 'Polygon'} (${count} points)</div>`
            );
        } else {
            $boundaryStatusText.html(
                `<div style="color: #f59e0b; font-weight: 600; margin-bottom: 4px;">⚠️ No Boundary Polygon (${level.toUpperCase()})</div>` +
                `<div>"${targetLabel}" currently falls back to a circular hotspot on the map. Click <strong>"Update Boundary"</strong> below to fetch its polygon outline.</div>`
            );
        }
    }

    // Update boundary button: fetch from OSM if missing, save to memory, sync to Firebase, refresh stats
    $('#btn-update-boundary').off('click').on('click', async function () {
        const country = $boundaryCountrySelect.val();
        const state = $boundaryStateSelect.val();
        if (!country) {
            customAlert('Please select a country first.');
            return;
        }
        const targetLabel = state ? `${state}, ${country}` : country;
        const level = state ? 'state' : 'country';
        const $btn = $(this);
        $btn.attr('disabled', 'disabled').text('Updating...');

        try {
            let boundary = getGeoBoundary({ country, state });
            if (!boundary) {
                $boundaryStatusText.html(`<span style="color: #38bdf8;">🌐 Querying OpenStreetMap Nominatim for "${targetLabel}" polygon...</span>`);
                const feature = await fetchBoundaryFromOSM({ country, state });
                saveGeoBoundary({ level, country, state, feature });
                showToast(`Boundary for "${targetLabel}" fetched and saved to memory.`, 'success');
            } else {
                showToast(`Boundary for "${targetLabel}" already in memory.`, 'info');
            }
            updateBoundaryStatus();
            updateBoundaryCoverageUI();
        } catch (err) {
            console.error('Update boundary failed:', err);
            $boundaryStatusText.html(`<span style="color: #ef4444;">Error: ${err.message}</span>`);
            showToast(`Update failed: ${err.message}`, 'error');
        } finally {
            setTimeout(() => { $btn.removeAttr('disabled').text('🔄 Update Boundary'); }, 1500);
        }
    });

    // Update all states for selected country
    $('#btn-update-all-states').off('click').on('click', async function () {
        const country = $boundaryCountrySelect.val();
        if (!country) {
            customAlert('Please select a country first.');
            return;
        }
        const $btn = $(this);
        $btn.attr('disabled', 'disabled').text('Updating...');

        try {
            const countries = data.countries || {};
            const states = countries[country]?.states || {};
            const stateNames = Object.keys(states);
            if (stateNames.length === 0) {
                showToast(`No states found for ${country}.`, 'info');
                return;
            }

            let fetched = 0;
            let skipped = 0;
            const CHUNK_SIZE = 10;
            let processed = 0;
            for (const stateName of stateNames) {
                const boundary = getGeoBoundary({ country, state: stateName });
                if (!boundary) {
                    $boundaryStatusText.html(`<span style="color: #38bdf8;">🌐 Fetching ${stateName}, ${country}...</span>`);
                    const feature = await fetchBoundaryFromOSM({ country, state: stateName });
                    saveGeoBoundary({ level: 'state', country, state: stateName, feature });
                    fetched++;
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    skipped++;
                }
                processed++;
                if (processed % CHUNK_SIZE === 0 || processed === stateNames.length) {
                    updateBoundaryCoverageUI();
                }
            }

            updateBoundaryStatus();
            showToast(`Updated ${country}: ${fetched} state(s) fetched, ${skipped} already present.`, 'success');
        } catch (err) {
            console.error('Update all states failed:', err);
            $boundaryStatusText.html(`<span style="color: #ef4444;">Error: ${err.message}</span>`);
            showToast(`Update all states failed: ${err.message}`, 'error');
        } finally {
            setTimeout(() => { $btn.removeAttr('disabled').text('🔄 Update All States'); }, 1500);
        }
    });

    function refreshSelects() {
        const countries = data.countries || {};
        let countryOptions = '<option value="">-- Select Country --</option>';
        Object.keys(countries).sort().forEach(c => {
            countryOptions += `<option value="${c}">${c}</option>`;
        });
        $countrySelect.html(countryOptions);
        $newStateCountrySelect.html(countryOptions);
        $scanCountryFilter.html(countryOptions);

        $countrySelect.off('change').on('change', function () {
            const c = $(this).val();
            let stateOptions = '<option value="">-- All / Country Level --</option>';
            if (c && countries[c] && countries[c].states) {
                Object.keys(countries[c].states).sort().forEach(s => {
                    stateOptions += `<option value="${s}">${s}</option>`;
                });
            }
            $stateSelect.html(stateOptions);
            $cityInput.val('');
            $placeInput.val('');
            updateCityDatalist();
            updatePlaceDatalist();
            updateCurrentCoordsBanner();
        });

        $stateSelect.off('change').on('change', function () {
            $cityInput.val('');
            $placeInput.val('');
            updateCityDatalist();
            updatePlaceDatalist();
            updateCurrentCoordsBanner();
        });

        $cityInput.off('input change').on('input change', function () {
            updatePlaceDatalist();
            updateCurrentCoordsBanner();
        });

        $placeInput.off('input change').on('input change', function () {
            updateCurrentCoordsBanner();
        });

        refreshBoundarySelects();
        updateBoundaryCoverageUI();
    }
    refreshSelects();

    // Add New Country
    $('#btn-add-country').off('click').on('click', async function () {
        const $btn = $(this);
        const countryName = $('#new-country-name').val().trim();
        const fetchStates = $('#chk-country-fetch-states').is(':checked');
        const geocode = $('#chk-country-geocode').is(':checked');
        const geocodeStates = $('#chk-country-geocode-states').is(':checked');
        const $status = $('#add-country-status');

        if (!countryName) {
            customAlert('Please enter a Country name.');
            return;
        }

        $btn.text('⏳ Adding...').attr('disabled', 'disabled');
        $status.show().css({ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' })
               .text(`Adding "${countryName}"${fetchStates ? ' and fetching states...' : '...'}`);

        try {
            const res = await addNewCountry({
                country: countryName,
                fetchStates,
                geocode,
                geocodeStates,
                onProgress: (current, total, name) => {
                    $status.text(`Geocoding state [${current}/${total}] "${name}"...`);
                }
            });
            let msg = `Added "${res.country}"!`;
            if (res.geocoded) msg += ' Country coordinates saved.';
            if (res.statesCount > 0) msg += ` Populated ${res.statesCount} states/provinces.`;

            $status.css({ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }).text(msg);
            showToast(`Added country "${res.country}" with ${res.statesCount} states!`, 'success');
            $('#new-country-name').val('');
            refreshSelects();
            $countrySelect.val(res.country).trigger('change');
            $newStateCountrySelect.val(res.country);
        } catch (err) {
            console.error(err);
            $status.css({ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }).text(err.message);
            customAlert(err.message);
        } finally {
            $btn.text('➕ Add Country').removeAttr('disabled');
        }
    });

    // Add New State
    $('#btn-add-state').off('click').on('click', async function () {
        const $btn = $(this);
        const country = $newStateCountrySelect.val();
        const stateName = $('#new-state-name').val().trim();
        const geocode = $('#chk-state-geocode').is(':checked');
        const $status = $('#add-state-status');

        if (!country) {
            customAlert('Please select an existing Country.');
            return;
        }
        if (!stateName) {
            customAlert('Please enter a State / Province name.');
            return;
        }

        $btn.text('⏳ Adding...').attr('disabled', 'disabled');
        $status.show().css({ background: 'rgba(168,85,247,0.1)', color: '#c084fc' })
               .text(`Adding "${stateName}" under ${country}...`);

        try {
            const res = await addNewState({ country, state: stateName, geocode });
            let msg = `Added state "${res.state}" under ${res.country}!`;
            if (res.geocoded) msg += ' Coordinates saved.';

            $status.css({ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }).text(msg);
            showToast(`Added state "${res.state}"!`, 'success');
            $('#new-state-name').val('');
            refreshSelects();
            $countrySelect.val(country).trigger('change');
            $stateSelect.val(res.state);
        } catch (err) {
            console.error(err);
            $status.css({ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }).text(err.message);
            customAlert(err.message);
        } finally {
            $btn.text('➕ Add State').removeAttr('disabled');
        }
    });

    let currentLookupResult = null;

    // Fetch / Re-geocode selected location
    $('#btn-fetch-geo').off('click').on('click', async function () {
        const country = $countrySelect.val();
        const state = $stateSelect.val();
        const city = $cityInput.val().trim();
        const place = $placeInput.val().trim();

        if (!country) {
            customAlert('Please select at least a Country.');
            return;
        }

        const $btn = $(this);
        const originalText = $btn.text();
        $btn.text('⏳ Geocoding...').attr('disabled', 'disabled');
        $('#geo-lookup-result').hide();

        try {
            const type = place ? 'place' : (city ? 'city' : (state ? 'state' : 'country'));
            const result = await lookupLocation({
                place,
                city,
                state,
                country,
                type
            });

            if (result) {
                currentLookupResult = { ...result, country, state, city, place, type };
                const oldNode = getPlaceNode({ country, state, city, place });
                let diffText = `<strong>${result.displayName}</strong> (via ${result.provider})`;
                if (oldNode && oldNode.lat && oldNode.lng) {
                    diffText += ` &nbsp;|&nbsp; <span style="color: #94a3b8;">Previous: ${oldNode.lat}, ${oldNode.lng} (${oldNode.radius}km)</span>`;
                }
                $('#geo-res-name').html(diffText);
                $('#geo-res-lat-input').val(result.lat);
                $('#geo-res-lng-input').val(result.lng);
                $('#geo-res-radius-input').val(result.radius);
                $('#geo-lookup-result').show();
                showToast(`Coordinates found via ${result.provider}!`, 'success');
            } else {
                const targetName = place || city || state || country;
                customAlert(`No coordinates found for "${targetName}".`);
            }
        } catch (err) {
            console.error(err);
            customAlert('Lookup error: ' + err.message);
        } finally {
            $btn.text(originalText).removeAttr('disabled');
        }
    });

    // Save Re-geocoded Coordinates to Places
    $('#btn-save-geo-result').off('click').on('click', function () {
        if (!currentLookupResult) return;
        const lat = parseFloat($('#geo-res-lat-input').val());
        const lng = parseFloat($('#geo-res-lng-input').val());
        const radius = parseFloat($('#geo-res-radius-input').val());

        if (isNaN(lat) || isNaN(lng)) {
            customAlert('Please provide valid numerical coordinates.');
            return;
        }

        savePlaceGeo({
            country: currentLookupResult.country,
            state: currentLookupResult.state || null,
            city: currentLookupResult.city || null,
            place: currentLookupResult.place || null,
            lat,
            lng,
            radius
        });
        const label = currentLookupResult.place || currentLookupResult.city || currentLookupResult.state || currentLookupResult.country;
        showToast(`Saved "${label}" to places.json!`, 'success');
        $('#geo-lookup-result').hide();
        updateCurrentCoordsBanner();
    });

    // Batch Re-Geocode Sub-Locations (States of Country or Cities/Places of State)
    $('#btn-batch-regeocode-sub').off('click').on('click', async function () {
        const country = $countrySelect.val();
        const state = $stateSelect.val();
        const $btn = $(this);
        const $progress = $('#sub-regeocode-progress');
        const $statusText = $('#sub-regeocode-status-text');

        let subList = [];
        let scopeName = '';

        if (country && !state) {
            scopeName = `all states in ${country}`;
            const states = data.countries[country]?.states || {};
            Object.keys(states).forEach(s => {
                subList.push({ country, state: s, city: '', place: '', type: 'state', displayName: s });
            });
        } else if (country && state) {
            scopeName = `all cities and places in ${state}`;
            const stateNode = data.countries[country]?.states?.[state];
            if (stateNode && stateNode.cities) {
                Object.keys(stateNode.cities).forEach(cityName => {
                    subList.push({ country, state, city: cityName, place: '', type: 'city', displayName: cityName });
                    const cityNode = stateNode.cities[cityName];
                    if (cityNode && cityNode.places) {
                        Object.keys(cityNode.places).forEach(placeName => {
                            subList.push({ country, state, city: cityName, place: placeName, type: 'place', displayName: placeName });
                        });
                    }
                });
            }
        }

        if (subList.length === 0) return;

        $btn.attr('disabled', 'disabled');
        $progress.show();

        let successCount = 0;
        for (let i = 0; i < subList.length; i++) {
            const item = subList[i];
            $statusText.text(`Re-geocoding [${i + 1}/${subList.length}] (${item.type}) "${item.displayName}"...`);

            try {
                const res = await lookupLocation({
                    country: item.country,
                    state: item.state,
                    city: item.city,
                    place: item.place,
                    type: item.type
                });
                if (res) {
                    savePlaceGeo({
                        country: item.country,
                        state: item.state || null,
                        city: item.city || null,
                        place: item.place || null,
                        lat: res.lat,
                        lng: res.lng,
                        radius: res.radius,
                        skipUpload: true
                    });
                    successCount++;
                }
            } catch (e) {
                console.error(`Failed to geocode ${item.displayName}:`, e);
            }
        }

        if (successCount > 0) {
            try {
                uploadJSONData('places', true);
            } catch (err) {
                console.error('Failed to sync places.json:', err);
            }
        }

        $statusText.html(`<span style="color: #22c55e;">Done! Re-geocoded and saved ${successCount} location(s) for ${scopeName}.</span>`);
        $btn.removeAttr('disabled');
        showToast(`Successfully re-geocoded ${successCount} location(s)!`, 'success');
        updateCurrentCoordsBanner();
    });

    // Scan Mode Switcher (missing / all / country)
    $('#scan-mode-select').off('change').on('change', function () {
        const mode = $(this).val();
        if (mode === 'country') {
            $('#scan-country-filter').show();
        } else {
            $('#scan-country-filter').hide();
        }
    });

    // Scan / Re-Geocode Scanner
    $('#btn-scan-missing-places').off('click').on('click', function () {
        const mode = $('#scan-mode-select').val() || 'missing';
        const selectedCountry = $('#scan-country-filter').val();
        const countries = data.countries || {};
        const sightings = data.sightings || [];
        const scanMap = new Map();

        // Helper to check if item matches scan mode
        function shouldInclude(item, isMissing) {
            if (mode === 'missing') return isMissing;
            if (mode === 'country') return item.country === selectedCountry;
            return true; // 'all'
        }

        // 1. Scan places.json
        Object.keys(countries).forEach(country => {
            if (mode === 'country' && selectedCountry && country !== selectedCountry) return;
            const countryObj = countries[country];
            if (!countryObj) return;

            const isCountryMissing = !countryObj.lat || !countryObj.lng;
            const countryItem = {
                type: 'country',
                country,
                state: '',
                city: '',
                place: '',
                displayName: country,
                parentContext: '-',
                lat: countryObj.lat,
                lng: countryObj.lng,
                radius: countryObj.radius
            };
            if (shouldInclude(countryItem, isCountryMissing)) {
                scanMap.set(`country|${country}`, countryItem);
            }

            const states = countryObj.states || {};
            Object.keys(states).forEach(state => {
                const stateObj = states[state];
                if (!stateObj) return;

                const isStateMissing = !stateObj.lat || !stateObj.lng;
                const stateItem = {
                    type: 'state',
                    country,
                    state,
                    city: '',
                    place: '',
                    displayName: state,
                    parentContext: country,
                    lat: stateObj.lat,
                    lng: stateObj.lng,
                    radius: stateObj.radius
                };
                if (shouldInclude(stateItem, isStateMissing)) {
                    scanMap.set(`state|${country}|${state}`, stateItem);
                }

                const cities = stateObj.cities || {};
                Object.keys(cities).forEach(city => {
                    const cityObj = cities[city];
                    if (!cityObj) return;

                    const isCityMissing = !cityObj.lat || !cityObj.lng;
                    const cityItem = {
                        type: 'city',
                        country,
                        state,
                        city,
                        place: '',
                        displayName: city,
                        parentContext: `${state}, ${country}`,
                        lat: cityObj.lat,
                        lng: cityObj.lng,
                        radius: cityObj.radius
                    };
                    if (shouldInclude(cityItem, isCityMissing)) {
                        scanMap.set(`city|${country}|${state}|${city}`, cityItem);
                    }

                    const places = cityObj.places || {};
                    Object.keys(places).forEach(place => {
                        const placeObj = places[place];
                        if (!placeObj) return;

                        const isPlaceMissing = !placeObj.lat || !placeObj.lng;
                        const placeItem = {
                            type: 'place',
                            country,
                            state,
                            city,
                            place,
                            displayName: place,
                            parentContext: `${city}, ${state}, ${country}`,
                            lat: placeObj.lat,
                            lng: placeObj.lng,
                            radius: placeObj.radius
                        };
                        if (shouldInclude(placeItem, isPlaceMissing)) {
                            scanMap.set(`place|${country}|${state}|${city}|${place}`, placeItem);
                        }
                    });
                });
            });
        });

        // 2. Also scan sightings if looking for missing
        if (mode === 'missing') {
            sightings.forEach(s => {
                const country = s.country && s.country.trim();
                const state = s.state && s.state.trim();
                const city = s.city && s.city.trim();
                const place = s.place && s.place.trim();

                if (country && (!countries[country] || !countries[country].lat || !countries[country].lng)) {
                    const key = `country|${country}`;
                    if (!scanMap.has(key)) {
                        scanMap.set(key, { type: 'country', country, state: '', city: '', place: '', displayName: country, parentContext: '-' });
                    }
                }
                if (country && state) {
                    const stateObj = countries[country]?.states?.[state];
                    if (!stateObj || !stateObj.lat || !stateObj.lng) {
                        const key = `state|${country}|${state}`;
                        if (!scanMap.has(key)) {
                            scanMap.set(key, { type: 'state', country, state, city: '', place: '', displayName: state, parentContext: country });
                        }
                    }
                }
                if (country && state && city) {
                    const cityObj = countries[country]?.states?.[state]?.cities?.[city];
                    if (!cityObj || !cityObj.lat || !cityObj.lng) {
                        const key = `city|${country}|${state}|${city}`;
                        if (!scanMap.has(key)) {
                            scanMap.set(key, { type: 'city', country, state, city, place: '', displayName: city, parentContext: `${state}, ${country}` });
                        }
                    }
                }
                if (country && state && city && place) {
                    const placeObj = countries[country]?.states?.[state]?.cities?.[city]?.places?.[place];
                    if (!placeObj || !placeObj.lat || !placeObj.lng) {
                        const key = `place|${country}|${state}|${city}|${place}`;
                        if (!scanMap.has(key)) {
                            scanMap.set(key, { type: 'place', country, state, city, place, displayName: place, parentContext: `${city}, ${state}, ${country}` });
                        }
                    }
                }
            });
        }

        const scanList = Array.from(scanMap.values());
        $('#missing-places-summary').show();
        const actionLabel = mode === 'missing' ? 'missing coordinates' : 'matching';
        $('#missing-places-count').text(`Found ${scanList.length} ${actionLabel} location(s).`);

        if (scanList.length === 0) {
            $('#btn-autofill-missing').hide();
            $('#missing-places-list').html('<div style="color: #22c55e; padding: 6px 0;">No locations matched the criteria.</div>');
            return;
        }

        $('#btn-autofill-missing').show().text(mode === 'missing' ? `⚡ Auto-Fill All (${scanList.length})` : `⚡ Re-Geocode All (${scanList.length})`);
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += '<tr style="color: #94a3b8; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);"><th style="padding: 6px 4px;">Level</th><th style="padding: 6px 4px;">Name</th><th style="padding: 6px 4px;">Coordinates</th><th style="padding: 6px 4px;">Action</th></tr>';
        scanList.forEach((m, idx) => {
            const badgeColor = m.type === 'country' ? '#ef4444' : (m.type === 'state' ? '#a855f7' : (m.type === 'city' ? '#38bdf8' : '#22c55e'));
            const coordsText = (m.lat && m.lng) ? `${m.lat}, ${m.lng} (${m.radius || '-'}km)` : '<span style="color: #f87171;">Missing</span>';
            html += `<tr id="scan-row-${idx}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 4px;"><span style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44; padding: 2px 6px; border-radius: 4px; font-size: 11px; text-transform: uppercase; font-weight: 600;">${m.type}</span></td>
                <td style="padding: 4px; color: #fff; font-weight: 500;">${m.displayName} <span style="font-size: 11px; color: #64748b;">(${m.parentContext})</span></td>
                <td style="padding: 4px; font-family: monospace; font-size: 11px; color: #94a3b8;" class="row-coords">${coordsText}</td>
                <td style="padding: 4px;">
                    <button class="btn-regeocode-single" data-idx="${idx}" style="padding: 2px 8px; font-size: 11px; background: #0284c7; color: white;">🔄 Re-Geocode</button>
                </td>
            </tr>`;
        });
        html += '</table>';
        $('#missing-places-list').html(html);

        // Single row re-geocode
        $('.btn-regeocode-single').off('click').on('click', async function () {
            const idx = parseInt($(this).data('idx'));
            const item = scanList[idx];
            const $row = $(`#scan-row-${idx}`);
            const $btn = $(this);

            $btn.text('⏳').attr('disabled', 'disabled');
            try {
                const res = await lookupLocation({
                    country: item.country,
                    state: item.state,
                    city: item.city,
                    place: item.place,
                    type: item.type
                });
                if (res) {
                    savePlaceGeo({
                        country: item.country,
                        state: item.state || null,
                        city: item.city || null,
                        place: item.place || null,
                        lat: res.lat,
                        lng: res.lng,
                        radius: res.radius
                    });
                    $row.find('.row-coords').html(`<span style="color: #22c55e;">${res.lat}, ${res.lng} (${res.radius}km) ✔</span>`);
                    $btn.text('✔ Done').css({ background: '#22c55e' });
                    showToast(`Re-geocoded "${item.displayName}"!`, 'success');
                    updateCurrentCoordsBanner();
                } else {
                    $btn.text('❌ Not found').css({ background: '#ef4444' });
                }
            } catch (err) {
                console.error(err);
                $btn.text('❌ Error').css({ background: '#ef4444' });
            }
        });

        // Batch Re-geocode / Auto-fill
        $('#btn-autofill-missing').off('click').on('click', async function () {
            const $autofillBtn = $(this);
            $autofillBtn.attr('disabled', 'disabled');
            $('#autofill-progress').show();

            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < scanList.length; i++) {
                const item = scanList[i];
                $('#autofill-status-text').text(`Geocoding [${i + 1}/${scanList.length}] (${item.type}) "${item.displayName}" via ${geoService.getActiveProviderName()}...`);

                try {
                    const res = await lookupLocation({
                        place: item.place,
                        city: item.city,
                        state: item.state,
                        country: item.country,
                        type: item.type
                    });

                    if (res) {
                        savePlaceGeo({
                            country: item.country,
                            state: item.state || null,
                            city: item.city || null,
                            place: item.place || null,
                            lat: res.lat,
                            lng: res.lng,
                            radius: res.radius,
                            skipUpload: true
                        });
                        $(`#scan-row-${i}`).find('.row-coords').html(`<span style="color: #22c55e;">${res.lat}, ${res.lng} (${res.radius}km) ✔</span>`);
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (e) {
                    console.error(e);
                    failCount++;
                }
            }

            if (successCount > 0) {
                try {
                    uploadJSONData('places', true);
                    refreshSelects();
                } catch (err) {
                    console.error('Failed to upload places.json after autofill:', err);
                }
            }

            $('#autofill-status-text').html(
                `<span style="color: #22c55e;">Completed: ${successCount} geocoded and saved to places.json.</span>` +
                (failCount > 0 ? ` <span style="color: #ef4444;">(${failCount} could not be located)</span>` : '')
            );
            $autofillBtn.removeAttr('disabled');
            showToast(`Re-geocoded and saved ${successCount} location(s) to places.json!`, 'success');
            updateCurrentCoordsBanner();
        });
    });

}

