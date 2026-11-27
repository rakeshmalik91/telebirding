import { describe, it, expect, vi, beforeEach } from 'vitest';
import EbirdApi from '../../scripts/modules/ebird-api.js';

describe('EbirdApi', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    describe('fetchEbirdCode', () => {
        it('should return code for valid name', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([{ code: 'rockpi' }])
            });

            const code = await EbirdApi.fetchEbirdCode('Rock Pigeon');
            expect(code).toBe('rockpi');
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q=Rock%20Pigeon'));
        });

        it('should return undefined if no taxons found', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([])
            });

            const code = await EbirdApi.fetchEbirdCode('Unknown');
            expect(code).toBeUndefined();
        });

        it('should handle fetch errors', async () => {
            fetch.mockRejectedValue(new Error('Network error'));
            const code = await EbirdApi.fetchEbirdCode('Rock Pigeon');
            expect(code).toBeUndefined();
        });

        it('should return undefined for empty name', async () => {
            const code = await EbirdApi.fetchEbirdCode('');
            expect(code).toBeUndefined();
            expect(fetch).not.toHaveBeenCalled();
        });

        it('should reject fuzzy match when common name does not match query', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([
                    { code: 'bncwoo3', name: 'Brown-capped Pygmy Woodpecker - Yungipicus nanus' }
                ])
            });

            const code = await EbirdApi.fetchEbirdCode('Brown Woodpecker');
            expect(code).toBeUndefined();
        });

        it('should normalize curly apostrophe and match common name', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([
                    { code: 'blrwar1', name: "Blyth's Reed Warbler - Acrocephalus dumetorum" }
                ])
            });

            const code = await EbirdApi.fetchEbirdCode('Blyth\u2019s Reed Warbler');
            expect(code).toBe('blrwar1');
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=Blyth's%20Reed%20Warbler"));
        });

        it('should match common name with parenthetical variation', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([
                    { code: 'rocpig', name: 'Rock Pigeon (Feral Pigeon) - Columba livia' }
                ])
            });

            const code = await EbirdApi.fetchEbirdCode('Rock Pigeon');
            expect(code).toBe('rocpig');
        });
    });

    describe('fetchEbirdSciName', () => {
        it('should return data for valid code', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([{ sciName: 'Columba livia' }])
            });

            const data = await EbirdApi.fetchEbirdSciName('rockpi');
            expect(data.sciName).toBe('Columba livia');
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('species=rockpi'));
        });

        it('should handle invalid codes', async () => {
            fetch.mockResolvedValue({
                json: () => Promise.resolve([])
            });

            const data = await EbirdApi.fetchEbirdSciName('invalid');
            expect(data).toBeUndefined();
        });

        it('should return undefined for empty code', async () => {
            const data = await EbirdApi.fetchEbirdSciName('');
            expect(data).toBeUndefined();
            expect(fetch).not.toHaveBeenCalled();
        });

        it('should handle fetch errors', async () => {
            fetch.mockRejectedValue(new Error('Network error'));
            const data = await EbirdApi.fetchEbirdSciName('rockpi');
            expect(data).toBeUndefined();
        });
    });
});
