import {describe, expect, test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {getGlobeCenterInViewSpace, getGlobeCircumferencePixels, getGlobeRadiusPixels, getZoomAdjustment, globeDistanceOfLocationsPixels} from './globe_utils.ts';
import {GlobeTransform} from './globe_transform.ts';

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

    test('getGlobeCenterInViewSpace', () => {
        const transform = new GlobeTransform();
        transform.resize(256, 512);
        transform.setMaxPitch(85);
        transform.setCenter(new LngLat(11.64, 47.55));
        transform.setZoom(11);
        const radius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);

        transform.setPitch(0);
        const straightDown = getGlobeCenterInViewSpace(transform);
        expect(straightDown[0]).toBeCloseTo(0, 6);
        expect(straightDown[1]).toBeCloseTo(0, 6);
        expect(straightDown[2]).toBeCloseTo(-(transform.cameraToCenterDistance + radius), 2);

        transform.setPitch(85);
        const pitched = getGlobeCenterInViewSpace(transform);
        expect(Math.hypot(...pitched) / radius).toBeCloseTo(Math.hypot(...transform.cameraPosition), 8);
    });
});
