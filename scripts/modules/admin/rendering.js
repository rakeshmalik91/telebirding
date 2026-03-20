import Constants from '../constants.js';
import Util from '../util.js';
import { getSelectDOM, getSelectOptionsDOM } from '../ui-helpers.js';
import { showLoader, hideLoader } from '../loader.js';
import EbirdApi from '../ebird-api.js';
import {
    data, currentMode, uploadMedia, deleteMedia, moveMediaLeft, updateField, updateMediaProperty,
    deleteSighting, moveSighting, sightingMatches, addFamily, saveSpecies, deleteFamily, deleteSpecies
} from './data.js';

import { openCropper } from '../cropper.js';

export function getValue(sighting, prop) {
    return sighting[prop] ? sighting[prop] : '';
}

export function fillUpdateSpeciesForm() {
    const updateSpeciesForm = $("#update-species-form");
    let key = updateSpeciesForm.find("select[data-field=key]").val();
    updateSpeciesForm.find("select[data-field=family] option").removeAttr("selected");
    if (key) {
        const species = data.species[key];
        updateSpeciesForm.find("input[data-field=name]").val(species.name);
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
        updateSpeciesForm.find("input[data-field=name]").val('');
        updateSpeciesForm.find("input[data-field=tags]").val('');
        updateSpeciesForm.find("select[data-field=family]").val('').trigger("change");
        updateSpeciesForm.find("input[data-field=latin-name]").val('');
        updateSpeciesForm.find("input[data-field=ebird-code]").val('');
        updateSpeciesForm.find("input[data-field=sighting-count]").val('0');
        updateSpeciesForm.find("button.submit").html("Add");
        updateSpeciesForm.find("button.delete").attr("disabled", "disabled");
    }
}

export function setupUpdateSpeciesForm() {
    const updateSpeciesForm = $("#update-species-form");

    if (currentMode != Constants.MODE_BIRD) {
        updateSpeciesForm.find("input[data-field=ebird-code]").closest('tr').hide();
    } else {
        updateSpeciesForm.find("input[data-field=ebird-code]").closest('tr').show();
    }

    updateSpeciesForm.find("select[data-field=family], select[data-field=key]").html('');
    updateSpeciesForm.find("select[data-field=family]").append("<option value=''>-</option>");
    data.families.forEach(function (family) {
        updateSpeciesForm.find("select[data-field=family]").append("<option value='" + family.name + "'>" + family.name + "</option>");
    });
    updateSpeciesForm.find("select[data-field=key]").append("<option value=''>(New Key/ID to be auto-generated)</option>");
    Object.values(data.species).forEach(function (species, i) {
        updateSpeciesForm.find("select[data-field=key]").append("<option value='" + species.key + "'>" + species.key + "</option>");
    });
    fillUpdateSpeciesForm();
    updateSpeciesForm.find("select[data-field=key]").unbind("change").change(fillUpdateSpeciesForm);
    updateSpeciesForm.find("button.submit").unbind("click").click(function () {
        saveSpecies(updateSpeciesForm.find("select[data-field=key]").val(), updateSpeciesForm.find("input[data-field=name]").val(),
            updateSpeciesForm.find("input[data-field=tags]").val(), updateSpeciesForm.find("select[data-field=family]").val(),
            updateSpeciesForm.find("input[data-field=latin-name]").val(), updateSpeciesForm.find("input[data-field=ebird-code]").val());
    });
    updateSpeciesForm.find("button.delete").unbind("click").click(function () {
        let key = updateSpeciesForm.find("select[data-field=key]").val();
        if (!key) return;
        let oldSpeciesCount = Object.keys(data.species).length;
        deleteSpecies(key);
        if (Object.keys(data.species).length < oldSpeciesCount) {
            updateSpeciesForm.find("select[data-field=key] option[value='" + key + "']").remove();
            updateSpeciesForm.find("select[data-field=key]").val('').trigger('change');
        }
    });
    updateSpeciesForm.find("select[data-field=key]").select2({
        allowClear: true,
        placeholder: "Select or Leave Empty for New Key/ID to be Auto-generated"
    });
    updateSpeciesForm.find("select[data-field=family]").select2();
    updateSpeciesForm.find("input[data-field=name]").unbind("change").change(function () {
        let v = $(this).val();
        if (!v || !v.trim()) return;
        let tagsInput = updateSpeciesForm.find("input[data-field=tags]");
        if (!tagsInput.val() || !tagsInput.val().trim()) tagsInput.val(v.trim().split(/\s+/).slice(-1)[0]);

        if (currentMode == Constants.MODE_INSECT) {
            let lastWord = v.trim().split(/\s+/).slice(-1)[0];
            let pluralWord = Util.plural(lastWord);
            let family = data.families.find(f => f.name.toLowerCase() == pluralWord.toLowerCase());
            if (family) {
                updateSpeciesForm.find("select[data-field=family]").val(family.name).trigger("change");
            }
        } else if (currentMode == Constants.MODE_BIRD) {
            showLoader("ebird-code", "Fetching eBird Code");
            EbirdApi.fetchEbirdCode(v).then(code => {
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


export function renderSightingsTable(OFFSET, ROWS) {
    const table = $("#sightings-table");
    table.html("");
    table.append("<tr>" +
        "<th class='noborder'></th>" +
        "<th>ID</th>" +
        "<th>Species</th>" +
        "<th>Media</th>" +
        "<th>Date & Place</th>" +
        "<th>Properties</th>" +
        "<th class='noborder'></th>" +
        "</tr>");
    const searchKey = $("input[name=filter-sighting]").val() || "";
    const filteredSightings = data.sightings.filter(b => sightingMatches(b, searchKey));

    // Update pagination text/buttons here or separate? 
    // The original code did it at the end of render(). 
    // I can do it here or split it.
    // Let's do table rows first.

    filteredSightings.slice(OFFSET, OFFSET + ROWS).forEach(function (sighting, i) {
        let row = "<tr id='" + sighting.key + "'>";

        row += "<td class='noborder'>"
        row += "<button class='delete-sighting' title='Delete sighting'>-</button>";
        row += "<input class='hide-checkbox' type='checkbox' data-field='hidden' " + (sighting.hidden ? "" : "checked") + " title='Hide/Unhide sighting'/>";
        row += "</td>";

        row += "<td><span style='width: 100px;' class='label'>" + sighting.key + "</span></td>";

        row += "<td>"
        row += getSelectDOM("species", data.species, getValue(sighting, 'species'), "200px");
        row += "<br>";
        row += "<textarea data-field='description' style='width:190px;height:70px' placeholder='Enter Description'>" + getValue(sighting, 'description') + "</textarea>";
        row += getSelectDOM("rating", Constants.OPT_RATING, getValue(sighting, 'rating'), "200px");
        row += "<input type='text' data-field='author' value='" + getValue(sighting, 'author') + "' style='width:180px' placeholder='" + Constants.DEFAULT_AUTHOR + "'></input>";
        row += "<input class='unconfirmed-checkbox' type='checkbox' data-field='unconfirmed' " + (sighting.unconfirmed ? "checked" : "") + " title='Unconfirmed'/> <span class='label'>Unconfirmed</span>";
        row += "</td>";

        row += "<td><div style='width: calc(100vw - 820px);'>";
        sighting.media.forEach(function (media, i) {
            row += "<div class='thumbnail'>";
            row += "<span>." + (media.type == "video" ? "mp4" : "jpg") + "</span>";
            row += "<button class='delete-media' data-mediasrc='" + media.src + "' title='Delete media'>-</button>";
            row += "<button class='move-media-left' data-mediasrc='" + media.src + "' title='Move Left' " + (i <= 0 ? "disabled" : "") + "><</button>";
            if (media.type == 'video') {
                row += "<img src='" + Util.getMedia(media.thumbnail) + "' title='" + media.src + "'/>";
            } else {
                row += "<img src='" + Util.getMedia(media.src) + "' title='" + media.src + "'/>";
            }
            row += "<textarea class='title-textbox' data-mediasrc='" + media.src + "' style='font-size:0.8em;height:40px;width:80px;' placeholder='Add title'>" + (media.title || "") + "</textarea>";
            row += "<textarea class='camera-model-textbox' data-mediasrc='" + media.src + "' style='font-size:0.8em;height:50px;width:80px;' placeholder='Sony 7rmV + Sony 200-600 G'>" + (media.exif_data ? (media.exif_data.camera_model || "") : "") + "</textarea>";
            row += "</div>";
        });
        row += "<button class='upload-button' title='Add media'>+</button>";
        row += "<input class='upload' type='file' accept='.jpg,.mp4' hidden/>";
        row += "</div></td>";

        row += "<td class='place-fields'>";
        row += "<input type='date' data-field='date' value='" + moment(sighting.date, 'DD-mm-yyyy').format('yyyy-mm-DD') + "' style='width:180px'></input>";
        row += getSelectDOM("time_of_day", Constants.OPT_TIME_OF_DAY, getValue(sighting, 'time_of_day'), "90px");
        row += getSelectDOM("weather", Constants.OPT_WEATHER, getValue(sighting, 'weather'), "90px");
        row += "<br>";
        row += getSelectDOM("country", data.countries, getValue(sighting, 'country'), "180px");
        row += getSelectDOM("state", data.countries[sighting.country].states, getValue(sighting, 'state'), "180px");
        row += "<input type='text' data-field='city' value='" + getValue(sighting, 'city') + "' style='width:180px' placeholder='Add city'></input>";
        row += "<input type='text' data-field='place' value='" + getValue(sighting, 'place') + "' style='width:180px' placeholder='Add place'></input>";
        row += "</td>";

        row += "<td>";
        row += getSelectDOM("gender", Constants.OPT_GENDER, getValue(sighting, 'gender'), "160px");
        row += getSelectDOM("age", Constants.OPT_AGE[currentMode], getValue(sighting, 'age'), "160px");
        row += getSelectDOM("plumage", Constants.OPT_PLUMAGE[currentMode], getValue(sighting, 'plumage'), "160px");
        row += "<br>";
        row += "<input type='text' data-field='variation' value='" + getValue(sighting, 'variation') + "' style='width:160px' placeholder='Add variation'></input>";
        row += "<input type='text' data-field='subspecies' value='" + getValue(sighting, 'subspecies') + "' style='width:160px' placeholder='Add subspecies'></input>";
        row += "</td>";

        row += "<td class='noborder'>"
        row += "<button class='move-upx5' title='Move Up' " + (OFFSET + i <= 4 ? "disabled" : "") + ">⯭</button>";
        row += "<button class='move-up' title='Move Up' " + (OFFSET + i <= 0 ? "disabled" : "") + ">⏶</button>";
        row += "<button class='move-down' title='Move down' " + (OFFSET + i >= filteredSightings.length - 1 ? "disabled" : "") + ">⏷</button>";
        row += "<button class='move-downx5' title='Move down' " + (OFFSET + i >= filteredSightings.length - 5 ? "disabled" : "") + ">⯯</button>";
        row += "</td>";

        row += "</tr>";

        table.append(row);
        table.find("select").select2();

        const sightingRow = $("#" + sighting.key);
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
        sightingRow.find("select[data-field=country]").change(function () {
            const firstStateInCountry = Object.keys(data.countries[$(this).val()].states)[0];
            updateField(sighting.key, 'state', firstStateInCountry);
        });
        sightingRow.find("button.delete-media").click(function () {
            deleteMedia(sighting.key, $(this).attr("data-mediasrc"));
        });
        sightingRow.find("button.move-media-left").click(function () {
            moveMediaLeft(sighting.key, $(this).attr("data-mediasrc"));
        });
        sightingRow.find(".thumbnail .title-textbox").change(function () {
            updateMediaProperty(sighting.key, $(this).attr("data-mediasrc"), "title", $(this).val());
        });
        sightingRow.find(".thumbnail .camera-model-textbox").change(function () {
            updateMediaProperty(sighting.key, $(this).attr("data-mediasrc"), "exif_data.camera_model", $(this).val());
        });
        sightingRow.find(".delete-sighting").click(() => deleteSighting(sighting.key));
        sightingRow.find(".move-upx5").click(() => moveSighting(sighting.key, -5));
        sightingRow.find(".move-up").click(() => moveSighting(sighting.key, -1));
        sightingRow.find(".move-down").click(() => moveSighting(sighting.key, 1));
        sightingRow.find(".move-downx5").click(() => moveSighting(sighting.key, 5));
        sightingRow.find("select[data-field=country]").change(function () {
            sightingRow.find("select[data-field=state]").prop('innerHTML', getSelectOptionsDOM("state", data.countries[sighting.country].states, getValue(sighting, 'state')));
            sightingRow.find("select[data-field=state]").select2();
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

// Helper to fill form based on selection
export function fillAddFamilyForm() {
    const addFamilyForm = $("#add-family-form");
    let name = addFamilyForm.find("select[data-field=name]").val();
    name = $('<textarea />').html(name).text(); // Decode HTML entities
    let family = data.families.find(f => f.name == name);
    if (family) {
        addFamilyForm.find("input[data-field=sci-name]").val(family.sci_name || "");
        addFamilyForm.find("input[data-field=ebird-code]").val(family.ebird_code || "");

        let count = Object.values(data.species).filter(s => s.family == name).length;
        addFamilyForm.find("input[data-field=species-count]").val(count);

        addFamilyForm.find("button.submit").html("Update");
        addFamilyForm.find("button.submit").removeAttr("disabled");
        addFamilyForm.find("button.delete").removeAttr("disabled");
    } else {
        addFamilyForm.find("input[data-field=sci-name]").val("");
        addFamilyForm.find("input[data-field=ebird-code]").val("");
        addFamilyForm.find("input[data-field=species-count]").val("0");
        addFamilyForm.find("button.submit").html("Add");
        addFamilyForm.find("button.delete").attr("disabled", "disabled");
        if (currentMode == Constants.MODE_BIRD) {
            addFamilyForm.find("button.submit").attr("disabled", "disabled");
        } else {
            addFamilyForm.find("button.submit").removeAttr("disabled");
        }
    }

    if (currentMode != Constants.MODE_BIRD) {
        addFamilyForm.find("input[data-field=ebird-code]").closest('tr').hide();
    } else {
        addFamilyForm.find("input[data-field=ebird-code]").closest('tr').show();
    }
}

export function setupAddFamilyForm() {
    const addFamilyForm = $("#add-family-form");
    $("#add-family-section").show();

    // Populate family select
    let $famSelect = addFamilyForm.find("select[data-field=name]");

    // Destroy existing Select2 if it exists to allow clean re-initialization
    if ($famSelect.hasClass("select2-hidden-accessible")) {
        $famSelect.select2('destroy');
    }

    $famSelect.html('<option value="">- New Family -</option>');
    data.families.forEach(function (family) {
        $famSelect.append("<option value=\"" + family.name + "\">" + family.name + "</option>");
    });

    fillAddFamilyForm();
    $famSelect.unbind("change").on("change select2:select", fillAddFamilyForm);

    $famSelect.select2({
        tags: true,
        placeholder: "Select or Enter Name",
        allowClear: true
    });

    addFamilyForm.find("button.submit").unbind("click").click(function () {
        let name = addFamilyForm.find("select[data-field=name]").val();
        if (!name) return;

        addFamily(
            name,
            addFamilyForm.find("input[data-field=ebird-code]").val(),
            addFamilyForm.find("input[data-field=sci-name]").val()
        );

        // Refresh update species form dropdown if it's a new family (or just refresh anyway)
        let speciesFamilySelect = $("#update-species-form").find("select[data-field=family]");
        if (speciesFamilySelect.find("option[value='" + name + "']").length == 0) {
            speciesFamilySelect.append("<option value='" + name + "'>" + name + "</option>");
        }

        // Also update this form's select if it's new
        if ($famSelect.find("option[value='" + name + "']").length == 0) {
            $famSelect.append("<option value='" + name + "'>" + name + "</option>");
        }

        // clear form
        // We trigger change to reset UI via fillAddFamilyForm, but we also want to clear inputs.
        // Actually fillAddFamilyForm clears inputs if value is empty.
        $famSelect.val('').trigger('change');
    });

    addFamilyForm.find("button.delete").unbind("click").click(function () {
        let name = addFamilyForm.find("select[data-field=name]").val();
        if (!name) return;

        let oldCount = data.families.length;
        deleteFamily(name);

        if (data.families.length < oldCount) {
            // Deleted successfully

            // Remove from select (both forms)
            let speciesFamilySelect = $("#update-species-form").find("select[data-field=family]");
            speciesFamilySelect.find("option[value='" + name + "']").remove();

            // Remove from this select and reset
            $famSelect.find("option[value='" + name + "']").remove();
            $famSelect.val('').trigger('change');
        }
    });
}
