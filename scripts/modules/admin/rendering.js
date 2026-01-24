import Constants from '../constants.js';
import Util from '../util.js';
import { getSelectDOM, getSelectOptionsDOM, showOverlay } from '../ui-helpers.js';
import EbirdApi from '../ebird-api.js';
import {
    data, currentMode, uploadMedia, deleteMedia, moveMediaLeft, updateField, updateMediaProperty,
    deleteSighting, moveSighting, sightingMatches, addFamily, saveSpecies
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
        updateSpeciesForm.find("button.submit").html("Update");
    } else {
        updateSpeciesForm.find("input[data-field=name]").val('');
        updateSpeciesForm.find("input[data-field=tags]").val('');
        updateSpeciesForm.find("select[data-field=family]").val('').trigger("change");
        updateSpeciesForm.find("input[data-field=latin-name]").val('');
        updateSpeciesForm.find("input[data-field=ebird-code]").val('');
        updateSpeciesForm.find("button.submit").html("Add");
    }
}



export function setupUpdateSpeciesForm() {
    const updateSpeciesForm = $("#update-species-form");

    if (currentMode != Constants.MODE_BIRD) {
        updateSpeciesForm.find("tr:first th:eq(2)").html("Scientific Name");
        updateSpeciesForm.find("input[data-field=ebird-code]").remove();
    }

    updateSpeciesForm.find("select[data-field=family], select[data-field=key]").html('');
    updateSpeciesForm.find("select[data-field=family]").append("<option value=''>-</option>");
    data.families.forEach(function (family) {
        updateSpeciesForm.find("select[data-field=family]").append("<option value='" + family.name + "'>" + family.name + "</option>");
    });
    updateSpeciesForm.find("select[data-field=key]").append("<option value=''>New (auto-generated)</option>");
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
    updateSpeciesForm.find("select[data-field=key]").select2();
    updateSpeciesForm.find("select[data-field=family]").select2();
    updateSpeciesForm.find("input[data-field=name]").unbind("change").change(function () {
        let v = $(this).val();
        if (!v || !v.trim()) return;
        let tagsInput = updateSpeciesForm.find("input[data-field=tags]");
        if (!tagsInput.val() || !tagsInput.val().trim()) tagsInput.val(v.trim().split(/\s+/).slice(-1)[0]);

        if (currentMode == Constants.MODE_BIRD) {
            showOverlay("Fetching eBird Code");
            EbirdApi.fetchEbirdCode(v).then(c => {
                if (c && !updateSpeciesForm.find("input[data-field=ebird-code]").val())
                    updateSpeciesForm.find("input[data-field=ebird-code]").val(c).change();
            }).finally(() => {
                $(".overlay:not(#crop-modal)").hide();
            });
        }
    });
    updateSpeciesForm.find("input[data-field=ebird-code]").unbind("change").change(function () {
        let v = $(this).val();
        if (!v || !v.trim()) return;

        if (currentMode == Constants.MODE_BIRD) {
            showOverlay("Fetching Scientific Name & Family");
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
            }).finally(() => {
                $(".overlay:not(#crop-modal)").hide();
            });
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
            row += "<input class='title-textbox' data-mediasrc='" + media.src + "' type='text' value='" + (media.title || "") + "' placeholder='Add title'></input>";
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

export function setupAddFamilyForm() {
    const addFamilyForm = $("#add-family-form");
    if (currentMode != Constants.MODE_BIRD) {
        $("#add-family-section").show();
        addFamilyForm.find("button.submit").unbind("click").click(function () {
            addFamily(
                addFamilyForm.find("input[data-field=name]").val(),
                null,
                addFamilyForm.find("input[data-field=sci-name]").val()
            );

            // Refresh logic to update dropdown in species form
            $("#update-species-form").find("select[data-field=family]").append("<option value='" + addFamilyForm.find("input[data-field=name]").val() + "'>" + addFamilyForm.find("input[data-field=name]").val() + "</option>");

            addFamilyForm.find("input").val('');
        });
    } else {
        $("#add-family-section").hide();
    }
}
