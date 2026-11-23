import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderModeToggle, updateMobileNavActiveTab, updateMobileFilterToggleBadge } from '../../scripts/modules/public/ui-helpers.js';
import Constants from '../../scripts/modules/constants.js';
import State from '../../scripts/modules/public/state.js';

describe('Public UI Helpers - renderModeToggle', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="mode-toggle" class="mode-toggle"></div>';
    });

    it('should do nothing gracefully if .mode-toggle does not exist in the DOM', () => {
        $('.mode-toggle').remove();
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

    it('should update multiple .mode-toggle containers (e.g. header and menu) simultaneously', () => {
        $('body').append('<div class="mode-toggle header-mode-toggle"></div>');
        renderModeToggle(Constants.MODE_INSECT);

        const $menuBtns = $('#mode-toggle .mode-toggle-btn');
        const $headerBtns = $('.header-mode-toggle .mode-toggle-btn');

        expect($menuBtns.length).toBe(2);
        expect($headerBtns.length).toBe(2);
        expect($headerBtns.filter('[data-mode="insect"]').hasClass('active')).toBe(true);
        expect($menuBtns.filter('[data-mode="insect"]').hasClass('active')).toBe(true);
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

describe('Public UI Helpers - updateMobileNavActiveTab', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <nav id="mobile-bottom-nav">
                <button class="mobile-nav-btn active" data-page="feed"></button>
                <button class="mobile-nav-btn" data-page="explore_menu"></button>
                <button class="mobile-nav-btn" data-page="map_menu"></button>
                <button class="mobile-nav-btn" data-page="stories"></button>
                <button class="mobile-nav-btn" data-page="about"></button>
            </nav>
        `;
    });

    it('should do nothing gracefully if #mobile-bottom-nav is not present', () => {
        $('#mobile-bottom-nav').remove();
        expect(() => updateMobileNavActiveTab('feed')).not.toThrow();
    });

    it('should activate feed tab for feed page', () => {
        updateMobileNavActiveTab('feed');
        expect($('.mobile-nav-btn[data-page="feed"]').hasClass('active')).toBe(true);
        expect($('.mobile-nav-btn[data-page="explore_menu"]').hasClass('active')).toBe(false);
    });

    it('should activate explore_menu tab for explore_page', () => {
        updateMobileNavActiveTab(Constants.EXPLORE_PAGE);
        expect($('.mobile-nav-btn[data-page="explore_menu"]').hasClass('active')).toBe(true);
        expect($('.mobile-nav-btn[data-page="feed"]').hasClass('active')).toBe(false);
    });

    it('should activate map_menu tab for map page', () => {
        updateMobileNavActiveTab(Constants.MAP);
        expect($('.mobile-nav-btn[data-page="map_menu"]').hasClass('active')).toBe(true);
        expect($('.mobile-nav-btn[data-page="feed"]').hasClass('active')).toBe(false);
    });

    it('should activate stories tab for stories page', () => {
        updateMobileNavActiveTab(Constants.STORIES);
        expect($('.mobile-nav-btn[data-page="stories"]').hasClass('active')).toBe(true);
        expect($('.mobile-nav-btn[data-page="feed"]').hasClass('active')).toBe(false);
    });

    it('should activate about tab for about page', () => {
        updateMobileNavActiveTab(Constants.ABOUT);
        expect($('.mobile-nav-btn[data-page="about"]').hasClass('active')).toBe(true);
        expect($('.mobile-nav-btn[data-page="feed"]').hasClass('active')).toBe(false);
    });
});

describe('Public UI Helpers - updateMobileFilterToggleBadge', () => {
    beforeEach(() => {
        State.ratingFilter = 0;
        document.body.innerHTML = `
            <button type="button" class="mobile-filter-toggle-btn">
                <span class="mobile-filter-badge" style="display:none;"></span>
            </button>
            <div class="filter">
                <input data-value="place" value="" />
                <input data-value="sighting" value="" />
                <input data-value="date" value="" />
            </div>
        `;
    });

    it('should hide badge when no filters are active', () => {
        updateMobileFilterToggleBadge();
        const $btn = $('.mobile-filter-toggle-btn');
        expect($btn.hasClass('has-filters')).toBe(false);
        expect($btn.find('.mobile-filter-badge').css('display')).toBe('none');
    });

    it('should show count 1 when rating filter is active', () => {
        State.ratingFilter = 3;
        updateMobileFilterToggleBadge();
        const $btn = $('.mobile-filter-toggle-btn');
        expect($btn.hasClass('has-filters')).toBe(true);
        expect($btn.find('.mobile-filter-badge').text()).toBe('1');
    });

    it('should sum inputs and rating filter correctly', () => {
        $('.filter input[data-value="place"]').val('Park');
        $('.filter input[data-value="date"]').val('2026');
        State.ratingFilter = 4;
        updateMobileFilterToggleBadge();
        const $btn = $('.mobile-filter-toggle-btn');
        expect($btn.hasClass('has-filters')).toBe(true);
        expect($btn.find('.mobile-filter-badge').text()).toBe('3');
    });

    it('should include family filter in count', () => {
        State.updateSightingFamilyFilter('Corvidae');
        updateMobileFilterToggleBadge();
        const $btn = $('.mobile-filter-toggle-btn');
        expect($btn.hasClass('has-filters')).toBe(true);
        expect($btn.find('.mobile-filter-badge').text()).toBe('1');
        State.updateSightingFamilyFilter(null);
    });
});

