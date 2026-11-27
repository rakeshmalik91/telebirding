import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AdminData from '../../scripts/modules/admin/data.js';
import * as AdminUi from '../../scripts/modules/admin/ui.js';

vi.mock('../../scripts/modules/admin/data.js', () => {
    let mode = 'bird';
    return {
        get currentMode() { return mode; },
        setCurrentMode: vi.fn((m) => { mode = m; }),
        refreshData: vi.fn(),
        setRenderCallback: vi.fn(),
        hasUnsavedChanges: vi.fn(() => false)
    };
});

vi.mock('../../scripts/modules/admin/ui.js', () => ({
    customAlert: vi.fn()
}));

vi.mock('../../scripts/modules/admin/rendering.js', () => ({
    setupUpdateSpeciesForm: vi.fn(),
    renderSightingsTable: vi.fn(),
    updatePaginationControls: vi.fn(),
    setupAddFamilyForm: vi.fn(),
    setupPlacesTab: vi.fn()
}));

vi.mock('../../scripts/modules/admin/auth.js', () => ({
    setupAuthListeners: vi.fn()
}));

vi.mock('../../scripts/modules/admin/listeners.js', () => ({
    setupDashboardListeners: vi.fn()
}));

vi.mock('../../scripts/modules/admin/cleanup.js', () => ({
    setupCleanupListeners: vi.fn()
}));

vi.mock('../../scripts/modules/admin/restore.js', () => ({
    setupRestoreListeners: vi.fn()
}));

vi.mock('../../scripts/modules/admin/ebird-sync.js', () => ({
    setupEbirdSync: vi.fn()
}));

import { switchMode, viewState } from '../../scripts/admin.js';

describe('Admin Mode Switch', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="mode-tab" data-mode="bird"></div>
            <div class="mode-tab" data-mode="insect"></div>
            <div class="mode-tab" data-mode="reptile"></div>
            <div class="site-logo"></div>
            <div class="input-clear-wrapper has-value">
                <input name="filter-sighting" value="sparrow" />
                <span class="input-clear-btn">✕</span>
            </div>
        `;
        viewState.offset = 30;
        viewState.rows = 10;
        vi.clearAllMocks();
    });

    it('should reset offset to 0 and clear filter input when mode is changed', () => {
        expect(viewState.offset).toBe(30);
        expect($('input[name=filter-sighting]').val()).toBe('sparrow');

        switchMode('insect');

        expect(AdminData.setCurrentMode).toHaveBeenCalledWith('insect');
        expect(viewState.offset).toBe(0);
        expect($('input[name=filter-sighting]').val()).toBe('');
        expect($('.input-clear-wrapper').hasClass('has-value')).toBe(false);
        expect(AdminData.refreshData).toHaveBeenCalled();
        expect($('.mode-tab[data-mode="insect"]').hasClass('active')).toBe(true);
    });

    it('should not switch or reset if hasUnsavedChanges is true', () => {
        vi.mocked(AdminData.hasUnsavedChanges).mockReturnValueOnce(true);

        switchMode('reptile');

        expect(AdminUi.customAlert).toHaveBeenCalled();
        expect(viewState.offset).toBe(30);
        expect($('input[name=filter-sighting]').val()).toBe('sparrow');
        expect(AdminData.refreshData).not.toHaveBeenCalled();
    });
});
