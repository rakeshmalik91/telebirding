import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderModeToggle } from '../../scripts/modules/public/ui-helpers.js';
import Constants from '../../scripts/modules/constants.js';

describe('Public UI Helpers - renderModeToggle', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="mode-toggle"></div>';
    });

    it('should do nothing gracefully if #mode-toggle does not exist in the DOM', () => {
        $('#mode-toggle').remove();
        expect(() => renderModeToggle(Constants.MODE_BIRD)).not.toThrow();
    });

    it('should render icon toggle buttons for bird and insect modes with bird active by default', () => {
        renderModeToggle(Constants.MODE_BIRD);
        const $btns = $('#mode-toggle .mode-toggle-btn');
        expect($btns.length).toBe(2);

        const $birdBtn = $btns.filter('[data-mode="bird"]');
        expect($birdBtn.hasClass('active')).toBe(true);
        expect($birdBtn.attr('aria-selected')).toBe('true');
        expect($birdBtn.attr('tabindex')).toBe('0');
        expect($birdBtn.attr('aria-label')).toBe('Bird');
        expect($birdBtn.attr('title')).toBe('Bird');
        expect($birdBtn.find('svg.mode-toggle-icon').length).toBe(1);

        const $insectBtn = $btns.filter('[data-mode="insect"]');
        expect($insectBtn.hasClass('active')).toBe(false);
        expect($insectBtn.attr('aria-selected')).toBe('false');
        expect($insectBtn.attr('tabindex')).toBe('-1');
        expect($insectBtn.attr('aria-label')).toBe('Insect');
        expect($insectBtn.attr('title')).toBe('Insect');
        expect($insectBtn.find('svg.mode-toggle-icon').length).toBe(1);
    });

    it('should update active class and accessibility attributes when insect mode is active', () => {
        renderModeToggle(Constants.MODE_INSECT);
        const $birdBtn = $('#mode-toggle .mode-toggle-btn[data-mode="bird"]');
        const $insectBtn = $('#mode-toggle .mode-toggle-btn[data-mode="insect"]');

        expect($birdBtn.hasClass('active')).toBe(false);
        expect($birdBtn.attr('aria-selected')).toBe('false');
        expect($birdBtn.attr('tabindex')).toBe('-1');

        expect($insectBtn.hasClass('active')).toBe(true);
        expect($insectBtn.attr('aria-selected')).toBe('true');
        expect($insectBtn.attr('tabindex')).toBe('0');
    });

    it('should support image fallback if svg property is not defined on a mode config', () => {
        const originalBirdSvg = Constants.MODE[Constants.MODE_BIRD].svg;
        delete Constants.MODE[Constants.MODE_BIRD].svg;

        renderModeToggle(Constants.MODE_BIRD);
        const $birdBtn = $('#mode-toggle .mode-toggle-btn[data-mode="bird"]');
        expect($birdBtn.find('img.mode-toggle-icon').length).toBe(1);
        expect($birdBtn.find('img.mode-toggle-icon').attr('src')).toBe(Constants.MODE[Constants.MODE_BIRD].icon);

        // Restore
        Constants.MODE[Constants.MODE_BIRD].svg = originalBirdSvg;
    });
});
