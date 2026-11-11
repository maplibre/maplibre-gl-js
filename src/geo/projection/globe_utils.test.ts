import {describe, expect, test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {getAtmosphereAltitudeBlend, getGlobeCenterInViewSpace, getGlobeCircumferencePixels, getGlobeRadiusPixels, getZoomAdjustment, globeDistanceOfLocationsPixels} from './globe_utils.ts';
import {createCameraState} from '../camera_state.ts';
import {createGlobeCameraProjection} from './camera_projection.ts';
import {projectCamera} from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';
import {MAX_VALID_LATITUDE} from '../../util/util.ts';

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

        expect(globeDistanceOfLocationsPixels({
            worldSize: 1,
            center: {
                lat: 0
            }
        }, new LngLat(-180, -58), new LngLat(180, -58))).toBe(0);
    });

    test('getZoomAdjustment', () => {
        expect(getZoomAdjustment(0, 60)).toBeCloseTo(-1, digitsPrecision);
        expect(getZoomAdjustment(60, 0)).toBeCloseTo(1, digitsPrecision);
    });

    test('getZoomAdjustment keeps the globe size past the mercator range', () => {
        expect(getZoomAdjustment(MAX_VALID_LATITUDE, 90)).toBe(0);
    });

    test('getGlobeCenterInViewSpace', () => {
        const projection = createGlobeCameraProjection();
        const context = {projection, constrainOverride: null};
        let state = createCameraState({maxPitch: 85});
        state = cameraUpdates.resize(state, context, 256, 512);
        state = cameraUpdates.setCenter(state, context, new LngLat(11.64, 47.55));
        state = cameraUpdates.setZoom(state, context, 11);
        const radius = getGlobeRadiusPixels(projectCamera(state, projection).worldSize, state.center.lat);

        const straightDown = projectCamera(cameraUpdates.setPitch(state, 0), projection);
        const straightDownCenter = getGlobeCenterInViewSpace(straightDown);
        expect(straightDownCenter[0]).toBeCloseTo(0, 6);
        expect(straightDownCenter[1]).toBeCloseTo(0, 6);
        expect(straightDownCenter[2]).toBeCloseTo(-(straightDown.cameraToCenterDistance + radius), 2);

        const pitched = projectCamera(cameraUpdates.setPitch(state, 85), projection);
        const pitchedCenter = getGlobeCenterInViewSpace(pitched);
        expect(Math.hypot(...pitchedCenter) / radius).toBeCloseTo(Math.hypot(...pitched.cameraPosition), 8);
    });
});

describe('getAtmosphereAltitudeBlend', () => {
    const earthRadius = 6371000;

    test('is 0 inside the atmosphere and 1 from ten times its height', () => {
        expect(getAtmosphereAltitudeBlend(0, earthRadius)).toBe(0);
        expect(getAtmosphereAltitudeBlend(100000, earthRadius)).toBe(0);
        expect(getAtmosphereAltitudeBlend(1000000, earthRadius)).toBe(1);
        expect(getAtmosphereAltitudeBlend(100 * earthRadius, earthRadius)).toBe(1);
    });

    test('follows a smoothstep between', () => {
        expect(getAtmosphereAltitudeBlend(325000, earthRadius)).toBeCloseTo(0.15625, 6);
        expect(getAtmosphereAltitudeBlend(775000, earthRadius)).toBeCloseTo(0.84375, 6);
    });
});
