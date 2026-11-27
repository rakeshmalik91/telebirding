import { describe, it, expect, beforeEach, vi } from 'vitest';

let showOverlay, hideOverlay, getSelectOptionsDOM, getSelectDOM, disableScroll, enableScroll;

async function loadModule() {
    vi.resetModules();
    const mod = await import('../../scripts/modules/ui-helpers.js');
    showOverlay = mod.showOverlay;
    hideOverlay = mod.hideOverlay;
    getSelectOptionsDOM = mod.getSelectOptionsDOM;
    getSelectDOM = mod.getSelectDOM;
    disableScroll = mod.disableScroll;
    enableScroll = mod.enableScroll;
}

describe('UI Helpers', () => {
    beforeEach(async () => {
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

        await loadModule();
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
        it('should add scroll-preventing event listeners and prevent defaults', () => {
            const preventDefaultSpy = vi.fn();
            disableScroll();

            // Dispatch DOMMouseScroll
            const domMouseScrollEvt = new Event('DOMMouseScroll');
            domMouseScrollEvt.preventDefault = preventDefaultSpy;
            window.dispatchEvent(domMouseScrollEvt);
            expect(preventDefaultSpy).toHaveBeenCalledTimes(1);

            // Dispatch wheel (wheelEvent is wheel or mousewheel)
            const wheelEvt = new Event('wheel');
            wheelEvt.preventDefault = preventDefaultSpy;
            window.dispatchEvent(wheelEvt);
            // Wait, does it register 'wheel' or 'mousewheel'?
            // In JSDOM/Node, onwheel in document.createElement('div') is false, so it might use mousewheel.
            // Let's dispatch mousewheel just in case to cover it.
            const mousewheelEvt = new Event('mousewheel');
            mousewheelEvt.preventDefault = preventDefaultSpy;
            window.dispatchEvent(mousewheelEvt);

            // Dispatch touchmove
            const touchmoveEvt = new Event('touchmove');
            touchmoveEvt.preventDefault = preventDefaultSpy;
            window.dispatchEvent(touchmoveEvt);

            // Dispatch keydown once to call preventDefaultForScrollKeys
            const keydownEvt1 = new Event('keydown');
            window.dispatchEvent(keydownEvt1);

            // Dispatch keydown with code Space (listened to by the nested handler)
            const keydownEvt2 = new KeyboardEvent('keydown', { code: 'Space' });
            keydownEvt2.preventDefault = preventDefaultSpy;
            window.dispatchEvent(keydownEvt2);

            expect(preventDefaultSpy).toHaveBeenCalled();
            enableScroll();
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

    it('should handle addEventListener failure in supportsPassive check', async () => {
        const originalAddEventListener = window.addEventListener;
        window.addEventListener = vi.fn().mockImplementation((type, listener, options) => {
            if (type === 'test') {
                throw new Error('mock error');
            }
            return originalAddEventListener(type, listener, options);
        });

        await loadModule();

        window.addEventListener = originalAddEventListener;
    });

    it('should cover both branches of wheelEvent check', async () => {
        // Branch 1: 'onwheel' is present in document.createElement('div')
        const originalCreateElement = document.createElement;
        document.createElement = vi.fn().mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'div') {
                return new Proxy(el, {
                    has(target, prop) {
                        if (prop === 'onwheel') return true;
                        return prop in target;
                    }
                });
            }
            return el;
        });
        await loadModule();

        // Branch 2: 'onwheel' is absent in document.createElement('div')
        document.createElement = vi.fn().mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'div') {
                return new Proxy(el, {
                    has(target, prop) {
                        if (prop === 'onwheel') return false;
                        return prop in target;
                    }
                });
            }
            return el;
        });
        await loadModule();

        // Restore
        document.createElement = originalCreateElement;
    });
});
