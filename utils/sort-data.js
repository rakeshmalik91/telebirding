function sortKeys(t) {
	t1 = {}; 
	['hidden', 'key', 'species', 'gender', 'age', 'variation', 'subspecies', 'plumage', 'date', 'place', 'city', 'state', 'country', 'media'].forEach(k => t1[k]=t[k]);
	return t1;
}

readJSONFile('data/sightings.json', function(json) {
	console.log(JSON.stringify({sightings: json.sightings.sort((b,a) => compare(moment(a.date, "DD-MM-yyyy"), moment(b.date, "DD-MM-yyyy"))).map(b => sortKeys(b))}));
});
