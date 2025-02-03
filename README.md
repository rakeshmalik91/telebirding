# Telebirding

A bird watching blog by Rakesh Malik.

### Hosted On
 - https://telebirding.info
 - https://telebirding-49623.web.app
 - https://telebirding-49623.firebaseapp.com
 - https://telebirding.netlify.app

### Local Setup on Firebase
```
winget install Schniz.fnm
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use --install-if-missing 20
npm install firebase
firebase login
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