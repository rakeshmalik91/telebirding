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
                return prefix.child(`${currentMode}-sightings.json`).getMetadata()
                    .then(() => prefix.name)
                    .catch(() => {
                        return prefix.child('places.json').getMetadata()
                            .then(() => prefix.name)
                            .catch(() => null);
                    });
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
                <div style='background:#1e293b; border-radius:8px; padding:20px; width:450px; max-width:90%; color:#f8fafc; border:1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);'>
                    <h3 style='margin-top:0; margin-bottom:15px; font-size:18px;'>Available Backups</h3>
                    <div style='margin-bottom: 15px; font-size:14px;'>Select a backup to restore data for the <strong>${currentMode.toUpperCase()}</strong> mode and <strong>places.json</strong>.<br>
                    <em style='font-size:0.9em;color:#f87171;'>Note: Restoring data will not restore any deleted media files (images/videos).</em></div>
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

function restoreBackup(dateString) {
    showLoader('restore', `Restoring backup from ${dateString}...`);
    
    const filesToRestore = ["sightings", "species", "families", "likes", "places"];
    let promises = [];
    
    filesToRestore.forEach(file => {
        const fileName = (file === "places") ? "places.json" : `${currentMode}-${file}.json`;
        const p = FirebaseApi.getFirebase().storage().ref(`backup/${dateString}/${fileName}`).getDownloadURL()
            .then(url => fetch(url).then(r => r.json()))
            .then(json => {
                if (file === "places") {
                    return { file, data: json.countries || json };
                }
                return { file, data: json[file] || json };
            })
            .catch(err => {
                console.warn(`Could not fetch ${fileName} from backup. It may not exist.`, err);
                return { file, data: null };
            });
        promises.push(p);
    });
    
    Promise.all(promises).then(results => {
        let restoredCount = 0;
        let preChangeSightings = data.sightings ? JSON.parse(JSON.stringify(data.sightings)) : [];

        results.forEach(res => {
            if (res.data) {
                if (res.file === "places") {
                    data.countries = res.data;
                } else {
                    data[res.file] = res.data;
                }
                restoredCount++;
            }
        });

        if (restoredCount > 0) {
            // Push undo state for sightings
            if (data.sightings) {
                historyManager.pushState(preChangeSightings, data.sightings);
            }
            
            // Re-render and trigger sync
            triggerRender();
            
            // Upload all restored data to remote
            filesToRestore.forEach(file => {
                if (file === "places") {
                    if (data.countries) uploadJSONData('places', true);
                } else if (data[file]) {
                    uploadJSONData(file, true);
                }
            });
            syncSightingsData(3000, true);
            
            showToast(`Successfully restored ${restoredCount} file(s) from backup.`, 'success');
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

function deleteBackup(dateString, $element) {
    customConfirm(`Are you sure you want to delete the ${currentMode.toUpperCase()} backup for ${dateString}?`, () => {
        showLoader('delete-backup', 'Deleting backup...');
        const filesToDelete = ["sightings", "species", "families", "likes"];
        let promises = [];
        const storageRef = FirebaseApi.getFirebase().storage().ref(`backup/${dateString}`);
        
        filesToDelete.forEach(file => {
            const fileName = `${currentMode}-${file}.json`;
            const p = storageRef.child(fileName).delete().catch(err => {
                // Ignore if file doesn't exist
            });
            promises.push(p);
        });
        
        Promise.all(promises).then(() => {
            // Check if any other mode files remain before deleting places.json
            storageRef.listAll().then(res => {
                const otherMode = currentMode === 'bird' ? 'insect' : 'bird';
                const hasOtherModeFiles = res.items && res.items.some(item => item.name.startsWith(otherMode));
                
                if (!hasOtherModeFiles) {
                    storageRef.child("places.json").delete().catch(() => {});
                }

                $element.remove();
                hideLoader('delete-backup');
                showToast('Backup deleted successfully', 'success');
                if ($('#backup-list').children().length === 0) {
                    $('#backup-list-modal').remove();
                }
            }).catch(err => {
                hideLoader('delete-backup');
                $element.remove();
                if ($('#backup-list').children().length === 0) {
                    $('#backup-list-modal').remove();
                }
            });
        });
    });
}
