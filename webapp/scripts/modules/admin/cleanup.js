import FirebaseApi from '../firebase-api.js';
import Util from '../util.js';
import { customAlert, customConfirm } from './ui.js';
import { showLoader, hideLoader } from '../loader.js';

export function setupCleanupListeners() {
    $('.cleanup-media').click(async function () {
        showLoader();
        try {
            // Fetch both sightings to ensure we don't delete media from another mode
            let birdSightings = [];
            let insectSightings = [];
            
            try {
                const birdRes = await fetch(Util.getData('data/bird-sightings.json'));
                if (birdRes.ok) {
                    const data = await birdRes.json();
                    birdSightings = data.sightings || [];
                }
            } catch (e) {
                console.warn("Could not fetch bird sightings", e);
            }
            
            try {
                const insectRes = await fetch(Util.getData('data/insect-sightings.json'));
                if (insectRes.ok) {
                    const data = await insectRes.json();
                    insectSightings = data.sightings || [];
                }
            } catch (e) {
                console.warn("Could not fetch insect sightings", e);
            }
            
            const allSightings = [...birdSightings, ...insectSightings];
            
            const referencedMedia = new Set();
            allSightings.forEach(sighting => {
                if (sighting.media) {
                    sighting.media.forEach(m => {
                        if (m.src) referencedMedia.add(m.src);
                        if (m.thumbnail) referencedMedia.add(m.thumbnail);
                    });
                }
            });
            
            // List all files in images/ and videos/
            const storage = FirebaseApi.getFirebase().storage();
            const imagesRef = storage.ref('images');
            const videosRef = storage.ref('videos');
            
            let allFiles = [];
            try {
                const imgRes = await imagesRef.listAll();
                allFiles.push(...imgRes.items);
            } catch (e) {
                console.warn("Could not list images", e);
            }
            try {
                const vidRes = await videosRef.listAll();
                allFiles.push(...vidRes.items);
            } catch (e) {
                console.warn("Could not list videos", e);
            }
            
            const unreferencedFiles = allFiles.filter(item => {
                return !referencedMedia.has(item.fullPath);
            });
            
            hideLoader();
            
            if (unreferencedFiles.length === 0) {
                customAlert("No unused media found! Your storage is clean.");
                return;
            }
            
            showCleanupModal(unreferencedFiles);
            
        } catch (e) {
            hideLoader();
            console.error(e);
            customAlert("An error occurred while scanning for unused media.");
        }
    });
}

function showCleanupModal(files) {
    if ($('#cleanup-modal').length === 0) {
        $('body').append(`
            <div id="cleanup-modal" class="modal-overlay" style="display: none;">
                <div class="modal-content" style="max-width: 600px; width: 90%; max-height: 90vh; display: flex; flex-direction: column;">
                    <h2 style="margin-top:0;">Cleanup Unused Media</h2>
                    <p style="margin-bottom: 15px; font-size: 0.9em; color: #aaa;">
                        The following files are not linked to any sighting. Select the ones you want to delete.
                    </p>
                    <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="cleanup-select-all" checked>
                            <strong>Select All</strong>
                        </label>
                        <span id="cleanup-selected-count">${files.length} selected</span>
                    </div>
                    <div id="cleanup-list" style="overflow-y: auto; flex: 1; border: 1px solid #3b4048; border-radius: 4px; padding: 10px; background: #1a1d24; display: flex; flex-direction: column; gap: 10px;">
                    </div>
                    <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="cancel-cleanup btn-secondary" style="padding: 8px 16px;">Cancel</button>
                        <button class="delete-selected-cleanup btn-danger" style="background: #e3342f; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;">Delete Selected</button>
                    </div>
                </div>
            </div>
        `);
        
        $('#cleanup-select-all').change(function() {
            const isChecked = $(this).is(':checked');
            $('.cleanup-item-checkbox').prop('checked', isChecked);
            updateSelectedCount();
        });
        
        $('body').on('change', '.cleanup-item-checkbox', function() {
            updateSelectedCount();
            if ($('.cleanup-item-checkbox:checked').length === $('.cleanup-item-checkbox').length) {
                $('#cleanup-select-all').prop('checked', true);
            } else {
                $('#cleanup-select-all').prop('checked', false);
            }
        });
        
        $('.cancel-cleanup').click(function() {
            $('#cleanup-modal').fadeOut(200);
        });
        
        $('.delete-selected-cleanup').click(async function() {
            const selectedPaths = [];
            $('.cleanup-item-checkbox:checked').each(function() {
                selectedPaths.push($(this).val());
            });
            
            if (selectedPaths.length === 0) {
                customAlert("Please select at least one file to delete.");
                return;
            }
            
            customConfirm(`Are you sure you want to permanently delete ${selectedPaths.length} file(s)? This action cannot be undone.`, async () => {
                $('#cleanup-modal').fadeOut(200);
                showLoader();
                const storage = FirebaseApi.getFirebase().storage();
                let successCount = 0;
                let failCount = 0;
                
                for (let path of selectedPaths) {
                    try {
                        await storage.ref(path).delete();
                        successCount++;
                    } catch (e) {
                        console.error("Failed to delete " + path, e);
                        failCount++;
                    }
                }
                
                hideLoader();
                customAlert(`Cleanup complete!\nSuccessfully deleted: ${successCount}\nFailed to delete: ${failCount}`);
            });
        });
    }
    
    // Populate list
    const $list = $('#cleanup-list');
    $list.empty();
    
    files.forEach(file => {
        let isVideo = file.fullPath.startsWith('videos/');
        let previewHtml = '';
        if (isVideo) {
            previewHtml = `<div style="width: 50px; height: 50px; background: #2b303b; display: flex; align-items: center; justify-content: center; font-size: 20px; border-radius: 4px; flex-shrink: 0;">📽️</div>`;
        } else {
            previewHtml = `<img src="${Util.getMedia(file.fullPath)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; flex-shrink: 0;" loading="lazy">`;
        }
        
        $list.append(`
            <label style="display: flex; align-items: center; gap: 15px; padding: 10px; background: #232730; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
                <input type="checkbox" class="cleanup-item-checkbox" value="${file.fullPath}" checked>
                ${previewHtml}
                <span style="word-break: break-all; font-size: 0.9em; flex: 1;">${file.fullPath}</span>
            </label>
        `);
    });
    
    updateSelectedCount();
    $('#cleanup-modal').fadeIn(200);
}

function updateSelectedCount() {
    const count = $('.cleanup-item-checkbox:checked').length;
    $('#cleanup-selected-count').text(count + ' selected');
    if (count === 0) {
        $('.delete-selected-cleanup').prop('disabled', true).css('opacity', '0.5');
    } else {
        $('.delete-selected-cleanup').prop('disabled', false).css('opacity', '1');
    }
}
