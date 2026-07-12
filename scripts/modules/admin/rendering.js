import Constants from '../constants.js';
import Util from '../util.js';
import { getSelectDOM, getSelectOptionsDOM } from '../ui-helpers.js';
import { showLoader, hideLoader } from '../loader.js';
import EbirdApi from '../ebird-api.js';
import { initSearchableSelect, initSearchableSelects } from '../searchable-select.js';
import {
    data, currentMode, uploadMedia, deleteMedia, moveMediaToTarget, updateField, updateMediaProperty,
    deleteSighting, moveSighting, moveSightingToTarget, sightingMatches, addFamily, saveSpecies, deleteFamily, deleteSpecies,
    syncSightingsData
} from './data.js';

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
        updateSpeciesForm.find("input[data-field=tags]").val(species.tags.join(", "));
        updateSpeciesForm.find("select[data-field=family]").val(species.family).trigger("change");
        updateSpeciesForm.find("select[data-field=family] option[value='" + species.family + "']").attr("selected", "selected").trigger("change");
        updateSpeciesForm.find("input[data-field=latin-name]").val(species.latin_name);
        updateSpeciesForm.find("input[data-field=ebird-code]").val(species.ebird_code);
        let count = data.sightings.filter(s => s.species == key).length;
        updateSpeciesForm.find("input[data-field=sighting-count]").val(count);
        updateSpeciesForm.find("button.submit").html("Update");
        if (count == 0) {
            updateSpeciesForm.find("button.delete").removeAttr("disabled");
        } else {
            updateSpeciesForm.find("button.delete").attr("disabled", "disabled");
        }
    } else {
        // New custom name
        updateSpeciesForm.find("input[data-field=tags]").val('');
        updateSpeciesForm.find("select[data-field=family]").val('').trigger("change");
        updateSpeciesForm.find("input[data-field=latin-name]").val('');
        updateSpeciesForm.find("input[data-field=ebird-code]").val('');
        updateSpeciesForm.find("input[data-field=sighting-count]").val('0');
        updateSpeciesForm.find("button.submit").html("Add");
        updateSpeciesForm.find("button.delete").attr("disabled", "disabled");

        // Auto-fill tags if possible
        if (nameVal && nameVal.trim()) {
            updateSpeciesForm.find("input[data-field=tags]").val(nameVal.trim().split(/\s+/).slice(-1)[0]);
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
    data.families.forEach(function (family) {
        updateSpeciesForm.find("select[data-field=family]").append("<option value='" + family.name + "'>" + family.name + "</option>");
    });

    updateSpeciesForm.find("select[data-field=name]").append("<option value=''></option>");
    Object.values(data.species).forEach(function (species, i) {
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
    html += `<span class='input-clear-btn' title='Clear'>✕</span>`;
    html += `</div>`;
    return html;
}

export function renderSightingsTable(OFFSET, ROWS) {
    const table = $("#sightings-table");
    table.html("");
    table.append("<tr>" +
        "<th class='noborder' style='width: 60px;'></th>" +
        "<th style='width: 280px;'>Species</th>" +
        "<th>Media</th>" +
        "<th style='width: 260px;'>Date & Place</th>" +
        "<th style='width: 180px;'>Properties</th>" +
        "<th class='noborder' style='width: 40px;'></th>" +
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
        row += getSelectDOM("species", data.species, getValue(sighting, 'species'), "280px", "data-no-clear='true'");
        row += "<br>";
        row += "<textarea data-field='description' style='width:280px;height:70px' placeholder='Enter Description'>" + getValue(sighting, 'description') + "</textarea>";
        row += getTextDOM("author", getValue(sighting, 'author'), "280px", Constants.DEFAULT_AUTHOR);
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
            row += "<div class='thumbnail' draggable='true' data-mediasrc='" + media.src + "' data-sightingkey='" + sighting.key + "'>";
            let ext = media.src.split('.').pop().toLowerCase();
            row += "<div class='media-header'>";
            row += "<span class='media-ext-badge'>." + ext + "</span>";
            row += "<button class='delete-media' data-mediasrc='" + media.src + "' title='Delete media'>-</button>";
            row += "</div>";
            if (media.type == 'video') {
                row += "<img src='" + Util.getMedia(media.thumbnail) + "' title='" + media.src + "'/>";
            } else {
                row += "<img src='" + Util.getMedia(media.src) + "' title='" + media.src + "'/>";
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
            row += "</div>";
            row += "</div>";
        });
        row += "<button class='upload-button' title='Add media'>+</button>";
        row += "<input class='upload' type='file' accept='.jpg,.mp4' hidden/>";
        row += "</div></td>";

        row += "<td class='place-fields'>";
        row += "<input type='date' data-field='date' value='" + moment(sighting.date, 'DD-mm-yyyy').format('yyyy-mm-DD') + "' style='width:250px'></input><br>";
        row += getSelectDOM("time_of_day", Constants.OPT_TIME_OF_DAY, getValue(sighting, 'time_of_day'), "123px");
        row += getSelectDOM("weather", Constants.OPT_WEATHER, getValue(sighting, 'weather'), "123px") + "<br>";
        row += getSelectDOM("country", data.countries, getValue(sighting, 'country'), "250px") + "<br>";
        row += getSelectDOM("state", data.countries[sighting.country].states, getValue(sighting, 'state'), "250px") + "<br>";
        row += getTextDOM("city", getValue(sighting, 'city'), "250px", "Add city") + "<br>";
        row += getTextDOM("place", getValue(sighting, 'place'), "250px", "Add place");
        row += "</td>";

        row += "<td class='property-fields'>";
        row += getSelectDOM("gender", Constants.OPT_GENDER, getValue(sighting, 'gender'), "160px");
        row += getSelectDOM("age", Constants.OPT_AGE[currentMode], getValue(sighting, 'age'), "160px");
        row += getSelectDOM("plumage", Constants.OPT_PLUMAGE[currentMode], getValue(sighting, 'plumage'), "160px");
        row += getTextDOM("variation", getValue(sighting, 'variation'), "160px", "Add variation");
        row += getTextDOM("subspecies", getValue(sighting, 'subspecies'), "160px", "Add subspecies");
        row += "</td>";

        row += "<td class='noborder'>";
        row += "<div class='drag-handle' title='Drag to reorder' style='font-size: 28px; cursor: grab; color: #64748b; padding: 10px 5px; text-align: center; user-select: none;'>⣿</div>";
        row += "</td>";

        row += "</tr>";

        table.append(row);


        const sightingRow = $("#" + sighting.key);

        // Init searchable selects on large-option dropdowns
        initSearchableSelect(sightingRow.find("select[data-field=species]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=country]")[0]);
        initSearchableSelect(sightingRow.find("select[data-field=state]")[0]);

        sightingRow.find('.camera-model-select').each(function () {
            initSearchableSelect(this);
        });



        sightingRow.find('.drag-handle').on('mousedown', function () {
            sightingRow.attr('draggable', 'true');
        }).on('mouseup mouseleave', function () {
            sightingRow.attr('draggable', 'false');
        });

        sightingRow.on('dragstart', function (e) {
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', sighting.key);
            $(this).css('opacity', '0.5');
        });
        sightingRow.on('dragend', function (e) {
            $(this).css('opacity', '1');
            $("tr").removeClass('drag-over-top drag-over-bottom');
            $(this).attr('draggable', 'false');
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
            $(this).attr('draggable', 'false');
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
        sightingRow.find("input[type=text], input[type=date], input[type=date], input[type=checkbox], select, textarea").not(".thumbnail *").not(".hide-toggle").change(function () {
            let value = ($(this).attr('type') == 'checkbox') ? $(this).is(":checked") : $(this).val();
            updateField(sighting.key, $(this).attr("data-field"), value);
        });
        // Hide/unhide toggle - save immediately
        sightingRow.find(".hide-toggle").change(function () {
            let value = $(this).is(":checked");
            updateField(sighting.key, $(this).attr("data-field"), value);
            syncSightingsData(0);
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
    let family = data.families.find(f => f.name == name);
    if (family) {
        addFamilyForm.find("input[data-field=sci-name]").val(family.sci_name || "");
        addFamilyForm.find("input[data-field=ebird-code]").val(family.ebird_code || "");

        let count = Object.values(data.species).filter(s => s.family == name).length;
        addFamilyForm.find("input[data-field=species-count]").val(count);

        addFamilyForm.find("button.submit").html("Update");
        addFamilyForm.find("button.delete").removeAttr("disabled");
    } else {
        addFamilyForm.find("input[data-field=sci-name]").val("");
        addFamilyForm.find("input[data-field=ebird-code]").val("");
        addFamilyForm.find("input[data-field=species-count]").val("0");
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
