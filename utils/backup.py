import urllib.request
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
firestoragePath = "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/"
dataDir = "data"
resourcesDir = ROOT / "webapp" / "resources"


print(f'\nBacking up data and images from Firebase Storage ...\n{"-"*50}\n')

for mode in ["bird", "insect"]:
	for filename in ["sightings", "species", "families", "likes"]:
		src = firestoragePath + dataDir + "%2F" + mode + "-" + filename + ".json?alt=media"
		dst_path = resourcesDir / dataDir / f"{mode}-{filename}.json"
		print(f"Downloading {dst_path.relative_to(ROOT)} ...")
		dst_path.parent.mkdir(parents=True, exist_ok=True)
		urllib.request.urlretrieve(src, str(dst_path))
		with open(dst_path, 'r', encoding='utf-8') as f:
			content = json.load(f)
		with open(dst_path, 'w', encoding='utf-8') as f:
			json.dump(content, f, indent=4, ensure_ascii=False)
	with open(resourcesDir / dataDir / f"{mode}-sightings.json", 'r', encoding='utf-8') as f:
		data = json.load(f)
	for sighting in data['sightings']:
		for media in sighting['media']:
			media_rel = media.get('src') if ('type' not in media or media['type'] == 'image') else media.get('thumbnail')
			if media_rel:
				src = firestoragePath + media_rel.replace('/', '%2F') + "?alt=media"
				dst_path = resourcesDir / media_rel
				if not dst_path.is_file():
					print(f"Downloading {dst_path.relative_to(ROOT)} ...")
					dst_path.parent.mkdir(parents=True, exist_ok=True)
					urllib.request.urlretrieve(src, str(dst_path))

# Download places.json
src = firestoragePath + dataDir + "%2Fplaces.json?alt=media"
dst_path = resourcesDir / dataDir / "places.json"
print(f"Downloading {dst_path.relative_to(ROOT)} ...")
dst_path.parent.mkdir(parents=True, exist_ok=True)
try:
	urllib.request.urlretrieve(src, str(dst_path))
	with open(dst_path, 'r', encoding='utf-8') as f:
		content = json.load(f)
	with open(dst_path, 'w', encoding='utf-8') as f:
		json.dump(content, f, indent=4, ensure_ascii=False)
except Exception as e:
	print(f"Error downloading places.json: {e}")



print(f'\nChecking for local unused images ...\n{"-"*50}\n')

def _collect_referenced_images(root):
	"""Collect referenced image paths from data JSON and project files.
	Returns a set of resolved absolute Paths."""
	import re
	refs = set()
	# 1) Extract from JSON data files (walk objects looking for any image references)
	for json_path in (root / 'webapp' / 'resources' / 'data').glob('*.json'):
		try:
			obj = json.loads(json_path.read_text(encoding='utf8'))
		except Exception:
			continue
		def walk(o):
			if isinstance(o, str):
				if o.startswith('images/') or o.startswith('featured-images/'):
					refs.add((root / 'webapp' / 'resources' / o).resolve())
				elif 'images/' in o:
					# e.g. resources/images/... or webapp/resources/images/...
					rel = o.split('images/', 1)[1]
					refs.add((root / 'webapp' / 'resources' / 'images' / rel).resolve())
			elif isinstance(o, dict):
				for v in o.values():
					walk(v)
			elif isinstance(o, list):
				for i in o:
					walk(i)
		walk(obj)

	# 2) Search project text files (excluding build/dependency dirs) for occurrences of images/
	skip_dirs = {'node_modules', '.git', '.gradle', 'build', '.idea', '.vscode', 'images', 'featured-images', 'videos'}
	pattern = re.compile(r"(?:images)/[A-Za-z0-9_\-\./()\[\]@,]+?\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tif|tiff|ico|heic)", re.I)
	import os
	for dirpath, dirnames, filenames in os.walk(root):
		dirnames[:] = [d for d in dirnames if d not in skip_dirs]
		for fn in filenames:
			ext = os.path.splitext(fn)[1].lower()
			if ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff', '.ico', '.heic', '.mp4', '.class', '.jar'}:
				continue
			p = Path(dirpath) / fn
			try:
				text = p.read_text(encoding='utf8', errors='ignore')
			except Exception:
				continue
			for m in pattern.findall(text):
				refs.add((root / 'webapp' / 'resources' / m).resolve())

	return refs


def _find_local_image_files(root, folders=('images',)):
	"""Return list of local image Paths under the specified folders."""
	exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff', '.ico', '.heic'}
	files = []
	for folder in folders:
		d = root / 'webapp' / 'resources' / folder
		if not d.exists():
			continue
		for p in d.rglob('*'):
			if p.is_file() and p.suffix.lower() in exts:
				files.append(p.resolve())
	return files


def _cleanup_unused_images(root, yes=False, folders=('images',)):
	"""Detect unused local images and optionally delete them after confirmation.
	Returns number of files deleted."""
	refs = _collect_referenced_images(root)
	local = _find_local_image_files(root, folders=folders)
	unused = [p for p in local if p not in refs]
	if not unused:
		print('No unused images found.')
		return 0

	print('\nFound {} unused image(s):'.format(len(unused)))
	for p in sorted(unused):
		print('  -', p.relative_to(root))

	if not yes:
		resp = input('\nDelete these files? [y/N]: ').strip().lower()
		if resp not in ('y', 'yes'):
			print('Aborted: no files were deleted.')
			return 0

	deleted = 0
	for p in unused:
		try:
			p.unlink()
			deleted += 1
		except Exception as e:
			print('Failed to delete', p, ':', e)
	print('\nDeleted {} file(s).'.format(deleted))
	return deleted


if __name__ == '__main__':
	# when run as a script, behave as before (download), then run cleanup prompt
	ROOT = Path(__file__).resolve().parents[1]
	# allow a -y/--yes flag for non-interactive deletion
	import sys
	non_interactive = False
	if len(sys.argv) > 1 and sys.argv[1] in ('-y', '--yes'):
		non_interactive = True
	# run cleanup after downloads
	_cleanup_unused_images(ROOT, yes=non_interactive)