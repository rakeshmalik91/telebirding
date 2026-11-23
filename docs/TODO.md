# TODO list
---------------------
Pick feature, enhancements, fixes from here.
commit after each features or set of fixes/enhancements
---------------------

### CRITICAL BUG
- [ ] 

### Features
- [ ] pinned posts:
  - [ ] in admin configure a sighting to be pinned. toggle button on ui. boolean in json "pinned": true/false
  - [ ] admin search "pinned" searches all pinned sightings only
  - [ ] set max pin to 3 by default. make it configurable in admin where watermark config is shown. keep value in local storage. setting a new pin when 3 are already pinned unpins the oldest (in time) pinned sighting. 
  - [ ] on public facing site, pinned sightings appear at top regardless of sorting, and they are sorted by selected sort order among themselves
- [ ] 

### Fixes / Enhancements
- [x] in admin: add a small today button (icon only) beside date field
- [x] in admin, on ipad: when clicked on dropdown, focused on textbox; if dropdown is below screen, keyboard opens and screen scroll up automatically, the dropdown also moves up more, moving the textbox outside screen
- [x] auto detect sighting date from exif/metadata
- [x] fix duplicate species entries
- [x] BUG: adding a new species and switching to sightings tab doesnt add new species in dropdowns
- [x] BUG: to check why ebird sync is mapping brown woodpecker to brown capped pygmy woodpecker
- [x] BUG: adding species with 's is failing. eg Marshall's Iora
- [ ] 