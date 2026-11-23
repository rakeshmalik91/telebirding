import Constants from '../constants.js';
import FirebaseApi from '../firebase-api.js';
import Util from '../util.js';
import { customConfirm, customAlert, showToast, showModal, closeModal } from './ui.js';
import { showLoader, hideLoader } from '../loader.js';
import { currentMode, data, uploadJSONData, triggerRender, syncSightingsData, historyManager } from './data.js';

export function setupRestoreListeners() {
    $('.restore-backup').click(function() {
        showLoader('restore', 'Fetching available backups...');
        FirebaseApi.getFirebase().storage().ref('backup').listAll().then(res => {
            const allFolders = res.prefixes;
            if (allFolders.length === 0) {
                hideLoader('restore');
                customAlert("No backups found.");
                return;
            }

            const folderPromises = allFolders.map(prefix => {
                return prefix.listAll()
                    .then(sub => (sub.items.length > 0 || sub.prefixes.length > 0) ? prefix.name : null)
                    .catch(() => prefix.name);
            });

            Promise.all(folderPromises).then(folderNames => {
                hideLoader('restore');
                const folders = folderNames.filter(name => name !== null).sort().reverse();
                
                if (folders.length === 0) {
                    customAlert(`No backups found.`);
                    return;
                }

                let modalHtml = `
                <div id='backup-list-modal' style='display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;'>
                    <div style='background:#1e293b; border-radius:8px; padding:20px; width:480px; max-width:90%; color:#f8fafc; border:1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);'>
                        <h3 style='margin-top:0; margin-bottom:15px; font-size:18px;'>Available Backups</h3>
                        <div style='margin-bottom: 15px; font-size:14px; line-height: 1.4;'>
                            Select a backup to restore all data across all modes (<strong>Birds</strong>, <strong>Insects</strong>, <strong>Reptiles</strong>) and <strong>places / boundaries</strong>.<br>
                            <em style='font-size:0.9em;color:#f87171;'>Note: Restoring data will overwrite existing data across all modes. Media files (images/videos) in storage are not affected.</em>
                        </div>
                        <div id='backup-list' style='display:flex; flex-direction:column; gap:5px; max-height:300px; overflow-y:auto; padding:5px; margin-bottom:15px;'>`;
                
                folders.forEach((folder, index) => {
                    modalHtml += `<div style='display:flex; justify-content:space-between; align-items:center; background:#334155; padding:8px; border-radius:4px;'>
                        <span>${folder}</span>
                        <div>
                            <button class='restore-this-backup' data-folder='${folder}' style='padding:4px 8px; font-size:12px; margin-right:5px;'>Restore</button>
                            ${index !== 0 ? `<button class='delete-this-backup' data-folder='${folder}' style='padding:4px 8px; font-size:12px; background:#ef4444;'>Delete</button>` : ''}
                        </div>
                    </div>`;
                });
                
                modalHtml += `</div>
                        <div style='display:flex; justify-content:flex-end;'>
                            <button id='close-backup-list' style='padding:8px 16px; border-radius:4px; background:#3b82f6; color:white; border:none; cursor:pointer;'>Close</button>
                        </div>
                    </div>
                </div>`;

                $('body').append(modalHtml);

                $('#close-backup-list').click(() => {
                    $('#backup-list-modal').remove();
                });

                $('.restore-this-backup').click(function() {
                    const selectedDate = $(this).data('folder');
                    $('#backup-list-modal').remove();
                    restoreBackup(selectedDate);
                });

                $('.delete-this-backup').click(function() {
                    const selectedDate = $(this).data('folder');
                    deleteBackup(selectedDate, $(this).closest('div').parent());
                });
            });
        }).catch(err => {
            hideLoader('restore');
            console.error(err);
            customAlert("Failed to fetch backups: " + err.message);
        });
    });
}

export function restoreBackup(dateString) {
    showLoader('restore', `Restoring backup from ${dateString}...`);
    
    const storage = FirebaseApi.getFirebase().storage();
    const backupRef = storage.ref(`backup/${dateString}`);
    const modeFiles = ["sightings", "species", "families", "likes"];
    const fetchPromises = [];

    // 1. Fetch places.json
    const placesPromise = backupRef.child("places.json").getDownloadURL()
        .then(url => fetch(url).then(r => r.json()))
        .then(json => ({ type: 'places', data: json.countries || json }))
        .catch(err => {
            console.warn("Could not fetch places.json from backup. It may not exist.", err);
            return { type: 'places', data: null };
        });
    fetchPromises.push(placesPromise);

    // 2. Fetch all mode-specific files across all modes in Constants.MODES
    const allModes = Constants.MODES || [currentMode];
    allModes.forEach(mode => {
        modeFiles.forEach(file => {
            const fileName = `${mode}-${file}.json`;
            const p = backupRef.child(fileName).getDownloadURL()
                .then(url => fetch(url).then(r => r.json()))
                .then(json => ({
                    type: 'mode-file',
                    mode,
                    file,
                    fileName,
                    data: json[file] || json
                }))
                .catch(err => {
                    console.warn(`Could not fetch ${fileName} from backup. It may not exist.`, err);
                    return { type: 'mode-file', mode, file, fileName, data: null };
                });
            fetchPromises.push(p);
        });
    });

    // 3. Fetch geo boundary files from backup/${dateString}/geo
    const geoRef = backupRef.child('geo');
    const geoPromise = geoRef.listAll()
        .then(res => {
            if (!res.items || res.items.length === 0) return [];
            return Promise.all(res.items.map(item => {
                return item.getDownloadURL()
                    .then(url => fetch(url).then(r => r.json()))
                    .then(geoJson => {
                        const country = item.name.replace(/\.json$/, '');
                        return { country, geoJson };
                    })
                    .catch(err => {
                        console.warn(`Could not fetch geo backup for ${item.name}`, err);
                        return null;
                    });
            }));
        })
        .catch(err => {
            console.warn(`No geo folder in backup/${dateString}`, err);
            return [];
        });
    
    Promise.all([...fetchPromises, geoPromise]).then(results => {
        const fileResults = results.slice(0, fetchPromises.length);
        const geoResults = results[fetchPromises.length] || [];

        let restoredCount = 0;
        let preChangeSightings = data.sightings ? JSON.parse(JSON.stringify(data.sightings)) : [];
        const remoteUploadPromises = [];

        fileResults.forEach(res => {
            if (!res || !res.data) return;

            if (res.type === 'places') {
                data.countries = res.data;
                uploadJSONData('places', true);
                restoredCount++;
            } else if (res.type === 'mode-file') {
                if (res.mode === currentMode) {
                    data[res.file] = res.data;
                    uploadJSONData(res.file, true);
                    restoredCount++;
                } else {
                    const fileData = { [res.file]: res.data };
                    const fileBlob = new File([JSON.stringify(fileData, null, '\t') + '\n'], res.fileName);
                    remoteUploadPromises.push(
                        storage.ref(`data/${res.fileName}`).put(fileBlob)
                    );
                    restoredCount++;
                }
            }
        });

        // Restore geo boundaries
        let restoredGeoCount = 0;
        data.geoCountries = data.geoCountries || { type: 'FeatureCollection', features: [] };
        data.geoStates = data.geoStates || { type: 'FeatureCollection', features: [] };

        const geoUploadPromises = [];
        geoResults.forEach(item => {
            if (item && item.geoJson) {
                const { country, geoJson } = item;
                if (geoJson.country) {
                    const cIdx = data.geoCountries.features.findIndex(f => f.properties?.name === country);
                    if (cIdx >= 0) {
                        data.geoCountries.features[cIdx] = geoJson.country;
                    } else {
                        data.geoCountries.features.push(geoJson.country);
                    }
                }
                if (geoJson.states && Array.isArray(geoJson.states.features)) {
                    data.geoStates.features = data.geoStates.features.filter(f => f.properties?.country !== country);
                    data.geoStates.features.push(...geoJson.states.features);
                }
                
                // Write restored geo file back to data/geo/${country}.json
                const fileBlob = new File([JSON.stringify(geoJson)], `${country}.json`);
                geoUploadPromises.push(
                    storage.ref(`data/geo/${country}.json`).put(fileBlob)
                );
                restoredGeoCount++;
            }
        });

        if (restoredCount > 0 || restoredGeoCount > 0) {
            // Push undo state for sightings of currentMode
            if (data.sightings) {
                historyManager.pushState(preChangeSightings, data.sightings);
            }
            
            // Re-render and trigger sync for active mode
            triggerRender();
            syncSightingsData(3000, true);

            Promise.all([...remoteUploadPromises, ...geoUploadPromises]).catch(err => {
                console.warn("Could not write all remote restored files to storage:", err);
            });
            
            const msg = restoredGeoCount > 0
                ? `Successfully restored ${restoredCount} file(s) across all modes and ${restoredGeoCount} geo boundary file(s) from backup.`
                : `Successfully restored ${restoredCount} file(s) across all modes from backup.`;
            showToast(msg, 'success');
        } else {
            customAlert(`No matching files found in that backup.`);
        }
        hideLoader('restore');
    }).catch(err => {
        hideLoader('restore');
        console.error(err);
        customAlert("Restore failed: " + err.message);
    });
}

export function deleteBackup(dateString, $element) {
    customConfirm(`Are you sure you want to delete the backup for ${dateString}? This will remove backup data for all modes and places.`, () => {
        showLoader('delete-backup', 'Deleting backup...');
        const storageRef = FirebaseApi.getFirebase().storage().ref(`backup/${dateString}`);
        
        storageRef.listAll().then(res => {
            const itemDeletions = res.items.map(item => item.delete().catch(() => {}));
            const prefixDeletions = res.prefixes.map(prefix => {
                return prefix.listAll().then(sub => {
                    return Promise.all(sub.items.map(item => item.delete().catch(() => {})));
                }).catch(() => {});
            });
            return Promise.all([...itemDeletions, ...prefixDeletions]);
        }).then(() => {
            $element.remove();
            hideLoader('delete-backup');
            showToast('Backup deleted successfully', 'success');
            if ($('#backup-list').children().length === 0) {
                $('#backup-list-modal').remove();
            }
        }).catch(err => {
            hideLoader('delete-backup');
            console.error("Delete backup error:", err);
            customAlert("Failed to delete backup: " + err.message);
        });
    });
}
