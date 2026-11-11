let currentCropper = null;
let escapeHandler = null;
let originalFile = null;

export function openCropper(file, callback) {
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

        newConfirmBtn.addEventListener('click', function (evt) {
            evt.preventDefault();
            if (currentCropper) {
                currentCropper.getCroppedCanvas().toBlob(function (blob) {
                    const croppedFile = new File([blob], file.name, { type: file.type });
                    closeModal();
                    if (callback) callback(croppedFile);
                }, file.type);
            }
        });

        newSkipBtn.addEventListener('click', function (evt) {
            evt.preventDefault();
            const fileToUpload = originalFile;
            closeModal();
            if (callback && fileToUpload) {
                callback(fileToUpload);
            }
        });

        newCancelBtn.addEventListener('click', function (evt) {
            evt.preventDefault();
            closeModal();
        });
    };
    reader.readAsDataURL(file);
}
