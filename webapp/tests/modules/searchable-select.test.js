import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSearchableSelect, destroySearchableSelect } from '../../scripts/modules/searchable-select.js';

describe('SearchableSelect Module', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="container">
                <select id="speciesSelect" data-tags="true" placeholder="Select or type a species...">
                    <option value=""></option>
                    <option value="rock-pigeon" data-search-terms="pigeon">Rock Pigeon</option>
                    <option value="blyths-reed-warbler" data-search-terms="warbler">Blyth's Reed Warbler</option>
                </select>
            </div>
        `;
    });

    it('initializes wrapper and display elements', () => {
        const select = document.getElementById('speciesSelect');
        initSearchableSelect(select);

        expect($('.ss-wrapper').length).toBe(1);
        expect($('.ss-display').length).toBe(1);
        expect($('.ss-display-text').text()).toBe('Select or type a species...');
    });

    it('matches options with curly apostrophes', () => {
        const select = document.getElementById('speciesSelect');
        initSearchableSelect(select);

        // Click display to open dropdown
        $('.ss-display').trigger('click');
        const $search = $('.ss-search');

        // Type with curly apostrophe: "Blyth’s"
        $search.val('Blyth\u2019s').trigger('input');

        const options = $('.ss-options .ss-option:not(.ss-option-new)');
        expect(options.length).toBe(1);
        expect(options.text()).toBe("Blyth's Reed Warbler");
    });

    it('commits custom typed tag on dropdown close when allowTags is true', () => {
        const select = document.getElementById('speciesSelect');
        initSearchableSelect(select);

        $('.ss-display').trigger('click');
        const $search = $('.ss-search');

        // Type a new species with apostrophe: "Marshall's Iora"
        $search.val("Marshall's Iora").trigger('input');

        // Close dropdown by clicking document body
        $(document).trigger('click.ss');

        expect($(select).val()).toBe("Marshall's Iora");
        expect($('.ss-display-text').text()).toBe("Marshall's Iora");
        expect($(select).find('option:selected').text()).toBe("Marshall's Iora");
    });

    it('normalizes curly apostrophe when adding custom tag', () => {
        const select = document.getElementById('speciesSelect');
        initSearchableSelect(select);

        $('.ss-display').trigger('click');
        const $search = $('.ss-search');

        // Type "Marshall’s Iora" (curly apostrophe)
        $search.val('Marshall\u2019s Iora').trigger('input');

        // Close dropdown
        $(document).trigger('click.ss');

        expect($(select).val()).toBe("Marshall's Iora");
        expect($('.ss-display-text').text()).toBe("Marshall's Iora");
    });

    it('commits custom tag on Tab keypress', () => {
        const select = document.getElementById('speciesSelect');
        initSearchableSelect(select);

        $('.ss-display').trigger('click');
        const $search = $('.ss-search');
        $search.val("Wilson's Storm-Petrel").trigger('input');

        const tabEvent = $.Event('keydown', { key: 'Tab' });
        $search.trigger(tabEvent);

        expect($(select).val()).toBe("Wilson's Storm-Petrel");
        expect($('.ss-dropdown').hasClass('open')).toBe(false);
    });
});
