import { describe, it, expect, vi, beforeEach } from 'vitest';
import FirebaseApi from '../../scripts/modules/firebase-api.js';

describe('FirebaseApi', () => {
    beforeEach(() => {
        // Clear window mock if needed
        global.window.FIREBASE_ENABLED = undefined;
        // firebase is mocked in setup.js
    });

    it('should determine if Firebase is enabled based on origin', () => {
        // Mock localhost
        global.window.location = { origin: 'http://localhost:5000', pathname: '/' };
        expect(FirebaseApi.FIREBASE_ENABLED).toBe(false);

        // Mock production
        global.window.location = { origin: 'https://telebirding.com', pathname: '/' };
        expect(FirebaseApi.FIREBASE_ENABLED).toBe(true);

        // Mock admin override
        global.window.location = { origin: 'http://localhost:5000', pathname: '/admin' };
        expect(FirebaseApi.FIREBASE_ENABLED).toBe(true);
    });

    it('should allow manual override of FIREBASE_ENABLED', () => {
        global.window.FIREBASE_ENABLED = true;
        global.window.location = { origin: 'http://localhost:5000', pathname: '/' };
        expect(FirebaseApi.FIREBASE_ENABLED).toBe(true);
    });

    it('should initialize firebase correctly via getFirebase', () => {
        vi.spyOn(firebase, 'initializeApp');
        const fb = FirebaseApi.getFirebase();
        expect(fb).toBe(firebase);
        expect(firebase.initializeApp).toHaveBeenCalledWith(FirebaseApi.config);
    });

    it('should activate app check when FIREBASE_APPCHECK_ENABLED is true', async () => {
        vi.resetModules();
        const { default: FreshFirebaseApi } = await import('../../scripts/modules/firebase-api.js');

        const origValue = FreshFirebaseApi.FIREBASE_APPCHECK_ENABLED;
        FreshFirebaseApi.FIREBASE_APPCHECK_ENABLED = true;

        // Mock appCheck
        const activateFn = vi.fn();
        firebase.appCheck = vi.fn(() => ({ activate: activateFn }));
        firebase.appCheck.ReCaptchaV3Provider = vi.fn();

        const fb = FreshFirebaseApi.getFirebase();
        expect(fb).toBe(firebase);
        expect(activateFn).toHaveBeenCalled();

        FreshFirebaseApi.FIREBASE_APPCHECK_ENABLED = origValue;
    });

    it('should have moveFile method that chains Firebase operations', async () => {
        const mockBlob = new Blob(['data']);
        const mockUrl = 'https://firebasestorage.googleapis.com/test';

        const deleteFn = vi.fn(() => Promise.resolve());
        const putFn = vi.fn(() => Promise.resolve());
        const getDownloadURLFn = vi.fn(() => Promise.resolve(mockUrl));

        firebase.storage = vi.fn(() => ({
            ref: vi.fn(() => ({
                getDownloadURL: getDownloadURLFn,
                put: putFn,
                delete: deleteFn
            }))
        }));

        // Mock fetch
        const origFetch = global.fetch;
        global.fetch = vi.fn(() => Promise.resolve({ blob: () => Promise.resolve(mockBlob) }));

        await FirebaseApi.moveFile('old/path.jpg', 'new/path.jpg');

        expect(global.fetch).toHaveBeenCalledWith(mockUrl);
        expect(putFn).toHaveBeenCalledWith(mockBlob);
        expect(deleteFn).toHaveBeenCalled();

        global.fetch = origFetch;
    });
});
