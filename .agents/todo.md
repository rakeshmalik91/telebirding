- [x] replace select2 with a custom searchable select/multiselect. ensure all change/clear/etc events retained correctly.
- [x] implement reorder sighting by dragging. remove the move up/down buttons on sightings table right side, instead add a draggable holder icon there. 
- [x] implement reorder media by dragging. remove the "Move Left" button
- [x] Entering a text and adding a new value for camera dropdown 
  - should directly add that text value instead of trying to resolve known camera models
  - count should increase as well
  - on adding a value "Test" with existing "S7RV+200600" should become "S7RV+200600+Test"



- [ ] to check what can be done about this:
    - The following Authentication features will stop working when Firebase Dynamic Links shuts down soon: email link authentication for mobile apps, as well as Cordova OAuth support for web apps.
    - Since the Firebase Dynamics links deprecation window has finished, you should take action immediately to avoid breaking your app's Authentication flow.


- [ ] implement etag for all json files in admin. have a flag to use or not use etag in admin/constant.js
- [ ] background sync data on any change instead of fullscreen blocked loader
- [ ] 