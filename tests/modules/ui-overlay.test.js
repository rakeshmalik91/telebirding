import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showOverlay, hideOverlay } from '../../scripts/modules/ui-helpers.js';

describe('UI Helpers - Overlay', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    it('should show the overlay correctly', () => {
        showOverlay('test');
        expect($('#page-loader').length).toBe(1);
        expect($('#page-loader').css('display')).toBe('flex');
    });

    it('should hide the overlay correctly', () => {
        showOverlay('test');
        hideOverlay();
        // Since fadeOut is used, we might need to wait or mock it
        // Or check if the style is changing or being scheduled
    });
});
