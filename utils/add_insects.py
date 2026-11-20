import argparse
import os
import sys
import json
import time
import shutil
import mimetypes
import re
from pathlib import Path
from PIL import Image

# Add insect-id to path to import mynnlibv2
# We assume the user runs this from d:\Projects\telebirding
BASE_DIR = Path(__file__).resolve().parents[1]
INSECT_ID_DIR = BASE_DIR.parent / "insect-id"
IMAGES_DIR = BASE_DIR / "webapp" / "resources" / "images"
SIGHTINGS_FILE = BASE_DIR / "webapp" / "resources" / "data" / "insect-sightings.json"
SPECIES_FILE = BASE_DIR / "webapp" / "resources" / "data" / "insect-species.json"

if INSECT_ID_DIR.exists():
    sys.path.append(str(INSECT_ID_DIR))
else:
    # Fallback if not found relative to current script
    INSECT_ID_DIR = Path("D:/Projects/insect-id")
    if INSECT_ID_DIR.exists():
        sys.path.append(str(INSECT_ID_DIR))

try:
    import torch
    import torch.nn.functional as F
    import mynnlibv2
except ImportError as e:
    print(f"Warning: Could not import dependencies for 'process' command: {e}")

try:
    from google.cloud import storage
except ImportError:
    print("Warning: google-cloud-storage not found. Firebase upload will be disabled.")

BUCKET_NAME = "telebirding-49623.appspot.com"

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text

def square_crop_image(img_path, output_dir, target_size=1000):
    try:
        with Image.open(img_path) as img:
            # Convert to RGB (to save as JPG)
            if img.mode != 'RGB':
                img = img.convert('RGB')
                
            width, height = img.size
            
            # Calculate square crop dimensions (center-aligned)
            if width > height:
                # Landscape: crop left and right
                left = (width - height) / 2
                top = 0
                right = left + height
                bottom = height
            else:
                # Portrait: crop top and bottom
                left = 0
                top = (height - width) / 2
                right = width
                bottom = top + width
            
            img = img.crop((left, top, right, bottom))
            # Now resize smoothly to the target size
            img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
            
            # Preserve EXIF
            exif = img.info.get('exif')
            
            os.makedirs(output_dir, exist_ok=True)
            output_path = Path(output_dir) / (img_path.stem + ".jpg")
            
            if exif:
                img.save(output_path, 'JPEG', quality=95, exif=exif)
            else:
                img.save(output_path, 'JPEG', quality=95)
            return output_path
    except Exception as e:
        print(f"  Error cropping {img_path}: {e}")
        return None

def upload_to_firebase(local_path, remote_path):
    try:
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(remote_path)
        
        ctype, _ = mimetypes.guess_type(str(local_path))
        if ctype:
            blob.content_type = ctype
            
        print(f"Uploading {local_path} to {remote_path} ...")
        blob.upload_from_filename(str(local_path))
        return True
    except Exception as e:
        print(f"Upload failed for {remote_path}: {e}")
        return False

def get_next_sighting_key(sightings):
    # Format: s1773209689
    # We use current timestamp and ensure it's unique
    ts = int(time.time())
    while True:
        key = f"s{ts}"
        if not any(s['key'] == key for s in sightings):
            return key
        ts += 1

def process_images(args):
    model_paths = [Path(p.strip()) for p in args.model.split(',')]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    loaded_models = []
    
    for model_path in model_paths:
        if not model_path.exists():
            print(f"Error: Model not found at {model_path}")
            continue

        print(f"Loading model from {model_path}...")
        try:
            model_data = torch.load(model_path, map_location=device, weights_only=False)
            
            # Ensure model is on the correct device
            if 'model' in model_data:
                model_data['model'].to(device)
            model_data['device'] = device
            
            # Ensure transforms are present in model_data
            if 'transform' not in model_data or 'val' not in model_data['transform']:
                from torchvision import transforms
                image_size = model_data.get('image_size', 224)
                img_header_footer_ratio = 1.1
                normazile_x = [0.485, 0.456, 0.406]
                normalize_y = [0.229, 0.224, 0.225]
                model_data['transform'] = {
                    'val': transforms.Compose([
                        transforms.Resize(int(image_size * img_header_footer_ratio)),
                        transforms.CenterCrop((image_size, image_size)),
                        transforms.ToTensor(),
                        transforms.Normalize(normazile_x, normalize_y),
                    ])
                }
            loaded_models.append((model_data, model_path.name))
        except Exception as e:
            print(f"Error loading model {model_path}: {e}")
            continue

    if not loaded_models:
        print("Error: No valid models loaded.")
        return

    # Pluralization helper
    def get_family_plural(singular):
        if singular.lower() == "butterfly":
            return "Butterflies"
        if singular.endswith('y'):
            return singular[:-1] + "ies"
        if not singular.endswith('s'):
            return singular + "s"
        return singular

    with open(SIGHTINGS_FILE, 'r', encoding='utf-8') as f:
        sightings_data = json.load(f)
    
    with open(SPECIES_FILE, 'r', encoding='utf-8') as f:
        species_data = json.load(f)

    # Parse place
    # "India, Andaman & Nicobar Islands, South Andaman, Chidiyatapu"
    place_parts = [p.strip() for p in args.place.split(',')]
    country = place_parts[0] if len(place_parts) > 0 else "India"
    state = place_parts[1] if len(place_parts) > 1 else ""
    city = place_parts[2] if len(place_parts) > 2 else ""
    specific_place = place_parts[3] if len(place_parts) > 3 else ""

    # Load class details if provided
    class_details = {}
    if args.class_details:
        cd_path = Path(args.class_details)
        if cd_path.exists():
            with open(cd_path, 'r', encoding='utf-8') as f:
                class_details = json.load(f)
        else:
            print(f"Warning: Class details file not found at {cd_path}")

    img_dir = Path(args.dir)
    images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.jpeg")) + list(img_dir.glob("*.png"))
    
    session_sightings = {} # species_key -> sighting_object
    processed_count = 0
    
    # Helpers
    def parse_date(date_str):
        try:
            return time.mktime(time.strptime(date_str, "%d-%m-%Y"))
        except (ValueError, TypeError):
            return 0

    WINDOW_SECONDS = 15 * 24 * 60 * 60 # 15 days
    
    for img_path in images:
        print(f"\nProcessing {img_path.name}...")
        
        best_pred = None
        for model_data, model_name in loaded_models:
            # Inference
            preds = mynnlibv2.predict_top_k(img_path, model_data, k=1)
            if not preds:
                print(f"  Warning: Inference failed for model {model_name}")
                continue
                
            species_name, score = list(preds.items())[0]
            print(f"  [{model_name}] Predicted: {species_name} ({score:.2%})")
            
            if score >= args.threshold:
                best_pred = (species_name, score)
                break
            else:
                print(f"    Score below threshold ({args.threshold:.2%})")

        if not best_pred:
            print(f"Skipping {img_path.name}: No model met the threshold.")
            continue
            
        species_label, score = best_pred
        
        # Determine descriptive name and key
        species_key = slugify(species_label)
        display_name = species_label.replace('-', ' ').title()
        latin_name = species_label.replace('-', ' ').lower()
        
        if species_key in class_details:
            details = class_details[species_key]
            if "name" in details:
                display_name = details["name"]
            if "latin_name" in details:
                latin_name = details["latin_name"]
            elif "scientific_name" in details: # fallback
                latin_name = details["scientific_name"]
        
        # Add to species.json if missing
        if species_key not in species_data['species']:
            print(f"Adding new species: {species_key} ({display_name})")
            family_name = get_family_plural(args.type)
            species_data['species'][species_key] = {
                "key": species_key,
                "name": display_name,
                "tags": [args.type],
                "family": family_name,
                "latin_name": latin_name
            }
        
        # Extract timestamp from EXIF (Date Taken) or file creation date
        timestamp = None
        try:
            with Image.open(img_path) as img:
                exif_data = img._getexif()
                if exif_data:
                    # Try multiple date tags: 36867 (DateTimeOriginal), 36868 (DateTimeDigitized), 306 (DateTime)
                    for tag in [36867, 36868, 306]:
                        date_taken = exif_data.get(tag)
                        if date_taken:
                            try:
                                timestamp = int(time.mktime(time.strptime(date_taken, "%Y:%m:%d %H:%M:%S")))
                                break # Found a valid date
                            except (ValueError, TypeError):
                                continue
        except Exception as e:
            print(f"  Warning: Could not read EXIF from {img_path.name}: {e}")

        if not timestamp:
            if args.date:
                try:
                    # Expecting date in dd-mm-yyyy format
                    timestamp = int(time.mktime(time.strptime(args.date, "%d-%m-%Y")))
                except (ValueError, TypeError) as e:
                    print(f"  Warning: Invalid --date format '{args.date}'. Expected DD-MM-YYYY. Falling back to file date.")
                    timestamp = int(img_path.stat().st_ctime)
            else:
                timestamp = int(img_path.stat().st_ctime)

        # Generate sighting key and filename
        # Add index to ensure uniqueness if multiple images have same timestamp
        unique_ts = timestamp + processed_count
        new_filename = f"{species_key}-{unique_ts}.jpg"
        
        # Determine physical move location (staging area)
        output_dir = Path(args.output_dir).resolve()
        target_local_path = output_dir / new_filename

        # Use the relative staging path in the JSON during the processing phase
        rel_staging_path = output_dir.relative_to(BASE_DIR).as_posix()
        json_src_path = f"{rel_staging_path}/{new_filename}"
        
        # Create or update sighting entry
        existing_sighting = None
        
        # 1. Check if we already created a sighting for this species in this session
        if species_key in session_sightings:
            existing_sighting = session_sightings[species_key]
        else:
            # 2. Check the global database for a sighting within +/- 15 days
            for s in sightings_data['sightings']:
                if s.get('species') == species_key:
                    s_ts = parse_date(s.get('date', ''))
                    if abs(s_ts - timestamp) <= WINDOW_SECONDS:
                        existing_sighting = s
                        # Cache it in session_sightings for subsequent images
                        session_sightings[species_key] = s
                        break

        if existing_sighting:
            existing_sighting["media"].append({
                "src": json_src_path
            })
            print(f"  Added to existing sighting for {species_key} (ID: {existing_sighting['key']}, Date: {existing_sighting['date']})")
        else:
            sighting_key = get_next_sighting_key(sightings_data['sightings'])
            date_str = time.strftime("%d-%m-%Y", time.localtime(timestamp))
            
            new_sighting = {
                "key": sighting_key,
                "species": species_key,
                "date": date_str,
                "city": city,
                "state": state,
                "country": country,
                "author": "Rakesh Malik",
                "unconfirmed": True,
                "time_of_day": "Day",
                "weather": "Sunny",
                "hidden": False,
                "media": [
                    {
                        "src": json_src_path
                    }
                ],
                "rating": "3"
            }
            if specific_place:
                new_sighting["place"] = specific_place
                
            session_sightings[species_key] = new_sighting
            sightings_data['sightings'].insert(0, new_sighting) # Add to top
            print(f"  Created new session sighting for {species_key}")
        
        # Rename and Move
        print(f"Moving to {target_local_path}")
        os.makedirs(target_local_path.parent, exist_ok=True)
        shutil.move(img_path, target_local_path)
        
        processed_count += 1
        
        # Remove source if requested (shutil.move already removed it if successful)
        if args.remove_source and img_path.exists():
            try:
                os.remove(img_path)
                print(f"  Removed source: {img_path.name}")
            except Exception as e:
                print(f"  Error removing source {img_path.name}: {e}")
        
    # Sort sightings by date (descending: newest first)
    sightings_data['sightings'].sort(key=lambda x: (parse_date(x.get('date', '')), x.get('key', '')), reverse=True)

    # Save JSONs
    with open(SIGHTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(sightings_data, f, indent=4)
        
    with open(SPECIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(species_data, f, indent=4)
        
    print(f"\nFinished! Processed {processed_count} images.")

def upload_minified_json(local_path, remote_path):
    """Minifies JSON and uploads it to Firebase Storage."""
    try:
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        
        text = local_path.read_text(encoding='utf-8')
        data = json.loads(text)
        minified = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
        
        blob = bucket.blob(remote_path)
        blob.content_type = 'application/json; charset=utf-8'
        
        print(f"Uploading {remote_path} (minified)...")
        blob.upload_from_string(minified, content_type='application/json; charset=utf-8')
        return True
    except Exception as e:
        print(f"  -> Failed to upload {remote_path}: {e}")
        return False

def publish_data(args):
    processed_dir = Path(args.dir).resolve()
    images_dir = IMAGES_DIR
    
    # Calculate the relative staging prefix for JSON replacement
    try:
        rel_staging_prefix = processed_dir.relative_to(BASE_DIR).as_posix() + "/"
    except ValueError:
        rel_staging_prefix = processed_dir.name + "/"

    # Calculate the relative final path (usually "images/")
    rel_images_prefix = IMAGES_DIR.relative_to(BASE_DIR).as_posix() + "/"

    if not SIGHTINGS_FILE.exists():
        print(f"Error: {SIGHTINGS_FILE} not found.")
        return

    if not processed_dir.exists():
        print(f"No staging directory found at {processed_dir}. Nothing to publish.")
        return

    with open(SIGHTINGS_FILE, 'r', encoding='utf-8') as f:
        sightings_data = json.load(f)

    print(f"Scanning {processed_dir} for new images to finalize...")
    
    processed_images = list(processed_dir.glob("*.jpg")) + list(processed_dir.glob("*.jpeg")) + list(processed_dir.glob("*.png"))
    
    if not processed_images:
        print(f"No images found in {processed_dir}.")
    else:
        upload_count = 0
        finalized_filenames = set()
        for local_proc_path in processed_images:
            filename = local_proc_path.name
            remote_path = f"{rel_images_prefix}{filename}"
            target_final_path = images_dir / filename
            
            print(f"Processing staging file: {filename}")
            
            # 1. Upload to Firebase
            if upload_to_firebase(local_proc_path, remote_path):
                # 2. Move to final images/ directory
                os.makedirs(images_dir, exist_ok=True)
                shutil.move(local_proc_path, target_final_path)
                print(f"  -> Finalized and moved to {target_final_path}")
                finalized_filenames.add(filename)
                upload_count += 1
            else:
                print(f"  -> Skipping move as upload failed.")

        if finalized_filenames:
            print(f"\nUploaded and finalized {upload_count} images. Updating JSON paths...")
            # 3. Update paths in JSON from staging to final images/
            changed_json = False
            for sighting in sightings_data.get('sightings', []):
                for media in sighting.get('media', []):
                    src = media.get('src', '')
                    if src.startswith(rel_staging_prefix):
                        fname = src[len(rel_staging_prefix):]
                        if fname in finalized_filenames:
                            media['src'] = f"{rel_images_prefix}{fname}"
                            changed_json = True
            
            if changed_json:
                with open(SIGHTINGS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(sightings_data, f, indent=4)
                print(f"Updated {SIGHTINGS_FILE.name} with finalized paths.")
        else:
            print("\nNo images were finalized.")

    # Final sync of JSON databases to Firebase
    print("\nSyncing JSON databases to Firebase...")
    upload_minified_json(SIGHTINGS_FILE, "data/insect-sightings.json")
    upload_minified_json(SPECIES_FILE, "data/insect-species.json")
    
    print("\nPublish complete!")

def main():
    parser = argparse.ArgumentParser(description="Add insects to database.")
    subparsers = parser.add_subparsers(dest="command")

    # Crop command
    crop_parser = subparsers.add_parser("crop", help="Square crop and resize images")
    crop_parser.add_argument("--dir", required=True, help="Directory containing images")
    crop_parser.add_argument("--output-dir", help="Directory to save cropped images (defaults to input dir)")
    crop_parser.add_argument("--size", type=int, default=1000, help="Target square size (default 1000)")
    crop_parser.add_argument("--remove-source", action="store_true", help="Remove original images after cropping")

    # Process command
    proc_parser = subparsers.add_parser("process", help="Process and identify insects")
    proc_parser.add_argument("--dir", required=True, help="Directory containing images")
    proc_parser.add_argument("--place", required=True, help="Place string: 'Country, State, City, Area'")
    proc_parser.add_argument("--model", required=True, help="Path to checkpoint model(s), comma-separated")
    proc_parser.add_argument("--class-details", help="Path to JSON file containing species names mapping")
    proc_parser.add_argument("--type", default="Butterfly", help="Insect type (e.g. Butterfly, Moth)")
    proc_parser.add_argument("--threshold", type=float, default=0.8, help="Softmax score threshold")
    proc_parser.add_argument("--output-dir", required=True, help="Directory to move processed images (staging area)")
    proc_parser.add_argument("--remove-source", action="store_true", help="Remove source images after successful processing (skipped files are kept)")
    proc_parser.add_argument("--date", help="Date to use if EXIF date is not found (format: DD-MM-YYYY)")

    # Publish command
    pub_parser = subparsers.add_parser("publish", help="Finalize images and sync everything to Firebase")
    pub_parser.add_argument("--dir", required=True, help="Directory containing staged images")

    args = parser.parse_args()

    if args.command == "crop":
        img_dir = Path(args.dir)
        output_dir = Path(args.output_dir) if args.output_dir else img_dir
        
        if not img_dir.exists():
            print(f"Error: Directory not found {img_dir}")
            return
            
        images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.jpeg")) + list(img_dir.glob("*.png"))
        print(f"Cropping and resizing {len(images)} images to {args.size}x{args.size}...")
        for img_path in images:
            print(f"  Processing {img_path.name}...")
            out = square_crop_image(img_path, output_dir, target_size=args.size)
            if out and args.remove_source:
                try:
                    os.remove(img_path)
                    print(f"    Removed source: {img_path.name}")
                except Exception as e:
                    print(f"    Error removing source {img_path.name}: {e}")
            
    elif args.command == "process":
        process_images(args)
    elif args.command == "publish":
        publish_data(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
