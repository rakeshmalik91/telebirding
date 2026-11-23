import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StoriesAdmin from '../../scripts/modules/admin/stories.js';
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

describe('Admin Stories Module', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="stories-tab" class="admin-tab-content"></div>
            <div id="media-popup" style="display:none;">
                <img id="media-popup-img" />
                <video id="media-popup-video"></video>
            </div>
        `;

        AdminData.data.stories = [
            {
                title: 'Andaman & Nicobar',
                date: 'March 2026',
                youtubeVideoId: 'video123',
                storyHtml: '<p>Great trip to Andaman</p>',
                itinerary: [
                    { date: '01/03/2026', activity: 'Arrive at Port Blair' },
                    { date: '02/03/2026', activity: 'Birding at Chidiyatapu' }
                ],
                sightings: [
                    { text: 'Andaman Sightings', params: { place: 'Andaman', date: '2026' } }
                ],
                images: ['images/andaman1.jpg']
            },
            {
                title: 'Rajasthan Desert',
                date: 'May 2025',
                youtubeVideoId: 'video456',
                storyHtml: '<p>Desert trip</p>',
                itinerary: [],
                sightings: [],
                images: []
            }
        ];

        vi.clearAllMocks();
    });

    it('renders stories spreadsheet table with existing stories', () => {
        StoriesAdmin.setupStoriesTab();
        expect($('#stories-main-table').length).toBe(1);
        expect($('.story-main-row').length).toBe(2);
        expect($('input[data-field="title"]').first().val()).toBe('Andaman & Nicobar');
    });

    it('adds, edits, moves, and deletes stories', () => {
        StoriesAdmin.setupStoriesTab();

        // Edit title
        const $title = $('tr[data-index="0"] input[data-field="title"]');
        $title.val('Andaman & Nicobar Endemics').trigger('input');
        expect(AdminData.data.stories[0].title).toBe('Andaman & Nicobar Endemics');

        // Move down
        $('tr[data-index="0"] .move-story-down').trigger('click');
        expect(AdminData.data.stories[0].title).toBe('Rajasthan Desert');
        expect(AdminData.data.stories[1].title).toBe('Andaman & Nicobar Endemics');

        // Add story
        $('#add-story-btn').trigger('click');
        expect(AdminData.data.stories.length).toBe(3);
        expect(AdminData.data.stories[0].title).toBe('New Story');

        // Delete story
        $('tr[data-index="0"] .delete-story-btn').trigger('click');
        expect(AdminData.data.stories.length).toBe(2);
    });

    it('updates YouTube watch link dynamically and supports drag reordering', () => {
        StoriesAdmin.setupStoriesTab();

        const $row0 = $('tr[data-index="0"]');
        const $ytLink = $row0.find('.open-yt-link');
        expect($ytLink.length).toBe(1);
        expect($ytLink.attr('href')).toContain('video123');

        // Update YouTube video ID
        $row0.find('input[data-field="youtubeVideoId"]').val('updated_vid_999').trigger('input');
        expect(AdminData.data.stories[0].youtubeVideoId).toBe('updated_vid_999');
        expect($ytLink.attr('href')).toBe('https://www.youtube.com/watch?v=updated_vid_999');

        // Check drag handles exist
        expect($('.story-drag-handle').length).toBe(2);
        expect($('.story-drag-handle[draggable="true"]').length).toBe(2);

        // Move story 0 after story 1
        StoriesAdmin.moveStoryItem(0, 1, true);
        expect(AdminData.data.stories[0].title).toBe('Rajasthan Desert');
        expect(AdminData.data.stories[1].title).toBe('Andaman & Nicobar');

        // Simulate DOM drop event on target row
        const dropEvent = $.Event('drop');
        dropEvent.originalEvent = {
            dataTransfer: {
                getData: () => '1'
            },
            preventDefault: () => {},
            clientY: 10
        };
        const targetRow = $('tr[data-index="0"]')[0];
        targetRow.getBoundingClientRect = () => ({ y: 0, height: 100 });
        $('tr[data-index="0"]').trigger(dropEvent);

        expect(AdminData.data.stories[0].title).toBe('Andaman & Nicobar');
        expect(AdminData.data.stories[1].title).toBe('Rajasthan Desert');

        // Simulate drop onto sub-table-row
        $('.toggle-sub-btn[data-sub="itinerary"]').first().trigger('click');
        expect($('.sub-table-row').length).toBe(1);

        const dropSubEvent = $.Event('drop');
        dropSubEvent.originalEvent = {
            dataTransfer: {
                getData: () => '1'
            },
            preventDefault: () => {},
            clientY: 150
        };
        $('.sub-table-row').trigger(dropSubEvent);
        expect(AdminData.data.stories[1].title).toBe('Rajasthan Desert');
    });

    it('manages itineraryExpanded flag in stories table and itinerary sub-table', () => {
        StoriesAdmin.setupStoriesTab();

        // Story 0 itineraryExpanded toggle in main row
        const $itinOpenCheckbox = $('tr[data-index="0"] input[data-field="itineraryExpanded"]');
        expect($itinOpenCheckbox.length).toBe(1);
        expect($itinOpenCheckbox.is(':checked')).toBe(false);

        $itinOpenCheckbox.prop('checked', true).trigger('change');
        expect(AdminData.data.stories[0].itineraryExpanded).toBe(true);

        // Expand itinerary sub-table
        $('.toggle-sub-btn[data-sub="itinerary"]').first().trigger('click');
        const $subCheckbox = $('.sub-itin-expanded-checkbox');
        expect($subCheckbox.length).toBe(1);
        expect($subCheckbox.is(':checked')).toBe(true);

        // Toggle via sub-table checkbox
        $subCheckbox.prop('checked', false).trigger('change');
        expect(AdminData.data.stories[0].itineraryExpanded).toBe(false);
        expect($('tr[data-index="0"] input[data-field="itineraryExpanded"]').is(':checked')).toBe(false);

        // Itinerary drag handle reordering
        expect($('.itin-drag-handle').length).toBe(2);
        StoriesAdmin.moveItineraryDay(0, 0, 1, true);
        expect(AdminData.data.stories[0].itinerary[0].activity).toBe('Birding at Chidiyatapu');
        expect(AdminData.data.stories[0].itinerary[1].activity).toBe('Arrive at Port Blair');
    });

    it('expands itinerary sub-table and allows adding/editing/deleting days', () => {
        StoriesAdmin.setupStoriesTab();

        // Expand itinerary on story 0
        $('.toggle-sub-btn[data-sub="itinerary"]').first().trigger('click');
        expect($('.sub-table-row').length).toBe(1);
        expect($('.itin-field').length).toBeGreaterThan(0);

        // Edit activity
        const $activity = $('.itin-field[data-field="activity"]').first();
        $activity.val('Updated flight arrival').trigger('input');
        expect(AdminData.data.stories[0].itinerary[0].activity).toBe('Updated flight arrival');

        // Add day
        $('.add-itinerary-btn').trigger('click');
        expect(AdminData.data.stories[0].itinerary.length).toBe(3);

        // Delete day
        $('.delete-itin-btn').last().trigger('click');
        expect(AdminData.data.stories[0].itinerary.length).toBe(2);
    });

    it('expands sightings sub-table and allows adding/editing/deleting links', () => {
        StoriesAdmin.setupStoriesTab();

        // Expand sightings
        $('.toggle-sub-btn[data-sub="sightings"]').first().trigger('click');
        expect($('.sub-table-row').length).toBe(1);
        expect($('.sighting-link-field').length).toBe(3);

        // Edit text
        $('.sighting-link-field[data-field="text"]').first().val('All Sightings').trigger('input');
        expect(AdminData.data.stories[0].sightings[0].text).toBe('All Sightings');

        // Add link
        $('.add-sighting-link-btn').trigger('click');
        expect(AdminData.data.stories[0].sightings.length).toBe(2);

        // Delete link
        $('.delete-sighting-link-btn').last().trigger('click');
        expect(AdminData.data.stories[0].sightings.length).toBe(1);
    });

    it('expands images sub-table and allows adding/editing/deleting photos', () => {
        StoriesAdmin.setupStoriesTab();

        // Expand images
        $('.toggle-sub-btn[data-sub="images"]').first().trigger('click');
        expect($('.sub-table-row').length).toBe(1);

        // Add image
        $('.add-story-image-btn').trigger('click');
        expect(AdminData.data.stories[0].images.length).toBe(2);

        // Edit image
        $('.story-img-field').last().val('images/andaman2.jpg').trigger('input');
        expect(AdminData.data.stories[0].images[1]).toBe('images/andaman2.jpg');

        // Delete image
        $('.delete-story-img-btn').last().trigger('click');
        expect(AdminData.data.stories[0].images.length).toBe(1);
    });

    it('expands storyHtml editor and updates live preview', () => {
        StoriesAdmin.setupStoriesTab();

        // Expand storyHtml
        $('.toggle-sub-btn[data-sub="storyHtml"]').first().trigger('click');
        expect($('.story-html-source').length).toBe(1);

        // Edit html
        $('.story-html-source').val('<h3>Updated Header</h3><p>Content</p>').trigger('input');
        expect(AdminData.data.stories[0].storyHtml).toContain('Updated Header');
        expect($('.story-html-preview').html()).toContain('Updated Header');
    });

    it('filters stories using the filter input', () => {
        StoriesAdmin.setupStoriesTab();
        $('.stories-filter').val('desert').trigger('input');
        expect($('.story-main-row').length).toBe(1);
        expect($('.story-main-row input[data-field="title"]').val()).toBe('Rajasthan Desert');
    });
});
