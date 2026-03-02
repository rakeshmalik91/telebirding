REM This script will backup the data uploaded from admin to firebase storage to local
REM It includes data/*-families.json, data/*-species.json, data/*-sightings.json, data/*-likes.json and images/*

REM It will also remove any unreferenced images from local images folder

cd ..
python utils/backup.py
timeout /t 10