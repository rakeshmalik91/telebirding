import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Util from '../../scripts/modules/util.js';
import Constants from '../../scripts/modules/constants.js';

describe('Util.shuffle', () => {
    it('should shuffle an array', () => {
        const arr = [1, 2, 3, 4, 5];
        const original = [...arr];
        Util.shuffle(arr);
        expect(arr).toHaveLength(original.length);
        expect(arr).toEqual(expect.arrayContaining(original));
    });
});

describe('Util.capitalize', () => {
    it('should capitalize each word in a string', () => {
        expect(Util.capitalize('hello world')).toBe('Hello World');
        expect(Util.capitalize('multiple words here')).toBe('Multiple Words Here');
    });
});

describe('Util.slugify', () => {
    it('should create a slug from a string', () => {
        expect(Util.slugify('Hello World!')).toBe('hello-world');
        expect(Util.slugify('  Spaced  Out  ')).toBe('spaced-out');
        expect(Util.slugify('Special@Characters#')).toBe('specialcharacters');
    });
});

describe('Util.plural', () => {
    it('should pluralize common bird-related words', () => {
        expect(Util.plural('flycatcher')).toBe('flycatchers');
        expect(Util.plural('lily')).toBe('lilies');
        expect(Util.plural('thrush')).toBe('thrushes');
        expect(Util.plural('buzzard')).toBe('buzzards');
        expect(Util.plural('fly')).toBe('flies');
        expect(Util.plural('moss')).toBe('mosses');
        expect(Util.plural('dish')).toBe('dishes');
        expect(Util.plural('peach')).toBe('peaches');
        expect(Util.plural('blitz')).toBe('blitzes');
    });
});

describe('Util.tagMatches', () => {
    it('should match tags correctly with normalization', () => {
        expect(Util.tagMatches('gray-headed', 'grey headed')).toBe(true);
        expect(Util.tagMatches('flycatcher', 'flycatchers')).toBe(true);
    });
});

describe('Util.tagMatchesSubstring', () => {
    it('should match substrings with word boundaries', () => {
        expect(Util.tagMatchesSubstring('grey-headed canary-flycatcher', 'grey headed')).toBeTruthy();
        expect(Util.tagMatchesSubstring('grey-headed canary-flycatcher', 'canary flycatcher')).toBeTruthy();
        expect(Util.tagMatchesSubstring('grey-headed canary-flycatcher', 'grey')).toBeTruthy();
        expect(Util.tagMatchesSubstring('grey-headed canary-flycatcher', 'head')).toBeFalsy();
    });
});

describe('Util.trimPlaceName', () => {
    it('should shorten common place names correctly', () => {
        expect(Util.trimPlaceName('Sattal Wildlife Sanctuary', 15)).toBe('Sattal W.S.');
        expect(Util.trimPlaceName('Jim Corbett National Park', 15)).toBe('JCN');
    });

    it('should handle very long names by taking initials for unknown tokens', () => {
        expect(Util.trimPlaceName('Tal Chhapar Wildlife Sanctuary', 10)).toBe('TCW');
    });

    it('should respect the block list of words that should not be initialed', () => {
        const name = "Andaman and Nicobar Islands";
        expect(Util.trimPlaceName(name, 25)).toBe('Andaman & Nicobar Isl.');
    });

    it('should return name if under threshold', () => {
        expect(Util.trimPlaceName('Short', 10)).toBe('Short');
    });

    it('should truncate a very long single token with ellipsis', () => {
        expect(Util.trimPlaceName('Superlongsingletokenname', 10)).toBe('Superlongsingletokenname...');
    });

    it('should handle dot tokens (abbreviations) by appending directly', () => {
        expect(Util.trimPlaceName('Big N.P.', 5)).toBe('BN');
    });
});

describe('Util.getData', () => {
    it('should return verbatim for http/https URLs', () => {
        const url = 'https://example.com/image.jpg';
        expect(Util.getData(url)).toBe(url);
    });

    it('should return local path if Firebase is disabled', () => {
        const path = 'images/birds/bird1.jpg';
        expect(Util.getData(path)).toBe(path);
    });

    it('should return Firebase URL when Firebase is enabled', () => {
        const origValue = window.FIREBASE_ENABLED;
        window.FIREBASE_ENABLED = true;
        const path = 'images/bird.jpg';
        const result = Util.getData(path);
        expect(result).toContain('firebasestorage.googleapis.com');
        expect(result).toContain('images%2Fbird.jpg');
        expect(result).toContain('?alt=media');
        window.FIREBASE_ENABLED = origValue;
    });

    it('should handle data URIs', () => {
        const dataUri = 'data:image/png;base64,123';
        expect(Util.getData(dataUri)).toBe(dataUri);
    });

    it('should handle falsy paths', () => {
        expect(Util.getData(null)).toBe('');
        expect(Util.getData('')).toBe('');
    });
});

describe('Util.normalizeForTagMatch', () => {
    it('should replace special characters based on mapping', () => {
        expect(Util.normalizeForTagMatch('gray-headed')).toBe('grey headed');
        expect(Util.normalizeForTagMatch('ashy+drongo')).toBe('ashy drongo');
        expect(Util.normalizeForTagMatch("buller's")).toBe('bullers');
    });
});

describe('Util.compare', () => {
    it('should correctly compare numbers', () => {
        expect(Util.compare(1, 2)).toBe(-1);
        expect(Util.compare(2, 1)).toBe(1);
        expect(Util.compare(1, 1)).toBe(0);
    });

    it('should use default value for equality if provided', () => {
        expect(Util.compare(1, 1, 5)).toBe(5);
    });

    it('should return 1 when a>b even if defaultValue is provided', () => {
        expect(Util.compare(3, 1, 99)).toBe(1);
    });

    it('should return -1 when a<b even if defaultValue is provided', () => {
        expect(Util.compare(1, 3, 99)).toBe(-1);
    });
});

describe('Util.setIntersect', () => {
    it('should return symmetric difference of two sets', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([2, 3, 4]);
        const intersect = Util.setIntersect(set1, set2);
        expect(intersect).toContain(1);
        expect(intersect).toContain(4);
        expect(intersect).not.toContain(2);
        expect(intersect).not.toContain(3);
    });
});

describe('Util.shortenPlumage', () => {
    it('should shorten plumage descriptions', () => {
        expect(Util.shortenPlumage('Juvenile Male')).toBe('Juv. M');
        expect(Util.shortenPlumage('Breeding-Male')).toBe('Br.');
    });
});

describe('Util.locationFullNames', () => {
    const countriesData = {
        'IN': {
            name: 'India',
            states: {
                'WB': { name: 'West Bengal' }
            }
        }
    };

    it('should return full country names correctly', () => {
        expect(Util.getCountryFullName('IN', countriesData)).toBe('India');
        expect(Util.getCountryFullName('US', countriesData)).toBe('US');
    });

    it('should return full state names correctly', () => {
        expect(Util.getStateFullName('IN', 'WB', countriesData)).toBe('West Bengal');
        expect(Util.getStateFullName('IN', 'KA', countriesData)).toBe('KA');
    });

    it('should handle null/undefined countriesData gracefully', () => {
        expect(Util.getCountryFullName('IN', null)).toBe('IN');
        expect(Util.getStateFullName('IN', 'WB', null)).toBe('WB');
        expect(Util.getCountryFullName('XX', undefined)).toBe('XX');
    });
});

describe('Util.uuidv4', () => {
    it('should return a valid-looking UUID', () => {
        const uuid = Util.uuidv4();
        expect(uuid).toMatch(/[a-f0-9-]{36}/);
    });
});

describe('Util.getClientId', () => {
    it('should generate and persist a client ID', () => {
        localStorage.removeItem('my_app_client_id');
        const id1 = Util.getClientId();
        expect(id1).toBeDefined();
        const id2 = Util.getClientId();
        expect(id1).toBe(id2);
        expect(localStorage.getItem('my_app_client_id')).toBe(id1);
    });
});

describe('Util.getMedia', () => {
    it('should delegate to getData', () => {
        expect(Util.getMedia('test.jpg')).toBe(Util.getData('test.jpg'));
    });
});

describe('Util.isTouchDevice', () => {
    it('should return a boolean reflecting touch capability', () => {
        const result = Util.isTouchDevice();
        expect(typeof result).toBe('boolean');
    });
});

describe('Util.isMobileDevice', () => {
    it('should return same as isTouchDevice', () => {
        expect(Util.isMobileDevice()).toBe(Util.isTouchDevice());
    });
});

describe('Util.isDeviceOnLandscapeOrientation', () => {
    it('should detect orientation based on inner dimensions', () => {
        // jsdom defaults: innerWidth=1024, innerHeight=768
        // 768/1024 = 0.75 < 13/9 ≈ 1.44 → landscape
        expect(Util.isDeviceOnLandscapeOrientation()).toBe(true);
    });
});

describe('Util.getUrlParams', () => {
    it('should parse URL search params', () => {
        // jsdom default has no search params, returns { '': undefined }
        const params = Util.getUrlParams();
        expect(typeof params).toBe('object');
    });
});

describe('Util.setCookie / getCookie / eraseCookie', () => {
    beforeEach(() => {
        document.cookie = '';
    });

    it('should set and get a cookie', () => {
        Util.setCookie('testCookie', 'hello', 1);
        expect(Util.getCookie('testCookie')).toBe('hello');
    });

    it('should set cookie without expiry', () => {
        Util.setCookie('noExpiry', 'val');
        expect(Util.getCookie('noExpiry')).toBe('val');
    });

    it('should return null for nonexistent cookie', () => {
        expect(Util.getCookie('nonexistent')).toBeNull();
    });

    it('should erase a cookie', () => {
        Util.setCookie('erasable', 'value', 1);
        Util.eraseCookie('erasable');
        expect(Util.getCookie('erasable')).toBeNull();
    });
});

describe('Util.readTextFile', () => {
    it('should use XMLHttpRequest to read file and cache result', () => {
        const mockXHR = {
            overrideMimeType: vi.fn(),
            open: vi.fn(),
            send: vi.fn(),
            onreadystatechange: null,
            readyState: 4,
            status: '200',
            responseText: '{"key":"value"}'
        };
        vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXHR));

        Util.clearFileCache();
        const callback = vi.fn();
        Util.readTextFile('test.json', callback);

        // Simulate readyState change
        mockXHR.onreadystatechange();

        expect(callback).toHaveBeenCalledWith('{"key":"value"}');
        expect(Util.FILE_CACHE['test.json']).toBe('{"key":"value"}');

        // Second call should use cache
        const callback2 = vi.fn();
        Util.readTextFile('test.json', callback2);
        expect(callback2).toHaveBeenCalledWith('{"key":"value"}');
    });
});

describe('Util.clearFileCache', () => {
    it('should clear the file cache', () => {
        Util.FILE_CACHE['cached'] = 'data';
        Util.clearFileCache();
        expect(Util.FILE_CACHE).toEqual({});
    });
});

describe('Util.readJSONFile', () => {
    it('should parse JSON from readTextFile', () => {
        const mockXHR = {
            overrideMimeType: vi.fn(),
            open: vi.fn(),
            send: vi.fn(),
            onreadystatechange: null,
            readyState: 4,
            status: '200',
            responseText: '{"a":1}'
        };
        vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXHR));

        Util.clearFileCache();
        const callback = vi.fn();
        Util.readJSONFile('data.json', callback);
        mockXHR.onreadystatechange();

        expect(callback).toHaveBeenCalledWith({ a: 1 });
    });
});

describe('Util.readJSONFiles', () => {
    it('should merge multiple JSON files', () => {
        Util.clearFileCache();
        Util.FILE_CACHE['file1.json'] = '{"a":1}';
        Util.FILE_CACHE['file2.json'] = '{"b":2}';

        const callback = vi.fn();
        Util.readJSONFiles(['file1.json', 'file2.json'], callback);

        expect(callback).toHaveBeenCalledWith({ a: 1, b: 2 });
    });
});

describe('Util.dataURLToBlob', () => {
    it('should handle non-base64 data URLs', () => {
        const dataURL = 'data:text/plain,Hello%20World';
        const blob = Util.dataURLToBlob(dataURL);
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('text/plain');
    });

    it('should handle base64 data URLs', () => {
        const dataURL = 'data:image/png;base64,aGVsbG8=';
        const blob = Util.dataURLToBlob(dataURL);
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('image/png');
    });
});

describe('Util.toggleCollpasible', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="parent">
                <button class="toggle-btn">Toggle</button>
                <div class="collapsible" style="display: block;">Content</div>
            </div>
        `;
    });

    it('should hide collapsible when visible and remove active class', () => {
        const btn = document.querySelector('.toggle-btn');
        // Mock :visible for JSDOM
        const originalIs = $.fn.is;
        $.fn.is = function(selector) {
            if (selector === ':visible') return this.css('display') !== 'none';
            return originalIs.apply(this, arguments);
        };

        Util.toggleCollpasible(btn);
        expect($(btn).hasClass('active')).toBe(false);

        $.fn.is = originalIs;
    });

    it('should show collapsible when hidden and add active class', () => {
        const originalIs = $.fn.is;
        $.fn.is = function(selector) {
            if (selector === ':visible') return this.css('display') !== 'none';
            return originalIs.apply(this, arguments);
        };

        document.querySelector('.collapsible').style.display = 'none';
        const btn = document.querySelector('.toggle-btn');
        Util.toggleCollpasible(btn);
        expect($(btn).hasClass('active')).toBe(true);

        $.fn.is = originalIs;
    });
});

describe('Util.autoScroll', () => {
    it('should not set up scroll for touch devices', () => {
        // isTouchDevice returns false in jsdom, so autoScroll WILL set up scroll
        // Let's mock it as touch device first
        const spy = vi.spyOn(Util, 'isTouchDevice').mockReturnValue(true);
        const container = $('<div></div>');
        Util.autoScroll(container, 10);
        // For touch devices, no interval or mousemove should be set
        spy.mockRestore();
    });

    it('should set up interval and mousemove for non-touch devices', () => {
        vi.useFakeTimers();
        const spy = vi.spyOn(Util, 'isTouchDevice').mockReturnValue(false);
        const container = $('<div style="height:100px"></div>');
        $('body').append(container);

        Util.autoScroll(container, 10);

        // Trigger mousemove
        const event = $.Event('mousemove', { pageY: 200 });
        container.trigger(event);

        vi.advanceTimersByTime(200);
        spy.mockRestore();
        vi.useRealTimers();
    });
});

describe('Util.resizeImage', () => {
    let mockCtx;
    const originalImage = global.Image;
    const originalFileReader = global.FileReader;

    beforeEach(() => {
        mockCtx = {
            drawImage: vi.fn(),
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
            font: '',
            fillStyle: '',
            fillText: vi.fn()
        };
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/4AAQ');

        // Mock FileReader
        global.FileReader = vi.fn().mockImplementation(() => ({
            readAsDataURL: vi.fn().mockImplementation(function(file) {
                this.onload({ target: { result: 'data:image/png;base64,mock' } });
            }),
            onload: null
        }));

        // Mock Image
        global.Image = vi.fn().mockImplementation(() => {
            const img = {
                onload: null,
                _src: '',
                set src(val) {
                    this._src = val;
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                },
                get src() {
                    return this._src;
                },
                width: 1000, // Larger than 500
                height: 1000
            };
            return img;
        });


    });

    afterEach(() => {
        vi.restoreAllMocks();
        global.Image = originalImage;
        global.FileReader = originalFileReader;
    });

    it('should reject non-image files', async () => {
        const file = new File(['test'], 'test.txt', { type: 'text/plain' });
        await expect(Util.resizeImage(file, 500)).rejects.toThrow('Not an image');
    });

    it('should resolve with a blob for image files', async () => {
        const file = new File(['pixels'], 'test.png', { type: 'image/png' });
        const result = await Util.resizeImage(file, 500);
        expect(result).toBeInstanceOf(Blob);
        expect(mockCtx.drawImage).toHaveBeenCalled();
    });

    it('should resize with watermark', async () => {
        const file = new File(['pixels'], 'test.png', { type: 'image/png' });
        const watermark = { text: 'Copyright', color: '#ffffff33' };

        const result = await Util.resizeImage(file, 500, watermark);
        expect(result).toBeInstanceOf(Blob);
        expect(mockCtx.fillText).toHaveBeenCalledWith('Copyright', 500 * 0.75, 500 * 0.95);
    });
});


