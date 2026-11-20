import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showLoader, hideLoader, resetLoader } from '../../scripts/modules/loader.js';

describe('Loader', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetLoader();
        vi.useFakeTimers();

        // Mock jQuery fadeOut to work in JSDOM
        $.fn.fadeOut = vi.fn(function(speed, cb) {
            this.hide();
            if (cb) cb();
            return this;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should show the loader when requested', () => {
        showLoader('test', 'Loading...');
        const loader = $('#page-loader');
        expect(loader.length).toBe(1);
        expect(loader.css('display')).toBe('flex');
        expect(loader.find('.loader-text').text()).toBe('Loading...');
    });

    it('should prevent hiding the loader if blockers remain', () => {
        showLoader('a', 'Loading A');
        showLoader('b', 'Loading B');

        hideLoader('a');
        expect($('#page-loader').css('display')).toBe('flex');
    });

    it('should handle text visibility', () => {
        showLoader('test', '');
        // When text is empty, loader.js calls .hide() on the text element
        expect($('#page-loader .loader-text').css('display')).toBe('none');

        showLoader('test', 'With Text');
        expect($('#page-loader .loader-text').css('display')).not.toBe('none');
        expect($('#page-loader .loader-text').text()).toBe('With Text');
    });

    it('should reset blockers correctly', () => {
        showLoader('a', 'A');
        showLoader('b', 'B');
        resetLoader();
        // After reset, hide should work since no blockers
        hideLoader();
        // Some time may need to pass
        vi.advanceTimersByTime(200);
    });

    it('should hide immediately when elapsed > min time', () => {
        showLoader('test', 'hi');
        // Advance time past the minimum
        vi.advanceTimersByTime(200);
        hideLoader('test');
        expect($.fn.fadeOut).toHaveBeenCalled();
    });

    it('should delay hiding when elapsed < min time', () => {
        showLoader('test', 'hi');
        // Hide immediately (within the 150ms min)
        hideLoader('test');
        expect($.fn.fadeOut).not.toHaveBeenCalled();

        // Advance to trigger the setTimeout
        vi.advanceTimersByTime(200);
        expect($.fn.fadeOut).toHaveBeenCalled();
    });

    it('should not hide during delay if new blocker is added', () => {
        showLoader('test', 'hi');
        hideLoader('test');

        // Add a new blocker before timeout fires
        showLoader('test2', 'hi again');

        vi.advanceTimersByTime(200);
        // fadeOut should NOT have been called because test2 is still blocking
        expect($.fn.fadeOut).not.toHaveBeenCalled();
    });

    it('should hide without key parameter', () => {
        showLoader(null, 'hi');
        vi.advanceTimersByTime(200);
        hideLoader();
        expect($.fn.fadeOut).toHaveBeenCalled();
    });

    it('should create page-loader DOM if missing', () => {
        expect($('#page-loader').length).toBe(0);
        showLoader('test');
        expect($('#page-loader').length).toBe(1);
    });

    it('should not duplicate page-loader DOM', () => {
        showLoader('a');
        showLoader('b');
        expect($('#page-loader').length).toBe(1);
    });

    it('should handle hideLoader when loader was never shown', () => {
        // Reset loader to clear any blockers
        resetLoader();
        hideLoader('nonexistent');
        expect($.fn.fadeOut).not.toHaveBeenCalled();
    });
});
