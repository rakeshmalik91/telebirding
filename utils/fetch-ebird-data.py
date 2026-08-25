import json
import requests
import re

# ------------------------------------------------

def find_species_code(name):
    url = "https://api.ebird.org/v2/ref/taxon/find"
    params = {
        "cat": "species",
        "key": "jfekjedvescr",
        "locale": "en",
        "q": name
    }
    response = requests.get(url, params=params)
    if response.status_code == 200 and len(response.json()) == 1:
        return response.json()[0]['code']
    elif response.status_code == 200 and len(response.json()) > 1:
        codes = [s['code'] for s in response.json() if s['name'].split(r"\s+[-(]\s+")[0].lower() == name.lower()]
        if codes:
            return codes[0]
    print(f"\tError fetching species code for {name}. Fetched names: {[ s['name'] for s in response.json()]}")
    return ''

def get_latin_name(sp_code):
    url = "https://api.ebird.org/v2/ref/taxonomy/ebird"
    params = {
        "cat": "species",
        "fmt": "json",
        "species": sp_code,
        "locale": "en"
    }
    response = requests.get(url, params=params)
    if response.status_code == 200 and len(response.json()) == 1:
        return response.json()[0]['sciName'].lower()
    else:
        print(f"\tError fetching latin name for {sp_code}")
        return ''


# -------------------------------------------------

# read file
file_path = "../webapp/resources/data/bird-species.json"
with open(file_path, "r", encoding="utf-8") as file:
    data = json.load(file)

for key, sp in [ sp for sp in data['species'].items() ]:
    sp_code = ''
    latin_name = ''

    # removing garbage data
    # if 'name' not in sp:
    #     print(f"Removing {key}: {sp}")
    #     del data['species'][key]
    #     continue

    # fetch ebird code and latin name 
    try:
        if not 'ebird_code' in sp or not sp['ebird_code'] or not 'latin_name' in sp or not sp['latin_name']:
            print(f"\n--------------\nFetching {sp['name']}...")
        if not 'ebird_code' in sp or not sp['ebird_code']:
            possible_names = [sp['name'], f"Indian {sp['name']}", f"Asian {sp['name']}", re.sub(r"(?i)grey", "gray", sp['name'])]
            longer_tags = sorted([ t for t in sp['tags'] if len(t.split(' ')) > 1], key=len, reverse=True)
            for name in possible_names + longer_tags:
                sp_code = find_species_code(name)
                if sp_code:
                    print(f"\tSpecies code: {sp_code}")
                    if name != sp['name']:
                        print(f"\tNew name: {name}")
                        if name in sp['tags']:
                            sp['tags'].remove(name)
                        sp['tags'] = sp['tags'] + [sp['name']]
                        sp['name'] = name
                    break
        else:
            sp_code = sp['ebird_code']
        if sp_code:
            sp['ebird_code'] = sp_code
            if not 'latin_name' in sp or not sp['latin_name']:
                latin_name = get_latin_name(sp_code)
        if latin_name:
            print(f"\tLatin name: {latin_name}")
            sp['latin_name'] = latin_name
    except Exception:
        print(f"Exception in {sp}")

# save file
with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, separators=(",", ":"))