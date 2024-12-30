var data = {};

var OFFSET = 0;
var ROWS = 10;

var IMAGE_SIZE = 1000;

var SYNC_SCHEDULE_TIME = 60000;

var OPT_RATING = {
	"0": "-",
	"1": "★",
	"2": "★★",
	"3": "★★★",
	"4": "★★★★",
	"5": "★★★★★"
}
var OPT_GENDER = {
	'': '-', 
	'M': "Male", 
	'F': 'Female'
};
var OPT_AGE = {
	'': 'Adult', 
	'Juvenile': 'Juvenile', 
	'Immature': 'Immature',
	'Juvenile/Immature': 'Juvenile/Immature'
};
var OPT_PLUMAGE = {
	'': 'Basic', 
	'Non-Breeding': 'Non-Breeding', 
	'Breeding': 'Breeding', 
	'Winter': 'Winter', 
	'Eclipse': 'Eclipse', 
	'Molting': 'Molting', 
	'Immature/Non-Breeding': 'Immature/Non-Breeding', 
	'Immature/Female': 'Immature/Female',
	'Female/Non-Breeding-Male': 'Female/Non-Breeding'
};

var DATA_DATE_FORMAT = "DD-MM-yyyy";

var MODE_BIRD = "bird";
var MODE_INSECT = "insect";
var currentMode = getUrlParams().mode || MODE_BIRD;

var lastUpdatedSpecies = (currentMode == MODE_INSECT) ? "housefly" : 'rock-pigeon';

function switchMode() {
	if(currentMode == MODE_BIRD) {
		window.location.href = window.location.origin + "/admin?mode=" + MODE_INSECT;
	} else {
		window.location.href = window.location.origin + "/admin?mode=" + MODE_BIRD;
	}
}

function showOverlay(text) {
	$(".overlay span").html((text || "Please Wait") + "...");
	$(".overlay").show();
}

function getValue(sighting, prop) {
	return sighting[prop] ? sighting[prop] : '';
}

function getSelectOptionsDOM(field, options, value) {
	var dom = "";
	for (const [k, v] of Object.entries(options)) {
		var name = v instanceof Object ? v.name : v;
		dom += "<option value='" + k + "' " + (k == value ? 'selected' : '') + ">" + name + "</option>";
	}
	return dom;
}

function getSelectDOM(field, options, value, width) {
	var dom = "<select data-field='" + field + "' style='width:" + width + "'>";
	dom += getSelectOptionsDOM(field, options, value);
	dom += "</select>";
	return dom;
}

function uploadJSONData(type) {
	showOverlay("Saving");
	var fileData = {};
	fileData[type] = data[type];
	fileData = JSON.stringify(fileData, null, '\t').split('\n').map(l => l + '\n');
	// if(fileData.length < 50) {
	// 	alert("Error uploading...");
	// 	return;
	// }
	var file = new File(fileData, type + ".json");
	firebase.storage().ref("data/" + currentMode + "-" + type + ".json").put(file).then(() => {
		console.log("uploaded data/" + currentMode + "-" + type + ".json");
		refresh();
	}).catch(e => {
		alert(e.message);
		$(".overlay").hide();
	});
}

function backup() {
	showOverlay("Backing up...");
	console.log("Backing up...");
	var backedUp = 0;
	var date = moment(Date.now()).format(BACKUP_DATE_FORMAT);
	firebase.storage() .ref("backup/" + date + "/" + currentMode + "-species.json") .put(new File(JSON.stringify({ species: data.species}, null, '\t').split('\n').map(l => l + '\n'), currentMode + "-species.json")).then(() => {
		if(++backedUp == 3) {
			refresh();
			console.log("Backup completed");
		}
	});
	firebase.storage() .ref("backup/" + date + "/" + currentMode + "-families.json") .put(new File(JSON.stringify({ families: data.families}, null, '\t').split('\n').map(l => l + '\n'), currentMode + "-families.json")).then(() => {
		if(++backedUp == 3) {
			refresh();
			console.log("Backup completed");
		}
	});
	firebase.storage() .ref("backup/" + date + "/" + currentMode + "-sightings.json") .put(new File(JSON.stringify({ sightings: data.sightings}, null, '\t').split('\n').map(l => l + '\n'), currentMode + "-sightings.json")).then(() => {
		if(++backedUp == 3) {
			refresh();
			console.log("Backup completed");
		}
	});
}

var syncRef;
function syncSightingsData(scheduleAfter) {
	$('.save').removeAttr("disabled");
	clearTimeout(syncRef);
	syncRef = setTimeout(function() {
		uploadJSONData('sightings');
		syncRef = undefined;
		$('.save').attr("disabled", "disabled");
	}, scheduleAfter);
}

function uploadMedia(sightingKey, files) {
	showOverlay("Uploading Media");
	var watermark = null;
	if($('input[name=watermark-on]').is(":checked")) {
		watermark = {
			text: $('input[name=watermark]').val(),
			color: $('input[name=watermark-color]').val() + "33"
		};
	}
	Array.from(files).forEach(function(file) {
		var mediaSrc;
		if(file.type.match(/image.*/)) {
			var speciesKey = data.species[data.sightings.filter(b => b.key == sightingKey)[0].species].key;
			mediaSrc = 'images/' + speciesKey + "-" + Math.floor(Date.now() / 1000) + ".jpg";
			console.log("uploading image " + file.name + " for " + sightingKey + " as " + mediaSrc);
			resizeImage(file, IMAGE_SIZE, watermark).then((resizedImage) => {
				firebase.storage().ref(mediaSrc).put(resizedImage).then(() => {
					console.log("uploaded image " + mediaSrc);
					data.sightings.forEach(function(sighting) {
						if(sighting.key == sightingKey) {
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

function deleteMedia(sightingKey, mediaSrc) {
	if(!mediaSrc.toLowerCase().endsWith(".jpg")) {
		alert("Unsupported!!!");
		return;
	}
	if(confirm("You are about to delete this media.")) {
		showOverlay("Deleting Media");
		data.sightings.forEach(function(sighting) {
			if(sighting.key != sightingKey) return;
			sighting.media = sighting.media.filter(m => m.src != mediaSrc);
		});
		firebase.storage().ref(mediaSrc).delete().then(() => {
			syncSightingsData(0);
		}, (error) => {
			if(error.code === 'storage/object-not-found') {
				syncSightingsData(0);
			} else {
				alert(error.message);
			}
		})
	}
}

function moveMediaLeft(sightingKey, mediaSrc) {
	data.sightings.forEach(function(sighting) {
		if(sighting.key != sightingKey) return;
		var index = sighting.media.map(m => m.src).indexOf(mediaSrc);
		if(index > 0) {
			sighting.media = [sighting.media.slice(0, index-1), [sighting.media[index]], [sighting.media[index-1]], sighting.media.slice(index+1)].flat();
			syncSightingsData(0);
			return;
		}
	});
}

function updateField(sightingKey, field, value) {
	data.sightings.forEach(function(sighting) {
		if(sighting.key != sightingKey) return;
		if(field == 'date') {
			sighting[field] = moment(value, 'yyyy-mm-DD').format('DD-mm-yyyy');
		} else if(field == 'hidden') {
			sighting[field] = !value;
		} else {
			sighting[field] = value;
		}
	});
	syncSightingsData(SYNC_SCHEDULE_TIME);
}

function updateMediaProperty(sightingKey, mediaSrc, property, value) {
	data.sightings.forEach(function(sighting) {
		if(sighting.key != sightingKey) return;
		sighting.media.forEach(media => {
			if(media.src == mediaSrc) {
				media[property] = value;
			}
		});
	});
	syncSightingsData(SYNC_SCHEDULE_TIME);
}

function addSighting() {
	OFFSET = 0;
	$("input[name=filter-sighting]").val('');
	data.sightings.unshift({
		"key": ("s" + Math.floor(Date.now() / 1000)),
		"species": lastUpdatedSpecies,
		"date": (data.sightings[0] || {}).date || moment(Date.now()).format(DATA_DATE_FORMAT),
		"place": (data.sightings[0] || {}).place,
		"city": (data.sightings[0] || {}).city || "Howrah",
		"state": (data.sightings[0] || {}).state || "West Bengal",
		"country": (data.sightings[0] || {}).country || "India",
		"hidden": true,
		"media": []
	});
	syncSightingsData(0);
}

function deleteSighting(sightingKey) {
	if(confirm("You are about to delete this sighting.")) {
		data.sightings.filter(b => b.key == sightingKey)[0].media.forEach(function(media) {
			deleteMedia(sightingKey, media.src);
		});
		data.sightings = data.sightings.filter(b => b.key != sightingKey);
		syncSightingsData(0);
	}
}

function saveSpecies(key, name, tags, family) {
	if(!name || !tags || !family) {
		alert("All fields are mandatory");
	} else {
		name = name.replaceAll("’", "'");
		var key = key || name.toLowerCase().replaceAll(/\s+/ig, "-").replaceAll('\'', "");
		tags = tags.replaceAll("’", "'");
		data.species[key] = {
			key: key,
			name: name,
			tags: tags.split(/\s*,\s*/ig),
			family: family
		};
		data.species = Object.fromEntries(Object.entries(data.species).sort());
		uploadJSONData("species");
		lastUpdatedSpecies = key;
	}
}

function addFamily(name) {
	if(!name) {
		alert("Name is mandatory");
	} else {
		data.families = data.families.filter(f => f.name != name);
		data.families.push({
			name: name
		});
		uploadJSONData("families");
	}
}

function sightingMatches(sighting, searchKey) {
	searchKey = searchKey.toLowerCase().trim();
	if(searchKey == "hidden") {
		return sighting.hidden;
	}
	if(searchKey.match(/^rating=/i)) {
		return sighting.rating == searchKey.split("=")[1] || 0;
	}
	return sighting.key.indexOf(searchKey) >= 0
		|| data.species[sighting.species].name.toLowerCase().indexOf(searchKey) >= 0
		|| data.species[sighting.species].tags.map(t => t.toLowerCase().indexOf(searchKey) >= 0).reduce((a,b) => a || b)
		|| (sighting.place && sighting.place.toLowerCase().indexOf(searchKey) >= 0)
		|| (sighting.city && sighting.city.toLowerCase().indexOf(searchKey) >= 0)
		|| sighting.state.toLowerCase().indexOf(searchKey) >= 0
		|| sighting.country.toLowerCase().indexOf(searchKey) >= 0
		|| (sighting.variation && sighting.variation.toLowerCase().indexOf(searchKey) >= 0)
		|| (sighting.subspecies && sighting.subspecies.toLowerCase().indexOf(searchKey) >= 0)
		|| (sighting.plumage && sighting.plumage.toLowerCase().indexOf(searchKey) >= 0)
		|| (sighting.age && sighting.age.toLowerCase().indexOf(searchKey) >= 0);
}

function moveSighting(sightingKey, direction) {
	var sighting = data.sightings.filter(b => b.key == sightingKey)[0];
	var index = data.sightings.map(b => b.key).indexOf(sightingKey);
	if(direction > 0 && index < data.sightings.length-1) {
		data.sightings = [data.sightings.slice(0, index), data.sightings.slice(index+1, index+2), [sighting], data.sightings.slice(index+2)].flat();
		syncSightingsData(0);
	} else if(direction < 0 && index > 0) {
		data.sightings = [data.sightings.slice(0, index-1), [sighting], data.sightings.slice(index-1, index), data.sightings.slice(index+1)].flat();
		syncSightingsData(0);
	}
}

function fillUpdateSpeciesForm() {
	var updateSpeciesForm = $("#update-species-form");
	var key = updateSpeciesForm.find("select[data-field=key]").val();
	updateSpeciesForm.find("select[data-field=family] option").removeAttr("selected");
	if(key) {
		var species = data.species[key];
		updateSpeciesForm.find("input[data-field=name]").val(species.name);
		updateSpeciesForm.find("input[data-field=tags]").val(species.tags.join(", "));
		updateSpeciesForm.find("select[data-field=family]").val(species.family).trigger("change");
		updateSpeciesForm.find("select[data-field=family] option[value='" + species.family + "']").attr("selected", "selected").trigger("change");
		updateSpeciesForm.find("button.submit").html("Update");
	} else {
		updateSpeciesForm.find("input[data-field=name]").val('');
		updateSpeciesForm.find("input[data-field=tags]").val('');
		updateSpeciesForm.find("select[data-field=family]").val('').trigger("change");
		updateSpeciesForm.find("button.submit").html("Add");
	}
}

function sortByDate() {
	data.sightings.sort((a,b) => compare(moment(b.date, DATA_DATE_FORMAT), moment(a.date, DATA_DATE_FORMAT)));
	syncSightingsData(0);
}

function render() {
	data.species = Object.fromEntries(Object.entries(data.species).sort((a,b) => compare(a[1].name, b[1].name)));

	// add family form
	var addFamilyForm = $("#add-family-form");
	addFamilyForm.find("button.submit").click(function() {
		addFamily(addFamilyForm.find("input[data-field=name]").val());
	});

	// add/update species form
	var updateSpeciesForm = $("#update-species-form");
	updateSpeciesForm.find("select[data-field=family], select[data-field=key]").html('');
	updateSpeciesForm.find("select[data-field=family]").append("<option value=''>-</option>");
	data.families.forEach(function(family) {
		updateSpeciesForm.find("select[data-field=family]").append("<option value='" + family.name + "'>" + family.name + "</option>");
	});
	updateSpeciesForm.find("select[data-field=key]").append("<option value=''>New (auto-generated)</option>");
	Object.values(data.species).forEach(function(species, i) {
		updateSpeciesForm.find("select[data-field=key]").append("<option value='" + species.key + "'>" + species.key + "</option>");
	});
	fillUpdateSpeciesForm();
	updateSpeciesForm.find("select[data-field=key]").change(fillUpdateSpeciesForm);
	updateSpeciesForm.find("button.submit").click(function() {
		saveSpecies(updateSpeciesForm.find("select[data-field=key]").val(), updateSpeciesForm.find("input[data-field=name]").val(), updateSpeciesForm.find("input[data-field=tags]").val(), updateSpeciesForm.find("select[data-field=family]").val());
	});
	updateSpeciesForm.find("select[data-field=key]").select2();
	updateSpeciesForm.find("select[data-field=family]").select2();

	// sightings table
	var table = $("#sightings-table");
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
	var searchKey = $("input[name=filter-sighting]").val();
	var filteredSightings = data.sightings.filter(b => sightingMatches(b, searchKey));
	filteredSightings.slice(OFFSET, OFFSET+ROWS).forEach(function(sighting, i) {
		var row = "<tr id='" + sighting.key + "'>";

		row += "<td class='noborder'>"
		row += "<button class='delete-sighting' title='Delete sighting'>-</button>";
		row += "<input class='hide-checkbox' type='checkbox' data-field='hidden' " + (sighting.hidden ? "" : "checked") + " title='Hide/Unhide sighting'/>";
		row += "</td>";

		row += "<td><span style='width: 100px;' class='label'>" + sighting.key + "</span></td>";

		row += "<td>"
		row += getSelectDOM("species", data.species, getValue(sighting, 'species'), "200px");
		row += "<br>";
		// row += "<span style='width: 200px;' class='label'>" + data.species[sighting.species].family + "</span>";
		// row += "<br>";
		// row += "<span style='width: 200px;' class='label'>" + data.species[sighting.species].tags.map(t => "&lt;"+t+"&gt;").join(", ") + "</span>";
		row += "<textarea data-field='description' style='width:190px;height:80px' placeholder='Enter Description'>" + getValue(sighting, 'description') + "</textarea>";
		row += getSelectDOM("rating", OPT_RATING, getValue(sighting, 'rating'), "200px");
		row += "</td>";

		row += "<td><div style='width: calc(100vw - 820px);'>";
		sighting.media.forEach(function(media, i) {
			row += "<div class='thumbnail'>";
			row += "<span>." + (media.type == "video" ? "mp4" : "jpg") + "</span>";
			row += "<button class='delete-media' data-mediasrc='" + media.src + "' title='Delete media' " + (media.type == "video" ? "disabled" : "") + ">-</button>";
			row += "<button class='move-media-left' data-mediasrc='" + media.src + "' title='Move Left' " + (i <= 0 ? "disabled" : "") + "><</button>";
			if(media.type == 'video') {
				row += "<img src='" + getMedia(media.thumbnail) + "' title='" + media.src + "'/>";
			} else {
				row += "<img src='" + getMedia(media.src) + "' title='" + media.src + "'/>";
			}
			row += "<input class='title-textbox' data-mediasrc='" + media.src + "' type='text' value='" + (media.title||"") + "' placeholder='Add title'></input>";
			row += "</div>";
		});
		row += "<button class='upload-button' title='Add media'>+</button>";
		row += "<input class='upload' type='file' accept='.jpg' hidden/>";
		row += "</div></td>";

		row += "<td class='place-fields'>";
		row += "<input type='date' data-field='date' value='" + moment(sighting.date, 'DD-mm-yyyy').format('yyyy-mm-DD') + "' style='width:180px'></input>";
		row += "<br>";
		row += getSelectDOM("country", data.countries, getValue(sighting, 'country'), "180px");
		row += getSelectDOM("state", data.countries[sighting.country].states, getValue(sighting, 'state'), "180px");
		row += "<input type='text' data-field='city' value='" + getValue(sighting, 'city') + "' style='width:180px' placeholder='Add city'></input>";
		row += "<input type='text' data-field='place' value='" + getValue(sighting, 'place') + "' style='width:180px' placeholder='Add place'></input>";
		row += "</td>";

		row += "<td>";
		row += getSelectDOM("gender", OPT_GENDER, getValue(sighting, 'gender'), "160px");
		row += getSelectDOM("age", OPT_AGE, getValue(sighting, 'age'), "160px");
		row += getSelectDOM("plumage", OPT_PLUMAGE, getValue(sighting, 'plumage'), "160px");
		row += "<br>";
		row += "<input type='text' data-field='variation' value='" + getValue(sighting, 'variation') + "' style='width:160px' placeholder='Add variation'></input>";
		row += "<input type='text' data-field='subspecies' value='" + getValue(sighting, 'subspecies') + "' style='width:160px' placeholder='Add subspecies'></input>";
		row += "</td>";

		row += "<td class='noborder'>"
		row += "<button class='move-up' title='Move Up' " + (OFFSET+i==0?"disabled":"") + ">▲</button>";
		row += "<button class='move-down' title='Move down' " + (OFFSET+i==filteredSightings.length-1?"disabled":"") + ">▼</button>";
		row += "</td>";

		row += "</tr>";

		table.append(row);
		table.find("select").select2();

		var sightingRow = $("#" + sighting.key);
		sightingRow.find(".upload-button").click(function() {
			sightingRow.find(".upload").click();
		});
		sightingRow.find(".upload").change(function() {
			uploadMedia(sighting.key, this.files)
		});
		sightingRow.find("input[type=text], input[type=date], input[type=date], input[type=checkbox], select, textarea").not(".thumbnail *").change(function() {
			var value = ($(this).attr('type') == 'checkbox') ? $(this).is(":checked") : $(this).val();
			updateField(sighting.key, $(this).attr("data-field"), value);
		});
		sightingRow.find("button.delete-media").click(function() {
			deleteMedia(sighting.key, $(this).attr("data-mediasrc"));
		});
		sightingRow.find("button.move-media-left").click(function() {
			moveMediaLeft(sighting.key, $(this).attr("data-mediasrc"));
		});
		sightingRow.find(".thumbnail .title-textbox").change(function() {
			updateMediaProperty(sighting.key, $(this).attr("data-mediasrc"), "title", $(this).val());
		});
		sightingRow.find(".delete-sighting").click(() => deleteSighting(sighting.key));
		sightingRow.find(".move-up").click(() => moveSighting(sighting.key, -1));
		sightingRow.find(".move-down").click(() => moveSighting(sighting.key, 1));
		sightingRow.find("select[data-field=country]").change(function() {
			sightingRow.find("select[data-field=state]").prop('innerHTML', getSelectOptionsDOM("state", data.countries[sighting.country].states, getValue(sighting, 'state')));
			sightingRow.find("select[data-field=state]").select2();
		});
	});

	$('.page-number').html(OFFSET + " - " + Math.min(OFFSET+ROWS, filteredSightings.length) + " of " + filteredSightings.length);
	
	if(OFFSET == 0) {
		$('button.first-page, button.previous').attr("disabled", "disabled");
	} else {
		$('button.first-page, button.previous').removeAttr("disabled");
	}
	
	if(OFFSET+ROWS >= filteredSightings.length) {
		$('button.last-page, button.next').attr("disabled", "disabled");
	} else {
		$('button.last-page, button.next').removeAttr("disabled");
	}
}

function refresh() {
	FIREBASE_ENABLED = true
	clearFileCache();
	data = {};
	readJSONFiles([getData("data/" + currentMode + "-sightings.json"), getData("data/" + currentMode + "-species.json"), getData("data/" + currentMode + "-families.json"), getData("data/places.json")], function(json) {
		data = json;
		render();
		$(".overlay").hide();
	});
}

$(document).ready(function() {
	refresh();

	$('.save').click(function() {
		if(syncRef) {
			syncSightingsData(0);
		}
	});
	$('.sort-by-date').click(sortByDate);
	$('.add-sighting').click(addSighting);
	$('.backup').click(backup);
	$('button.first-page').click(function() {
		if(OFFSET > 0) {
			OFFSET = 0;
			refresh();
			showOverlay();
		}
	});
	$('button.previous').click(function() {
		if(OFFSET > 0) {
			OFFSET = Math.max(OFFSET - ROWS, 0);
			refresh();
			showOverlay();
		}
	});
	$('button.next').click(function() {
		var searchKey = $("input[name=filter-sighting]").val();
		var length = data.sightings.filter(b => sightingMatches(b, searchKey)).length;
		if(OFFSET + ROWS < length) {
			OFFSET += ROWS;
			refresh();
			showOverlay();
		}
	});
	$('button.last-page').click(function() {
		var searchKey = $("input[name=filter-sighting]").val();
		var length = data.sightings.filter(b => sightingMatches(b, searchKey)).length;
		if(OFFSET + ROWS < length) {
			OFFSET = Math.floor(length / ROWS) * ROWS;
			refresh();
			showOverlay();
		}
	});
	$('select[name=page-size]').click(function() {
		ROWS = Number($("select[name=page-size]").val());
		refresh();
	});
	$("input[name=filter-sighting]").change(function() {
		OFFSET = 0;
		refresh();
		$(this).blur();
		showOverlay();
	});
	$("input[name=filter-sighting]").focus(function() {
		$(this).select();
	});
});

window.onbeforeunload = function (e) {
	if(syncRef) {
	    e = e || window.event;

	    // For IE and Firefox prior to version 4
	    if (e) {
	        e.returnValue = 'Changes you made is not saved.';
	    }

	    // For Safari
	    return 'Changes you made is not saved.';
	}
};