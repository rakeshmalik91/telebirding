#!/usr/bin/env python3
"""
Cleanup script to find and merge duplicate species entries in species.json files.
Handles both bird and insect species, and updates corresponding sightings files.
"""

import json
import sys
import re
from pathlib import Path
from collections import defaultdict
from copy import deepcopy


def normalize_name(name):
    """
    Normalize a species name for comparison.
    - Convert to lowercase
    - Remove special characters (hyphens, apostrophes, periods, etc.)
    - Collapse multiple spaces
    - Strip leading/trailing whitespace
    """
    # Convert to lowercase
    normalized = name.lower()
    # Replace special characters with space
    normalized = re.sub(r"[-\'’\.\(\)]", ' ', normalized)
    # Collapse multiple spaces
    normalized = re.sub(r'\s+', ' ', normalized)
    # Strip
    return normalized.strip()


def load_json(filepath):
    """Load JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(filepath, data):
    """Save JSON file with pretty formatting."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def find_duplicates(species_data):
    """
    Find species with duplicate names (case-insensitive, ignoring special chars).
    Returns a dict mapping normalized name -> list of keys with that name.
    """
    name_to_keys = defaultdict(list)
    original_names = {}  # Track original name for display
    
    for key, species in species_data['species'].items():
        name = species['name']
        normalized = normalize_name(name)
        name_to_keys[normalized].append(key)
        # Keep the first original name for display
        if normalized not in original_names:
            original_names[normalized] = name
    
    # Return only names with more than one key, using original name for display
    duplicates = {}
    for norm_name, keys in name_to_keys.items():
        if len(keys) > 1:
            duplicates[original_names[norm_name]] = keys
    return duplicates


def choose_primary_key(species_data, duplicate_keys, sightings_data=None):
    """
    Choose which key to keep among duplicates.
    Priority:
    1. Key that has more complete data (more fields, ebird_code for birds)
    2. Key that is referenced in sightings
    3. First key alphabetically (fallback)
    """
    def score_key(key):
        species = species_data['species'][key]
        score = 0
        # More fields = more complete
        score += len(species)
        # Has ebird_code (birds)
        if 'ebird_code' in species and species['ebird_code']:
            score += 10
        # Has latin_name
        if 'latin_name' in species and species['latin_name']:
            score += 5
        # More tags
        score += len(species.get('tags', []))
        # Referenced in sightings
        if sightings_data:
            for sighting in sightings_data.get('sightings', []):
                if sighting.get('species') == key:
                    score += 100
                    break
        return score
    
    scored = [(score_key(k), k) for k in duplicate_keys]
    scored.sort(reverse=True)
    return scored[0][1]


def merge_species(species_data, primary_key, duplicate_keys):
    """
    Merge duplicate species into the primary key.
    Combines tags and keeps the most complete data.
    """
    primary = species_data['species'][primary_key]
    
    for key in duplicate_keys:
        if key == primary_key:
            continue
        duplicate = species_data['species'][key]
        
        # Merge tags (unique)
        primary_tags = set(primary.get('tags', []))
        duplicate_tags = set(duplicate.get('tags', []))
        primary['tags'] = sorted(list(primary_tags | duplicate_tags))
        
        # Keep non-empty fields from duplicate if primary doesn't have them
        for field, value in duplicate.items():
            if field in ['key', 'name']:
                continue
            if field not in primary or not primary[field]:
                primary[field] = value
        
        # Remove the duplicate
        del species_data['species'][key]
    
    return species_data


def update_sightings(sightings_data, old_key, new_key):
    """Update sightings to use the new key instead of old key."""
    updated = 0
    for sighting in sightings_data.get('sightings', []):
        if sighting.get('species') == old_key:
            sighting['species'] = new_key
            updated += 1
    return updated


def process_category(category_name, species_file, sightings_file, dry_run=False):
    """
    Process a category (bird or insect) to find and merge duplicates.
    """
    print(f"\n{'='*60}")
    print(f"Processing {category_name}...")
    print(f"{'='*60}")
    
    # Load data
    species_data = load_json(species_file)
    sightings_data = load_json(sightings_file)
    
    # Find duplicates
    duplicates = find_duplicates(species_data)
    
    if not duplicates:
        print(f"No duplicate species names found in {category_name}.")
        return 0
    
    print(f"Found {len(duplicates)} duplicate species name(s):")
    for name, keys in duplicates.items():
        print(f"  '{name}': {keys}")
    
    total_merged = 0
    total_sightings_updated = 0
    
    for name, keys in duplicates.items():
        print(f"\n  Merging '{name}'...")
        
        # Choose primary key
        primary_key = choose_primary_key(species_data, keys, sightings_data)
        other_keys = [k for k in keys if k != primary_key]
        
        print(f"    Keeping: {primary_key}")
        print(f"    Removing: {other_keys}")
        
        if not dry_run:
            # Merge species data
            species_data = merge_species(species_data, primary_key, keys)
            
            # Update sightings for each removed key
            for old_key in other_keys:
                updated = update_sightings(sightings_data, old_key, primary_key)
                if updated > 0:
                    print(f"    Updated {updated} sighting(s) from '{old_key}' to '{primary_key}'")
                    total_sightings_updated += updated
            
            total_merged += 1
    
    if not dry_run:
        # Save updated files
        save_json(species_file, species_data)
        save_json(sightings_file, sightings_data)
        print(f"\n  Saved updated {species_file}")
        print(f"  Saved updated {sightings_file}")
    else:
        print(f"\n  [DRY RUN] No files modified.")
    
    print(f"  Merged {total_merged} duplicate group(s)")
    print(f"  Updated {total_sightings_updated} sighting(s)")
    
    return total_merged


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Find and merge duplicate species entries in species.json files.'
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Show what would be done without modifying files'
    )
    parser.add_argument(
        '--category', '-c',
        choices=['bird', 'insect', 'reptile', 'all', 'both'],
        default='all',
        help='Which category to process (default: all)'
    )
    
    args = parser.parse_args()
    
    base_path = Path('webapp/resources/data')
    
    total_merged = 0
    
    if args.category in ['bird', 'all', 'both']:
        total_merged += process_category(
            'Bird',
            base_path / 'bird-species.json',
            base_path / 'bird-sightings.json',
            dry_run=args.dry_run
        )
    
    if args.category in ['insect', 'all', 'both']:
        total_merged += process_category(
            'Insect',
            base_path / 'insect-species.json',
            base_path / 'insect-sightings.json',
            dry_run=args.dry_run
        )

    if args.category in ['reptile', 'all', 'both']:
        total_merged += process_category(
            'Reptile & Amphibian',
            base_path / 'reptile-species.json',
            base_path / 'reptile-sightings.json',
            dry_run=args.dry_run
        )
    
    print(f"\n{'='*60}")
    if args.dry_run:
        print(f"DRY RUN COMPLETE - Would merge {total_merged} duplicate group(s)")
        print(f"Run without --dry-run to apply changes.")
    else:
        print(f"CLEANUP COMPLETE - Merged {total_merged} duplicate group(s)")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()