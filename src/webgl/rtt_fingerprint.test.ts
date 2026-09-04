import {describe, test, expect} from 'vitest';
import {RTTFingerprint} from './rtt_fingerprint.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';

describe('RTTFingerprint', () => {
    const a = new OverscaledTileID(3, 0, 2, 1, 2);
    const b = new OverscaledTileID(3, 0, 2, 2, 2);

    test('equals matches same tiles, revision and zoom, in any tile order', () => {
        const fingerprint = new RTTFingerprint([a, b], 0, 10);
        expect(fingerprint.equals(new RTTFingerprint([b, a], 0, 10))).toBe(true);
        expect(fingerprint.equals(new RTTFingerprint([a], 0, 10))).toBe(false);
        expect(fingerprint.equals(new RTTFingerprint([a, b], 1, 10))).toBe(false);
        expect(fingerprint.equals(new RTTFingerprint([a, b], 0, 11))).toBe(false);
        expect(fingerprint.equals(undefined)).toBe(false);
    });

    test('equalsIgnoringZoom only disregards the zoom', () => {
        const fingerprint = new RTTFingerprint([a, b], 0, 10);
        expect(fingerprint.equalsIgnoringZoom(new RTTFingerprint([a, b], 0, 11))).toBe(true);
        expect(fingerprint.equalsIgnoringZoom(new RTTFingerprint([a], 0, 10))).toBe(false);
        expect(fingerprint.equalsIgnoringZoom(new RTTFingerprint([a, b], 1, 10))).toBe(false);
        expect(fingerprint.equalsIgnoringZoom(undefined)).toBe(false);
    });
});
