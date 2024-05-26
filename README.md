# Telebirding

A bird watching blog by Rakesh Malik.

### Hosted On
 - https://telebirding.info
 - https://telebirding-49623.web.app
 - https://telebirding-49623.firebaseapp.com
 - https://telebirding.netlify.app

### Local Setup on Firebase
```
npm install firebase
firebase init
gsutil init
```

### Host locally
```
firebase serve --only hosting
```

### Deploy
```
firebase deploy
```

### Adding new domain for CORS
```
gsutil cors set cors.json gs://telebirding-49623.appspot.com
```

### Fire Storage Url

https://console.firebase.google.com/u/0/project/telebirding-49623/storage/telebirding-49623.appspot.com/files/~2F

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