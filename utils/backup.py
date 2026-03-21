import urllib.request
import json
from pathlib import Path

firestoragePath = "https://firebasestorage.googleapis.com/v0/b/telebirding-49623.appspot.com/o/"
dataDir = "data"


print(f'\nBacking up data and images from Firebase Storage ...\n{'-'*50}\n')

for mode in ["bird", "insect"]:
	for filename in ["sightings", "species", "families", "likes"]:
		src = firestoragePath + dataDir + "%2F" + mode + "-" + filename + ".json?alt=media"
		dst = dataDir + "/" + mode + "-" + filename + ".json"
		print("Downloading " + dst + " ...")
		urllib.request.urlretrieve(src, dst)
		with open(dst, 'r', encoding='utf-8') as f:
			content = json.load(f)
		with open(dst, 'w', encoding='utf-8') as f:
			json.dump(content, f, indent=4, ensure_ascii=False)
	with open(dataDir + "/" + mode + "-sightings.json", 'r', encoding='utf-8') as f:
		data = json.load(f)
	for sighting in data['sightings']:
		for media in sighting['media']:
			if 'type' not in media or media['type'] == 'image':
				src = firestoragePath + media['src'].replace('/', '%2F') + "?alt=media"
				dst = media['src']
				if not Path(dst).is_file():
					print("Downloading " + dst + " ...")
					urllib.request.urlretrieve(src, dst)



print(f'\nChecking for local unused images ...\n{'-'*50}\n')

def _collect_referenced_images(root):
	"""Collect referenced image paths from data JSON and project files.
	Returns a set of resolved absolute Paths."""
	import re
	refs = set()
	# 1) Extract from JSON data files (walk objects looking for 'src')
	for json_path in (root / 'data').glob('*.json'):
		try:
			obj = json.loads(json_path.read_text(encoding='utf8'))
		except Exception:
			continue
		def walk(o):
			if isinstance(o, dict):
				for k, v in o.items():
					if k == 'src' and isinstance(v, str) and (v.startswith('images/')):
						refs.add((root / v).resolve())
					else:
						walk(v)
			elif isinstance(o, list):
				for i in o:
					walk(i)
		walk(obj)

	# 2) Search project text files for occurrences of images/
	pattern = re.compile(r"(?:images)/[A-Za-z0-9_\-\./()\[\]@,]+?\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tif|tiff|ico|heic)", re.I)
	for p in root.rglob('*.*'):
		# skip reading image binaries themselves
		if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff', '.ico', '.heic'}:
			continue
		try:
			text = p.read_text(encoding='utf8', errors='ignore')
		except Exception:
			continue
		for m in pattern.findall(text):
			refs.add((root / m).resolve())

	return refs


def _find_local_image_files(root, folders=('images')):
	"""Return list of local image Paths under the specified folders."""
	exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff', '.ico', '.heic'}
	files = []
	for folder in folders:
		d = root / folder
		if not d.exists():
			continue
		for p in d.rglob('*'):
			if p.is_file() and p.suffix.lower() in exts:
				files.append(p.resolve())
	return files


def _cleanup_unused_images(root, yes=False, folders=('images')):
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