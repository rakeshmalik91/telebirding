import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as DataHelpers from '../../scripts/modules/public/data-helpers.js';
import State from '../../scripts/modules/public/state.js';
import Util from '../../scripts/modules/util.js';
import Constants from '../../scripts/modules/constants.js';
import FirebaseApi from '../../scripts/modules/firebase-api.js';

// Mock FirebaseApi
vi.mock('../../scripts/modules/firebase-api.js', () => ({
    default: {
        getFirebase: vi.fn(() => ({
            storage: () => ({
                ref: () => ({
                    put: vi.fn(() => Promise.resolve())
                })
            })
        }))
    }
}));

describe('DataHelpers Module', () => {

    beforeEach(() => {
        // Mock DOM for like()
        document.body.innerHTML = `
            <div id="s1">
                <div class="sighting-desc likes">
                    <span class="count">5</span>
                    <span class="heart hollow"></span>
                </div>
            </div>
            <div class="preview-image-desc">
                <div class="sighting-desc likes">
                    <span class="count">10</span>
                    <span class="heart hollow"></span>
                </div>
            </div>
        `;

        // Prepopulate State
        State.data = {
            sightings: [
                {
                    key: 's1',
                    species: 'sp1',
                    date: '01 Jan 2023',
                    hidden: false,
                    media: [ { src: 'img1.jpg', type: 'image' } ],
                    country: 'US',
                    state: 'NY',
                    city: 'New York',
                    place: 'Central Park'
                },
                {
                    key: 's2',
                    species: 'sp2',
                    date: '02 Jan 2023',
                    hidden: true, // Should be filtered out
                    media: [],
                    country: 'US',
                    state: 'NY',
                    city: '',
                    place: 'Some Place'
                }
            ],
            species: {
                'sp1': { key: 'sp1', tags: ['a', 'bb'], family: 'Columbidae' },
                'sp2': { key: 'sp2', tags: ['c'], family: 'Corvidae' }
            },
            families: [
                { name: 'Columbidae' },
                { name: 'Corvidae' }
            ],
            countries: {
                'US': { name: 'United States', count: 0, states: { 'NY': { name: 'New York' } } }
            },
            likes: { 's1': ['user1'] },
            years: {}
        };
        State.likeLocked = false;
        State.remainingLikes = 5;
        State.currentMode = Constants.MODE_BIRD;

        vi.spyOn(Util, 'getClientId').mockReturnValue('client123');
        vi.spyOn(State, 'updateLikeLocked');
        vi.spyOn(State, 'updateRemainingLikes');
        vi.spyOn(State, 'updateData');
    });

    describe('getSpeciesCount', () => {
        it('should return unique species count from sightings array', () => {
            const sightings = [
                { species: { key: 'a' } },
                { species: { key: 'b' } },
                { species: { key: 'a' } }
            ];
            expect(DataHelpers.getSpeciesCount(sightings)).toBe(2);
        });
    });

    describe('computeInternalDataFields', () => {
        it('should filter hidden sightings and compute internal fields like dateString and newSpecies', () => {
            DataHelpers.computeInternalDataFields();
            
            // Hidden sighting s2 should be removed
            expect(State.data.sightings.length).toBe(1);
            expect(State.data.sightings[0].key).toBe('s1');

            // Internal fields should be set
            expect(State.data.sightings[0].index).toBe(0);
            expect(State.data.sightings[0].dateString).toBeDefined(); // Formatted by moment
            expect(State.data.sightings[0].newSpecies).toBe(true);
            expect(State.data.sightings[0].species.tags.length).toBe(2);
        });

        it('should build missing families and compute counts/imagesrc', () => {
            // Add a sighting with a family not in State.data.families
            State.data.sightings.push({
                key: 's3',
                species: 'sp3',
                date: '03 Jan 2023',
                hidden: false,
                media: [],
                country: 'US',
                state: 'NY'
            });
            State.data.species['sp3'] = { key: 'sp3', family: 'NewFamily' };

            DataHelpers.computeInternalDataFields();

            expect(State.data.families.some(f => f.name === 'NewFamily')).toBe(true);
            expect(State.data.families.find(f => f.name === 'Columbidae').count).toBe(1); // Since s1 is Columbidae
            expect(State.data.families.find(f => f.name === 'NewFamily').count).toBe(1);
        });

        it('should populate countries nested hierarchy', () => {
            DataHelpers.computeInternalDataFields();

            // After compute, we should have countries populated with counts and states and cities
            expect(State.data.countries['US'].count).toBe(1);
            expect(State.data.countries['US'].states['NY'].count).toBe(1);
            expect(State.data.countries['US'].states['NY'].cities['New York']).toBeDefined();
            expect(State.data.countries['US'].states['NY'].cities['New York'].places['Central Park']).toBeDefined();
        });

        it('should populate years list based on sightings', () => {
             DataHelpers.computeInternalDataFields();
             
             // date '01 Jan 2023' => year is likely '2023' (depends on moment parsing, assuming valid)
             const yearKeys = Object.keys(State.data.years);
             expect(yearKeys.length).toBeGreaterThan(0);
             const yearObj = State.data.years[yearKeys[0]];
             expect(yearObj.sighting_count).toBe(1);
        });
    });

    describe('computeInternalDataFields - city normalization', () => {
        it('should use place name if city is missing', () => {
             // Mock sighting s2 was city='', place='Some Place'
             State.data.sightings[1].hidden = false; // Ensure it's not filtered out
             DataHelpers.computeInternalDataFields();
             
             // Check if 'Some Place' was added to cities
             // Hierarcy is US -> NY -> cities['Some Place']
             expect(State.data.countries['US'].states['NY'].cities['Some Place']).toBeDefined();
             expect(State.data.countries['US'].states['NY'].cities['Some Place'].count).toBe(1);
        });
    });

    describe('like', () => {
        it('should do nothing if likes are disabled, locked, or remaining <= 0', () => {
            State.remainingLikes = 0;
            DataHelpers.like('s1');
            expect(FirebaseApi.getFirebase).not.toHaveBeenCalled();
        });

        it('should toggle like on', async () => {
            DataHelpers.like('s1');
            
            expect(State.updateLikeLocked).toHaveBeenCalledWith(true);
            expect(State.updateData).toHaveBeenCalled();
            
            // Check State.data.likes has client123
            const callArgs = State.updateData.mock.calls[0][0];
            expect(callArgs.likes['s1']).toContain('client123');
        });

        it('should toggle like off when already liked', async () => {
            State.data.likes['s1'] = ['client123', 'other'];
            
            DataHelpers.like('s1');
            
            const callArgs = State.updateData.mock.calls[0][0];
            expect(callArgs.likes['s1']).not.toContain('client123');
            expect(callArgs.likes['s1']).toContain('other');
        });

        it('should handle failure in put() call', async () => {
            const putMock = vi.fn(() => Promise.reject(new Error('fail')));
            FirebaseApi.getFirebase.mockReturnValue({
                storage: () => ({
                    ref: () => ({
                        put: putMock
                    })
                })
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.useFakeTimers();
            
            DataHelpers.like('s1');
            
            // Should have set lock first
            expect(State.updateLikeLocked).toHaveBeenCalledWith(true);

            // Wait for catch block
            for (let i = 0; i < 10; i++) await Promise.resolve();
            await vi.runAllTicks();
            
            expect(consoleSpy).toHaveBeenCalledWith('like s1 failed');

            // Should release lock after 60s
            vi.advanceTimersByTime(61000);
            expect(State.updateLikeLocked).toHaveBeenCalledWith(false);
            vi.useRealTimers();



            consoleSpy.mockRestore();
        });
    });

    describe('computeInternalDataFields - thumbnail', () => {
        it('should handle media thumbnails', () => {
            State.data.sightings[0].media[0].thumbnail = 'thumb1.jpg';
            DataHelpers.computeInternalDataFields();
            expect(State.data.sightings[0].media[0].thumbnail).toContain('thumb1.jpg');
        });
    });

    describe('computeInternalDataFields - video family thumbnail', () => {
        it('should handle case when first media is video', () => {
            State.data.sightings[0].media = [{ src: 'vid1.mp4', type: 'video' }];
            DataHelpers.computeInternalDataFields();
            expect(State.data.families.find(f => f.name === 'Columbidae').imagesrc).toBeUndefined();
        });
    });

    describe('computeInternalDataFields - oldest date comparison', () => {
        it('should compare and find oldest date correctly when multiple sightings in a year', () => {
            State.data.sightings = [
                {
                    key: 's1', species: 'sp1', date: '05-01-2023', hidden: false,
                    media: [ { src: 'img1.jpg', type: 'image' } ], country: 'US', state: 'NY', city: 'New York', place: 'Central Park'
                },
                {
                    key: 's3', species: 'sp1', date: '01-01-2023', hidden: false,
                    media: [ { src: 'img1.jpg', type: 'image' } ], country: 'US', state: 'NY', city: 'New York', place: 'Central Park'
                }
            ];
            DataHelpers.computeInternalDataFields();
            expect(State.data.years['2023']).toBeDefined();
        });
    });

    describe('like - fallbacks', () => {
        it('should handle undefined likes wrapper and undefined likes[key]', () => {
            State.data.likes = undefined;
            DataHelpers.like('s1');
            
            const callArgs = State.updateData.mock.calls[0][0];
            expect(callArgs.likes).toBeDefined();
            expect(callArgs.likes['s1']).toContain('client123');
        });
    });
});



