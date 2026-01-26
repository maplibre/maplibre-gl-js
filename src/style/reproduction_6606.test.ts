import {describe, test, expect} from 'vitest';
import {DataConstantProperty} from './properties';
import {type StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

describe('Issue #6606 - Array Interpolation Mismatch', () => {
    test('DataConstantProperty.interpolate with mismatched array lengths should not crash', () => {
        const spec: StylePropertySpecification = {
            type: 'array',
            value: 'number',
            paint: true,
            'property-type': 'data-constant',
        } as any;

        const property = new DataConstantProperty(spec);

        // Case 1: Start shorter than End (previously passed? No, prev was Start=2, End=3)
        // Expected: Should we get 3 items? If we get 2, we lost data.
        const startShort = [0, 0];
        const endLong = [10, 10, 10];
        const res1 = property.interpolate(startShort, endLong, 0.5);
        console.log('Short->Long:', res1);

        // Case 2: Start longer than End
        const startLong = [0, 0, 0];
        const endShort = [10, 10];
        const res2 = property.interpolate(startLong, endShort, 0.5);
        console.log('Long->Short:', res2);

        // Case 3: Empty array
        const empty = [];
        const full = [1];
        const res3 = property.interpolate(empty, full, 0.5);
        console.log('Empty->Full:', res3);
        const res4 = property.interpolate(full, empty, 0.5);
        console.log('Full->Empty:', res4);
    });
});
