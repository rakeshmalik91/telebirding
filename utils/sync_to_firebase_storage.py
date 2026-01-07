"""
Sync local data and featured-images to Firebase Storage (hard-coded, no CLI).

Behavior (hard-coded):
 - Uses bucket `telebirding-49623.appspot.com` and checks metadata endpoint
 - Uploads missing objects: `data/site-data.json`, `data/places.json`, and files under `featured-images/` preserving local directory structure
 - After uploads, scans `data/site-data.json` for featured images and prompts to delete any files under `featured-images/` that are not referenced (asks per-file confirmation)

Requires: `google-cloud-storage` Python package and authentication (e.g., set `GOOGLE_APPLICATION_CREDENTIALS` or run `gcloud auth application-default login`).

This script does not accept CLI parameters and always performs the actions when run.
"""
from __future__ import print_function
import sys
import urllib.request
import urllib.parse
from pathlib import Path
import json
import mimetypes

# Google Cloud Storage client
try:
    from google.cloud import storage
except Exception as e:
    raise RuntimeError("`google-cloud-storage` is required. Install with `pip install google-cloud-storage` and authenticate (e.g., set GOOGLE_APPLICATION_CREDENTIALS or run `gcloud auth application-default login`).") from e

BUCKET_NAME = "telebirding-49623.appspot.com"
FIREBASE_METADATA_BASE = f"https://firebasestorage.googleapis.com/v0/b/{BUCKET_NAME}/o/"
ROOT = Path(__file__).resolve().parents[1]

# initialize storage client and bucket
try:
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
except Exception as e:
    # Provide a clear, actionable error message when ADC are not available.
    try:
        import google.auth.exceptions as _g_auth_exc
        DefaultCredsErr = getattr(_g_auth_exc, "DefaultCredentialsError", None)
    except Exception:
        DefaultCredsErr = None
    if (DefaultCredsErr and isinstance(e, DefaultCredsErr)) or ("default credentials" in str(e).lower()):
        raise RuntimeError(
            "Google Cloud credentials not found. Set the environment variable `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON file "
            "with Storage permissions, or run `gcloud auth application-default login`. See: "
            "https://cloud.google.com/docs/authentication/external/set-up-adc"
        ) from e
    raise

DATA_FILES = ["data/site-data.json", "data/places.json"]
FEATURED_DIR = ROOT / "featured-images"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".ico", ".heic"}


def remote_exists(path):
    """Check if an object exists in the remote bucket."""
    try:
        blob = bucket.get_blob(path)
        return blob is not None
    except Exception as e:
        print(f"Error checking remote {path}: {e}")
        return False


def upload_via_client(local_path: Path, remote_path: str):
    """Upload a local file to the given remote path using the google-cloud-storage client."""
    try:
        blob = bucket.blob(remote_path)
        # set content type if guessable
        ctype, _ = mimetypes.guess_type(str(local_path))
        if ctype:
            blob.content_type = ctype
        print(f"Uploading {local_path} to {remote_path} ...")
        blob.upload_from_filename(str(local_path))
        return True
    except Exception as e:
        print(f"Upload failed for {remote_path}: {e}")
        return False


def upload_json_file(local_path: Path, remote_path: str):
    """Read a local JSON file, minify it, and upload as application/json (replacing any existing object)."""
    try:
        text = local_path.read_text(encoding='utf8')
        obj = json.loads(text)
    except Exception as e:
        print(f"  -> Failed to parse JSON {local_path}: {e}")
        return False
    try:
        minified = json.dumps(obj, separators=(',', ':'), ensure_ascii=False)
        blob = bucket.blob(remote_path)
        # Upload as a text string and explicitly set content_type to avoid mismatches
        print(f"Uploading (minified) {local_path} to {remote_path} ...")
        # upload_from_string will overwrite existing object; pass content_type to match metadata
        blob.upload_from_string(minified, content_type='application/json; charset=utf-8')
        return True
    except Exception as e:
        print(f"  -> Failed to upload {remote_path}: {e}")
        return False


def upload_data_files():
    for p in DATA_FILES:
        print("\nUploading (replace):", p)
        local = ROOT / p
        if not local.exists():
            print("  -> local file not found:", local)
            continue
        ok = upload_json_file(local, p)
        print("  -> uploaded." if ok else "  -> upload failed.")


def upload_featured_images():
    if not FEATURED_DIR.exists():
        print("\nNo featured-images directory found at:", FEATURED_DIR)
        return
    print("\nScanning featured-images for missing uploads...")
    for p in sorted(FEATURED_DIR.rglob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        # Preserve the local directory structure when uploading (e.g. featured-images/subdir/img.jpg)
        remote_path = p.relative_to(ROOT).as_posix()
        print("\nChecking:", remote_path)
        if remote_exists(remote_path):
            print("  -> exists; skipping.")
            continue
        print("  -> missing remotely; uploading...")
        ok = upload_via_client(p, remote_path)
        print("  -> uploaded." if ok else "  -> upload failed.")


def _collect_referenced_featured_images_from_site_data():
    """Return set of Paths (absolute) for featured images referenced in data/site-data.json"""
    site_path = ROOT / "data" / "site-data.json"
    refs = set()
    try:
        obj = json.loads(site_path.read_text(encoding='utf8'))
    except Exception as e:
        print("Failed to read/parse site-data.json:", e)
        return refs
    featured = obj.get('featured', [])
    for item in featured:
        src = item.get('src')
        if not src:
            continue
        if src.startswith('featured-images/'):
            refs.add((ROOT / src).resolve())
    return refs


def cleanup_unused_featured_images():
    """Detect unused featured-images and prompt to delete the remote objects.

    Behavior:
     - Builds the set of referenced featured image paths from `data/site-data.json`.
     - Lists all objects under `featured-images/` in the remote bucket and finds those NOT referenced.
     - Prompts per remote object and deletes it if you confirm.

    Local files are left untouched by this operation.
    """
    referenced = _collect_referenced_featured_images_from_site_data()
    referenced_rel = set(p.relative_to(ROOT).as_posix() for p in referenced)

    # List blobs under featured-images/ prefix on the remote bucket
    try:
        blobs = list(bucket.list_blobs(prefix="featured-images/"))
    except Exception as e:
        print("\nFailed to list blobs from bucket:", e)
        return

    # Ignore directory-marker objects (names ending with '/') — treat them as non-deletable markers
    markers = [b for b in blobs if b.name.endswith('/')]
    if markers:
        print(f"\nNote: found {len(markers)} directory marker object(s) on remote; these will be skipped:")
        for m in markers:
            print("  -", m.name)

    remote_unused = [b for b in blobs if b.name not in referenced_rel and not b.name.endswith('/')]

    if not remote_unused:
        print('\nNo unused featured-images found on remote.')
        return

    print(f"\nFound {len(remote_unused)} unused featured image(s) on remote:")
    # Print the full list of remote paths first
    for b in sorted(remote_unused, key=lambda x: x.name):
        print("  -", b.name)

    # Now prompt per object for deletion
    for b in sorted(remote_unused, key=lambda x: x.name):
        ans = input(f"Delete remote object {b.name}? [y/N]: ").strip().lower()
        if ans in ('y', 'yes'):
            try:
                b.delete()
                print(f"  Deleted remote object {b.name}")
            except Exception as e:
                print(f"  Failed to delete remote object {b.name}: {e}")
        else:
            print(f"  Skipped {b.name}")

    # Additionally inform about any local files that are unused (optional informational)
    if FEATURED_DIR.exists():
        local_files = [p.resolve() for p in FEATURED_DIR.rglob('*') if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
        local_unused = [p for p in sorted(local_files) if p.relative_to(ROOT).as_posix() not in referenced_rel]
        if local_unused:
            print(f"\nNote: {len(local_unused)} local featured-image(s) are not referenced in site-data.json (left untouched):")
            for p in local_unused:
                print("  -", p.relative_to(ROOT))


def main():
    print("Starting sync_to_firebase_storage...")
    print(f"Using bucket: {BUCKET_NAME}")
    try:
        upload_data_files()
        upload_featured_images()
        cleanup_unused_featured_images()
    except RuntimeError as e:
        print("\nError:", e)
        print("Make sure `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` is configured and you have appropriate IAM permissions.")
        sys.exit(2)


if __name__ == "__main__":
    main()

