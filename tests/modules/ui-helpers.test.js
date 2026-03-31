import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showOverlay, hideOverlay, getSelectOptionsDOM, getSelectDOM, disableScroll, enableScroll } from '../../scripts/modules/ui-helpers.js';

describe('UI Helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="page-loader" style="display: none;"></div>
            <div class="overlay">Old Overlay</div>
            <div id="crop-modal" class="overlay">Crop</div>
        `;

        // Mock jQuery fade functions
        $.fn.fadeIn = vi.fn(function(speed, cb) {
            this.show();
            if(cb) cb();
            return this;
        });
        $.fn.fadeOut = vi.fn(function(speed, cb) {
            this.hide();
            if(cb) cb();
            return this;
        });
    });

    describe('getSelectOptionsDOM', () => {
        it('should generate option tags for simple options', () => {
            const options = { 'm': 'Male', 'f': 'Female' };
            const dom = getSelectOptionsDOM('gender', options, 'm');
            expect(dom).toContain("<option value='m' selected>Male</option>");
            expect(dom).toContain("<option value='f' >Female</option>");
        });

        it('should generate option tags for complex object options', () => {
            const options = { 'adult': { name: 'Adult' }, 'juvenile': { name: 'Juvenile' } };
            const dom = getSelectOptionsDOM('age', options, 'juvenile');
            expect(dom).toContain("<option value='adult' >Adult</option>");
            expect(dom).toContain("<option value='juvenile' selected>Juvenile</option>");
        });
    });

    describe('getSelectDOM', () => {
        it('should wrap options in a select tag', () => {
            const options = { '1': 'One', '2': 'Two' };
            const dom = getSelectDOM('test', options, '1', '100px');
            expect(dom).toContain("<select data-field='test' style='width:100px'>");
            expect(dom).toContain("</select>");
            expect(dom).toContain("<option value='1' selected>One</option>");
        });
    });

    describe('showOverlay', () => {
        it('should show the page loader and hide old overlays', () => {
            showOverlay('Loading...');
            expect($('#page-loader').css('display')).toBe('flex');
            // Non-crop-modal overlays should be hidden
        });

        it('should create page-loader if missing', () => {
            $('#page-loader').remove();
            showOverlay('Loading...');
            expect($('#page-loader').length).toBe(1);
        });
    });

    describe('hideOverlay', () => {
        it('should hide the page loader', () => {
            $('#page-loader').show();
            hideOverlay();
            expect($.fn.fadeOut).toHaveBeenCalled();
        });
    });

    describe('disableScroll', () => {
        it('should add scroll-preventing event listeners', () => {
            const spy = vi.spyOn(window, 'addEventListener');
            disableScroll();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('enableScroll', () => {
        it('should remove scroll-preventing event listeners', () => {
            const spy = vi.spyOn(window, 'removeEventListener');
            enableScroll();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});
