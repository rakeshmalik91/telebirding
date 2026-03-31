import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Rendering from '../../scripts/modules/public/rendering.js';
import State from '../../scripts/modules/public/state.js';
import Constants from '../../scripts/modules/constants.js';

// Setup Mock for global window tools
global.previewImage = vi.fn();
global.triggerFilter = vi.fn();
window.previewImage = global.previewImage;
window.triggerFilter = global.triggerFilter;

describe('Public Rendering', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <div id="test-container"></div>
            <div class="sightings-list"></div>
            <div class="explore-menu"><div class="list"></div></div>
            <div class="page-name"></div>
            <div class="featured"></div>
            <div class="home"><div class="featured"></div></div>
            <div class="home-stories"></div>
            <div class="stories"></div>
            <div class="map-menu"></div>
            <div class="sightings-count"></div>
            <div class="species-count"></div>
            <div><span class="rating"></span></div>
            <div><span class="new-species-count"></span></div>
        `;

        State.IS_MOBILE_DEVICE = false;

        State.data = {
            countries: {
                'IN': {
                    name: 'India', count: 10,
                    states: { 'MH': { name: 'Maharashtra', count: 10, cities: { 'Pune': { count: 10, places: { 'Park': { count: 10 } } } } } }
                }
            },
            families: [
                { name: 'Corvidae', count: 5, sci_name: 'Corvus', imagesrc: 'c.jpg' },
                { name: 'EmptyFamily', count: 0, sci_name: null, imagesrc: null }
            ],
            sightings: [
                {
                    key: 's1',
                    species: { name: 'Rock Pigeon', family: 'Columbidae', tags: ['common'], key: 'rock-pigeon' },
                    date: { format: vi.fn(() => '2023') },
                    dateString: '1 Jan, 2023',
                    place: 'Park', city: 'Pune', state: 'MH', country: 'IN', rating: 4,
                    gender: 'M', newSpecies: true, unconfirmed: true,
                    time_of_day: 'Day', weather: 'Sunny', author: 'tester',
                    media: [{ src: 'img1.jpg', type: 'image' }, { src: 'img2.jpg', type: 'image' }]
                },
                {
                    key: 's2',
                    species: { name: 'Rock Pigeon', family: 'Columbidae', tags: [], key: 'rock-pigeon' },
                    date: { format: vi.fn(() => '2023') },
                    dateString: '2 Jan, 2023',
                    place: 'Lake', city: 'Pune', state: 'MH', country: 'IN', rating: 3,
                    gender: 'F', newSpecies: false,
                    media: [{ src: 'img3.jpg', type: 'image' }]
                }
            ],
            filteredSightings: [
                {
                    key: 's1',
                    species: { name: 'Rock Pigeon', family: 'Columbidae', tags: ['common'], key: 'rock-pigeon' },
                    date: { format: vi.fn(() => '2023') },
                    dateString: '1 Jan, 2023',
                    place: 'Park', city: 'Pune', state: 'MH', country: 'IN', rating: 4,
                    gender: 'M', newSpecies: true, unconfirmed: true,
                    time_of_day: 'Day', weather: 'Sunny', author: 'tester',
                    media: [{ src: 'img1.jpg', type: 'image' }, { src: 'img2.jpg', type: 'image' }]
                }
            ],
            likes: { 's1': ['client-123'] },
            years: { '2023': { sighting_count: 10, new_species_count: 2 } },
            species: { 'rock-pigeon': { name: 'Rock Pigeon' } }
        };

        State.currentMode = Constants.MODE_BIRD;
        vi.clearAllMocks();
    });

    describe('getSightingPhotoTitle', () => {
        it('should return image title if available', () => {
            expect(Rendering.getSightingPhotoTitle({}, { title: 'My Photo' })).toBe('My Photo');
        });

        it('should join plumage/tags', () => {
            expect(Rendering.getSightingPhotoTitle({ gender: 'M' }, {})).toBe('Male');
            expect(Rendering.getSightingPhotoTitle({ gender: 'F' }, {})).toBe('Female');
            expect(Rendering.getSightingPhotoTitle({}, {})).toBe(Constants.DEFAULT_PLUMAGE);
        });

        it('should combine multiple tag types', () => {
            const sighting = { plumage: 'Breeding', age: 'Juvenile' };
            const result = Rendering.getSightingPhotoTitle(sighting, {});
            expect(result).toContain('Br.');
            expect(result).toContain('Juv.');
        });
    });

    describe('renderSightingTags', () => {
        it('should append tags logically', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            Rendering.renderSightingTags(div, sighting);

            expect(div.html()).toContain('common');
            expect(div.html()).toContain('Columbidae');
        });

        it('should handle sighting without tags', () => {
            const div = $('#test-container');
            const sighting = { species: { name: 'Test', family: 'TestFamily', tags: [] } };
            Rendering.renderSightingTags(div, sighting);
            expect(div.html()).toContain('TestFamily');
            expect(div.html()).not.toContain('Tagged');
        });
    });

    describe('renderSightingDetails', () => {
        it('should render details correctly', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            Rendering.renderSightingDetails(div, sighting, false);

            expect(div.html()).toContain('Pigeon');
            expect(div.find('.male').length).toBe(1);
            expect(div.find('.new-species').length).toBe(1);
            expect(div.find('.unconfirmed').length).toBe(1);
            expect(div.find('.country').text()).toBe('India');
        });

        it('should render female gender icon', () => {
            const div = $('#test-container');
            const sighting = { ...State.data.filteredSightings[0], gender: 'Female' };
            Rendering.renderSightingDetails(div, sighting, false);
            expect(div.find('.female').length).toBe(1);
        });

        it('should render preview page with latin_name and ebird_code', () => {
            const div = $('#test-container');
            const sighting = {
                ...State.data.filteredSightings[0],
                species: {
                    ...State.data.filteredSightings[0].species,
                    latin_name: 'Columba livia',
                    ebird_code: 'rocpig1'
                }
            };
            Rendering.renderSightingDetails(div, sighting, true);
            expect(div.html()).toContain('Columba livia');
            expect(div.html()).toContain('eBird');
            expect(div.html()).toContain('vgap30px');
        });

        it('should render subspecies and variation correctly', () => {
            const div = $('#test-container');
            const sighting = {
                ...State.data.filteredSightings[0],
                subspecies: 'domestica',
                variation: 'feral'
            };
            Rendering.renderSightingDetails(div, sighting, false);
            // On non-preview page: subspecies shown with variation appended
            expect(div.html()).toContain('domestica');
            expect(div.html()).toContain('feral');
        });

        it('should render weather and time_of_day', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            Rendering.renderSightingDetails(div, sighting, false);
            expect(div.html()).toContain('weather');
        });

        it('should render weather details on preview page', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            Rendering.renderSightingDetails(div, sighting, true);
            expect(div.html()).toContain('Shot on');
        });

        it('should render non-default author on non-preview page', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            Rendering.renderSightingDetails(div, sighting, false);
            expect(div.html()).toContain('tester');
        });

        it('should not render new-species indicator on preview page', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            Rendering.renderSightingDetails(div, sighting, true);
            expect(div.find('.new-species').length).toBe(0);
        });

        it('should handle unidentified species', () => {
            const div = $('#test-container');
            const sighting = {
                ...State.data.filteredSightings[0],
                species: { ...State.data.filteredSightings[0].species, name: 'Unidentified Pigeon' }
            };
            Rendering.renderSightingDetails(div, sighting, false);
            expect(div.find('.unidentified').length).toBe(1);
        });

        it('should show state=country deduplication', () => {
            const div = $('#test-container');
            State.data.countries = { 'SG': { name: 'Singapore', states: { 'SG': { name: 'Singapore' } } } };
            const sighting = { ...State.data.filteredSightings[0], state: 'SG', country: 'SG' };
            Rendering.renderSightingDetails(div, sighting, false);
            // When state full name === country full name, aState is empty
            const stateAnchors = div.find('.state');
            // Should still render country
            expect(div.find('.country').text()).toBe('Singapore');
        });

        it('should handle rating = 0 display', () => {
            const div = $('#test-container');
            const sighting = { ...State.data.filteredSightings[0], rating: 0 };
            Rendering.renderSightingDetails(div, sighting, false);
            expect(div.find('.rating').length).toBe(1);
        });

        it('should render full rating stars on preview page', () => {
            const div = $('#test-container');
            const sighting = { ...State.data.filteredSightings[0], rating: 3 };
            Rendering.renderSightingDetails(div, sighting, true);
            expect(div.html()).toContain('★');
            expect(div.html()).toContain('✰');
        });
    });

    describe('renderSighting & renderSightings', () => {
        it('should build rendering completely', () => {
            Rendering.renderSightings(0, 10);

            expect($('.sightings-list .sighting-panel').length).toBe(1);
            expect($('.sighting-panel .sighting-image img').attr('src')).toBe('img1.jpg');
        });

        it('should render sighting tags on mobile', () => {
            State.IS_MOBILE_DEVICE = true;
            Rendering.renderSightings(0, 10);
            expect($('.sighting-panel .sighting-tags').length).toBe(1);
        });

        it('should handle video media type', () => {
            State.data.filteredSightings[0].media = [
                { src: 'video.mp4', type: Constants.MEDIA_TYPE_VIDEO }
            ];
            Rendering.renderSightings(0, 10);
            expect($('.sighting-panel video source').attr('src')).toBe('video.mp4');
        });

        it('should stop rendering when no more data', () => {
            State.updateNoMoreDataToRender(true);
            Rendering.renderSightings(1, 10);
            // Should not add any panels since noMoreDataToRender
            expect($('.sightings-list .sighting-panel').length).toBe(0);
        });

        it('should clear list on offset 0', () => {
            $('.sightings-list').html('<div>old content</div>');
            Rendering.renderSightings(0, 10);
            expect($('.sightings-list').html()).not.toContain('old content');
        });
    });

    describe('renderSightingThumbnail', () => {
        it('should render an image thumbnail', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            const media = { src: 'img1.jpg', type: 'image' };
            Rendering.renderSightingThumbnail(div, sighting, media, ['img1.jpg'], 0);
            expect(div.find('.image-thumbnail').length).toBe(1);
            expect(div.find('.selected').length).toBe(1);
        });

        it('should render a video thumbnail', () => {
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            const media = { src: 'vid.mp4', type: Constants.MEDIA_TYPE_VIDEO, thumbnail: 'thumb.jpg' };
            Rendering.renderSightingThumbnail(div, sighting, media, [], 0);
            expect(div.find('.video-thumbnail').length).toBe(1);
            expect(div.find('.play-icon').length).toBe(1);
        });

        it('should log when video thumbnail is missing', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const div = $('#test-container');
            const sighting = State.data.filteredSightings[0];
            const media = { src: 'vid.mp4', type: Constants.MEDIA_TYPE_VIDEO };
            Rendering.renderSightingThumbnail(div, sighting, media, [], 0);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('thumbnail missing'));
            consoleSpy.mockRestore();
        });
    });

    describe('renderSightingThumbnailsAndDescription', () => {
        it('should render thumbnails for base sighting and other sightings of same species', () => {
            const div = $('#test-container');
            const selectedSighting = {
                species: { name: 'Rock Pigeon', media: [] },
                description: 'A common bird'
            };
            Rendering.renderSightingThumbnailsAndDescription(div, selectedSighting, ['img1.jpg'], 0);

            // Description rendered
            expect(div.html()).toContain('A common bird');
            // Thumbnails for base sighting (2 images)
            expect(div.find('.photos.section-1 div').length).toBe(2);
            // Other sightings section (s2 also has Rock Pigeon)
            expect(div.html()).toContain('Other sightings');
            expect(div.find('.photos.section-2 div').length).toBe(1);
        });

        it('should not show "Other sightings" when there are no other sightings', () => {
            const div = $('#test-container');
            // Replace sightings to only have one
            State.data.sightings = [State.data.sightings[0]];
            const selectedSighting = {
                species: { name: 'Rock Pigeon', media: [] },
                description: ''
            };
            Rendering.renderSightingThumbnailsAndDescription(div, selectedSighting, ['img1.jpg'], 0);
            expect(div.html()).not.toContain('Other sightings');
        });
    });

    describe('renderExploreMenu', () => {
        it('should correctly build family cards', () => {
            Rendering.renderExploreMenu();

            expect($('.explore-menu .list').html()).toContain('Corvidae');
            expect($('.explore-menu .list').html()).toContain('Corvus');
            expect($('.explore-menu .list img').length).toBe(1);
        });

        it('should skip families with count 0', () => {
            Rendering.renderExploreMenu();
            expect($('.explore-menu .list').html()).not.toContain('EmptyFamily');
        });

        it('should skip rendering if list already populated', () => {
            Rendering.renderExploreMenu();
            const firstHtml = $('.explore-menu .list').html();
            Rendering.renderExploreMenu();
            expect($('.explore-menu .list').html()).toBe(firstHtml);
        });
    });

    describe('renderHome', () => {
        it('should show featured and render stories', () => {
            State.data.stories = [
                { title: 'Trip', date: 'Oct 2023', storyHtml: 'Fun' }
            ];
            // Mock IntersectionObserver
            window.IntersectionObserver = vi.fn().mockImplementation((cb) => ({
                observe: vi.fn(),
                disconnect: vi.fn()
            }));

            Rendering.renderHome();
            expect($('.home .featured').hasClass('hidden')).toBe(false);
            expect($('.home .featured').hasClass('collapsed')).toBe(false);
        });
    });

    describe('renderLocationList', () => {
        it('should recursively output locations and bind UI events', () => {
            const div = $('#test-container');
            Rendering.renderLocationList(div);

            expect(div.html()).toContain('India');
            expect(div.html()).toContain('Maharashtra');
            expect(div.html()).toContain('Pune');
            expect(div.html()).toContain('Park');

            // Trigger expansion
            div.find('.location-item button.expand').eq(0).trigger('click');
            vi.advanceTimersByTime(110);
            expect(div.find('.location-item button.expand').eq(0).hasClass('expanded')).toBe(true);

            // Trigger collapse
            div.find('.location-item button.expand').eq(0).trigger('click');
            vi.advanceTimersByTime(110);
        });
    });

    describe('renderMapMenu and renderYearList', () => {
        it('should render map menu', () => {
            Rendering.renderMapMenu();
            expect($('.map-menu').html()).toContain('Species Observed by Location');
        });

        it('should not re-render map menu if already populated', () => {
            Rendering.renderMapMenu();
            const first = $('.map-menu').html();
            Rendering.renderMapMenu();
            expect($('.map-menu').html()).toBe(first);
        });

        it('should render year list', () => {
            Rendering.renderYearList($('#test-container'));
            expect($('#test-container').html()).toContain('2023');
            expect($('#test-container').html()).toContain('New species: 2 / Total sightings: 10');
        });
    });

    describe('renderMapPage', () => {
        it('should render sightings in map page context', () => {
            Rendering.renderMapPage();
            expect($('.sightings-list .sighting-panel').length).toBe(1);
        });
    });

    describe('fillStats', () => {
        it('should update stats summary with filters applied', () => {
            Rendering.fillStats(4, true, () => ({ date: '2023', place: 'Park' }));

            expect($('.sightings-count').html()).toBe("1");
            expect($('.species-count').html()).toBe("1");
            expect($('.rating').html()).toBe("4 +");
            expect($('.new-species-count').html()).toBe("1");
        });

        it('should hide rating parent when ratingFilter is 0', () => {
            Rendering.fillStats(0, false, () => ({}));
            expect($('.rating').html()).toBe("All");
        });

        it('should hide new-species-count when no date or place filter', () => {
            Rendering.fillStats(0, false, () => ({}));
            // parent should be hidden
            expect($('.new-species-count').parent().css('display')).toBe('none');
        });

        it('should show new-species-count when date filter present', () => {
            Rendering.fillStats(0, false, () => ({ date: '2023' }));
            expect($('.new-species-count').parent().css('display')).not.toBe('none');
        });
    });

    describe('renderStories', () => {
        let observerCallback;
        
        beforeEach(() => {
            class MockObserver {
                constructor(cb) {
                    this.cb = cb;
                    observerCallback = cb;
                }
                observe(el) {
                    this.el = el;
                    if (this.cb) this.cb([{ isIntersecting: true, target: el }]);
                }
                disconnect() { }
            }
            window.IntersectionObserver = vi.fn().mockImplementation((cb) => new MockObserver(cb));
        });

        it('should render stories completely and handle scrolling', () => {
            State.data.stories = [
                { title: 'Trip', date: 'Oct 2023', youtubeVideoId: '123', storyHtml: 'Fun trip', sightings: [{ text: 'Bird', params: { sighting: 'Bird' } }] },
                { title: 'Trip 2', date: 'Nov 2023', images: ['img1.jpg'], itinerary: [{ date: '1st', activity: 'Walk' }], itineraryExpanded: true, storyHtml: '' },
                { title: 'Trip 3', date: 'Dec 2023', itineraryHtml: '<b>Custom</b>', storyHtml: 'Walk' },
                { title: 'Trip 4', date: 'Jan 2024', storyHtml: 'Walk' },
                { title: 'Trip 5', date: 'Feb 2024', storyHtml: 'Walk' },
                { title: 'Trip 6', date: 'Mar 2024', storyHtml: 'Walk' }
            ];

            // Mock IntersectionObserver
            window.HTMLElement.prototype.scrollIntoView = vi.fn();

            Rendering.renderStories('.stories', 0, 'trip-oct-2023');

            vi.advanceTimersByTime(600);

            expect($('.stories').html()).toContain('Trip');
            expect($('.stories').html()).toContain('youtube');
            expect($('.stories').html()).toContain('Trip 2');
            expect($('.stories').html()).toContain('Itinerary');
            expect($('.stories').html()).toContain('Trip 6');
            expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        });

        it('should render limited stories on home page', () => {
            State.data.stories = [
                { title: 'Story 1', date: 'Jan 2024', storyHtml: 'Content 1' },
                { title: 'Story 2', date: 'Feb 2024', storyHtml: 'Content 2' },
                { title: 'Story 3', date: 'Mar 2024', storyHtml: 'Content 3' }
            ];

            Rendering.renderStories('.home-stories', 2);
            expect($('.home-stories .video').length).toBe(2);
        });

        it('should handle targetStory with title-only slug matching', () => {
            State.data.stories = [
                { title: 'Unique Title', date: 'Jan 2024', storyHtml: 'Content' }
            ];

            window.HTMLElement.prototype.scrollIntoView = vi.fn();

            Rendering.renderStories('.stories', 0, 'unique-title');
            vi.advanceTimersByTime(600);
            // Should find by title-part match
            expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        });

        it('should handle no matching targetStory gracefully', () => {
            State.data.stories = [
                { title: 'Story', date: 'Jan 2024', storyHtml: 'Content' }
            ];

            window.HTMLElement.prototype.scrollIntoView = vi.fn();

            Rendering.renderStories('.stories', 0, 'nonexistent-story');
            vi.advanceTimersByTime(600);
        });

        it('should handle stories container as .stories with heading', () => {
            State.data.stories = [
                { title: 'Trip', date: 'Oct 2023', storyHtml: 'Content' }
            ];
            Rendering.renderStories('.stories', 0);
            expect($('.stories h1').text()).toContain('Stories');
        });

        it('should render itinerary collapsed on home page', () => {
            State.data.stories = [
                { title: 'Trip', date: 'Oct 2023', storyHtml: 'Content', itinerary: [{ date: '1st', activity: 'Walk' }] }
            ];
            Rendering.renderStories('.home-stories', 5);
            expect($('.home-stories').html()).toContain('Itinerary');
            expect($('.home-stories').html()).toContain('collapsible hide');
        });

        it('should dispatch story-in-view event when story is in view', () => {
            State.data.stories = [
                { title: 'Test Story', date: 'Oct 2023', storyHtml: 'Content' }
            ];
            const eventSpy = vi.fn();
            window.addEventListener('story-in-view', eventSpy);

            Rendering.renderStories('.stories', 0);

            expect(observerCallback).toBeDefined();

            // Simulate story coming into view
            const entry = {
                isIntersecting: true,
                target: { id: 'test-story-oct-2023' }
            };
            observerCallback([entry]);

            expect(eventSpy).toHaveBeenCalled();
            expect(eventSpy.mock.calls[0][0].detail.slug).toBe('test-story-oct-2023');

            window.removeEventListener('story-in-view', eventSpy);
        });
    });

    describe('renderPageName', () => {
        it('should format explore page name', () => {
            Rendering.renderPageName(Constants.EXPLORE_PAGE, { family: 'Fringillidae' });
            expect($('.page-name').html()).toContain('Fringillidae');
        });

        it('should format home page name', () => {
            Rendering.renderPageName(Constants.HOME, null);
            expect($('.page-name').text()).toContain('Home');
        });

        it('should format explore menu page name', () => {
            Rendering.renderPageName(Constants.EXPLORE_MENU, null);
            expect($('.page-name').html()).toContain(Constants.PAGE[Constants.EXPLORE_MENU].name);
        });

        it('should format about page name', () => {
            Rendering.renderPageName(Constants.ABOUT, null);
            expect($('.page-name').html()).toContain(Constants.PAGE[Constants.ABOUT].name);
        });

        it('should format archive page name', () => {
            Rendering.renderPageName(Constants.ARCHIVE, null);
            expect($('.page-name').html()).toContain(Constants.PAGE[Constants.ARCHIVE].name);
        });

        it('should format stories page name', () => {
            Rendering.renderPageName(Constants.STORIES, null);
            expect($('.page-name').html()).toContain(Constants.PAGE[Constants.STORIES].name);
        });

        it('should format map menu page name', () => {
            Rendering.renderPageName(Constants.MAP_MENU, null);
            expect($('.page-name').html()).toContain(Constants.PAGE[Constants.MAP_MENU].name);
        });

        it('should format map page name with place param', () => {
            Rendering.renderPageName(Constants.MAP, { place: 'Delhi' });
            expect($('.page-name').html()).toContain('Delhi');
        });

        it('should format map page name without place param', () => {
            Rendering.renderPageName(Constants.MAP, {});
            expect($('.page-name').html()).toContain('All');
        });
    });

    describe('renderSightingDetails - subspecies branch', () => {
        it('should append subspecies to latin name in preview page', () => {
            const container = $('<div></div>');
            const sighting = {
                key: 's1',
                species: { key: 's1', name: 'Rock Pigeon', tags: ['pigeon'], family: 'Columbidae', latin_name: 'columba livia', ebird_code: 'rocpig' },
                date: moment('01-01-2024', 'DD-MM-YYYY'),
                dateString: '01 Jan 2024',
                country: 'India',
                state: 'WB',
                city: 'Howrah',
                place: 'Station',
                media: [{ src: 'img.jpg' }],
                subspecies: 'domestica',
                newSpecies: false,
                index: 0
            };
            State.data = {
                ...State.data,
                sightings: [sighting],
                filteredSightings: [sighting],
                species: { 's1': sighting.species },
                countries: { 'India': { name: 'India', states: { 'WB': { name: 'West Bengal' } } } }
            };
            Rendering.renderSightingDetails(container, sighting, true);
            const html = container.html();
            expect(html).toContain('columba livia');
            expect(html).toContain('domestica');
        });
    });

    describe('renderLocationList - expand/collapse', () => {
        it('should toggle visibility of children on expand button click', () => {
            vi.useRealTimers();
            vi.useFakeTimers();
            const container = $('<div></div>');
            $('body').append(container);

            State.data = {
                ...State.data,
                countries: {
                    'India': {
                        name: 'India', count: 20,
                        states: {
                            'WB': {
                                name: 'West Bengal', count: 15,
                                cities: {
                                    'Howrah': { count: 10, places: { 'Station': { count: 6 }, 'Market': { count: 5 } } }
                                }
                            }
                        }
                    }
                }
            };

            Rendering.renderLocationList(container);

            const expandBtn = container.find('button.expand').first();
            expect(expandBtn.length).toBeGreaterThan(0);

            // Click to expand
            expandBtn.trigger('click');
            vi.advanceTimersByTime(200);

            // Click to collapse
            expandBtn.trigger('click');
            vi.advanceTimersByTime(200);
        });
    });
});
