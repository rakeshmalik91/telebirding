import { describe, it, expect, beforeEach, vi } from 'vitest';
import $ from 'jquery';

vi.mock('../../scripts/modules/admin/data.js', () => {
    const mockData = {
        families: [
            { name: 'Accipitridae', sci_name: 'Accipitridae', ebird_code: 'accipi1' },
            { name: 'Passeridae', sci_name: 'Passeridae', ebird_code: 'passer1' }
        ],
        species: {
            'crested-serpent-eagle': {
                key: 'crested-serpent-eagle',
                name: 'Crested Serpent-Eagle',
                family: 'Accipitridae',
                latin_name: 'spilornis cheela',
                ebird_code: 'crseag1',
                tags: ['Eagle', 'Raptor']
            },
            'house-sparrow': {
                key: 'house-sparrow',
                name: 'House Sparrow',
                family: 'Passeridae',
                latin_name: 'passer domesticus',
                ebird_code: 'houspa',
                tags: ['Sparrow']
            },
            'unassigned-bird': {
                key: 'unassigned-bird',
                name: 'Mysterious Bird',
                family: '',
                latin_name: 'incertae sedis',
                tags: ['Unknown']
            }
        },
        sightings: [
            { species: 'crested-serpent-eagle' },
            { species: 'crested-serpent-eagle' },
            { species: 'house-sparrow' }
        ]
    };
    return {
        data: mockData,
        currentMode: 'bird',
        saveSpecies: vi.fn(),
        deleteSpecies: vi.fn(),
        renameFamily: vi.fn().mockReturnValue(true),
        deleteFamily: vi.fn()
    };
});

vi.mock('../../scripts/modules/admin/ui.js', () => ({
    customAlert: vi.fn(),
    customConfirm: vi.fn((msg, cb) => cb()),
    showToast: vi.fn()
}));

describe('Species Hierarchy & Subtabs Module', () => {
    let SpeciesHierarchy;
    let AdminData;

    beforeEach(async () => {
        document.body.innerHTML = `
            <div id="species-tab" class="admin-tab-content active">
                <div class="admin-card species-card">
                    <div class="spreadsheet-toolbar">
                        <div class="spreadsheet-sheet-tabs species-subnav-tabs">
                            <button type="button" class="spreadsheet-sheet-tab species-subtab-btn active" data-subtab="add-species-family">Add Species/Family</button>
                            <button type="button" class="spreadsheet-sheet-tab species-subtab-btn" data-subtab="hierarchical-view">Hierarchical View</button>
                            <button type="button" class="spreadsheet-sheet-tab species-subtab-btn" data-subtab="ebird-sync">eBird Sync</button>
                        </div>
                    </div>
                    <div id="species-forms-wrapper">
                        <div class="species-form-card">
                            <div id="update-species-form">
                                <select data-field="name"></select>
                                <select data-field="family"></select>
                                <input data-field="display-name" />
                            </div>
                        </div>
                        <div id="add-family-section" class="species-form-card" style="display:none;">
                            <table id="add-family-form">
                                <select data-field="name"></select>
                                <input data-field="display-name" />
                            </table>
                        </div>
                    </div>
                    <div id="species-hierarchical-section" style="display: none;"></div>
                    <div id="ebird-sync-card" class="species-form-card" style="display:none;"></div>
                </div>
            </div>
        `;

        vi.clearAllMocks();
        SpeciesHierarchy = await import('../../scripts/modules/admin/species-hierarchy.js');
        AdminData = await import('../../scripts/modules/admin/data.js');
        AdminData.data.families = [
            { name: 'Accipitridae', sci_name: 'Accipitridae', ebird_code: 'accipi1' },
            { name: 'Passeridae', sci_name: 'Passeridae', ebird_code: 'passer1' }
        ];
        SpeciesHierarchy._resetState();
    });

    describe('setupSpeciesSubtabs', () => {
        it('should show forms and hide hierarchical section on add-species-family subtab', () => {
            SpeciesHierarchy.setupSpeciesSubtabs('add-species-family');

            expect($('.species-subtab-btn[data-subtab="add-species-family"]').hasClass('active')).toBe(true);
            expect($('#species-forms-wrapper').css('display')).not.toBe('none');
            expect($('#species-hierarchical-section').css('display')).toBe('none');
            expect($('#ebird-sync-card').css('display')).toBe('none');
        });

        it('should hide forms on hierarchical-view subtab', () => {
            SpeciesHierarchy.setupSpeciesSubtabs('hierarchical-view');

            expect($('.species-subtab-btn[data-subtab="hierarchical-view"]').hasClass('active')).toBe(true);
            expect($('#species-forms-wrapper').css('display')).toBe('none');
            expect($('#species-hierarchical-section').css('display')).not.toBe('none');
            expect($('#ebird-sync-card').css('display')).toBe('none');
        });

        it('should show ebird-sync-card and hide others on ebird-sync subtab in bird mode', () => {
            SpeciesHierarchy.setupSpeciesSubtabs('ebird-sync');

            expect($('.species-subtab-btn[data-subtab="ebird-sync"]').hasClass('active')).toBe(true);
            expect($('#species-forms-wrapper').css('display')).toBe('none');
            expect($('#species-hierarchical-section').css('display')).toBe('none');
            expect($('#ebird-sync-card').css('display')).not.toBe('none');
        });

        it('should switch subtabs when subtab button is clicked', () => {
            SpeciesHierarchy.setupSpeciesSubtabs('add-species-family');

            $('.species-subtab-btn[data-subtab="hierarchical-view"]').click();
            expect($('#species-forms-wrapper').css('display')).toBe('none');
            expect($('#species-hierarchical-section').css('display')).not.toBe('none');
        });
    });

    describe('renderSpeciesHierarchy', () => {
        it('should render family rows and nested species rows', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            expect($('.family-row').length).toBe(3); // Accipitridae, Passeridae, Unassigned
            expect($('.species-row').length).toBe(3); // Crested Serpent-Eagle, House Sparrow, Mysterious Bird

            expect($('#species-hierarchical-section').text()).toContain('Accipitridae');
            expect($('#species-hierarchical-section').text()).toContain('Passeridae');
            expect($('#species-hierarchical-section').text()).toContain('Crested Serpent-Eagle');
            expect($('#species-hierarchical-section').text()).toContain('House Sparrow');
        });

        it('should display correct sightings counts', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            // Crested Serpent-Eagle has 2 sightings
            const spBtn = $('.btn-view-sightings-badge[data-species="crested-serpent-eagle"]');
            expect(spBtn.text().trim()).toBe('2');

            // House Sparrow has 1 sighting
            const sparrowBtn = $('.btn-view-sightings-badge[data-species="house-sparrow"]');
            expect(sparrowBtn.text().trim()).toBe('1');
        });

        it('should filter rows by search query', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            $('#species-hierarchy-search').val('sparrow').trigger('input');

            // Should show Passeridae and House Sparrow, but not Accipitridae
            expect($('#species-hierarchical-section').text()).toContain('House Sparrow');
            expect($('#species-hierarchical-section').text()).not.toContain('Crested Serpent-Eagle');
        });

        it('should filter rows by family dropdown', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            $('#species-hierarchy-family-filter').val('Accipitridae').trigger('change');

            expect($('#species-hierarchy-table').text()).toContain('Accipitridae');
            expect($('#species-hierarchy-table').text()).toContain('Crested Serpent-Eagle');
            expect($('#species-hierarchy-table').text()).not.toContain('Passeridae');
            expect($('#species-hierarchy-table').text()).not.toContain('House Sparrow');
        });

        it('should filter rows by tag dropdown', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            $('#species-hierarchy-tag-filter').val('Raptor').trigger('change');

            expect($('#species-hierarchy-table').text()).toContain('Accipitridae');
            expect($('#species-hierarchy-table').text()).toContain('Crested Serpent-Eagle');
            expect($('#species-hierarchy-table').text()).not.toContain('Passeridae');
            expect($('#species-hierarchy-table').text()).not.toContain('House Sparrow');
        });

        it('should render filter textboxes under all data columns and filter by each column', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            const $filterRow = $('#species-hierarchy-table thead tr.hierarchy-filter-row');
            expect($filterRow.find('.hierarchy-col-filter[data-col="name"]').length).toBe(1);
            expect($filterRow.find('.hierarchy-col-filter[data-col="sci"]').length).toBe(1);
            expect($filterRow.find('.hierarchy-col-filter[data-col="ebird"]').length).toBe(1);
            expect($filterRow.find('.hierarchy-col-filter[data-col="tags"]').length).toBe(1);
            expect($filterRow.find('.hierarchy-col-filter[data-col="sightings"]').length).toBe(1);

            // Filter by Scientific Name column
            $filterRow.find('.hierarchy-col-filter[data-col="sci"]').val('domesticus').trigger('input');
            expect($('#species-hierarchy-table tbody').text()).toContain('House Sparrow');
            expect($('#species-hierarchy-table tbody').text()).not.toContain('Crested Serpent-Eagle');

            // Clear and filter by eBird Code column
            $filterRow.find('.hierarchy-col-filter[data-col="sci"]').val('').trigger('input');
            $filterRow.find('.hierarchy-col-filter[data-col="ebird"]').val('crseag1').trigger('input');
            expect($('#species-hierarchy-table tbody').text()).toContain('Crested Serpent-Eagle');
            expect($('#species-hierarchy-table tbody').text()).not.toContain('House Sparrow');

            // Clear and filter by Sightings column expression
            $filterRow.find('.hierarchy-col-filter[data-col="ebird"]').val('').trigger('input');
            $filterRow.find('.hierarchy-col-filter[data-col="sightings"]').val('>=2').trigger('input');
            expect($('#species-hierarchy-table tbody').text()).toContain('Crested Serpent-Eagle');
            expect($('#species-hierarchy-table tbody').text()).not.toContain('House Sparrow');
        });

        it('should toggle family collapse and expand on family row click', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            const initialSpeciesCount = $('.species-row').length;
            expect(initialSpeciesCount).toBe(3);

            // Click Accipitridae row to collapse
            $('.family-row[data-family="Accipitridae"]').click();

            // Species in Accipitridae should now be hidden
            expect($('#species-hierarchical-section').text()).not.toContain('Crested Serpent-Eagle');
            expect($('#species-hierarchical-section').text()).toContain('House Sparrow');

            // Click again to expand
            $('.family-row[data-family="Accipitridae"]').click();
            expect($('#species-hierarchical-section').text()).toContain('Crested Serpent-Eagle');
        });

        it('should handle expand all and collapse all buttons', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            $('#species-hierarchy-collapse-all').click();
            expect($('.species-row').length).toBe(0);

            $('#species-hierarchy-expand-all').click();
            expect($('.species-row').length).toBe(3);
        });

        it('should enter inline edit mode for family and call renameFamily', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            $('.btn-edit-fam-inline[data-name="Passeridae"]').click();
            expect($('.inline-edit-fam-name').val()).toBe('Passeridae');

            $('.inline-edit-fam-name').val('Passeridae New');
            $('.btn-save-fam-inline').click();

            expect(AdminData.renameFamily).toHaveBeenCalledWith(
                'Passeridae',
                'Passeridae New',
                'passer1',
                'Passeridae'
            );
        });

        it('should enter inline edit mode for species and call saveSpecies', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            $('.btn-edit-sp-inline[data-key="house-sparrow"]').click();
            expect($('.inline-edit-sp-name').val()).toBe('House Sparrow');

            $('.inline-edit-sp-name').val('Eurasian Tree Sparrow');
            $('.btn-save-sp-inline').click();

            expect(AdminData.saveSpecies).toHaveBeenCalledWith(
                'house-sparrow',
                'Eurasian Tree Sparrow',
                'Sparrow',
                'Passeridae',
                'passer domesticus',
                'houspa'
            );
        });

        it('should call deleteFamily when clicking delete button on family without species', () => {
            // Add empty family
            AdminData.data.families.push({ name: 'EmptyFamily' });
            SpeciesHierarchy.renderSpeciesHierarchy();

            $(`.btn-delete-fam[data-name="EmptyFamily"]`).click();
            expect(AdminData.deleteFamily).toHaveBeenCalledWith('EmptyFamily', expect.any(Function));
        });

        it('should call deleteSpecies when clicking delete button on species without sightings', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();

            // Mysterious Bird has 0 sightings
            $(`.btn-delete-sp[data-key="unassigned-bird"]`).click();
            expect(AdminData.deleteSpecies).toHaveBeenCalledWith('unassigned-bird', expect.any(Function));
        });

        it('should reflect added or updated species when form data changes and render is called', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();
            expect($('#species-hierarchical-section').text()).not.toContain('Peregrine Falcon');

            // Add new species
            AdminData.data.species['peregrine-falcon'] = {
                key: 'peregrine-falcon',
                name: 'Peregrine Falcon',
                family: 'Accipitridae',
                latin_name: 'falco peregrinus',
                ebird_code: 'perfal',
                tags: ['Falcon', 'Raptor']
            };
            AdminData.data.lastUpdatedSpecies = 'peregrine-falcon';

            SpeciesHierarchy.renderSpeciesHierarchy();
            expect($('#species-hierarchical-section').text()).toContain('Peregrine Falcon');
            expect($('#species-hierarchical-section').text()).toContain('falco peregrinus');

            // Update species name
            AdminData.data.species['peregrine-falcon'].name = 'Peregrine Falcon (Updated)';
            SpeciesHierarchy.renderSpeciesHierarchy();
            expect($('#species-hierarchical-section').text()).toContain('Peregrine Falcon (Updated)');
        });

        it('should reflect added and deleted families when render is called', () => {
            SpeciesHierarchy.renderSpeciesHierarchy();
            expect($('#species-hierarchical-section').text()).not.toContain('Falconidae');

            // Add new family
            AdminData.data.families.push({ name: 'Falconidae', sci_name: 'Falconidae', ebird_code: 'falcon1' });
            SpeciesHierarchy.renderSpeciesHierarchy();
            expect($('#species-hierarchical-section').text()).toContain('Falconidae');

            // Delete family
            AdminData.data.families = AdminData.data.families.filter(f => f.name !== 'Falconidae');
            SpeciesHierarchy.renderSpeciesHierarchy();
            expect($('#species-hierarchical-section').text()).not.toContain('Falconidae');
        });

        it('should auto-render hierarchy table when switching to hierarchical-view subtab', () => {
            SpeciesHierarchy.setupSpeciesSubtabs('add-species-family');
            expect($('#species-hierarchical-section').css('display')).toBe('none');

            // Add a new species while on the form subtab
            AdminData.data.species['golden-eagle'] = {
                key: 'golden-eagle',
                name: 'Golden Eagle',
                family: 'Accipitridae',
                latin_name: 'aquila chrysaetos',
                tags: ['Eagle']
            };
            AdminData.data.lastUpdatedSpecies = 'golden-eagle';

            // User switches to hierarchical view subtab
            SpeciesHierarchy.setupSpeciesSubtabs('hierarchical-view');
            expect($('#species-hierarchical-section').css('display')).not.toBe('none');
            expect($('#species-hierarchical-section').text()).toContain('Golden Eagle');
        });

        it('should update hierarchy table and auto-expand affected families after eBird sync changes', () => {
            SpeciesHierarchy.setupSpeciesSubtabs('hierarchical-view');

            AdminData.data.families.push({
                name: 'Columbidae',
                sci_name: 'Columbidae',
                ebird_code: 'columb1'
            });
            AdminData.data.species['rock-pigeon'] = {
                key: 'rock-pigeon',
                name: 'Rock Dove',
                family: 'Columbidae',
                latin_name: 'columba livia',
                ebird_code: 'rocpig'
            };

            SpeciesHierarchy.autoExpandFamilies(['Columbidae']);
            SpeciesHierarchy.renderSpeciesHierarchy();

            const $table = $('#species-hierarchical-section');
            expect($table.text()).toContain('Columbidae');
            expect($table.text()).toContain('Rock Dove');
            expect($table.find('tr.family-row[data-family="Columbidae"] a[href*="ebird.org"]').length).toBe(0);
            expect($table.find('tr.family-row[data-family="Columbidae"] a[href="https://www.google.com/search?q=Columbidae"]').length).toBe(1);
            expect($table.find('tr.species-row[data-key="rock-pigeon"] a[href*="google.com/search"]').attr('href')).toBe('https://www.google.com/search?q=columba%20livia');
            expect($table.find('tr.species-row[data-key="rock-pigeon"] a[href="https://ebird.org/species/rocpig"]').length).toBe(1);
            expect(SpeciesHierarchy._getExpandedFamilies().has('Columbidae')).toBe(true);
        });
    });
});
