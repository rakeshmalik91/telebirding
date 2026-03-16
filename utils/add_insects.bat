cd ..

git checkout data/insect-sightings.json data/insect-species.json

python utils/add_insects.py crop --dir "dataset/1_original" --output-dir "dataset/2_cropped" --size 1000 --remove-source

python utils/add_insects.py process --dir "dataset/2_cropped" --output-dir "dataset/3_processed" --place "India, Andaman & Nicobar Islands, South Andaman, Chidiyatapu" --date "28-02-2026" --model "../insect-id/insect-dataset/lepidoptera/checkpoint.lepidoptera.v2.i01.e20.pth, ../insect-id/insect-dataset/butterfly/checkpoint.butterfly.te.ep060001.pth" --class-details "../insect-id/models/class_details.lepidoptera.json" --type "Butterfly" --threshold 0.8 --remove-source

python utils/add_insects.py publish --dir "dataset/3_processed"

python utils/sync_dynamic_files_to_firebase_storage.py --cleanup
