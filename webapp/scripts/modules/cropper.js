import { showLoader, hideLoader } from './loader.js';

let currentCropper = null;
let escapeHandler = null;
let originalFile = null;

export function cropImageWithRatios(file, cropRatios) {
    if (!cropRatios) return Promise.resolve(file);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const natW = img.naturalWidth || img.width;
                const natH = img.naturalHeight || img.height;
                if (!natW || !natH) {
                    resolve(file);
                    return;
                }
                const sx = Math.max(0, Math.round(cropRatios.x * natW));
                const sy = Math.max(0, Math.round(cropRatios.y * natH));
                const sw = Math.max(1, Math.min(natW - sx, Math.round(cropRatios.width * natW)));
                const sh = Math.max(1, Math.min(natH - sy, Math.round(cropRatios.height * natH)));
                const canvas = document.createElement('canvas');
                canvas.width = sw;
                canvas.height = sh;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file);
                    return;
                }
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                canvas.toBlob(function (blob) {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: file.type }));
                    } else {
                        resolve(file);
                    }
                }, file.type);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

export function openCropper(file, callback, options = {}) {
    hideLoader('upload-media');
    // Store original file for skip functionality
    originalFile = file;

    // Destroy any existing cropper
    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }

    // Blur current focus to prevent scroll jumps
    if (document.activeElement) {
        document.activeElement.blur();
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const image = document.getElementById('crop-image');
        const modal = document.getElementById('crop-modal');

        // Show modal - CSS handles centering
        modal.style.display = 'flex';

        // Removed crop-modal-open class since it does nothing now
        // and we want to avoid any potential side effects

        // Set image source
        image.src = e.target.result;

        // Wait for image to load, then init cropper
        image.onload = function () {
            // Delay slightly to ensure layout is ready
            setTimeout(() => {
                currentCropper = new Cropper(image, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 0.9,
                    toggleDragModeOnDblclick: false,
                });
            }, 50);
        };

        // Helper to close modal
        function closeModal() {
            if (escapeHandler) {
                document.removeEventListener('keydown', escapeHandler);
                escapeHandler = null;
            }

            modal.style.display = 'none';
            if (currentCropper) {
                currentCropper.destroy();
                currentCropper = null;
            }
        }

        // Escape key handler
        escapeHandler = function (evt) {
            if (evt.key === 'Escape' || evt.keyCode === 27) {
                hideLoader('upload-media');
                closeModal();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Clone buttons to remove old listeners
        const confirmBtn = document.getElementById('crop-confirm');
        const skipBtn = document.getElementById('crop-skip');
        const cancelBtn = document.getElementById('crop-cancel');

        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        skipBtn.replaceWith(skipBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));

        const newConfirmBtn = document.getElementById('crop-confirm');
        const newSkipBtn = document.getElementById('crop-skip');
        const newCancelBtn = document.getElementById('crop-cancel');

        const totalCount = options?.totalCount || 1;
        if (totalCount > 1) {
            newConfirmBtn.textContent = `Crop & Upload All (${totalCount})`;
            newSkipBtn.textContent = `Skip Crop & Upload All (${totalCount})`;
        } else {
            newConfirmBtn.textContent = 'Crop & Upload';
            newSkipBtn.textContent = 'Skip Crop & Upload';
        }

        newConfirmBtn.addEventListener('click', function (evt) {
            evt.preventDefault();
            showLoader('upload-media', 'Uploading Media...');
            if (currentCropper) {
                let cropRatios = null;
                if (typeof currentCropper.getImageData === 'function' && typeof currentCropper.getData === 'function') {
                    const imgData = currentCropper.getImageData();
                    const cropData = currentCropper.getData(true);
                    if (imgData && imgData.naturalWidth > 0 && imgData.naturalHeight > 0 && cropData && cropData.width > 0 && cropData.height > 0) {
                        cropRatios = {
                            x: cropData.x / imgData.naturalWidth,
                            y: cropData.y / imgData.naturalHeight,
                            width: cropData.width / imgData.naturalWidth,
                            height: cropData.height / imgData.naturalHeight
                        };
                    }
                }
                currentCropper.getCroppedCanvas().toBlob(function (blob) {
                    const croppedFile = new File([blob], file.name, { type: file.type });
                    closeModal();
                    if (callback) {
                        if (options?.includeCropMeta) callback(croppedFile, { action: 'crop', cropRatios });
                        else callback(croppedFile);
                    }
                }, file.type);
            } else {
                closeModal();
                if (callback && originalFile) {
                    if (options?.includeCropMeta) callback(originalFile, { action: 'crop', cropRatios: null });
                    else callback(originalFile);
                }
            }
        });

        newSkipBtn.addEventListener('click', function (evt) {
            evt.preventDefault();
            showLoader('upload-media', 'Uploading Media...');
            const fileToUpload = originalFile;
            closeModal();
            if (callback && fileToUpload) {
                if (options?.includeCropMeta) callback(fileToUpload, { action: 'skip' });
                else callback(fileToUpload);
            }
        });

        newCancelBtn.addEventListener('click', function (evt) {
            evt.preventDefault();
            hideLoader('upload-media');
            closeModal();
        });
    };
    reader.readAsDataURL(file);
}
