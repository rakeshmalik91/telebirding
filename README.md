# Telebirding

A bird watching blog by Rakesh Malik.

### Hosted On
 - https://telebirding.info
 - https://telebirding-49623.web.app
 - https://telebirding-49623.firebaseapp.com
 - https://telebirding.netlify.app

 Note: New domains to be registered in cors.json and here -> https://www.google.com/recaptcha/admin/site/736295256/settings

### Android app

- [Play Store](https://play.google.com/store/apps/details?id=com.rakeshmalik.telebirding)
- [Dropbox](https://www.dropbox.com/scl/fo/5t1zgkn419ctlzkuacu3h/ACC-_MbfOOu151yPRRH25XU?rlkey=3tirqkq5xland2qx3dfa8hrda&st=0aosjy2b&dl=0)

### Local Setup on Firebase
```
./setup.ps1
```

to change firebase setup:
```
firebase init
gsutil init
```

Env variables for Windows:
```
PATH:
    C:\Users\User\AppData\Roaming\npm
    C:\Users\User\AppData\Roaming\fnm\node-versions\v20.17.0\installation
```

### Host locally
```
firebase serve --only hosting
```
or
```
firebase.cmd serve --only hosting
```

### Deploy
```
firebase deploy
```
or
```
firebase.cmd deploy
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