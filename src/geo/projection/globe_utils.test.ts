import {describe, expect, test} from 'vitest';
import {LngLat} from '../lng_lat';
import {getGlobeCircumferencePixels, getZoomAdjustment, globeDistanceOfLocationsPixels} from './globe_utils';

describe('globe utils', () => {
    const digitsPrecision = 10;

    test('getGlobeCircumferencePixels', () => {
        expect(getGlobeCircumferencePixels({
            worldSize: 1,
            center: {
                lat: 0
            }
        })).toBeCloseTo(1, digitsPrecision);
        expect(getGlobeCircumferencePixels({
            worldSize: 1,
            center: {
                lat: 60
            }
        })).toBeCloseTo(2, digitsPrecision);
    });

    test('globeDistanceOfLocationsPixels', () => {
        expect(globeDistanceOfLocationsPixels({
            worldSize: 1,
            center: {
                lat: 0
            }
        }, new LngLat(0, 0), new LngLat(90, 0))).toBeCloseTo(0.25, digitsPrecision);

        expect(globeDistanceOfLocationsPixels({
            worldSize: 1,
            center: {
                lat: 0
            }
        }, new LngLat(0, -45), new LngLat(0, 45))).toBeCloseTo(0.25, digitsPrecision);

        expect(globeDistanceOfLocationsPixels({
            worldSize: 1,
            center: {
                lat: 0
            }
        }, new LngLat(0, 0), new LngLat(45, 45))).toBeCloseTo(0.16666666666666666, digitsPrecision);
    });

    test('getZoomAdjustment', () => {
        expect(getZoomAdjustment(0, 60)).toBeCloseTo(-1, digitsPrecision);
        expect(getZoomAdjustment(60, 0)).toBeCloseTo(1, digitsPrecision);
    });
});
