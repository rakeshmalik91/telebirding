import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as AdminRendering from '../../scripts/modules/admin/rendering.js';
import * as AdminData from '../../scripts/modules/admin/data.js';
import Constants from '../../scripts/modules/constants.js';

vi.mock('../../scripts/modules/admin/data.js', () => ({
    data: {
        sightings: [],
        species: {},
        families: [],
        camera_model: {},
        countries: {}
    },
    currentMode: 'bird',
    uploadMedia: vi.fn(),
    deleteMedia: vi.fn(),
    moveMediaLeft: vi.fn(),
    updateField: vi.fn(),
    updateMediaProperty: vi.fn(),
    deleteSighting: vi.fn(),
    moveSighting: vi.fn(),
    sightingMatches: vi.fn(() => true), // default true for rendering
    addFamily: vi.fn(),
    saveSpecies: vi.fn(),
    deleteFamily: vi.fn(),
    deleteSpecies: vi.fn()
}));

vi.mock('../../scripts/modules/ui-helpers.js', () => ({
    getSelectDOM: vi.fn((name, options, selected, width) => `<select data-name="${name}"></select>`),
    getSelectOptionsDOM: vi.fn(() => '')
}));

function buildBaseDOM() {
    return `
        <table id="sightings-table"></table>
        <input name="filter-sighting" value="" />
        <div class="page-number"></div>
        <button class="first-page"></button>
        <button class="previous"></button>
        <button class="last-page"></button>
        <button class="next"></button>

        <div id="update-species-form">
            <table>
                <tr><td><select data-field="key"><option value="s1" selected>s1</option></select></td></tr>
                <tr><td><select data-field="family"><option value="Columbidae">Columbidae</option></select></td></tr>
                <tr><td><input data-field="name" value="" /></td></tr>
                <tr><td><input data-field="tags" value="" /></td></tr>
                <tr><td><input data-field="latin-name" value="" /></td></tr>
                <tr><td><input data-field="ebird-code" value="" /></td></tr>
                <tr><td><input data-field="sighting-count" value="" /></td></tr>
                <tr><td><button class="submit"></button></td></tr>
                <tr><td><button class="delete"></button></td></tr>
            </table>
        </div>

        <div id="add-family-section" style="display:none">
            <div id="add-family-form">
                <table>
                    <tr><td><select data-field="name"><option value="Columbidae" selected>Columbidae</option></select></td></tr>
                    <tr><td><input data-field="sci-name" value="" /></td></tr>
                    <tr><td><input data-field="ebird-code" value="" /></td></tr>
                    <tr><td><input data-field="species-count" value="" /></td></tr>
                    <tr><td><button class="submit"></button></td></tr>
                    <tr><td><button class="delete"></button></td></tr>
                </table>
            </div>
        </div>
    `;
}

function setupDefaultData() {
    AdminData.data.species = {
        's1': { key: 's1', name: 'Rock Pigeon', tags: ['common'], family: 'Columbidae', latin_name: 'columba livia', ebird_code: 'rocpig' },
        's2': { key: 's2', name: 'House Sparrow', tags: ['urban'], family: 'Passeridae', latin_name: 'passer domesticus', ebird_code: 'houspa' }
    };
    AdminData.data.families = [
        { name: 'Columbidae', sci_name: 'Columbidae', ebird_code: 'columb1' },
        { name: 'Passeridae', sci_name: 'Passeridae', ebird_code: 'passer1' }
    ];
    AdminData.data.sightings = [
        {
            key: 'sight1', species: 's1', place: 'Central Park',
            media: [
                { src: 'images/s1-123.jpg', title: 'Pretty', exif_data: { camera_model: 'S7RV+200600' } },
                { src: 'videos/s1-456.mp4', type: 'video', thumbnail: 'images/s1-456.jpg' }
            ],
            date: '01-01-2023', country: 'US', state: 'NY',
            city: 'New York', hidden: false, unconfirmed: true,
            rating: 4, gender: 'M', age: '', plumage: '',
            time_of_day: 'Day', weather: 'Sunny',
            author: 'Tester', description: 'Nice bird', variation: '', subspecies: ''
        },
        {
            key: 'sight2', species: 's2', place: 'Times Square',
            media: [], date: '02-01-2023', country: 'US', state: 'NY',
            city: 'New York', hidden: true, rating: 2
        }
    ];
    AdminData.data.countries = {
        'US': { states: { 'NY': 'New York', 'CA': 'California' } }
    };
    AdminData.data.camera_model = { 'S7RV': 'Sony a7R V', '200600': 'Sony 200-600mm' };
}

describe('Admin Rendering - Readonly Operations', () => {

    beforeEach(() => {
        document.body.innerHTML = buildBaseDOM();
        setupDefaultData();

        // Mock select2 to prevent TypeError
        $.fn.select2 = vi.fn(function() { return this; });

        vi.clearAllMocks();
    });

    // ========================
    // getValue
    // ========================
    describe('getValue', () => {
        it('should return the property if it exists', () => {
            expect(AdminRendering.getValue({ place: 'Central Park' }, 'place')).toBe('Central Park');
        });

        it('should return empty string if the property does not exist', () => {
            expect(AdminRendering.getValue({ place: 'Central Park' }, 'description')).toBe('');
        });

        it('should return empty string for falsy values', () => {
            expect(AdminRendering.getValue({ rating: 0 }, 'rating')).toBe('');
            expect(AdminRendering.getValue({ hidden: false }, 'hidden')).toBe('');
            expect(AdminRendering.getValue({ val: null }, 'val')).toBe('');
        });

        it('should return truthy values as-is', () => {
            expect(AdminRendering.getValue({ rating: 5 }, 'rating')).toBe(5);
            expect(AdminRendering.getValue({ hidden: true }, 'hidden')).toBe(true);
        });
    });

    // ========================
    // updatePaginationControls
    // ========================
    describe('updatePaginationControls', () => {
        it('should display pagination text and disable buttons at the beginning', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.updatePaginationControls(0, 5);

            expect($('.page-number').html()).toBe('0 - 2 of 2');
            expect($('button.first-page').attr('disabled')).toBe('disabled');
            expect($('button.previous').attr('disabled')).toBe('disabled');
            expect($('button.last-page').attr('disabled')).toBe('disabled');
            expect($('button.next').attr('disabled')).toBe('disabled');
        });

        it('should enable first/previous when offset > 0', () => {
            for (let i = 3; i <= 12; i++) {
                AdminData.data.sightings.push({ key: 's' + i, species: 's1', media: [], date: '01-01-2023', country: 'US', state: 'NY' });
            }
            AdminData.sightingMatches.mockReturnValue(true);

            AdminRendering.updatePaginationControls(5, 5);
            expect($('.page-number').html()).toBe('5 - 10 of 12');
            expect($('button.first-page').attr('disabled')).toBeUndefined();
            expect($('button.previous').attr('disabled')).toBeUndefined();
        });

        it('should enable next/last when not at the end', () => {
            for (let i = 3; i <= 12; i++) {
                AdminData.data.sightings.push({ key: 's' + i, species: 's1', media: [], date: '01-01-2023', country: 'US', state: 'NY' });
            }
            AdminData.sightingMatches.mockReturnValue(true);

            AdminRendering.updatePaginationControls(0, 5);
            expect($('button.next').attr('disabled')).toBeUndefined();
            expect($('button.last-page').attr('disabled')).toBeUndefined();
        });

        it('should disable next/last at the end', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.updatePaginationControls(0, 10);
            expect($('button.next').attr('disabled')).toBe('disabled');
            expect($('button.last-page').attr('disabled')).toBe('disabled');
        });

        it('should respect filter-sighting search field', () => {
            $('input[name=filter-sighting]').val('pigeon');
            AdminData.sightingMatches.mockImplementation((s, key) =>
                key === 'pigeon' && s.species === 's1'
            );

            AdminRendering.updatePaginationControls(0, 5);
            expect($('.page-number').html()).toBe('0 - 1 of 1');
        });
    });

    // ========================
    // fillUpdateSpeciesForm
    // ========================
    describe('fillUpdateSpeciesForm', () => {
        it('should fill form with species data when key is selected', () => {
            AdminRendering.fillUpdateSpeciesForm();

            expect($('#update-species-form input[data-field="name"]').val()).toBe('Rock Pigeon');
            expect($('#update-species-form input[data-field="tags"]').val()).toBe('common');
            expect($('#update-species-form select[data-field="family"]').val()).toBe('Columbidae');
            expect($('#update-species-form input[data-field="latin-name"]').val()).toBe('columba livia');
            expect($('#update-species-form input[data-field="ebird-code"]').val()).toBe('rocpig');
            expect($('#update-species-form input[data-field="sighting-count"]').val()).toBe('1');
            expect($('#update-species-form button.submit').html()).toBe('Update');
        });

        it('should disable delete button when species has sightings', () => {
            AdminRendering.fillUpdateSpeciesForm();
            expect($('#update-species-form button.delete').attr('disabled')).toBe('disabled');
        });

        it('should enable delete button when species has 0 sightings', () => {
            AdminData.data.sightings = []; // No sightings
            AdminRendering.fillUpdateSpeciesForm();
            expect($('#update-species-form button.delete').attr('disabled')).toBeUndefined();
        });

        it('should reset form when no species key is selected', () => {
            $('#update-species-form select[data-field="key"]').val('');
            AdminRendering.fillUpdateSpeciesForm();

            expect($('#update-species-form input[data-field="name"]').val()).toBe('');
            expect($('#update-species-form input[data-field="tags"]').val()).toBe('');
            expect($('#update-species-form input[data-field="latin-name"]').val()).toBe('');
            expect($('#update-species-form input[data-field="ebird-code"]').val()).toBe('');
            expect($('#update-species-form input[data-field="sighting-count"]').val()).toBe('0');
            expect($('#update-species-form button.submit').html()).toBe('Add');
            expect($('#update-species-form button.delete').attr('disabled')).toBe('disabled');
        });
    });

    // ========================
    // fillAddFamilyForm
    // ========================
    describe('fillAddFamilyForm', () => {
        it('should fill form with family data when family is selected', () => {
            AdminRendering.fillAddFamilyForm();

            expect($('#add-family-form input[data-field="sci-name"]').val()).toBe('Columbidae');
            expect($('#add-family-form input[data-field="ebird-code"]').val()).toBe('columb1');
            expect($('#add-family-form input[data-field="species-count"]').val()).toBe('1');
            expect($('#add-family-form button.submit').html()).toBe('Update');
            expect($('#add-family-form button.delete').attr('disabled')).toBeUndefined();
        });

        it('should enable submit and delete buttons for existing family', () => {
            AdminRendering.fillAddFamilyForm();
            expect($('#add-family-form button.submit').attr('disabled')).toBeUndefined();
            expect($('#add-family-form button.delete').attr('disabled')).toBeUndefined();
        });

        it('should reset form when no family selected', () => {
            $('#add-family-form select[data-field="name"]').val('');
            AdminRendering.fillAddFamilyForm();

            expect($('#add-family-form input[data-field="sci-name"]').val()).toBe('');
            expect($('#add-family-form input[data-field="ebird-code"]').val()).toBe('');
            expect($('#add-family-form input[data-field="species-count"]').val()).toBe('0');
            expect($('#add-family-form button.submit').html()).toBe('Add');
            expect($('#add-family-form button.delete').attr('disabled')).toBe('disabled');
        });

        it('should disable submit for new family in bird mode', () => {
            // currentMode is 'bird' by mock
            $('#add-family-form select[data-field="name"]').val('NewFamily');
            AdminRendering.fillAddFamilyForm();
            expect($('#add-family-form button.submit').attr('disabled')).toBe('disabled');
        });

        it('should show ebird-code tr in bird mode and hide in insect mode', () => {
            // Bird mode - should show
            AdminRendering.fillAddFamilyForm();
            expect($('#add-family-form input[data-field="ebird-code"]').closest('tr').css('display')).not.toBe('none');
        });
    });

    // ========================
    // renderSightingsTable — expanded
    // ========================
    describe('renderSightingsTable', () => {
        it('should render header row plus sighting rows', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            // 1 header + 2 sighting rows
            expect($('#sightings-table tr').length).toBe(3);
        });

        it('should render sighting keys', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            expect($('#sightings-table').html()).toContain('sight1');
            expect($('#sightings-table').html()).toContain('sight2');
        });

        it('should render media thumbnails for images', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('.jpg');
            expect(html).toContain('thumbnail');
        });

        it('should render video media with .mp4 label and video thumbnail', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('.mp4');
        });

        it('should render camera/lens selects with camera_model data', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('camera-model-select');
            expect(html).toContain('S7RV');
            expect(html).toContain('200600');
        });

        it('should render title textbox for media', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('title-textbox');
            expect(html).toContain('Pretty');
        });

        it('should render description textarea', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('Nice bird');
        });

        it('should render unconfirmed checkbox checked when sighting is unconfirmed', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('unconfirmed-checkbox');
        });

        it('should render hide checkbox unchecked when sighting is visible', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const html = $('#sightings-table').html();
            expect(html).toContain('hide-checkbox');
        });

        it('should disable move-up for first item and move-down for last', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            // First item: move-up should be disabled
            const firstRow = $('#sight1');
            expect(firstRow.find('.move-up').attr('disabled')).toBeDefined();
            // Last item: move-down should be disabled
            const lastRow = $('#sight2');
            expect(lastRow.find('.move-down').attr('disabled')).toBeDefined();
        });

        it('should disable move-media-left for first media', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            const firstMediaMoveLeft = $('#sight1 .move-media-left').first();
            expect(firstMediaMoveLeft.attr('disabled')).toBeDefined();
        });

        it('should render upload button for each sighting', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            expect($('#sight1 .upload-button').length).toBe(1);
            expect($('#sight2 .upload-button').length).toBe(1);
        });

        it('should apply pagination (offset/rows)', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 1);

            // Only 1 sighting row + header
            expect($('#sightings-table tr').length).toBe(2);
            expect($('#sightings-table').html()).toContain('sight1');
            expect($('#sightings-table').html()).not.toContain('sight2');
        });

        it('should skip sightings that do not match filter', () => {
            AdminData.sightingMatches.mockImplementation((s) => s.key === 'sight1');
            AdminRendering.renderSightingsTable(0, 10);

            expect($('#sightings-table tr').length).toBe(2); // header + sight1
            expect($('#sightings-table').html()).toContain('sight1');
            expect($('#sightings-table').html()).not.toContain('sight2');
        });

        it('should render author field', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);
            expect($('#sightings-table').html()).toContain('Tester');
        });

        it('should render move buttons (up, down, upx5, downx5)', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            expect($('#sight1 .move-up').length).toBe(1);
            expect($('#sight1 .move-down').length).toBe(1);
            expect($('#sight1 .move-upx5').length).toBe(1);
            expect($('#sight1 .move-downx5').length).toBe(1);
        });

        it('should render delete-sighting button', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            expect($('#sight1 .delete-sighting').length).toBe(1);
        });

        it('should render delete-media button for each media', () => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            expect($('#sight1 .delete-media').length).toBe(2); // 2 media items
        });

        it('should handle empty camera_model data', () => {
            AdminData.data.camera_model = null;
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);

            // Should still render without errors
            expect($('#sightings-table tr').length).toBe(3);
        });
    });

    // ========================
    // setupUpdateSpeciesForm
    // ========================
    describe('setupUpdateSpeciesForm', () => {
        it('should populate key and family selects from data', () => {
            AdminRendering.setupUpdateSpeciesForm();

            const keyOptions = $('#update-species-form select[data-field="key"] option');
            const familyOptions = $('#update-species-form select[data-field="family"] option');

            // key: 1 blank option + 2 species keys
            expect(keyOptions.length).toBe(3);
            // family: 1 blank + 2 families
            expect(familyOptions.length).toBe(3);
        });

        it('should show ebird-code field in bird mode', () => {
            AdminRendering.setupUpdateSpeciesForm();
            expect($('#update-species-form input[data-field="ebird-code"]').closest('tr').css('display')).not.toBe('none');
        });

        it('should initialize select2 on key and family selects', () => {
            AdminRendering.setupUpdateSpeciesForm();
            expect($.fn.select2).toHaveBeenCalled();
        });

        it('should bind change event on key select', () => {
            AdminRendering.setupUpdateSpeciesForm();

            // Change key to s2
            $('#update-species-form select[data-field="key"]').val('s2').trigger('change');
            expect($('#update-species-form input[data-field="name"]').val()).toBe('House Sparrow');
        });

        it('should fill tags from species name when name changes and tags is empty', () => {
            AdminRendering.setupUpdateSpeciesForm();

            // Clear tags, set name
            $('#update-species-form input[data-field="tags"]').val('');
            $('#update-species-form input[data-field="name"]').val('Great Tit').trigger('change');

            expect($('#update-species-form input[data-field="tags"]').val()).toBe('Tit');
        });

        it('should not overwrite existing tags when name changes', () => {
            AdminRendering.setupUpdateSpeciesForm();

            $('#update-species-form input[data-field="tags"]').val('existing-tag');
            $('#update-species-form input[data-field="name"]').val('Great Tit').trigger('change');

            expect($('#update-species-form input[data-field="tags"]').val()).toBe('existing-tag');
        });

        it('should not trigger tag update when name is empty', () => {
            AdminRendering.setupUpdateSpeciesForm();

            $('#update-species-form input[data-field="tags"]').val('');
            $('#update-species-form input[data-field="name"]').val('').trigger('change');

            expect($('#update-species-form input[data-field="tags"]').val()).toBe('');
        });

        it('should lowercase latin name on change', () => {
            AdminRendering.setupUpdateSpeciesForm();

            $('#update-species-form input[data-field="latin-name"]').val('Columba Livia').trigger('change');
            expect($('#update-species-form input[data-field="latin-name"]').val()).toBe('columba livia');
        });

        it('should trim latin name on change', () => {
            AdminRendering.setupUpdateSpeciesForm();

            $('#update-species-form input[data-field="latin-name"]').val('  passer domesticus  ').trigger('change');
            expect($('#update-species-form input[data-field="latin-name"]').val()).toBe('passer domesticus');
        });
    });

    // ========================
    // setupAddFamilyForm
    // ========================
    describe('setupAddFamilyForm', () => {
        it('should show add-family-section', () => {
            AdminRendering.setupAddFamilyForm();
            expect($('#add-family-section').css('display')).not.toBe('none');
        });

        it('should populate family select with families', () => {
            AdminRendering.setupAddFamilyForm();

            const options = $('#add-family-form select[data-field="name"] option');
            // "- New Family -" + 2 families
            expect(options.length).toBe(3);
            expect(options.eq(0).text()).toBe('- New Family -');
            expect(options.eq(1).text()).toBe('Columbidae');
            expect(options.eq(2).text()).toBe('Passeridae');
        });

        it('should initialize select2 on family select with tags', () => {
            AdminRendering.setupAddFamilyForm();
            expect($.fn.select2).toHaveBeenCalledWith(
                expect.objectContaining({ tags: true, placeholder: expect.any(String) })
            );
        });

        it('should bind change event and call fillAddFamilyForm', () => {
            AdminRendering.setupAddFamilyForm();

            // Trigger change to Passeridae
            $('#add-family-form select[data-field="name"]').val('Passeridae').trigger('change');
            expect($('#add-family-form input[data-field="sci-name"]').val()).toBe('Passeridae');
        });

        it('should call addFamily on submit click', () => {
            AdminRendering.setupAddFamilyForm();
            AdminData.addFamily.mockClear();

            $('#add-family-form select[data-field="name"]').val('Columbidae');
            $('#add-family-form button.submit').trigger('click');
            expect(AdminData.addFamily).toHaveBeenCalledWith('Columbidae', expect.any(String), expect.any(String));
        });

        it('should not call addFamily when name is empty', () => {
            AdminRendering.setupAddFamilyForm();
            AdminData.addFamily.mockClear();

            $('#add-family-form select[data-field="name"]').val('');
            $('#add-family-form button.submit').trigger('click');
            expect(AdminData.addFamily).not.toHaveBeenCalled();
        });

        it('should add a new option to both family selects when submitting new family', () => {
            AdminRendering.setupAddFamilyForm();

            // Manually add a new option to simulate typing a new family name
            $('#add-family-form select[data-field="name"]').append('<option value="NewBirds">NewBirds</option>');
            $('#add-family-form select[data-field="name"]').val('NewBirds');
            $('#add-family-form button.submit').trigger('click');

            expect(AdminData.addFamily).toHaveBeenCalledWith('NewBirds', expect.any(String), expect.any(String));
        });

        it('should handle delete click', () => {
            AdminRendering.setupAddFamilyForm();
            AdminData.deleteFamily.mockClear();

            // Select a family and click delete
            $('#add-family-form select[data-field="name"]').val('Columbidae');

            // Mock deleteFamily to actually remove from data.families
            AdminData.deleteFamily.mockImplementation((name) => {
                AdminData.data.families = AdminData.data.families.filter(f => f.name !== name);
            });

            $('#add-family-form button.delete').trigger('click');

            expect(AdminData.deleteFamily).toHaveBeenCalledWith('Columbidae');
            // After successful delete, the option should be removed
            expect($('#add-family-form select[data-field="name"] option[value="Columbidae"]').length).toBe(0);
        });

        it('should not call deleteFamily when name is empty', () => {
            AdminRendering.setupAddFamilyForm();
            AdminData.deleteFamily.mockClear();

            $('#add-family-form select[data-field="name"]').val('');
            $('#add-family-form button.delete').trigger('click');
            expect(AdminData.deleteFamily).not.toHaveBeenCalled();
        });

        it('should not remove option if delete did not reduce count', () => {
            AdminRendering.setupAddFamilyForm();
            AdminData.deleteFamily.mockClear();

            // deleteFamily doesn't actually remove (e.g., confirm was cancelled)
            AdminData.deleteFamily.mockImplementation(() => {});

            $('#add-family-form select[data-field="name"]').val('Columbidae');
            $('#add-family-form button.delete').trigger('click');

            // Option should still be there
            expect($('#add-family-form select[data-field="name"] option[value="Columbidae"]').length).toBe(1);
        });

        it('should destroy existing select2 before re-initializing', () => {
            // First setup
            AdminRendering.setupAddFamilyForm();

            // Add select2-hidden-accessible class to simulate select2 being active
            $('#add-family-form select[data-field="name"]').addClass('select2-hidden-accessible');

            // Second setup should not throw
            AdminRendering.setupAddFamilyForm();
            // select2('destroy') should have been called
            expect($.fn.select2).toHaveBeenCalledWith('destroy');
        });
    });

    // ========================
    // Sightings Table Event Handlers (readonly read of interactions)
    // ========================
    describe('renderSightingsTable event handlers', () => {
        beforeEach(() => {
            AdminData.sightingMatches.mockReturnValue(true);
            AdminRendering.renderSightingsTable(0, 10);
        });

        it('should call deleteSighting when delete button is clicked', () => {
            AdminData.deleteSighting.mockClear();
            $('#sight1 .delete-sighting').trigger('click');
            expect(AdminData.deleteSighting).toHaveBeenCalledWith('sight1');
        });

        it('should call moveSighting(-1) for move-up', () => {
            AdminData.moveSighting.mockClear();
            $('#sight1 .move-up').trigger('click');
            expect(AdminData.moveSighting).toHaveBeenCalledWith('sight1', -1);
        });

        it('should call moveSighting(1) for move-down', () => {
            AdminData.moveSighting.mockClear();
            $('#sight1 .move-down').trigger('click');
            expect(AdminData.moveSighting).toHaveBeenCalledWith('sight1', 1);
        });

        it('should call moveSighting(-5) for move-upx5', () => {
            AdminData.moveSighting.mockClear();
            $('#sight1 .move-upx5').trigger('click');
            expect(AdminData.moveSighting).toHaveBeenCalledWith('sight1', -5);
        });

        it('should call moveSighting(5) for move-downx5', () => {
            AdminData.moveSighting.mockClear();
            $('#sight1 .move-downx5').trigger('click');
            expect(AdminData.moveSighting).toHaveBeenCalledWith('sight1', 5);
        });

        it('should call deleteMedia for delete-media button', () => {
            AdminData.deleteMedia.mockClear();
            $('#sight1 .delete-media').first().trigger('click');
            expect(AdminData.deleteMedia).toHaveBeenCalledWith('sight1', 'images/s1-123.jpg');
        });

        it('should call moveMediaLeft for move-media-left button', () => {
            AdminData.moveMediaLeft.mockClear();
            // The second media's move-left button (first one is disabled)
            $('#sight1 .move-media-left').eq(1).trigger('click');
            expect(AdminData.moveMediaLeft).toHaveBeenCalledWith('sight1', 'videos/s1-456.mp4');
        });

        it('should call updateField when a field input changes', () => {
            AdminData.updateField.mockClear();
            $('#sight1 input[data-field="city"]').val('Brooklyn').trigger('change');
            expect(AdminData.updateField).toHaveBeenCalledWith('sight1', 'city', 'Brooklyn');
        });

        it('should call updateField for description textarea', () => {
            AdminData.updateField.mockClear();
            $('#sight1 textarea[data-field="description"]').val('Updated desc').trigger('change');
            expect(AdminData.updateField).toHaveBeenCalledWith('sight1', 'description', 'Updated desc');
        });

        it('should call updateMediaProperty for title textbox change', () => {
            AdminData.updateMediaProperty.mockClear();
            $('#sight1 .title-textbox').first().val('New Title').trigger('change');
            expect(AdminData.updateMediaProperty).toHaveBeenCalledWith('sight1', 'images/s1-123.jpg', 'title', 'New Title');
        });

        it('should call updateMediaProperty for camera-model select change', () => {
            AdminData.updateMediaProperty.mockClear();
            const camSelect = $('#sight1 .camera-model-select[data-part="0"]').first();
            camSelect.val('S7RV').trigger('change');
            expect(AdminData.updateMediaProperty).toHaveBeenCalledWith(
                'sight1', 'images/s1-123.jpg', 'exif_data.camera_model', expect.any(String)
            );
        });

        it('should trigger upload input when upload-button is clicked', () => {
            const clickSpy = vi.fn();
            $('#sight1 .upload').on('click', clickSpy);
            $('#sight1 .upload-button').trigger('click');
            expect(clickSpy).toHaveBeenCalled();
        });
    });
});
