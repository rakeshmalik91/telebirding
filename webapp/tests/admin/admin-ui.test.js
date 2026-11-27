import { describe, it, expect, beforeEach, vi } from 'vitest';
import { customConfirm, customAlert } from '../../scripts/modules/admin/ui.js';

describe('Admin UI Modal Module', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <div id="custom-modal-overlay" style="display: none;">
                <h3 id="custom-modal-title"></h3>
                <div id="custom-modal-message"></div>
                <button id="custom-modal-cancel">Cancel</button>
                <button id="custom-modal-confirm">OK</button>
            </div>
        `;
    });

    it('should confirm customConfirm when Enter key is pressed', () => {
        const onConfirm = vi.fn();
        customConfirm('You are about to delete this media.', onConfirm);
        expect($('#custom-modal-overlay').css('display')).toBe('flex');

        $(document).trigger($.Event('keydown', { key: 'Enter' }));
        vi.runAllTimers();

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect($('#custom-modal-overlay').css('display')).toBe('none');
    });

    it('should cancel customConfirm without calling callback when Escape key is pressed', () => {
        const onConfirm = vi.fn();
        customConfirm('You are about to delete this media.', onConfirm);

        $(document).trigger($.Event('keydown', { key: 'Escape' }));
        vi.runAllTimers();

        expect(onConfirm).not.toHaveBeenCalled();
        expect($('#custom-modal-overlay').css('display')).toBe('none');
    });

    it('should close customAlert on Enter key', () => {
        customAlert('Test alert');
        expect($('#custom-modal-overlay').css('display')).toBe('flex');

        $(document).trigger($.Event('keydown', { key: 'Enter' }));
        vi.runAllTimers();
        expect($('#custom-modal-overlay').css('display')).toBe('none');
    });
});
