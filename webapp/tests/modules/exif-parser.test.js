import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const exifSource = fs.readFileSync(path.resolve(testDir, '../../lib/js/exif.js'), 'utf8');

function makeSegment(marker, payload) {
    const length = payload.length + 2;
    return Buffer.concat([Buffer.from([0xff, marker, length >> 8, length & 0xff]), payload]);
}

function makeJpegWithExifDate(date) {
    const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>', 'ascii');
    const tiff = Buffer.alloc(64);
    let offset = 0;
    tiff.write('II', offset, 'ascii'); offset += 2;
    tiff.writeUInt16LE(42, offset); offset += 2;
    tiff.writeUInt32LE(8, offset); offset += 4;

    // IFD0: point to the Exif IFD at TIFF offset 26.
    tiff.writeUInt16LE(1, offset); offset += 2;
    tiff.writeUInt16LE(34665, offset); offset += 2;
    tiff.writeUInt16LE(4, offset); offset += 2;
    tiff.writeUInt32LE(1, offset); offset += 4;
    tiff.writeUInt32LE(26, offset); offset += 4;
    tiff.writeUInt32LE(0, offset); offset += 4;

    // Exif IFD: DateTimeOriginal stored at TIFF offset 44.
    const dateText = `${date}\0`;
    tiff.writeUInt16LE(1, offset); offset += 2;
    tiff.writeUInt16LE(36867, offset); offset += 2;
    tiff.writeUInt16LE(2, offset); offset += 2;
    tiff.writeUInt32LE(dateText.length, offset); offset += 4;
    tiff.writeUInt32LE(44, offset); offset += 4;
    tiff.writeUInt32LE(0, offset); offset += 4;
    tiff.write(dateText, 44, 'ascii');

    const exif = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
    return Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        makeSegment(0xe1, xmp), // A non-EXIF APP1 segment comes first.
        makeSegment(0xe1, exif),
        Buffer.from([0xff, 0xd9])
    ]);
}

describe('EXIF JPEG parser', () => {
    it('continues past a non-EXIF APP1 segment to find DateTimeOriginal', () => {
        const context = {
            console,
            Uint8Array,
            ArrayBuffer,
            DataView,
            Blob,
            self: { Blob },
            FileReader: class {}
        };
        vm.runInNewContext(exifSource, context);

        const jpeg = makeJpegWithExifDate('2026:11:17 14:35:22');
        const buffer = jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength);
        const tags = context.EXIF.readFromBinaryFile(buffer);

        expect(tags.DateTimeOriginal).toBe('2026:11:17 14:35:22');
    });
});
