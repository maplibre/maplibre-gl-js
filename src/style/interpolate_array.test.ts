import {describe, test, expect, vi} from 'vitest';
import {type StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

vi.mock('../util/util', async () => {
    const actual = await vi.importActual('../util/util');
    return {
        ...(actual as any),
        warnOnce: vi.fn(),
    };
});

describe('Issue #6606 - Array Interpolation Mismatch', () => {
    test('DataConstantProperty.interpolate with mismatched array lengths should warn and partial interpolate', async () => {
        // Reset modules to ensure we get a fresh copy of dependencies where the mock is applied
        // This is necessary because util.ts might be polluted by setupFiles (e.g. web_worker_mock)
        vi.resetModules();

        const {DataConstantProperty} = await import('./properties');
        const {warnOnce} = await import('../util/util');

        const spec: StylePropertySpecification = {
            type: 'array',
            value: 'number',
            paint: true,
            'property-type': 'data-constant',
            length: 2,
            expression: {
                interpolated: true,
                parameters: ['zoom', 'curve'],
            },
            transition: true,
        } as any;

        const property = new DataConstantProperty(spec);
        const startShort = [5, 5];
        const endLong = [10, 10, 10, 10]; // Longer array

        // Should warn and return a mixed array
        const res1 = property.interpolate(startShort, endLong, 0.5);
        expect(res1).toEqual([7.5, 7.5]);
        expect(warnOnce).toHaveBeenCalledWith(
            expect.stringContaining(
                'Array interpolation requires arrays of the same length',
            ),
        );

        // Reset mock for next assertion
        (warnOnce as any).mockClear();

        const startLong = [10, 10, 10, 10];
        const endShort = [5, 5];

        const res2 = property.interpolate(startLong, endShort, 0.5);
        expect(res2).toEqual([7.5, 7.5]);
        expect(warnOnce).toHaveBeenCalledWith(
            expect.stringContaining(
                'Array interpolation requires arrays of the same length',
            ),
        );
    });
});
