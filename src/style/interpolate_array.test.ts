import {describe, test, expect, vi} from 'vitest';
import {DataConstantProperty} from './properties';
import {type StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';
import {warnOnce} from '../util/util';

vi.mock('../util/util', async () => {
    const actual = await vi.importActual('../util/util');
    return {
        ...(actual as any),
        warnOnce: vi.fn(),
    };
});

describe('Issue #6606 - Array Interpolation Mismatch', () => {
    test('DataConstantProperty.interpolate with mismatched array lengths should warn and partial interpolate', () => {
        const spec: StylePropertySpecification = {
            type: 'array',
            value: 'number',
            paint: true,
            'property-type': 'data-constant',
        } as any;

        const property = new DataConstantProperty(spec);

        // Case 1: Start shorter than End
        // Start=[0, 0], End=[10, 10, 10], t=0.5
        // Expected: [5, 5] (partial interpolation of first 2 elements)
        const startShort = [0, 0];
        const endLong = [10, 10, 10];
        const res1 = property.interpolate(startShort, endLong, 0.5);
        expect(res1).toEqual([5, 5]);
        expect(warnOnce).toHaveBeenCalledWith(
            expect.stringContaining(
                'Array interpolation requires arrays of the same length',
            ),
        );

        // Case 2: Start longer than End
        // Start=[0, 0, 0], End=[10, 10], t=0.5
        // Expected: [5, 5] (partial interpolation of first 2 elements)
        const startLong = [0, 0, 0];
        const endShort = [10, 10];
        const res2 = property.interpolate(startLong, endShort, 0.5);
        expect(res2).toEqual([5, 5]);

        // Case 3: Empty array vs Full
        const empty = [];
        const full = [1];
        const res3 = property.interpolate(empty, full, 0.5);
        expect(res3).toEqual([]);

        const res4 = property.interpolate(full, empty, 0.5);
        expect(res4).toEqual([]);
    });
});
