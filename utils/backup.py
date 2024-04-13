import urllib.request
import json
from pathlib import Path

firestoragePath = "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/"
dataDir = "data"

for filename in ["sightings", "species", "families"]:
	src = firestoragePath + dataDir + "%2F" + filename + ".json?alt=media"
	dst = dataDir + "/" + filename + ".json"
	print("Downloading " + dst + " ...")
	urllib.request.urlretrieve(src, dst)

data = json.load(open(dataDir + "/sightings.json"))
for sighting in data['sightings']:
	for media in sighting['media']:
		if 'type' not in media or media['type'] == 'image':
			src = firestoragePath + media['src'].replace('/', '%2F') + "?alt=media"
			dst = media['src']
			if not Path(dst).is_file():
				print("Downloading " + dst + " ...")
				urllib.request.urlretrieve(src, dst)
