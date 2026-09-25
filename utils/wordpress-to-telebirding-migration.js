var xml;
readTextFile("migration/telebirding.wordpress.2022-02-23.000.xml", function(text) {
    xml = new DOMParser().parseFromString(text,"text/xml");
	
	var keyTracker = {};
	
	data = Array.prototype.slice.call(xml.getElementsByTagName("item")).filter(i => i.getElementsByTagName("wp:post_type")[0].innerHTML == "post").map(function(p) {
		var json = {};
		
		var title = p.getElementsByTagName("title")[0].innerHTML;
		var name = title.match("[a-zA-Z\- ]+")[0].trim();
		json.name = name;
		
		if(title.toLowerCase().includes("(non-br.)")) {
			json.plumage = "Non-Breeding Plumage";
		} else if(title.toLowerCase().includes("(br.)")) {
			json.plumage = "Breeding Plumage";
		}
		
		if(title.toLowerCase().includes("(imm.)")) {
			json.age = "Immature";
		} else if(title.toLowerCase().includes("(juv.)")) {
			json.age = "Juvenile";
		}
		
		if(title.toLowerCase().includes("♂")) {
			json.gender = "M";
		} else if(title.toLowerCase().includes("♀")) {
			json.gender = "F";
		}
		
		var key = name.toLowerCase().replaceAll(" ", "-");
		if(json.plumage == "Non-Breeding Plumage") {
			key += "-non-breeding";
		} else if(json.plumage == "Breeding Plumage") {
			key += "-breeding";
		}
		if(json.age) {
			key += "-" + json.age.toLowerCase();
		}
		if(json.gender == 'M') {
			key += '-male';
		} else if(json.gender == 'F') {
			key += '-female';
		}
		var count = keyTracker[key];
		if(count) {
			count = count+1;
			keyTracker[key] = count;
			key += "-" + count;
		} else {
			keyTracker[key] = 1;
		}
		
		json.key = key;
		
		json.date = moment(p.getElementsByTagName("pubDate")[0].innerHTML).format('DD-MM-yyyy');
		
		var content = p.getElementsByTagName("content:encoded")[0].textContent.match("[a-zA-Z, \-]+\\s*($|\<)");
		if(content) {
			var place = content[0].split(", ");
			json.place = place[0];
			if(place.length >= 2) {
				json.state = place[1];
			} else {
				json.state = place[0];
			}
		} else {
			json.place = "Unknown";
			json.state = "Unknown";
		}
		json.country = "India";
		
		json.family = "Unknown";
		
		return json;
	});
	
	console.log(JSON.stringify({ "birds": data }));
});
