import moment from 'moment';
import jQuery from 'jquery';

global.moment = moment;
global.jQuery = jQuery;
global.$ = jQuery;

// Mock Firebase storage
const storageRef = {
    getDownloadURL: vi.fn(() => Promise.resolve('http://example.com/url')),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
};

global.firebase = {
    initializeApp: vi.fn(),
    storage: () => ({
        ref: vi.fn(() => storageRef)
    })
};
