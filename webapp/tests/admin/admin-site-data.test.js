import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as SiteDataAdmin from '../../scripts/modules/admin/site-data.js';
import * as AdminData from '../../scripts/modules/admin/data.js';

vi.mock('../../scripts/modules/firebase-api.js', () => ({
    default: {
        getFirebase: vi.fn(() => global.firebase)
    }
}));

vi.mock('../../scripts/modules/admin/ui.js', () => ({
    customAlert: vi.fn(),
    customConfirm: vi.fn((msg, cb) => cb()),
    showToast: vi.fn()
}));

describe('Admin Site Data Module', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="site-data-tab" class="admin-tab-content"></div>
            <div id="media-popup" style="display:none;">
                <img id="media-popup-img" />
                <video id="media-popup-video"></video>
            </div>
        `;

        AdminData.data.featured = [
            {
                src: 'featured-images/wagtail.jpg',
                titleLine1: 'Forest Wagtail',
                titleLine2: '© Tester, 2026',
                titleColor: 'black',
                alt: 'Forest Wagtail'
            },
            {
                src: 'featured-images/owl.jpg',
                titleLine1: 'Barn Owl',
                titleLine2: '© Tester, 2025',
                alt: 'Barn Owl'
            }
        ];

        AdminData.data.camera_model = {
            'S7RV': 'Sony α7rmV',
            'NZ8': 'Nikon Z8'
        };

        AdminData.data.author = {
            'Tester One': 'https://instagram.com/tester1',
            'Tester Two': 'https://instagram.com/tester2'
        };

        vi.clearAllMocks();
    });

    it('renders site data spreadsheet with sheet navigation tabs and tables', () => {
        SiteDataAdmin.setupSiteDataTab();
        expect($('#site-data-sheet-content').length).toBe(1);
        expect($('.spreadsheet-sheet-tab').length).toBe(3);
        expect($('.spreadsheet-table tr').length).toBeGreaterThan(1);
    });

    it('allows switching between sheets (featured, camera_model, author)', () => {
        SiteDataAdmin.setupSiteDataTab();

        // Switch to Camera Models
        $('.spreadsheet-sheet-tab[data-sheet="camera_model"]').trigger('click');
        expect($('.camera-code-input').length).toBe(2);
        expect($('.camera-code-input').first().val()).toBe('S7RV');

        // Switch to Authors
        $('.spreadsheet-sheet-tab[data-sheet="author"]').trigger('click');
        expect($('.author-name-input').length).toBe(2);
        expect($('.author-name-input').first().val()).toBe('Tester One');

        // Switch back to Featured
        $('.spreadsheet-sheet-tab[data-sheet="featured"]').trigger('click');
        expect($('input[data-field="titleLine1"]').length).toBe(2);
    });

    it('adds, edits, moves, and deletes featured images', () => {
        SiteDataAdmin.setupSiteDataTab();

        // Edit field
        const $titleInput = $('tr[data-index="0"] input[data-field="titleLine1"]');
        $titleInput.val('Updated Wagtail').trigger('input');
        expect(AdminData.data.featured[0].titleLine1).toBe('Updated Wagtail');

        // Move down
        $('tr[data-index="0"] .move-featured-down').trigger('click');
        expect(AdminData.data.featured[0].titleLine1).toBe('Barn Owl');
        expect(AdminData.data.featured[1].titleLine1).toBe('Updated Wagtail');

        // Add new featured image
        $('#add-featured-btn').trigger('click');
        expect(AdminData.data.featured.length).toBe(3);

        // Delete featured image
        $('tr[data-index="2"] .delete-featured-btn').trigger('click');
        expect(AdminData.data.featured.length).toBe(2);
    });

    it('supports drag-and-drop reordering of featured images', () => {
        SiteDataAdmin.setupSiteDataTab();

        // Check drag handles exist and are draggable
        expect($('.featured-drag-handle').length).toBe(2);
        expect($('.featured-drag-handle[draggable="true"]').length).toBe(2);

        // Move first item after second item using moveFeaturedItem
        SiteDataAdmin.moveFeaturedItem(0, 1, true);
        expect(AdminData.data.featured[0].titleLine1).toBe('Barn Owl');
        expect(AdminData.data.featured[1].titleLine1).toBe('Forest Wagtail');

        // Move second item before first item using moveFeaturedItem
        SiteDataAdmin.moveFeaturedItem(1, 0, false);
        expect(AdminData.data.featured[0].titleLine1).toBe('Forest Wagtail');
        expect(AdminData.data.featured[1].titleLine1).toBe('Barn Owl');

        // Simulate DOM drop event on target row
        const dropEvent = $.Event('drop');
        dropEvent.originalEvent = {
            dataTransfer: {
                getData: () => '0'
            },
            preventDefault: () => { },
            clientY: 100
        };
        const targetRow = $('tr[data-index="1"]')[0];
        targetRow.getBoundingClientRect = () => ({ y: 0, height: 100 });
        $('tr[data-index="1"]').trigger(dropEvent);

        expect(AdminData.data.featured[0].titleLine1).toBe('Barn Owl');
        expect(AdminData.data.featured[1].titleLine1).toBe('Forest Wagtail');
    });

    it('adds, edits, and deletes camera models', () => {
        AdminData.data.sightings = [
            {
                key: 's1',
                camera_model: 'S7RV+200600',
                media: [
                    { src: 'images/test.jpg', camera_model: 'S7RV', exif_data: { camera_model: 'S7RV+55210' } }
                ]
            }
        ];

        SiteDataAdmin.setupSiteDataTab();
        $('.spreadsheet-sheet-tab[data-sheet="camera_model"]').trigger('click');

        // Add model
        $('#add-camera-btn').trigger('click');
        expect(Object.keys(AdminData.data.camera_model).length).toBe(3);

        // Edit code
        const $codeRow = $('tr[data-orig-code="S7RV"]');
        $codeRow.find('.camera-code-input').val('SONY_A7RV').trigger('change');
        expect(AdminData.data.camera_model['SONY_A7RV']).toBe('Sony α7rmV');
        expect(AdminData.data.camera_model['S7RV']).toBeUndefined();
        // Sightings should be updated with new code
        expect(AdminData.data.sightings[0].camera_model).toBe('SONY_A7RV+200600');
        expect(AdminData.data.sightings[0].media[0].camera_model).toBe('SONY_A7RV');
        expect(AdminData.data.sightings[0].media[0].exif_data.camera_model).toBe('SONY_A7RV+55210');

        // Edit display name
        $codeRow.find('.camera-name-input').val('Sony Alpha 7R V').trigger('input');
        expect(AdminData.data.camera_model['SONY_A7RV']).toBe('Sony Alpha 7R V');

        // Delete model
        $codeRow.find('.delete-camera-btn').trigger('click');
        expect(AdminData.data.camera_model['SONY_A7RV']).toBeUndefined();
    });

    it('adds, edits, and deletes authors', () => {
        AdminData.data.sightings = [
            {
                key: 's1',
                author: 'Tester One',
                media: [
                    { src: 'images/test.jpg', author: 'Tester One', exif_data: { author: 'Tester One' } }
                ]
            }
        ];

        SiteDataAdmin.setupSiteDataTab();
        $('.spreadsheet-sheet-tab[data-sheet="author"]').trigger('click');

        // Add author
        $('#add-author-btn').trigger('click');
        expect(Object.keys(AdminData.data.author).length).toBe(3);

        // Edit name
        const $authorRow = $('tr[data-orig-name="Tester One"]');
        $authorRow.find('.author-name-input').val('Alice').trigger('change');
        expect(AdminData.data.author['Alice']).toBe('https://instagram.com/tester1');
        expect(AdminData.data.author['Tester One']).toBeUndefined();
        // Sightings should be updated with new author name
        expect(AdminData.data.sightings[0].author).toBe('Alice');
        expect(AdminData.data.sightings[0].media[0].author).toBe('Alice');
        expect(AdminData.data.sightings[0].media[0].exif_data.author).toBe('Alice');

        // Edit URL
        $authorRow.find('.author-url-input').val('https://alice.art').trigger('input');
        expect(AdminData.data.author['Alice']).toBe('https://alice.art');
        expect($authorRow.find('.open-author-link').attr('href')).toBe('https://alice.art');

        // Edit URL with naked domain (should get https:// prefixed for open link)
        $authorRow.find('.author-url-input').val('instagram.com/alice').trigger('input');
        expect(AdminData.data.author['Alice']).toBe('instagram.com/alice');
        expect($authorRow.find('.open-author-link').attr('href')).toBe('https://instagram.com/alice');

        // Delete author
        $authorRow.find('.delete-author-btn').trigger('click');
        expect(AdminData.data.author['Alice']).toBeUndefined();
    });

    it('filters rows according to searchFilter input', () => {
        SiteDataAdmin.setupSiteDataTab();
        $('.site-data-filter').val('owl').trigger('input');
        expect($('tr[data-index]').length).toBe(1);
        expect($('tr[data-index] input[data-field="titleLine1"]').val()).toBe('Barn Owl');
    });
});
