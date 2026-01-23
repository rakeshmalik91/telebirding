import json
import requests
import time
import os

SPECIES_FILE = r'd:\Projects\telebirding\data\bird-species.json'
FAMILIES_FILE = r'd:\Projects\telebirding\data\bird-families.json'

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

def fetch_batch(codes):
    code_str = ",".join(codes)
    url = f"https://api.ebird.org/v2/ref/taxonomy/ebird?cat=species&fmt=json&species={code_str}&locale=en"
    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code == 200:
            return resp.json()
        print(f"Error {resp.status_code} fetching batch: {resp.text}")
    except Exception as e:
        print(f"Exception fetching batch: {e}")
    return []

def main():
    print("Loading data...")
    species_data = load_json(SPECIES_FILE)
    families_data = load_json(FAMILIES_FILE)
    
    # Map family name to object for easy access and updates
    families_list = families_data.get('families', [])
    families_map = {}
    for f in families_list:
        if isinstance(f, dict) and 'name' in f:
            families_map[f['name']] = f
    
    # Map ebird_code to list of species keys
    code_to_keys = {}
    for key, info in species_data.get('species', {}).items():
        code = info.get('ebird_code')
        if code:
            if code not in code_to_keys:
                code_to_keys[code] = []
            code_to_keys[code].append(key)
            
    all_codes = list(code_to_keys.keys())
    batch_size = 25
    total_batches = (len(all_codes) + batch_size - 1) // batch_size
    
    print(f"Found {len(all_codes)} codes to check in {total_batches} batches.")
    
    # Track used families to remove unused ones later
    used_families = set()

    for i in range(0, len(all_codes), batch_size):
        batch_codes = all_codes[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{total_batches} ({len(batch_codes)} codes)...")
        
        results = fetch_batch(batch_codes)
        
        updates_made = False
        
        for item in results:
            sp_code = item.get('speciesCode')
            com_name = item.get('comName')           # eBird Common Name
            fam_com_name = item.get('familyComName') # eBird Family Common Name
            fam_sci_name = item.get('familySciName')
            fam_code = item.get('familyCode')
            
            if sp_code and fam_com_name:
                # Add to used families list
                used_families.add(fam_com_name)

                # 1. Update species details in bird-species.json
                if sp_code in code_to_keys:
                    for sp_key in code_to_keys[sp_code]:
                        sp_obj = species_data['species'][sp_key]
                        
                        # A. Update Family
                        if sp_obj.get('family') != fam_com_name:
                            print(f"  [{sp_key}] Updating family: '{sp_obj.get('family')}' -> '{fam_com_name}'")
                            sp_obj['family'] = fam_com_name
                            updates_made = True
                            
                        # B. Update Common Name and Tags
                        current_name = sp_obj.get('name', '')
                        if com_name and current_name != com_name:
                            print(f"  [{sp_key}] Name mismatch: '{current_name}' -> '{com_name}'")
                            tags = sp_obj.get('tags', [])
                            
                            # Add old name to tags if not present
                            if current_name and current_name not in tags:
                                print(f"    -> Added '{current_name}' to tags")
                                tags.append(current_name)
                                sp_obj['tags'] = tags
                            
                            sp_obj['name'] = com_name
                            updates_made = True
                
                # 2. Update or Add family in bird-families.json
                if fam_com_name not in families_map:
                    print(f"  New Family found: {fam_com_name}")
                    families_map[fam_com_name] = {'name': fam_com_name}
                    updates_made = True
                
                fam_obj = families_map[fam_com_name]
                
                # Check and update fields if missing or different
                if fam_obj.get('ebird_code') != fam_code or fam_obj.get('sci_name') != fam_sci_name:
                    fam_obj['ebird_code'] = fam_code
                    fam_obj['sci_name'] = fam_sci_name
                    updates_made = True
        
        if updates_made:
             # Sort families by name (don't save yet, wait for final cleanup)
             # We save intermediates just in case of crash, but cleanup happens at end
            sorted_families = sorted(families_map.values(), key=lambda x: x['name'])
            families_data['families'] = sorted_families
            save_json(SPECIES_FILE, species_data)
            save_json(FAMILIES_FILE, families_data)
            print("  Progress saved.")
        else:
            print("  No changes in this batch.")
            
        time.sleep(0.5) 
    
    # --- Cleanup Unused Families ---
    print("\nCleaning up unused families...")
    final_families_list = []
    removed_families = []
    
    # families_map currently holds all families found in eBird + leftovers from original file
    # used_families holds exactly what we saw in the eBird responses for our species list
    
    for fam_name, fam_obj in families_map.items():
        if fam_name in used_families:
            final_families_list.append(fam_obj)
        else:
            removed_families.append(fam_name)
            
    if removed_families:
        print(f"Removing {len(removed_families)} unused families: {', '.join(removed_families)}")
        
        # Sort and Save Final
        final_families_list.sort(key=lambda x: x['name'])
        families_data['families'] = final_families_list
        save_json(FAMILIES_FILE, families_data)
        print("Final cleanup saved.")
    else:
        print("No unused families found.")

    print("Completed.")

if __name__ == "__main__":
    main()
