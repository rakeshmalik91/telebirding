import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as AdminData from '../../scripts/modules/admin/data.js';
import Util from '../../scripts/modules/util.js';
import FirebaseApi from '../../scripts/modules/firebase-api.js';

vi.mock('../../scripts/modules/util.js', () => ({
    default: {
        getUrlParams: vi.fn(() => ({})),
        clearFileCache: vi.fn(),
        readJSONFiles: vi.fn(),
        getData: vi.fn((p) => p),
        compare: vi.fn((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
        resizeImage: vi.fn(() => Promise.resolve(new Blob(['mocked'], {type: 'image/jpeg'}))),
        plural: vi.fn((s) => s + 's')
    }
}));

vi.mock('../../scripts/modules/firebase-api.js', () => ({
    default: {
        getFirebase: vi.fn(() => global.firebase),
        moveFile: vi.fn(() => Promise.resolve())
    }
}));

// Mock EXIF
global.EXIF = {
    getData: vi.fn((file, cb) => cb.call(file)),
    getTag: vi.fn()
};

// Mock alert
global.alert = vi.fn();

describe('Admin Data Module', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        AdminData.setRenderCallback(vi.fn());
        
        // Hard reset AdminData.data
        for (const key in AdminData.data) delete AdminData.data[key];
        
        // Setup initial data structure
        AdminData.data.sightings = [
            { 
                key: 's1', species: 'rock-pigeon', date: '01-01-2024', 
                media: [{ src: 'img1.jpg', exif_data: {} }], author: 'Tester',
                state: 'WB', country: 'India'
            },
            { 
                key: 's2', species: 'house-sparrow', date: '02-01-2024', 
                media: [], author: 'Tester',
                state: 'WB', country: 'India'
            },
            { 
                key: 's3', species: 'house-sparrow', date: '03-01-2024', 
                media: [], author: 'Tester',
                state: 'WB', country: 'India'
            }
        ];
        AdminData.data.species = {
            'rock-pigeon': { key: 'rock-pigeon', name: 'Rock Pigeon', family: 'Columbidae', tags: ['bird'] },
            'house-sparrow': { key: 'house-sparrow', name: 'House Sparrow', family: 'Passeridae', tags: ['bird'] }
        };
        AdminData.data.families = [
            { name: 'Columbidae' },
            { name: 'Passeridae' }
        ];

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe('Metadata Management', () => {
        it('should save new species', () => {
            AdminData.saveSpecies(null, 'New Bird', 'tag1, tag2', 'Columbidae');
            expect(AdminData.data.species['new-bird']).toBeDefined();
            expect(AdminData.data.species['new-bird'].name).toBe('New Bird');
        });

        it('should add/update family', () => {
            AdminData.addFamily('New Family', 'code', 'sci');
            expect(AdminData.data.families.find(f => f.name === 'New Family')).toBeDefined();
        });

        it('should delete family if not in use', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            AdminData.addFamily('Empty Family');
            AdminData.deleteFamily('Empty Family');
            expect(AdminData.data.families.find(f => f.name === 'Empty Family')).toBeUndefined();
        });

        it('should NOT delete family if in use', () => {
            AdminData.deleteFamily('Columbidae'); // used by rock-pigeon
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('used by one or more species'));
        });

        it('should delete species if no sightings', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            AdminData.saveSpecies('no-sighting', 'No Sighting', 'tag', 'Columbidae');
            AdminData.deleteSpecies('no-sighting');
            expect(AdminData.data.species['no-sighting']).toBeUndefined();
        });
    });

    describe('Sighting Operations', () => {
        it('should delete sighting and associated media', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            const deleteSpy = vi.spyOn(global.firebase.storage().ref(), 'delete');
            AdminData.deleteSighting('s1');
            expect(AdminData.data.sightings.find(s => s.key === 's1')).toBeUndefined();
            expect(deleteSpy).toHaveBeenCalled();
        });

        it('should move sighting up/down', () => {
            AdminData.moveSighting('s1', 1); // move down
            expect(AdminData.data.sightings[1].key).toBe('s1');
            AdminData.moveSighting('s1', -1); // move back up
            expect(AdminData.data.sightings[0].key).toBe('s1');
        });

        it('should sort sightings by date', () => {
            AdminData.sortByDate();
            expect(AdminData.data.sightings[0].key).toBe('s3');
        });

        it('should update field and trigger sync', () => {
            AdminData.updateField('s1', 'place', 'Park');
            expect(AdminData.data.sightings[0].place).toBe('Park');
        });
    });

    describe('Media Operations', () => {
        it('should handle image upload with EXIF date extraction', async () => {
            const files = [new File(['mock'], 'test.jpg', { type: 'image/jpeg' })];
            EXIF.getTag.mockReturnValue('2024:03:15 12:00:00');
            AdminData.uploadMedia('s3', files);
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(AdminData.data.sightings[2].media.length).toBe(1);
            expect(AdminData.data.sightings[2].date).toBe('15-03-2024');
        });

        it('should delete media on confirmation', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            AdminData.deleteMedia('s1', 'img1.jpg');
            expect(AdminData.data.sightings[0].media.length).toBe(0);
        });

        it('should move media left inside a sighting', () => {
            AdminData.data.sightings[0].media = [{src: '1.jpg'}, {src: '2.jpg'}, {src: '3.jpg'}];
            AdminData.moveMediaLeft('s1', '2.jpg');
            expect(AdminData.data.sightings[0].media[0].src).toBe('2.jpg');
        });

        it('should rename media when species changes', async () => {
            AdminData.data.sightings[0].media = [{ src: 'images/rock-pigeon-123.jpg' }];
            AdminData.updateField('s1', 'species', 'house-sparrow');
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(FirebaseApi.moveFile).toHaveBeenCalled();
            expect(AdminData.data.sightings[0].media[0].src).toMatch(/house-sparrow/);
        });

        it('should alert on unsupported media deletion', () => {
            AdminData.deleteMedia('s1', 'test.txt');
            expect(global.alert).toHaveBeenCalledWith('Unsupported!!!');
        });
    });

    describe('Firebase Data Operations', () => {
        it('should backup all data files', async () => {
            const putSpy = vi.spyOn(global.firebase.storage().ref(), 'put');
            AdminData.backup();
            expect(putSpy).toHaveBeenCalledTimes(4);
        });

        it('should refresh data from storage', () => {
            const testData = { sightings: [{ key: 'new' }] };
            Util.readJSONFiles.mockImplementation((files, cb) => cb(testData));
            AdminData.refreshData();
            expect(AdminData.data).toEqual(testData);
        });

        it('should upload JSON data and handle errors', async () => {
            const putSpy = vi.spyOn(global.firebase.storage().ref(), 'put');
            AdminData.uploadJSONData('sightings');
            expect(putSpy).toHaveBeenCalled();
            putSpy.mockReturnValue(Promise.reject({message: 'Failed'}));
            AdminData.uploadJSONData('sightings');
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(global.alert).toHaveBeenCalledWith('Failed');
        });

        it('should handle backup failure correctly', async () => {
            const putSpy = vi.spyOn(global.firebase.storage().ref(), 'put');
            putSpy.mockReturnValue(Promise.reject({message: 'Fail'}));
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            AdminData.backup();
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('syncSightingsData', () => {
        it('should enable save button and schedule sync', () => {
            document.body.innerHTML = '<button class="save" disabled></button>';
            AdminData.syncSightingsData(1000);
            expect($('.save').attr('disabled')).toBeUndefined();
            vi.advanceTimersByTime(1100);
            expect($('.save').attr('disabled')).toBe('disabled');
        });
    });

    describe('Boundary Checks & Search', () => {
        it('should handle moveSighting out of bounds', () => {
            // Local reset to ensure absolute isolation
            AdminData.data.sightings = [
                { key: 's1' }, { key: 's2' }, { key: 's3' }
            ];
            const originalLength = AdminData.data.sightings.length;
            AdminData.moveSighting('s1', -1);
            expect(AdminData.data.sightings.length).toBe(originalLength);
            expect(AdminData.data.sightings[0].key).toBe('s1');
            
            AdminData.moveSighting('s3', 1);
            expect(AdminData.data.sightings[originalLength-1].key).toBe('s3');
            
            AdminData.moveSighting('invalid', 1);
            expect(AdminData.data.sightings.length).toBe(originalLength);
        });

        it('should match search keys accurately', () => {
            const sighting = AdminData.data.sightings[0];
            expect(AdminData.sightingMatches(sighting, 'rock')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'missing')).toBeFalsy();
            expect(AdminData.sightingMatches(sighting, 'hidden')).toBeFalsy();
            
            sighting.hidden = true;
            expect(AdminData.sightingMatches(sighting, 'hidden')).toBeTruthy();
            
            sighting.rating = 5;
            expect(AdminData.sightingMatches(sighting, 'rating=5')).toBeTruthy();
            
            sighting.unconfirmed = true;
            expect(AdminData.sightingMatches(sighting, 'unconfirmed')).toBeTruthy();
        });
    });
    
    describe('addSighting', () => {
        it('should add a new sighting with default values', () => {
            AdminData.data.sightings = [];
            AdminData.addSighting();
            expect(AdminData.data.sightings.length).toBe(1);
            expect(AdminData.data.sightings[0].city).toBe('Howrah');
        });
    });
});
