import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Try importing google cloud storage
try:
    from google.cloud import storage
except ImportError:
    print("Error: `google-cloud-storage` is required.")
    sys.exit(1)

BUCKET_NAME = "telebirding-49623.appspot.com"
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"

TARGET_FILES = [
    "data/bird-families.json",
    "data/bird-species.json",
    "data/bird-sightings.json",
    "data/insect-families.json",
    "data/insect-species.json",
    "data/insect-sightings.json"
]

def get_git_changed_files():
    """Returns a set of files changed in git (relative to repo root)."""
    try:
        # Check for modified or staged files
        # --porcelain gives easy to parse output
        output = subprocess.check_output(['git', 'status', '--porcelain'], cwd=BASE_DIR).decode('utf-8')
        changed_files = set()
        for line in output.splitlines():
            if not line.strip():
                continue
            # format is "XY filename" or "XY  filename"
            # e.g. " M data/bird-species.json"
            parts = line.split(maxsplit=1)
            if len(parts) < 2:
                continue
            filename = parts[1]
            changed_files.add(filename)
        return changed_files
    except subprocess.CalledProcessError:
        print("Warning: Could not check git status. Assuming no git context.")
        return set()
    except FileNotFoundError:
        print("Warning: git command not found.")
        return set()

def upload_minified_json(client, local_path, remote_path):
    """Minifies JSON and uploads it to Firebase Storage."""
    bucket = client.bucket(BUCKET_NAME)
    try:
        text = local_path.read_text(encoding='utf-8')
        data = json.loads(text)
        minified = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
        
        blob = bucket.blob(remote_path)
        blob.content_type = 'application/json; charset=utf-8'
        
        print(f"Uploading {remote_path}...")
        blob.upload_from_string(minified, content_type='application/json; charset=utf-8')
        print(f"  -> Success")
        return True
    except Exception as e:
        print(f"  -> Failed to upload {remote_path}: {e}")
        return False

def cleanup_remote_images(client):
    """Deletes images from Firebase Storage that are not referenced in the JSON data."""
    print("Cleaning up unused images from Firebase Storage...")
    
    # 1. Collect all referenced images from JSON files
    referenced_images = set()
    sighting_files = [
        DATA_DIR / "bird-sightings.json",
        DATA_DIR / "insect-sightings.json"
    ]
    
    for f_path in sighting_files:
        if not f_path.exists():
            continue
        try:
            with open(f_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for sighting in data.get('sightings', []):
                    # Check media array
                    for m in sighting.get('media', []):
                        src = m.get('src')
                        if src:
                            referenced_images.add(src.lstrip('/'))
                    
                    # Check thumbnail field
                    thumb = sighting.get('thumbnail')
                    if thumb:
                        referenced_images.add(thumb.lstrip('/'))
        except Exception as e:
            print(f"  Error reading {f_path.name}: {e}")

    print(f"Found {len(referenced_images)} referenced images in JSON files.")

    # 2. List all images in remote storage
    bucket = client.bucket(BUCKET_NAME)
    blobs = bucket.list_blobs(prefix="images/")
    
    remote_images = []
    for blob in blobs:
        # Skip directory markers
        if blob.name.endswith('/'):
            continue
        remote_images.append(blob.name)

    print(f"Found {len(remote_images)} images in remote storage (images/ folder).")

    # 3. Identify orphaned images
    orphaned_images = [img for img in remote_images if img not in referenced_images]
    
    if not orphaned_images:
        print("No unused images found on remote.")
        return

    print(f"Found {len(orphaned_images)} unused images on remote:")
    for img in sorted(orphaned_images):
        print(f"  - {img}")
    print()
    
    # Confirm deletion if in interactive terminal
    if sys.stdin.isatty():
        confirm = input(f"Are you sure you want to delete these {len(orphaned_images)} files? (y/n): ")
        if confirm.lower() != 'y':
            print("Cleanup aborted.")
            return
    else:
        print("Non-interactive terminal detected. Proceeding with cleanup...")

    # 4. Delete orphaned images
    for img_path in orphaned_images:
        print(f"  Deleting {img_path}...")
        try:
            bucket.blob(img_path).delete()
            print(f"    -> Deleted.")
        except Exception as e:
            print(f"    -> Failed to delete {img_path}: {e}")

    print("Cleanup complete.")

def main():
    parser = argparse.ArgumentParser(description="Sync bird/insect data to Firebase.")
    parser.add_argument('-f', '--force', action='store_true', help="Force upload of all target files.")
    parser.add_argument('--cleanup', action='store_true', help="Cleanup unused images from Firebase Storage.")
    args = parser.parse_args()

    # Initialize storage client
    try:
        client = storage.Client()
    except Exception as e:
        print(f"Error initializing Google Cloud Storage client: {e}")
        sys.exit(1)

    files_to_upload = []
    
    if args.force:
        print("Force mode enabled: Uploading all target files.")
        files_to_upload = TARGET_FILES
    else:
        changed_files = get_git_changed_files()
        print("Checking git status for changes...")
        
        # Define groups
        bird_files = [f for f in TARGET_FILES if "bird-" in f]
        insect_files = [f for f in TARGET_FILES if "insect-" in f]
        
        files_set = set()
        
        # Check bird group
        if any(f in changed_files for f in bird_files):
            print("  -> Bird data change detected. Queueing all bird files.")
            files_set.update(bird_files)
            
        # Check insect group
        if any(f in changed_files for f in insect_files):
            print("  -> Insect data change detected. Queueing all insect files.")
            files_set.update(insect_files)
            
        files_to_upload = sorted(list(files_set))
    
    if not files_to_upload:
        print("No files to upload.")
    else:
        print(f"Uploading {len(files_to_upload)} files...")
        for rel_path in files_to_upload:
            local_path = BASE_DIR / rel_path
            if local_path.exists():
                upload_minified_json(client, local_path, rel_path)
            else:
                print(f"Warning: File not found {local_path}")

    # Run cleanup if requested
    if args.cleanup:
        cleanup_remote_images(client)

if __name__ == "__main__":
    main()
