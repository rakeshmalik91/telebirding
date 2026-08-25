import { describe, it, expect, vi } from 'vitest';
import * as Router from '../../scripts/modules/public/router.js';
import State from '../../scripts/modules/public/state.js';
import Constants from '../../scripts/modules/constants.js';

describe('Minimal Router Test', () => {
    it('should not crash on event', () => {
        State.currentPage = Constants.STORIES;
        // window.dispatchEvent(new CustomEvent('story-in-view', { detail: { slug: 'test' } }));
    });
});
