cd ..

git checkout data/insect-sightings.json data/insect-species.json

python utils/add_insects.py crop --dir "dataset/original" --output-dir "dataset/cropped" --size 1000 --remove-source

@REM if exist "dataset\processed" rd /s /q "dataset\processed"
python utils/add_insects.py process --dir "dataset/cropped" --output-dir "dataset/processed" --place "India, Andaman & Nicobar Islands, South Andaman, Chidiyatapu" --model "../insect-id/insect-dataset/lepidoptera/checkpoint.lepidoptera.v2.i01.e20.pth, ../insect-id/insect-dataset/butterfly/checkpoint.butterfly.te.ep060001.pth" --class-details "../insect-id/models/class_details.lepidoptera.json" --type "Butterfly" --threshold 0.80 --remove-source

python utils/add_insects.py publish

python utils/sync_dynamic_files_to_firebase_storage.py --cleanup
