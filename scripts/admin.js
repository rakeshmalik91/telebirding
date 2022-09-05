var data = {};

var OFFSET = 0;
var ROWS = 25;

var IMAGE_SIZE = 1000;

var SYNC_SCHEDULE_TIME = 5000;

var OPT_GENDER = {'': '-', 'M': "Male", 'F': 'Female'};
var OPT_AGE = {'': 'Adult', 'Juvenile': "Juvenile", 'Immature': 'Immature'};
var OPT_PLUMAGE = {'': 'Basic', 'Non-Breeding': "Non-Breeding", 'Breeding': 'Breeding', 'Winter': 'Winter', 'Eclipse': 'Eclipse', "Molting": "Molting"};

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
	$(".overlay").show();
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
	clearTimeout(syncRef);
	syncRef = setTimeout(function() {
		uploadJSONData('birds');
		syncRef = undefined;
	}, scheduleAfter);
}

function uploadMedia(birdKey, files) {
	$(".overlay").show();
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
					alert(e.message);
					$(".overlay").hide();
				});
			});
		}
	});
}

function deleteMedia(birdKey, mediaSrc) {
	if(confirm("You are about to delete this media.")) {
		data.birds.forEach(function(bird) {
			if(bird.key != birdKey) return;
			bird.media = bird.media.filter(m => m.src != mediaSrc);
		});
		firebase.storage().ref(mediaSrc).delete().then(() => {
			syncSightingsData(0);
		})
	}
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
	data.birds.unshift({
		"key": ("s-" + Math.floor(Date.now() / 1000)),
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

function addSpecies(name, tags, family) {
	if(!name || !tags || !family) {
		alert("All fields are mandatory");
		return;
	}
	var key = name.toLowerCase().replaceAll(/\s+/ig, "-").replaceAll('\'', "");
	data.species[key] = {
		key: key,
		name: name,
		tags: tags.split(/\s*,\s*/ig),
		family: family
	};
	data.species = Object.fromEntries(Object.entries(data.species).sort());
	uploadJSONData("species");
}

function addFamily(name) {
	if(!name) {
		alert("Name is mandatory");
		return;
	}
	data.families = data.families.filter(f => f.name != name);
	data.families.push({
		name: name
	});
	uploadJSONData("families");
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

function render() {
	data.species = Object.fromEntries(Object.entries(data.species).sort());

	// add family form
	var addFamilyForm = $("#add-family-form");
	addFamilyForm.find("button.submit").click(function() {
		addFamily(addFamilyForm.find("input[data-field=name]").val());
	});

	// add species form
	var addSpeciesForm = $("#add-species-form");
	data.families.forEach(function(family) {
		addSpeciesForm.find("select[data-field=family]").append("<option value='" + family.name + "'>" + family.name + "</option>");
	});
	addSpeciesForm.find("button.submit").click(function() {
		addSpecies(addSpeciesForm.find("input[data-field=name]").val(), addSpeciesForm.find("input[data-field=tags]").val(), addSpeciesForm.find("select[data-field=family]").val());
	});

	// sightings table
	var table = $("#sightings-table");
	table.html("");
	table.append("<tr>" +
			"<th></th>" +
			"<th>Sighting ID</th>" +
			"<th>Species</th>" +
			"<th>Media</th>" +
			"<th>Date & Place</th>" +
			"<th>Properties</th>" +
		"</tr>");
	var searchKey = $("input[name=filter-sighting]").val();
	var filteredSightings = data.birds.filter(b => birdMatches(b, searchKey));
	$('.page-number').html(OFFSET + " - " + Math.min(OFFSET+ROWS, filteredSightings.length));
	filteredSightings.slice(OFFSET, OFFSET+ROWS).forEach(function(bird, i) {
		var row = "<tr id='" + bird.key + "'>";

		row += "<td>"
		row += "<button class='delete-sighting' title='Delete sighting'>-</button>";
		row += "<input type='checkbox' data-field='hidden' " + (bird.hidden ? "" : "checked") + "/>";
		row += "</td>";

		row += "<td><span style='width: 60px;' class='label'>" + bird.key + "</span></td>";

		row += "<td>"
		row += getSelectDOM("species", data.species, getValue(bird, 'species'), "200px");
		row += "<br>";
		row += "<span style='width: 200px;' class='label'>" + data.species[bird.species].family + "</span>";
		row += "<br>";
		row += "<span style='width: 200px;' class='label'>" + data.species[bird.species].tags.map(t => "&lt;"+t+"&gt;").join(", ") + "</span>";
		row += "</td>";

		row += "<td><div style='width: calc(100vw - 800px); max-width: 700px;'>";
		bird.media.forEach(function(media) {
			row += "<div class='thumbnail'>";
			row += "<span>." + (media.type == "video" ? "mp4" : "jpg") + "</span>";
			row += "<button class='delete-media' data-mediasrc='" + media.src + "' title='Delete media'>-</button>";
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
		row += getSelectDOM("state", data.countries.IN.states, getValue(bird, 'state'), "180px");
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

		row += "</tr>";

		table.append(row);

		var birdRow = $("#" + bird.key);
		birdRow.find(".upload-button").click(function() {
			birdRow.find(".upload").click();
		});
		birdRow.find(".upload").change(function() {
			uploadMedia(bird.key, this.files)
		});
		birdRow.find("input[type=text], input[type=date], input[type=date], input[type=checkbox], select").not(".thumbnail *").change(function() {
			var value = ($(this).attr('type') == 'checkbox') ? $(this).is(":checked") : $(this).val();
			updateField(bird.key, $(this).attr("data-field"), value);
		});
		birdRow.find("button.delete-media").click(function() {
			deleteMedia(bird.key, $(this).attr("data-mediasrc"))
		});
		birdRow.find(".thumbnail .title-textbox").change(function() {
			updateMediaProperty(bird.key, $(this).attr("data-mediasrc"), "title", $(this).val());
		});
		birdRow.find(".delete-sighting").click(() => deleteSighting(bird.key));
	});
}

function refresh() {
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

	$('.add-sighting').click(addSighting);
	$('button.first-page').click(function() {
		if(OFFSET > 0) {
			OFFSET = 0
			refresh();
		$(".overlay").show();
		}
	});
	$('button.previous').click(function() {
		if(OFFSET > 0) {
			OFFSET -= ROWS;
			refresh();
			$(".overlay").show();
		}
	});
	$('button.next').click(function() {
		var searchKey = $("input[name=filter-sighting]").val();
		var length = data.birds.filter(b => birdMatches(b, searchKey)).length;
		if(OFFSET + ROWS < length) {
			OFFSET += ROWS;
			refresh();
			$(".overlay").show();
		}
	});
	$('button.last-page').click(function() {
		var searchKey = $("input[name=filter-sighting]").val();
		var length = data.birds.filter(b => birdMatches(b, searchKey)).length;
		if(OFFSET + ROWS < length) {
			OFFSET = Math.floor(length / ROWS) * ROWS;
			refresh();
			$(".overlay").show();
		}
	});
	$("input[name=filter-sighting]").change(function() {
		OFFSET = 0;
		refresh();
		$(this).blur();
		$(".overlay").show();
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