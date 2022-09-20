var data = {};

var OFFSET = 0;
var ROWS = 10;

var IMAGE_SIZE = 1000;

var SYNC_SCHEDULE_TIME = 60000;

var OPT_GENDER = {'': '-', 'M': "Male", 'F': 'Female'};
var OPT_AGE = {'': 'Adult', 'Juvenile': "Juvenile", 'Immature': 'Immature'};
var OPT_PLUMAGE = {'': 'Basic', 'Non-Breeding': "Non-Breeding", 'Breeding': 'Breeding', 'Winter': 'Winter', 'Eclipse': 'Eclipse', "Molting": "Molting"};

var DATA_DATE_FORMAT = "DD-MM-yyyy";

function showOverlay(text) {
	$(".overlay span").html((text || "Please Wait") + "...");
	$(".overlay").show();
}

function getValue(bird, prop) {
	return bird[prop] ? bird[prop] : '';
}

function getSelectDOM(field, options, value, width) {
	var dom = "<select data-field='" + field + "' style='width:" + width + "'>";
	for (const [k, v] of Object.entries(options)) {
		var name = v instanceof Object ? v.name : v;
		dom += "<option value='" + k + "' " + (k == value ? 'selected' : '') + ">" + name + "</option>";
	}
	dom += "</select>";
	return dom;
}

function uploadJSONData(type) {
	showOverlay("Saving");
	var fileData = {};
	fileData[type] = data[type];
	fileData = JSON.stringify(fileData, null, '\t').split('\n').map(l => l + '\n');
	if(fileData.length < 50) {
		alert("Error uploading...");
		return;
	}
	var file = new File(fileData, type + ".json");
	firebase.storage().ref("data/" + type + ".json").put(file).then(() => {
		console.log("uploaded data/" + type + ".json");
		refresh();
	}).catch(e => {
		alert(e.message);
		$(".overlay").hide();
	});
}

var syncRef;
function syncSightingsData(scheduleAfter) {
	$('.save').removeAttr("disabled");
	clearTimeout(syncRef);
	syncRef = setTimeout(function() {
		uploadJSONData('birds');
		syncRef = undefined;
		$('.save').attr("disabled", "disabled");
	}, scheduleAfter);
}

function uploadMedia(birdKey, files) {
	showOverlay("Uploading Media");
	Array.from(files).forEach(function(file) {
		var mediaSrc;
		if(file.type.match(/image.*/)) {
			var speciesKey = data.species[data.birds.filter(b => b.key == birdKey)[0].species].key;
			mediaSrc = 'images/' + speciesKey + "-" + Math.floor(Date.now() / 1000) + ".jpg";
			console.log("uploading image " + file.name + " for " + birdKey + " as " + mediaSrc);
			resizeImage(file, IMAGE_SIZE).then((resizedImage) => {
				firebase.storage().ref(mediaSrc).put(resizedImage).then(() => {
					console.log("uploaded image " + mediaSrc);
					data.birds.forEach(function(bird) {
						if(bird.key == birdKey) {
							bird.media.push({
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

function deleteMedia(birdKey, mediaSrc) {
	if(!mediaSrc.toLowerCase().endsWith(".jpg")) {
		alert("Unsupported!!!");
		return;
	}
	if(confirm("You are about to delete this media.")) {
		showOverlay("Deleting Media");
		data.birds.forEach(function(bird) {
			if(bird.key != birdKey) return;
			bird.media = bird.media.filter(m => m.src != mediaSrc);
		});
		firebase.storage().ref(mediaSrc).delete().then(() => {
			syncSightingsData(0);
		})
	}
}

function moveMediaLeft(birdKey, mediaSrc) {
	data.birds.forEach(function(bird) {
		if(bird.key != birdKey) return;
		var index = bird.media.map(m => m.src).indexOf(mediaSrc);
		if(index > 0) {
			bird.media = [bird.media.slice(0, index-1), [bird.media[index]], [bird.media[index-1]], bird.media.slice(index+1)].flat();
			syncSightingsData(0);
			return;
		}
	});
}

function updateField(birdKey, field, value) {
	data.birds.forEach(function(bird) {
		if(bird.key != birdKey) return;
		if(field == 'date') {
			bird[field] = moment(value, 'yyyy-mm-DD').format('DD-mm-yyyy');
		} else if(field == 'hidden') {
			bird[field] = !value;
		} else {
			bird[field] = value;
		}
	});
	syncSightingsData(SYNC_SCHEDULE_TIME);
}

function updateMediaProperty(birdKey, mediaSrc, property, value) {
	data.birds.forEach(function(bird) {
		if(bird.key != birdKey) return;
		bird.media.forEach(media => {
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
	data.birds.unshift({
		"key": ("s" + Math.floor(Date.now() / 1000)),
		"species": "rock-pigeon",
		"date": data.birds[0].date,
		"place": data.birds[0].place,
		"city": data.birds[0].city,
		"state": data.birds[0].state,
		"country": data.birds[0].country,
		"hidden": true,
		"media": []
	});
	syncSightingsData(0);
}

function deleteSighting(birdKey) {
	if(confirm("You are about to delete this sighting.")) {
		data.birds.filter(b => b.key == birdKey)[0].media.forEach(function(media) {
			deleteMedia(birdKey, media.src);
		});
		data.birds = data.birds.filter(b => b.key != birdKey);
		syncSightingsData(0);
	}
}

function saveSpecies(key, name, tags, family) {
	if(!name || !tags || !family) {
		alert("All fields are mandatory");
	} else {
		var key = key || name.toLowerCase().replaceAll(/\s+/ig, "-").replaceAll('\'', "");
		data.species[key] = {
			key: key,
			name: name,
			tags: tags.split(/\s*,\s*/ig),
			family: family
		};
		data.species = Object.fromEntries(Object.entries(data.species).sort());
		uploadJSONData("species");
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

function birdMatches(bird, searchKey) {
	searchKey = searchKey.toLowerCase().trim();
	if(searchKey == "hidden") {
		return bird.hidden;
	}
	return bird.key.indexOf(searchKey) >= 0
		|| data.species[bird.species].name.toLowerCase().indexOf(searchKey) >= 0
		|| data.species[bird.species].tags.map(t => t.toLowerCase().indexOf(searchKey) >= 0).reduce((a,b) => a || b)
		|| (bird.place && bird.place.toLowerCase().indexOf(searchKey) >= 0)
		|| (bird.city && bird.city.toLowerCase().indexOf(searchKey) >= 0)
		|| bird.state.toLowerCase().indexOf(searchKey) >= 0
		|| bird.country.toLowerCase().indexOf(searchKey) >= 0
		|| (bird.variation && bird.variation.toLowerCase().indexOf(searchKey) >= 0)
		|| (bird.subspecies && bird.subspecies.toLowerCase().indexOf(searchKey) >= 0)
		|| (bird.plumage && bird.plumage.toLowerCase().indexOf(searchKey) >= 0)
		|| (bird.age && bird.age.toLowerCase().indexOf(searchKey) >= 0);
}

function moveSighting(birdKey, direction) {
	var sighting = data.birds.filter(b => b.key == birdKey)[0];
	var index = data.birds.map(b => b.key).indexOf(birdKey);
	if(direction > 0 && index < data.birds.length-1) {
		data.birds = [data.birds.slice(0, index), data.birds.slice(index+1, index+2), [sighting], data.birds.slice(index+2)].flat();
		syncSightingsData(0);
	} else if(direction < 0 && index > 0) {
		data.birds = [data.birds.slice(0, index-1), [sighting], data.birds.slice(index-1, index), data.birds.slice(index+1)].flat();
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
		updateSpeciesForm.find("select[data-field=family]").val(species.family);
		updateSpeciesForm.find("select[data-field=family] option[value='" + species.family + "']").attr("selected", "selected");
		updateSpeciesForm.find("button.submit").html("Update");
	} else {
		updateSpeciesForm.find("input[data-field=name]").val('');
		updateSpeciesForm.find("input[data-field=tags]").val('');
		updateSpeciesForm.find("select[data-field=family]").val('');
		updateSpeciesForm.find("button.submit").html("Add");
	}
}

function sortByDate() {
	data.birds.sort((a,b) => compare(moment(b.date, DATA_DATE_FORMAT), moment(a.date, DATA_DATE_FORMAT)));
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
	var filteredSightings = data.birds.filter(b => birdMatches(b, searchKey));
	filteredSightings.slice(OFFSET, OFFSET+ROWS).forEach(function(bird, i) {
		var row = "<tr id='" + bird.key + "'>";

		row += "<td class='noborder'>"
		row += "<button class='delete-sighting' title='Delete sighting'>-</button>";
		row += "<input class='hide-checkbox' type='checkbox' data-field='hidden' " + (bird.hidden ? "" : "checked") + " title='Hide/Unhide sighting'/>";
		row += "</td>";

		row += "<td><span style='width: 100px;' class='label'>" + bird.key + "</span></td>";

		row += "<td>"
		row += getSelectDOM("species", data.species, getValue(bird, 'species'), "200px");
		row += "<br>";
		// row += "<span style='width: 200px;' class='label'>" + data.species[bird.species].family + "</span>";
		// row += "<br>";
		// row += "<span style='width: 200px;' class='label'>" + data.species[bird.species].tags.map(t => "&lt;"+t+"&gt;").join(", ") + "</span>";
		row += "<textarea data-field='description' style='width:190px;height:80px' placeholder='Enter Description'>" + getValue(bird, 'description') + "</textarea>";
		row += "</td>";

		row += "<td><div style='width: calc(100vw - 820px);'>";
		bird.media.forEach(function(media, i) {
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
		row += "<input type='date' data-field='date' value='" + moment(bird.date, 'DD-mm-yyyy').format('yyyy-mm-DD') + "' style='width:180px'></input>";
		row += "<br>";
		row += getSelectDOM("country", data.countries, getValue(bird, 'country'), "180px");
		row += getSelectDOM("state", data.countries[bird.country].states, getValue(bird, 'state'), "180px");
		row += "<input type='text' data-field='city' value='" + getValue(bird, 'city') + "' style='width:180px' placeholder='Add city'></input>";
		row += "<input type='text' data-field='place' value='" + getValue(bird, 'place') + "' style='width:180px' placeholder='Add place'></input>";
		row += "</td>";

		row += "<td>";
		row += getSelectDOM("gender", OPT_GENDER, getValue(bird, 'gender'), "160px");
		row += getSelectDOM("age", OPT_AGE, getValue(bird, 'age'), "160px");
		row += getSelectDOM("plumage", OPT_PLUMAGE, getValue(bird, 'plumage'), "160px");
		row += "<br>";
		row += "<input type='text' data-field='variation' value='" + getValue(bird, 'variation') + "' style='width:160px' placeholder='Add variation'></input>";
		row += "<input type='text' data-field='subspecies' value='" + getValue(bird, 'subspecies') + "' style='width:160px' placeholder='Add subspecies'></input>";
		row += "</td>";

		row += "<td class='noborder'>"
		row += "<button class='move-up' title='Move Up' " + (OFFSET+i==0?"disabled":"") + ">▲</button>";
		row += "<button class='move-down' title='Move down' " + (OFFSET+i==filteredSightings.length-1?"disabled":"") + ">▼</button>";
		row += "</td>";

		row += "</tr>";

		table.append(row);

		var birdRow = $("#" + bird.key);
		birdRow.find(".upload-button").click(function() {
			birdRow.find(".upload").click();
		});
		birdRow.find(".upload").change(function() {
			uploadMedia(bird.key, this.files)
		});
		birdRow.find("input[type=text], input[type=date], input[type=date], input[type=checkbox], select, textarea").not(".thumbnail *").change(function() {
			var value = ($(this).attr('type') == 'checkbox') ? $(this).is(":checked") : $(this).val();
			updateField(bird.key, $(this).attr("data-field"), value);
		});
		birdRow.find("button.delete-media").click(function() {
			deleteMedia(bird.key, $(this).attr("data-mediasrc"));
		});
		birdRow.find("button.move-media-left").click(function() {
			moveMediaLeft(bird.key, $(this).attr("data-mediasrc"));
		});
		birdRow.find(".thumbnail .title-textbox").change(function() {
			updateMediaProperty(bird.key, $(this).attr("data-mediasrc"), "title", $(this).val());
		});
		birdRow.find(".delete-sighting").click(() => deleteSighting(bird.key));
		birdRow.find(".move-up").click(() => moveSighting(bird.key, -1));
		birdRow.find(".move-down").click(() => moveSighting(bird.key, 1));
		birdRow.find("select[data-field=country]").change(function() {
			birdRow.find("select[data-field=state]").prop('outerHTML', getSelectDOM("state", data.countries[bird.country].states, getValue(bird, 'state'), "180px"));
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
	readJSONFiles([getData("data/birds.json"), getData("data/species.json"), getData("data/families.json"), getData("data/places.json")], function(json) {
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
	$('button.first-page').click(function() {
		if(OFFSET > 0) {
			OFFSET = 0;
			refresh();
			showOverlay();
		}
	});
	$('button.previous').click(function() {
		if(OFFSET > 0) {
			OFFSET -= ROWS;
			refresh();
			showOverlay();
		}
	});
	$('button.next').click(function() {
		var searchKey = $("input[name=filter-sighting]").val();
		var length = data.birds.filter(b => birdMatches(b, searchKey)).length;
		if(OFFSET + ROWS < length) {
			OFFSET += ROWS;
			refresh();
			showOverlay();
		}
	});
	$('button.last-page').click(function() {
		var searchKey = $("input[name=filter-sighting]").val();
		var length = data.birds.filter(b => birdMatches(b, searchKey)).length;
		if(OFFSET + ROWS < length) {
			OFFSET = Math.floor(length / ROWS) * ROWS;
			refresh();
			showOverlay();
		}
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