import { describe, it, expect, vi, beforeEach } from 'vitest';
import { disableScroll, enableScroll } from '../../scripts/modules/ui-helpers.js';

describe('UI Helpers - Scroll Management', () => {
    beforeEach(() => {
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');
    });

    it('should add event listeners when disabling scroll', () => {
        disableScroll();
        expect(window.addEventListener).toHaveBeenCalledWith('DOMMouseScroll', expect.any(Function), false);
        expect(window.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), expect.anything());
        expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), false);
    });

    it('should remove event listeners when enabling scroll', () => {
        enableScroll();
        expect(window.removeEventListener).toHaveBeenCalledWith('DOMMouseScroll', expect.any(Function), false);
        expect(window.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), expect.anything());
        expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), false);
    });
});
