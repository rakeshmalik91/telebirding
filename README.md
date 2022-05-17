# Telebirding

A bird watching blog by Rakesh Malik.

### Hosted On
 - https://telebirding-49623.web.app
 - https://telebirding-49623.firebaseapp.com
 - https://telebirding.info
 - https://www.telebirding.info

### Local Setup on Firebase
```
firebase init

gsutil init
gsutil cors set cors.json gs://telebirding-49623.appspot.com
```

### Host locally
```
firebase serve --only hosting
```

### Deploy
```
firebase deploy
```

### File structure in Fire Storage
- data
    - birds.json
    - species.json
    - families.json
    - places.json
    - site-data.json
- images
    - *.jpg
- videos
    - *.mp4
- featured-images
    - *.jpg