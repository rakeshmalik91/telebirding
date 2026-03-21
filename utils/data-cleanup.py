import json
import os
import re

def remove_unwanted_values(d):
    """
    Recursively remove null, false, empty list, empty string, and empty dictionary values from a dictionary or list.
    """
    if isinstance(d, dict):
        cleaned = {}
        for k, v in d.items():
            val = remove_unwanted_values(v)
            # Check if val is one of the unwanted types: None, False, [], "", or {}
            if (val is None or 
                (isinstance(val, bool) and val is False) or 
                (isinstance(val, list) and not val) or 
                (isinstance(val, str) and not val) or 
                (isinstance(val, dict) and not val)):
                continue
            cleaned[k] = val
        return cleaned
    elif isinstance(d, list):
        cleaned_list = []
        for v in d:
            val = remove_unwanted_values(v)
            if (val is None or 
                (isinstance(val, bool) and val is False) or 
                (isinstance(val, list) and not val) or 
                (isinstance(val, str) and not val) or 
                (isinstance(val, dict) and not val)):
                continue
            cleaned_list.append(val)
        return cleaned_list
    return d
# Define paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', 'data', 'bird-species.json')

# Simple singularization map for common exceptions
EXCEPTIONS = {
    'ibis': 'ibis',
    'lens': 'lens',
    'analysis': 'analysis',
    'albatross': 'albatross',
    'erpornis': 'erpornis',
    # Add more as discovered
}

def to_singular(word):
    """
    Attempt to singularize a word (naive approach with exceptions).
    """
    word_lower = word.lower()
    if word_lower in EXCEPTIONS:
        return word

    # Words ending in 'ies' -> 'y' (e.g. Canaries -> Canary)
    # Check it has enough length (e.g. 'pies' -> 'pie', 'spies' -> 'spy')
    if word.endswith('ies') and len(word) > 3:
        # Check for matching case
        if word.isupper(): return word[:-3] + 'Y'
        if word[0].isupper(): return word[:-3] + 'y'
        return word[:-3] + 'y'
        
    # Words ending in 's' (but not 'ss') -> remove 's'
    # e.g. "Ducks" -> "Duck"
    if word.endswith('s') and not word.endswith('ss'):
        return word[:-1]
        
    return word

def is_potentially_plural(name):
    """
    Check if a bird name looks plural (ends in s, not 'ss', etc).
    """
    name_parts = name.split()
    last_word = name_parts[-1]
    last_word_lower = last_word.lower()
    
    # Ignore if word is in exceptions
    if last_word_lower in EXCEPTIONS:
        return False
        
    # Ignore if it ends in 'ss'
    if last_word.endswith('ss'):
        return False

    if last_word.endswith('s'):
        return True
    return False

def clean_data():
    print(f"Looking for data file at: {DATA_FILE}")
    if not os.path.exists(DATA_FILE):
        print(f"Error: File not found at {DATA_FILE}")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}")
            return

    species_list = data.get('species', {})
    modified_count = 0
    
    # Store candidates for renaming to ask user
    # (key, original_name, proposed_name)
    rename_candidates = []

    print(f"Scanning {len(species_list)} species...")

    for key, bird in species_list.items():
        name = bird.get('name', '')
        
        # --- Check for singular name issues ---
        if is_potentially_plural(name):
            # Propose singular version
            name_parts = name.split()
            last_word = name_parts[-1]
            singular_last = to_singular(last_word)
            
            if singular_last != last_word:
                name_parts[-1] = singular_last
                proposed_name = " ".join(name_parts)
                rename_candidates.append((key, name, proposed_name))
        
        if 'tags' not in bird:
            bird['tags'] = []
            
        current_tags = bird['tags']
        existing_tags_set = set(current_tags)
        tags_to_add = set()
        
        # --- Apply User Rules ---

        if any(x in name for x in ['Eagle', 'Hawk', 'Falcon', 'Hobby', 'Kite', 'Kestrel', 'Merlin', 'Sparrowhawk', 'Shikra', 'Besra', 'Harrier', 'Buzzard', 'Osprey', 'Vulture', 'Eagle-Owl', 'Owl', 'Frogmouth', 'Nightjar']):
            tags_to_add.add('Raptor')
            tags_to_add.add('Bird of Prey')
        if any(x in name for x in ['Falcon', 'Hawk', 'Hobby', 'Kestrel', 'Merlin', 'Sparrowhawk', 'Shikra', 'Besra']):
            tags_to_add.add('Accipiter')
        if 'Vulture' in name:
            tags_to_add.add('Scavenger')
        if any(x in name for x in ['Owl', 'Frogmouth', 'Nightjar']):
            tags_to_add.add('Nocturnal')
        if any(x.lower() in name.lower() for x in ['Sandpiper', 'Plover', 'Duck', 'Waterfowl', 'Goose']):
            tags_to_add.add('Wader')
            tags_to_add.add('Wading Bird')
            tags_to_add.add('Water Bird')
            tags_to_add.add('Shorebird')
        if any(x in name for x in ['Gull', 'Gannet', 'Tern', 'Skua', 'Petrel', 'Shearwater', 'Albatross', 'Storm-petrel', 'Storm Petrel', 'Kittiwake']):
            tags_to_add.add('Seabird')
            tags_to_add.add('Pelagic')
        if any(x.lower() in name.lower() for x in ['Dove', 'Pigeon']):
            tags_to_add.add('Dove')
            tags_to_add.add('Pigeon')

        # --- Process Existing Tags and Merged New Tags ---
        
        final_tags = set()
        
        all_candidate_tags = existing_tags_set.union(tags_to_add)
        
        for tag in all_candidate_tags:
            # 1. Singularize Tag
            singular_tag = to_singular(tag)
            final_tags.add(singular_tag)

        # Update tags if changed
        if final_tags != existing_tags_set:
            bird['tags'] = sorted(list(final_tags))
            modified_count += 1

    # --- Interactive Rename Section ---
    if rename_candidates:
        print(f"\nFound {len(rename_candidates)} potential plural names.")
        for key, old_name, new_name in rename_candidates:
            print(f"\nSpecies Key: {key}")
            choice = input(f"Rename '{old_name}' to '{new_name}'? [y/N]: ").strip().lower()
            if choice == 'y':
                species_list[key]['name'] = new_name
                modified_count += 1
                print(f"Available: Renamed to {new_name}")
            else:
                print("Skipped.")

    if modified_count > 0:
        print(f"\nUpdating data for {modified_count} birds...")
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print("Success: File saved.")
    else:
        print("\nNo changes made.")

def clean_unwanted_values(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    old_data_str = json.dumps(data)
    data = remove_unwanted_values(data)
    
    if json.dumps(data) != old_data_str:
        print(f"Removing unwanted values (null, [], \"\", {{}}, false) in {os.path.basename(filepath)}...")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)    

if __name__ == "__main__":
    clean_data()
    
    print("\n--- Running Unwanted Values Cleanup on All Relevant Files ---")
    files = [
        'bird-species.json',
        'insect-species.json',
        'bird-sightings.json',
        'insect-sightings.json'
    ]
    for filename in files:
        filepath = os.path.join(BASE_DIR, '..', 'data', filename)
        clean_unwanted_values(filepath)
