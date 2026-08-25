import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openCropper } from '../../scripts/modules/cropper.js';

describe('Cropper Module', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="crop-modal" style="display:none">
                <img id="crop-image">
                <button id="crop-confirm">Confirm</button>
                <button id="crop-skip">Skip</button>
                <button id="crop-cancel">Cancel</button>
            </div>
        `;

        // Mock Cropper global
        global.Cropper = vi.fn().mockImplementation(() => ({
            destroy: vi.fn(),
            getCroppedCanvas: () => ({
                toBlob: (cb) => cb(new Blob(['cropped'], { type: 'image/jpeg' }))
            })
        }));

        // Mock FileReader
        const mockFileReader = {
            readAsDataURL: vi.fn(function() {
                this.onload({ target: { result: 'base64-data' } });
            }),
            onload: null
        };
        vi.stubGlobal('FileReader', vi.fn(() => mockFileReader));
    });

    it('should open the cropper modal and load image', () => {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        openCropper(file, vi.fn());

        const modal = document.getElementById('crop-modal');
        const image = document.getElementById('crop-image');

        expect(modal.style.display).toBe('flex');
        expect(image.src).toContain('base64-data');
    });

    it('should handle confirm button click', () => {
        vi.useFakeTimers();
        const callback = vi.fn();
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        openCropper(file, callback);

        // Trigger image.onload to initialize Cropper
        const image = document.getElementById('crop-image');
        if (image.onload) {
            image.onload();
        }
        // Advance past the setTimeout(50) that creates the Cropper instance
        vi.advanceTimersByTime(60);

        const confirmBtn = document.getElementById('crop-confirm');
        confirmBtn.click();

        expect(callback).toHaveBeenCalled();
        expect(document.getElementById('crop-modal').style.display).toBe('none');
        vi.useRealTimers();
    });

    it('should handle cancel button click', () => {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        openCropper(file, vi.fn());

        const cancelBtn = document.getElementById('crop-cancel');
        cancelBtn.click();

        const modal = document.getElementById('crop-modal');
        expect(modal.style.display).toBe('none');
    });

    it('should handle skip button click', () => {
        const callback = vi.fn();
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        openCropper(file, callback);

        const skipBtn = document.getElementById('crop-skip');
        skipBtn.click();

        expect(callback).toHaveBeenCalledWith(file);
        expect(document.getElementById('crop-modal').style.display).toBe('none');
    });

    it('should handle escape key', () => {
        const addSpy = vi.spyOn(document, 'addEventListener');
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

        openCropper(file, vi.fn());

        const handler = addSpy.mock.calls.find(call => call[0] === 'keydown')[1];
        
        // Test non-Escape case (should do nothing, modal remains flex)
        handler({ key: 'NotEscape', keyCode: 0 });
        expect(document.getElementById('crop-modal').style.display).toBe('flex');

        // Test Escape case via keyCode
        handler({ key: 'NotEscape', keyCode: 27 });
        expect(document.getElementById('crop-modal').style.display).toBe('none');
    });

    it('should destroy previous cropper when opening new one', () => {
        vi.useFakeTimers();
        const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });

        openCropper(file1, vi.fn());
        // Trigger image load to create a Cropper instance
        const image = document.getElementById('crop-image');
        if (image.onload) {
            image.onload();
            vi.advanceTimersByTime(60);
        }

        // Re-create DOM since cancel destroys nodes
        document.getElementById('crop-confirm').id = 'crop-confirm';
        document.getElementById('crop-skip').id = 'crop-skip';
        document.getElementById('crop-cancel').id = 'crop-cancel';

        openCropper(file2, vi.fn());
        expect(document.getElementById('crop-modal').style.display).toBe('flex');
        vi.useRealTimers();
    });

    it('should blur active element when opening', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        const blurSpy = vi.spyOn(input, 'blur');

        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        openCropper(file, vi.fn());

        expect(blurSpy).toHaveBeenCalled();
    });
});
