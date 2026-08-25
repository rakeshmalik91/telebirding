import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Autocomplete } from '../../scripts/modules/public/autocomplete.js';

describe('Autocomplete Module', () => {
    let inputEl;
    let onSelectMock;
    let autocomplete;
    const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Apricot'];

    beforeEach(() => {
        document.body.innerHTML = `
            <div>
                <input id="myInput" type="text" name="myFruit">
            </div>
            <div id="otherElement"></div>
        `;
        inputEl = document.getElementById('myInput');
        onSelectMock = vi.fn();
        autocomplete = new Autocomplete(inputEl, items, onSelectMock);
    });

    it('should initialize without issues', () => {
        expect(inputEl).toBeDefined();
        expect(autocomplete).toBeInstanceOf(Autocomplete);
    });

    it('should show options matching input', () => {
        // Trigger input event with "Ap"
        inputEl.value = 'Ap';
        const inputEvent = new Event('input');
        inputEl.dispatchEvent(inputEvent);

        const list = document.getElementById('myInputautocomplete-list');
        expect(list).not.toBeNull();
        expect(list.children.length).toBe(2); // Apple, Apricot
        expect(list.children[0].textContent).toBe('Apple');
        expect(list.children[1].textContent).toBe('Apricot');
    });

    it('should close list when input is empty', () => {
        inputEl.value = 'Ap';
        inputEl.dispatchEvent(new Event('input'));
        
        expect(document.getElementById('myInputautocomplete-list')).not.toBeNull();

        inputEl.value = '';
        inputEl.dispatchEvent(new Event('input'));
        
        expect(document.getElementById('myInputautocomplete-list')).toBeNull();
    });

    it('should select option on mousedown', () => {
        inputEl.value = 'Ap';
        inputEl.dispatchEvent(new Event('input'));

        const list = document.getElementById('myInputautocomplete-list');
        const firstOption = list.children[0]; // Apple

        // Trigger mousedown on first option
        const mousedownEvent = new MouseEvent('mousedown');
        firstOption.dispatchEvent(mousedownEvent);

        expect(inputEl.value).toBe('Apple');
        expect(onSelectMock).toHaveBeenCalledWith('Apple');
        expect(document.getElementById('myInputautocomplete-list')).toBeNull(); // List closed
    });

    it('should navigate options with arrow keys and select with enter', () => {
        inputEl.value = 'Ap';
        inputEl.dispatchEvent(new Event('input'));

        const listDivs = document.getElementById('myInputautocomplete-list').getElementsByTagName("div");
        
        // Press Down
        let keydownEvent = new KeyboardEvent('keydown', { keyCode: 40 });
        inputEl.dispatchEvent(keydownEvent);
        expect(listDivs[0].classList.contains('autocomplete-active')).toBe(true);

        // Press Down again
        keydownEvent = new KeyboardEvent('keydown', { keyCode: 40 });
        inputEl.dispatchEvent(keydownEvent);
        expect(listDivs[1].classList.contains('autocomplete-active')).toBe(true);

        // Press Up
        keydownEvent = new KeyboardEvent('keydown', { keyCode: 38 });
        inputEl.dispatchEvent(keydownEvent);
        expect(listDivs[0].classList.contains('autocomplete-active')).toBe(true);

        // Press Enter
        keydownEvent = new KeyboardEvent('keydown', { keyCode: 13 });
        inputEl.dispatchEvent(keydownEvent);

        expect(inputEl.value).toBe('Apple');
        expect(onSelectMock).toHaveBeenCalledWith('Apple');
        expect(document.getElementById('myInputautocomplete-list')).toBeNull(); // List closed
    });

    it('should wrap around when navigating with arrow keys', () => {
        inputEl.value = 'Ap'; // 2 results
        inputEl.dispatchEvent(new Event('input'));

        const listDivs = document.getElementById('myInputautocomplete-list').getElementsByTagName("div");

        // Press Up from -1 -> wraps to end
        let keydownEvent = new KeyboardEvent('keydown', { keyCode: 38 });
        inputEl.dispatchEvent(keydownEvent);
        expect(listDivs[1].classList.contains('autocomplete-active')).toBe(true); // Apricot active

        // Press Down from end -> wraps to start
        keydownEvent = new KeyboardEvent('keydown', { keyCode: 40 });
        inputEl.dispatchEvent(keydownEvent);
        expect(listDivs[0].classList.contains('autocomplete-active')).toBe(true); // Apple active
    });

    it('should trigger select manually if enter pressed without active option', () => {
        inputEl.value = 'Banana';
        inputEl.dispatchEvent(new Event('input')); // generates list

        // Press Enter directly (no active element from down/up)
        let keydownEvent = new KeyboardEvent('keydown', { keyCode: 13 });
        inputEl.dispatchEvent(keydownEvent);

        expect(onSelectMock).toHaveBeenCalledWith('Banana');
        expect(document.getElementById('myInputautocomplete-list')).toBeNull();
    });

    it('should close all lists when clicking outside', () => {
        inputEl.value = 'Ap';
        inputEl.dispatchEvent(new Event('input'));
        expect(document.getElementById('myInputautocomplete-list')).not.toBeNull();

        // Click outside
        const clickEvent = new MouseEvent('click', { bubbles: true });
        document.getElementById('otherElement').dispatchEvent(clickEvent);

        expect(document.getElementById('myInputautocomplete-list')).toBeNull();
    });

    it('should handle null input element gracefully', () => {
        const instance = new Autocomplete(null, items, onSelectMock);
        expect(instance).toBeInstanceOf(Autocomplete);
        expect(instance.inp).toBeNull();
    });

    it('should handle null elements in addActive', () => {
        const result = autocomplete.addActive(null);
        expect(result).toBe(false);
    });
});
