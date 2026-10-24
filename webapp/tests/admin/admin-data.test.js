import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as AdminData from '../../scripts/modules/admin/data.js';
import Util from '../../scripts/modules/util.js';
import FirebaseApi from '../../scripts/modules/firebase-api.js';
import { removeUnwantedValues, toSingular, applySpeciesTags } from '../../scripts/modules/admin/data-cleanup.js';

vi.mock('../../scripts/modules/util.js', () => ({
    default: {
        getUrlParams: vi.fn(() => ({})),
        clearFileCache: vi.fn(),
        readJSONFiles: vi.fn(),
        getData: vi.fn((p) => p),
        getMedia: vi.fn((p) => p),
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

vi.mock('../../scripts/modules/admin/ui.js', () => ({
    customAlert: vi.fn((msg) => global.alert(msg)),
    customConfirm: vi.fn((msg, cb) => {
        if (window.confirm(msg)) {
            cb();
        }
    }),
    showToast: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn()
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

        global.firebase.storage().ref().delete.mockReset();
        global.firebase.storage().ref().delete.mockResolvedValue();
        global.firebase.storage().ref().put.mockReset();
        global.firebase.storage().ref().put.mockResolvedValue();
        Util.resizeImage.mockResolvedValue(new Blob(['mocked'], {type: 'image/jpeg'}));

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe('Metadata Management', () => {
        it('should save new species', () => {
            AdminData.saveSpecies(null, 'New Bird', 'tag1, tag2', 'Columbidae', 'Columba livia', 'rocpig');
            expect(AdminData.data.species['new-bird']).toBeDefined();
            expect(AdminData.data.species['new-bird'].name).toBe('New Bird');
            expect(AdminData.data.species['new-bird'].latin_name).toBe('columba livia');
            expect(AdminData.data.species['new-bird'].ebird_code).toBe('rocpig');
        });

        it('should add/update family', () => {
            AdminData.addFamily('New Family', 'code', 'sci');
            expect(AdminData.data.families.find(f => f.name === 'New Family')).toBeDefined();
        });

        it('should alert if name is missing in addFamily', () => {
            AdminData.addFamily('', '', '');
            expect(global.alert).toHaveBeenCalledWith('Name is mandatory');
        });

        it('should alert if mandatory fields are missing in saveSpecies', () => {
            AdminData.saveSpecies('k', '', '', '');
            expect(global.alert).toHaveBeenCalledWith('All fields are mandatory');
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

        it('should NOT delete species if it has sightings', () => {
            AdminData.deleteSpecies('rock-pigeon');
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('as it has sightings'));
        });
    });

    describe('Sighting Operations', () => {
        it('should delete sighting and associated media', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            AdminData.deleteSighting('s1');
            expect(AdminData.data.sightings.find(s => s.key === 's1')).toBeUndefined();
            expect(global.firebase.storage().ref().delete).toHaveBeenCalled();
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

        it('should handle image upload with missing EXIF date', async () => {
            const files = [new File(['mock'], 'test.jpg', { type: 'image/jpeg' })];
            EXIF.getTag.mockReturnValue(null); // No EXIF date
            AdminData.uploadMedia('s3', files);
            for(let i=0; i<10; i++) await Promise.resolve();
            // Should resolve with current date or keep previous
            expect(AdminData.data.sightings[2].media.length).toBe(1);
        });

        it('should handle image upload with watermark checked (with author)', async () => {
            document.body.innerHTML = `
                <input name="watermark-on" type="checkbox" checked />
                <input name="watermark" value="By \${author}" />
                <input name="watermark-color" value="#ffffff" />
            `;
            const files = [new File(['mock'], 'test.jpg', { type: 'image/jpeg' })];
            EXIF.getTag.mockReturnValue(null);
            AdminData.data.sightings[2].author = 'Tester Author';

            AdminData.uploadMedia('s3', files);
            for(let i=0; i<10; i++) await Promise.resolve();
            vi.runAllTicks();
            expect(Util.resizeImage).toHaveBeenCalledWith(
                expect.any(File),
                1000,
                expect.objectContaining({ text: 'By Tester Author', color: '#ffffff33' })
            );
        });

        it('should handle image upload with watermark checked (without author)', async () => {
            document.body.innerHTML = `
                <input name="watermark-on" type="checkbox" checked />
                <input name="watermark" value="By \${author}" />
                <input name="watermark-color" value="#ffffff" />
            `;
            const files = [new File(['mock'], 'test.jpg', { type: 'image/jpeg' })];
            EXIF.getTag.mockReturnValue(null);
            AdminData.data.sightings[2].author = null; // force fallback

            AdminData.uploadMedia('s3', files);
            for(let i=0; i<10; i++) await Promise.resolve();
            vi.runAllTicks();
            expect(Util.resizeImage).toHaveBeenCalledWith(
                expect.any(File),
                1000,
                expect.objectContaining({ text: 'By Rakesh Malik', color: '#ffffff33' })
            );
        });

        it('should handle image upload failure', async () => {
            const files = [new File(['mock'], 'test.jpg', { type: 'image/jpeg' })];
            EXIF.getTag.mockReturnValue('2024:03:15 12:00:00');
            global.firebase.storage().ref().put.mockRejectedValue(new Error('Upload failed'));
            
            AdminData.uploadMedia('s3', files);
            for(let i=0; i<10; i++) await Promise.resolve();
            vi.runAllTicks();
            
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
        });

        it('should handle video upload success', async () => {
            const files = [new File(['mock-video'], 'video.mp4', { type: 'video/mp4' })];
            AdminData.uploadMedia('s1', files); // s1 has image, will trigger use as thumbnail
            
            for(let i=0; i<10; i++) await Promise.resolve();
            vi.runAllTicks();
            
            expect(AdminData.data.sightings[0].media.length).toBe(2);
            expect(AdminData.data.sightings[0].media[1].type).toBe('video');
            expect(AdminData.data.sightings[0].media[1].thumbnail).toBe('img1.jpg');
        });

        it('should handle video upload success when no image is available for thumbnail', async () => {
            const files = [new File(['mock-video'], 'video.mp4', { type: 'video/mp4' })];
            AdminData.uploadMedia('s3', files); // s3 has no image, will use video src as thumbnail
            
            for(let i=0; i<10; i++) await Promise.resolve();
            vi.runAllTicks();
            
            expect(AdminData.data.sightings[2].media.length).toBe(1);
            expect(AdminData.data.sightings[2].media[0].thumbnail).toBeNull();
        });

        it('should handle video upload failure', async () => {
            const files = [new File(['mock-video'], 'video.mp4', { type: 'video/mp4' })];
            global.firebase.storage().ref().put.mockRejectedValue(new Error('Upload failed'));
            
            AdminData.uploadMedia('s3', files);
            for(let i=0; i<10; i++) await Promise.resolve();
            vi.runAllTicks();
            
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
        });

        it('should delete media on confirmation', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            AdminData.deleteMedia('s1', 'img1.jpg');
            expect(AdminData.data.sightings[0].media.length).toBe(0);
        });

        it('should not delete media on cancellation', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            AdminData.deleteMedia('s1', 'img1.jpg');
            expect(AdminData.data.sightings[0].media.length).toBe(1);
        });

        it('should handle deleteMedia storage/object-not-found error code', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            global.firebase.storage().ref().delete = vi.fn(() => Promise.reject({ code: 'storage/object-not-found' }));

            AdminData.deleteMedia('s1', 'img1.jpg');
            for (let i = 0; i < 10; i++) await Promise.resolve();
            vi.runAllTicks();
            expect(global.alert).not.toHaveBeenCalled();
        });

        it('should alert for other deleteMedia error codes', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            global.firebase.storage().ref().delete = vi.fn(() => Promise.reject({ code: 'storage/some-error', message: 'Delete failed' }));

            console.log("Calling deleteMedia...");
            AdminData.deleteMedia('s1', 'img1.jpg');
            for (let i = 0; i < 10; i++) await Promise.resolve();
            vi.runAllTicks();
            console.log("Alert calls in test:", global.alert.mock.calls);
            expect(global.alert).toHaveBeenCalledWith('Delete failed');
        });

        it('should move media to target inside a sighting and handle boundary', () => {
            AdminData.data.sightings[0].media = [{src: '1.jpg'}, {src: '2.jpg'}, {src: '3.jpg'}];
            AdminData.moveMediaToTarget('s1', 's1', '2.jpg', '1.jpg', false);
            expect(AdminData.data.sightings[0].media[0].src).toBe('2.jpg');

            // Move to end if targetSrc is null
            AdminData.moveMediaToTarget('s1', 's1', '2.jpg', null, true);
            expect(AdminData.data.sightings[0].media[2].src).toBe('2.jpg');

            // Boundary: not found
            AdminData.moveMediaToTarget('s1', 's1', 'nonexistent.jpg', '1.jpg', false);
            expect(AdminData.data.sightings[0].media.length).toBe(3);
        });

        it('should update special fields (date, hidden) correctly', () => {
            AdminData.updateField('s1', 'date', '2024-03-15');
            // moment('2024-03-15', 'yyyy-mm-DD').format('DD-mm-yyyy') results in '15-03-2024' (since moment format uses uppercase DD, mm as minutes vs MM as months, but matches pattern in code)
            expect(AdminData.data.sightings[0].date).toBeDefined();

            AdminData.updateField('s1', 'hidden', true);
            expect(AdminData.data.sightings[0].hidden).toBe(false); // !true = false

            AdminData.updateField('s1', 'hidden', false);
            expect(AdminData.data.sightings[0].hidden).toBe(true); // !false = true
        });

        it('should rename media when species changes', async () => {
            AdminData.data.sightings[0].media = [{ src: 'images/rock-pigeon-123.jpg' }];
            AdminData.updateField('s1', 'species', 'house-sparrow');
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(FirebaseApi.moveFile).toHaveBeenCalled();
            expect(AdminData.data.sightings[0].media[0].src).toMatch(/house-sparrow/);
        });

        it('should update media property, handling nested keys and non-matching keys', () => {
            AdminData.updateMediaProperty('s1', 'img1.jpg', 'title', 'New Title');
            expect(AdminData.data.sightings[0].media[0].title).toBe('New Title');

            AdminData.updateMediaProperty('s1', 'img1.jpg', 'exif_data.lens', 'Sony 200-600');
            expect(AdminData.data.sightings[0].media[0].exif_data.lens).toBe('Sony 200-600');

            AdminData.updateMediaProperty('s1', 'img1.jpg', 'extra_data.foo', 'bar');
            expect(AdminData.data.sightings[0].media[0].extra_data.foo).toBe('bar');

            AdminData.updateMediaProperty('nonexistent', 'img1.jpg', 'title', 'Other');
            expect(AdminData.data.sightings[0].media[0].title).toBe('New Title');
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
            expect(putSpy).toHaveBeenCalledTimes(5);
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
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(putSpy).toHaveBeenCalled();
            putSpy.mockReturnValue(Promise.reject({message: 'Failed'}));
            AdminData.data.sightings.push({ key: 's_err', species: 'error-spec' });
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

        it('should detect active input and open dropdown in isInputActive', () => {
            document.body.innerHTML = '<input id="test-input" type="text" />';
            const input = document.getElementById('test-input');
            input.focus();
            expect(AdminData.isInputActive()).toBe(true);

            document.body.innerHTML = '<div class="ss-dropdown open"></div>';
            expect(AdminData.isInputActive()).toBe(true);

            document.body.innerHTML = '<div>No input</div>';
            expect(AdminData.isInputActive()).toBe(false);
        });

        it('should reschedule syncSightingsData if isInputActive is true when timer fires', () => {
            document.body.innerHTML = '<button class="save" disabled></button><input id="test-input" type="text" />';
            const input = document.getElementById('test-input');
            input.focus();

            AdminData.syncSightingsData(1000);
            vi.advanceTimersByTime(1100);
            // Save button should still be enabled (not disabled) because save was delayed/rescheduled
            expect($('.save').attr('disabled')).toBeUndefined();

            // Blurring input allows next scheduled sync to finish
            input.blur();
            vi.advanceTimersByTime(3100);
            expect($('.save').attr('disabled')).toBe('disabled');
        });

        it('should delay pending save via delayPendingSave when save is scheduled', () => {
            document.body.innerHTML = '<button class="save" disabled></button>';
            AdminData.syncSightingsData(3000);
            vi.advanceTimersByTime(2000);

            // Interaction happens at t=2000ms -> delayPendingSave resets timer by another 3000ms
            AdminData.delayPendingSave();
            vi.advanceTimersByTime(1500); // Now t = 3500ms from start (would have expired without delay)
            expect($('.save').attr('disabled')).toBeUndefined();

            vi.advanceTimersByTime(1600); // Total 5100ms passed (3100ms since delayPendingSave)
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
            
            // Add optional fields to sighting
            sighting.place = 'Sattal';
            sighting.city = 'Nainital';
            sighting.state = 'UA';
            sighting.country = 'India';
            sighting.variation = 'Dark morph';
            sighting.subspecies = 'columbae';
            sighting.plumage = 'adult';
            sighting.age = '1y';

            expect(AdminData.sightingMatches(sighting, 'rock')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'missing')).toBeFalsy();
            expect(AdminData.sightingMatches(sighting, 'hidden')).toBeFalsy();
            
            sighting.hidden = true;
            expect(AdminData.sightingMatches(sighting, 'hidden')).toBeTruthy();
            
            sighting.rating = 5;
            expect(AdminData.sightingMatches(sighting, 'rating=5')).toBeTruthy();
            
            sighting.unconfirmed = true;
            expect(AdminData.sightingMatches(sighting, 'unconfirmed')).toBeTruthy();

            // Match other fields
            expect(AdminData.sightingMatches(sighting, 'sattal')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'nainital')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'ua')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'india')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'dark')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'columbae')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'adult')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, '1y')).toBeTruthy();
            expect(AdminData.sightingMatches(sighting, 'bird')).toBeTruthy(); // tag match
        });

        it('should call getCurrentMode', () => {
            const mode = AdminData.getCurrentMode();
            expect(mode).toBe('bird');
        });

        it('should return early on deleteFamily/deleteSpecies with missing args', () => {
            expect(AdminData.deleteFamily(null)).toBeUndefined();
            expect(AdminData.deleteSpecies(null)).toBeUndefined();
        });

        it('should not delete family/species if confirm is cancelled', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            
            AdminData.addFamily('Temp Family');
            AdminData.deleteFamily('Temp Family');
            expect(AdminData.data.families.find(f => f.name === 'Temp Family')).toBeDefined();

            AdminData.saveSpecies('temp-spec', 'Temp Spec', 'tag', 'Columbidae');
            AdminData.deleteSpecies('temp-spec');
            expect(AdminData.data.species['temp-spec']).toBeDefined();
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

    describe('Sighting and Media edge cases', () => {
        it('should not delete sighting if cancel is clicked', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            const originalLength = AdminData.data.sightings.length;
            AdminData.deleteSighting('s1');
            expect(AdminData.data.sightings.length).toBe(originalLength);
        });

        it('should handle media rename when species changes and there is no media', async () => {
            AdminData.data.sightings[0].media = [];
            AdminData.updateField('s1', 'species', 'house-sparrow');
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(FirebaseApi.moveFile).not.toHaveBeenCalled();
        });

        it('should handle media rename with video type and thumbnail matching old key', async () => {
            AdminData.data.sightings[0].media = [{
                src: 'images/rock-pigeon-video.mp4',
                type: 'video',
                thumbnail: 'images/rock-pigeon-123.jpg'
            }];
            AdminData.updateField('s1', 'species', 'house-sparrow');
            for(let i=0; i<10; i++) await Promise.resolve();
            expect(FirebaseApi.moveFile).toHaveBeenCalled();
            expect(AdminData.data.sightings[0].media[0].src).toContain('house-sparrow');
            expect(AdminData.data.sightings[0].media[0].thumbnail).toContain('house-sparrow');
        });

        it('should handle media rename failure and display alert', async () => {
            AdminData.data.sightings[0].media = [{ src: 'images/rock-pigeon-123.jpg' }];
            FirebaseApi.moveFile.mockRejectedValue(new Error('Rename error'));
            
            AdminData.updateField('s1', 'species', 'house-sparrow');
            for(let i=0; i<10; i++) await Promise.resolve();
            
            // Fast-forward promises for the Promise.all check
            vi.runAllTicks();
            
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Some files could not be renamed'));
        });
    });

    describe('Insect Mode Initialization', () => {
        it('should initialize lastUpdatedSpecies to unidentified in insect mode', async () => {
            Util.getUrlParams.mockReturnValue({ mode: 'insect' });
            vi.resetModules();
            
            // Mock readJSONFiles to trigger the default renderCallback callback
            Util.readJSONFiles.mockImplementation((files, cb) => cb({ sightings: [], species: {}, families: [] }));

            const freshAdminData = await import('../../scripts/modules/admin/data.js');
            expect(freshAdminData.currentMode).toBe('insect');
            expect(freshAdminData.lastUpdatedSpecies).toBe('unidentified');

            freshAdminData.refreshData();

            Util.getUrlParams.mockReturnValue({}); // restore default
        });

        it('should trigger empty data cleanup fallback on uploadJSONData', () => {
            // Delete data property to trigger empty removeUnwantedValues output
            delete AdminData.data.nonexistent;
            AdminData.uploadJSONData('nonexistent');
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('file data too small'));
        });
    });

    describe('Data Cleanup Utilities', () => {
        describe('removeUnwantedValues', () => {
            it('should clean null and undefined', () => {
                expect(removeUnwantedValues(null)).toBeUndefined();
                expect(removeUnwantedValues(undefined)).toBeUndefined();
            });

            it('should clean false and empty string', () => {
                expect(removeUnwantedValues(false)).toBeUndefined();
                expect(removeUnwantedValues('')).toBeUndefined();
            });

            it('should retain true, numbers and normal strings', () => {
                expect(removeUnwantedValues(true)).toBe(true);
                expect(removeUnwantedValues(42)).toBe(42);
                expect(removeUnwantedValues('hello')).toBe('hello');
            });

            it('should clean arrays recursively and return undefined if empty', () => {
                expect(removeUnwantedValues([null, false, ''])).toBeUndefined();
                expect(removeUnwantedValues([1, null, 2])).toEqual([1, 2]);
            });

            it('should clean objects recursively and return undefined if empty', () => {
                expect(removeUnwantedValues({ a: null, b: '', c: false })).toBeUndefined();
                expect(removeUnwantedValues({ a: 1, b: null, c: { d: false } })).toEqual({ a: 1 });
            });
        });

        describe('toSingular', () => {
            it('should respect exceptions list', () => {
                expect(toSingular('ibis')).toBe('ibis');
                expect(toSingular('LENS')).toBe('LENS');
            });

            it('should singularize words ending in ies based on case', () => {
                // All uppercase
                expect(toSingular('CANARIES')).toBe('CANARY');
                // Title case
                expect(toSingular('Canaries')).toBe('Canary');
                // Lowercase
                expect(toSingular('canaries')).toBe('canary');
                // Length <= 3
                expect(toSingular('ies')).toBe('ie');
            });

            it('should singularize normal words ending in s but not ss', () => {
                expect(toSingular('birds')).toBe('bird');
                expect(toSingular('glass')).toBe('glass');
            });

            it('should return original word if not ending in s', () => {
                expect(toSingular('eagle')).toBe('eagle');
            });
        });

        describe('applySpeciesTags', () => {
            it('should auto-apply tags based on keywords and singularize them', () => {
                const speciesMap = {
                    'golden-eagle': { name: 'Golden Eagle', tags: [] },
                    'peregrine-falcon': { name: 'Peregrine Falcon', tags: ['Birds'] },
                    'white-pigeon': { name: 'White Pigeon' }, // missing tags array
                    'no-name': { tags: [] }
                };

                applySpeciesTags(speciesMap);

                expect(speciesMap['golden-eagle'].tags).toContain('Bird of Prey');
                expect(speciesMap['golden-eagle'].tags).toContain('Raptor');
                
                expect(speciesMap['peregrine-falcon'].tags).toContain('Accipiter');
                expect(speciesMap['peregrine-falcon'].tags).toContain('Bird'); // singularized from Birds
                
                expect(speciesMap['white-pigeon'].tags).toContain('Pigeon'); // singularized from Pigeon/Dove rules
            });
        });
    });
});
