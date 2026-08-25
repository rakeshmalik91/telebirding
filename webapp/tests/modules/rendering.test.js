import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Rendering from '../../scripts/modules/public/rendering.js';
import State from '../../scripts/modules/public/state.js';
import Constants from '../../scripts/modules/constants.js';

describe('Rendering Module', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="home">
                <div class="featured"></div>
            </div>
            <div class="explore-menu">
                <div class="list"></div>
            </div>
            <div class="map-menu"></div>
            <div class="sightings-list"></div>
        `;

        // Dummy Data for State
        State.data = {
            families: [
                { name: 'Columbidae', sci_name: 'Columbidae', count: 10, imagesrc: 'columbidae.jpg' },
                { name: 'Corvidae', count: 5, imagesrc: '' },
                { name: 'EmptyFamily', count: 0, imagesrc: '' }
            ],
            countries: {
                'US': {
                    name: 'United States',
                    count: 15,
                    states: {
                        'NY': {
                            name: 'New York',
                            count: 10,
                            cities: {
                                'New York': {
                                    name: 'New York',
                                    count: 10,
                                    places: {
                                        'Central Park': { name: 'Central Park', count: 10 }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            filteredSightings: [
                {
                    key: 's1',
                    species: { name: 'Rock Pigeon', family: 'Columbidae' },
                    place: 'Central Park',
                    city: 'New York',
                    state: 'NY',
                    country: 'US',
                    dateString: '1 Jan 2023',
                    date: { format: vi.fn(() => '1 Jan 2023') },
                    rating: 3,
                    media: []
                }
            ],
            sightings: []
        };
        State.currentMode = Constants.MODE_BIRD;
        
        // Setup window methods
        window.showPage = vi.fn();
    });

    describe('renderExploreMenu', () => {
        it('should render families with count > 0', () => {
             Rendering.renderExploreMenu();
             const listHtml = $('.explore-menu .list').html();
             
             // Check Columbidae and Corvidae are rendered
             expect(listHtml).toContain('Columbidae');
             expect(listHtml).toContain('Corvidae');
             // Check EmptyFamily is not rendered
             expect(listHtml).not.toContain('EmptyFamily');

             // Check image and sci_name handling
             expect(listHtml).toContain('<img class="fadein-50percent" src="resources/columbidae.jpg" alt="Columbidae">');
             expect(listHtml).toContain('<span class="sci-name">Columbidae</span>');

             // Check classes changed
             expect($('.featured').hasClass('collapsed')).toBe(true);
             expect($('.explore-menu').hasClass('expanded')).toBe(true);
        });

        it('should append click handler properly for families', () => {
             Rendering.renderExploreMenu();
             const listHtml = $('.explore-menu .list').html();
             expect(listHtml).toContain('onclick="showPage(&quot;explore_page&quot;, {family:&quot;Columbidae&quot;})"');
        });
    });

    describe('renderMapMenu', () => {
        it('should render map menu list from state countries data', () => {
            Rendering.renderMapMenu();
            
            expect($('.home .featured').hasClass('collapsed')).toBe(true);
            expect($('.map-menu').css('display')).not.toBe('none');

            const menuHtml = $('.map-menu').html();
            expect(menuHtml).toContain('Species Observed by Location');
            expect(menuHtml).toContain('United States');
            expect(menuHtml).toContain('New York');
            expect(menuHtml).toContain('Central Park');
            expect(menuHtml).toContain('<span class="count">15</span>'); // Total count for US
        });
    });

    describe('renderMapPage', () => {
        it('should call renderSightings with ARCHIVE_DATA_PER_PAGE', () => {
            Rendering.renderMapPage();
            // renderSightings will populate sightings-list
            expect($('.sightings-list').html()).not.toBe('');
            expect($('.sightings-list .sighting-panel').length).toBe(1);
        });
    });

});
