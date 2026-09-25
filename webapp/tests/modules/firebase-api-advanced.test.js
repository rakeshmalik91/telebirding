import { describe, it, expect, vi, beforeEach } from 'vitest';
import FirebaseApi from '../../scripts/modules/firebase-api.js';

describe('FirebaseApi - Advanced Operations', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            blob: () => Promise.resolve(new Blob(['test-data']))
        }));

        // Mock download URL
        vi.spyOn(firebase.storage().ref(), 'getDownloadURL').mockResolvedValue('http://example.com/file');
    });

    it('should move a file in storage by copying and then deleting the old one', async () => {
        const storageRef = firebase.storage().ref();
        
        await FirebaseApi.moveFile('old/path.jpg', 'new/path.jpg');

        expect(storageRef.getDownloadURL).toHaveBeenCalled();
        expect(storageRef.put).toHaveBeenCalled();
        expect(storageRef.delete).toHaveBeenCalled();
    });
});
