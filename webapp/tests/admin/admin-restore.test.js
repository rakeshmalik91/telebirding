import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as AdminRestore from '../../scripts/modules/admin/restore.js';
import * as AdminData from '../../scripts/modules/admin/data.js';
import FirebaseApi from '../../scripts/modules/firebase-api.js';
import * as AdminUi from '../../scripts/modules/admin/ui.js';
import Constants from '../../scripts/modules/constants.js';

vi.mock('../../scripts/modules/firebase-api.js', () => ({
    default: {
        getFirebase: vi.fn()
    }
}));

vi.mock('../../scripts/modules/admin/ui.js', () => ({
    customAlert: vi.fn(),
    customConfirm: vi.fn((msg, cb) => cb()),
    showToast: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn()
}));

vi.mock('../../scripts/modules/admin/data.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        uploadJSONData: vi.fn(() => Promise.resolve()),
        triggerRender: vi.fn(),
        syncSightingsData: vi.fn()
    };
});

const flushMicrotasks = async (count = 30) => {
    for (let i = 0; i < count; i++) {
        await Promise.resolve();
    }
};

describe('Admin Restore Module', () => {
    let mockStorage;
    let mockBackupFolderRef;

    beforeEach(() => {
        document.body.innerHTML = `
            <button class="restore-backup">Restore</button>
        `;

        mockBackupFolderRef = {
            name: '2026-11-23',
            listAll: vi.fn().mockResolvedValue({
                items: [{ name: 'places.json' }],
                prefixes: []
            }),
            child: vi.fn((path) => ({
                name: path,
                getDownloadURL: vi.fn().mockResolvedValue('http://mock.url/' + path),
                listAll: vi.fn().mockResolvedValue({ items: [], prefixes: [] }),
                delete: vi.fn().mockResolvedValue()
            }))
        };

        mockStorage = {
            ref: vi.fn((path) => {
                if (path === 'backup') {
                    return {
                        listAll: vi.fn().mockResolvedValue({
                            prefixes: [mockBackupFolderRef]
                        })
                    };
                }
                if (path.startsWith('backup/')) {
                    return {
                        child: vi.fn((subPath) => ({
                            name: subPath,
                            getDownloadURL: vi.fn().mockResolvedValue('http://mock.url/' + subPath),
                            listAll: vi.fn().mockResolvedValue({
                                items: subPath === 'geo' ? [{
                                    name: 'India.json',
                                    getDownloadURL: vi.fn().mockResolvedValue('http://mock.url/geo/India.json')
                                }] : [],
                                prefixes: []
                            }),
                            delete: vi.fn().mockResolvedValue()
                        })),
                        listAll: vi.fn().mockResolvedValue({
                            items: [
                                { name: 'places.json', delete: vi.fn().mockResolvedValue() },
                                { name: 'bird-sightings.json', delete: vi.fn().mockResolvedValue() }
                            ],
                            prefixes: [
                                {
                                    name: 'geo',
                                    listAll: vi.fn().mockResolvedValue({
                                        items: [{ name: 'India.json', delete: vi.fn().mockResolvedValue() }]
                                    })
                                }
                            ]
                        })
                    };
                }
                // Data uploads
                return {
                    put: vi.fn().mockResolvedValue({ metadata: { generation: '123' } }),
                    delete: vi.fn().mockResolvedValue(),
                    getDownloadURL: vi.fn().mockResolvedValue('http://mock.url/' + path)
                };
            })
        };

        FirebaseApi.getFirebase.mockReturnValue({
            storage: () => mockStorage
        });

        // Mock global fetch for restore JSON downloads
        global.fetch = vi.fn((url) => {
            let data = {};
            if (url.includes('places.json')) {
                data = { countries: { India: { name: 'India' } } };
            } else if (url.includes('sightings.json')) {
                data = { sightings: [{ key: 's1', species: 'test' }] };
            } else if (url.includes('species.json')) {
                data = { species: { 'test': { key: 'test', name: 'Test' } } };
            } else if (url.includes('families.json')) {
                data = { families: [{ name: 'TestFamily' }] };
            } else if (url.includes('likes.json')) {
                data = { likes: { s1: 5 } };
            } else if (url.includes('India.json')) {
                data = {
                    country: { type: 'Feature', properties: { name: 'India' }, geometry: {} },
                    states: { type: 'FeatureCollection', features: [] }
                };
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(data)
            });
        });

        vi.clearAllMocks();
    });

    afterEach(() => {
        $('#backup-list-modal').remove();
    });

    describe('setupRestoreListeners', () => {
        it('should show alert if no backup folders exist', async () => {
            mockStorage.ref = vi.fn((path) => {
                if (path === 'backup') {
                    return {
                        listAll: vi.fn().mockResolvedValue({ prefixes: [] })
                    };
                }
                return {};
            });

            AdminRestore.setupRestoreListeners();
            $('.restore-backup').trigger('click');

            await flushMicrotasks();

            expect(AdminUi.customAlert).toHaveBeenCalledWith('No backups found.');
        });

        it('should open modal listing available backups across all modes', async () => {
            AdminRestore.setupRestoreListeners();
            $('.restore-backup').trigger('click');

            await flushMicrotasks();

            expect($('#backup-list-modal').length).toBe(1);
            expect($('#backup-list-modal').text()).toContain('2026-11-23');
            expect($('#backup-list-modal').text()).toContain('all modes');

            $('#close-backup-list').trigger('click');
            expect($('#backup-list-modal').length).toBe(0);
        });
    });

    describe('restoreBackup', () => {
        it('should restore all modes, places, and geo boundaries', async () => {
            AdminRestore.restoreBackup('2026-11-23');
            await flushMicrotasks();

            // Places should be restored
            expect(AdminData.data.countries).toBeDefined();
            expect(AdminData.data.countries.India).toBeDefined();
            expect(AdminData.uploadJSONData).toHaveBeenCalledWith('places', true);

            // Active mode sightings and data should be restored
            expect(AdminData.data.sightings).toBeDefined();
            expect(AdminData.data.species).toBeDefined();
            expect(AdminData.uploadJSONData).toHaveBeenCalledWith('sightings', true);
            expect(AdminData.triggerRender).toHaveBeenCalled();
            expect(AdminData.syncSightingsData).toHaveBeenCalled();

            // Geo boundaries should be updated
            expect(AdminData.data.geoCountries.features.length).toBeGreaterThan(0);

            // Toast shown with multi-mode files restored
            expect(AdminUi.showToast).toHaveBeenCalled();
            const toastMsg = AdminUi.showToast.mock.calls[0][0];
            expect(toastMsg).toContain('across all modes');
        });
    });

    describe('deleteBackup', () => {
        it('should confirm and delete entire backup folder including geo subfolder', async () => {
            const $element = $('<div><button class="delete-this-backup">Delete</button></div>');
            $('body').append($element);

            AdminRestore.deleteBackup('2026-11-23', $element);
            await flushMicrotasks();

            expect(AdminUi.customConfirm).toHaveBeenCalledWith(
                expect.stringContaining('all modes'),
                expect.any(Function)
            );
            expect(AdminUi.showToast).toHaveBeenCalledWith('Backup deleted successfully', 'success');
        });
    });
});
