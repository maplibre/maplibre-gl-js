import {describe, expect, test} from 'vitest';
import {LngLat} from '../../dist/maplibre-gl.mjs';

describe('Importing a class', () => {
    test('should allow import and contruct', () => {
        const ll = new LngLat(1, 2);
        expect(ll.lng).toBe(1);
        expect(ll.lat).toBe(2);
    });
});
