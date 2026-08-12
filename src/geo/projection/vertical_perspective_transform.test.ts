import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform.ts';

describe('VerticalPerspectiveTransform', () => {
    test('getRaySegmentFromPixel is not implemented', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(640, 480);

        expect(() => transform.getRaySegmentFromPixel(new Point(320, 240))).toThrow('Not implemented.');
    });
});
