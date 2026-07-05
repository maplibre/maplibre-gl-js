import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Camera, type CameraInitOptions, type CameraOptions, type PointLike} from '../ui/camera.ts';
import {TaskQueue} from '../util/task_queue.ts';
import * as timeControl from '../util/time_control.ts';
import {browser} from '../util/browser.ts';
import {fixedLngLat, fixedNum} from '../../test/unit/lib/fixed.ts';
import {setMatchMedia} from '../util/test/util.ts';
import {mercatorZfromAltitude} from '../geo/mercator_coordinate.ts';
import {LngLat, type LngLatLike} from '../geo/lng_lat.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {getZoomAdjustment} from '../geo/projection/globe_utils.ts';
import {getMercatorHorizon} from '../geo/projection/mercator_utils.ts';
import {createProjectionFromName} from '../geo/projection/projection_factory.ts';
import Point from '@mapbox/point-geometry';

import type {Terrain} from '../render/terrain.ts';
import type {JumpToOptions} from '../../dist/maplibre-gl';

beforeEach(() => {
    setMatchMedia();
    Object.defineProperty(browser, 'prefersReducedMotion', {value: false});
});

function createCamera(options?: Partial<CameraInitOptions>, globe?: boolean, jumpToOptions?: JumpToOptions): { camera: Camera; queue: TaskQueue} {
    options ||= {};
    const queue = new TaskQueue();
    const camera = new Camera({
        minZoom: options.minZoom || 0,
        maxZoom: options.maxZoom || 20,
        minPitch: options.minPitch || 0,
        maxPitch: options.maxPitch || 60,
        bearingSnap: options.bearingSnap || 0,
        zoomSnap: options.zoomSnap || 0,
        renderWorldCopies: options.renderWorldCopies,
        centerClampedToGround: options.centerClampedToGround || false,
        terrain: options.terrain || null,
        transformConstrain: options.transformConstrain,
        requestRenderFrame: (cb) => queue.add(cb),
        cancelRenderFrame: (id) => queue.remove(id),
        transformCameraUpdate: options.transformCameraUpdate
    });
    camera.transform.resize(512, 512, true);

    if (globe) {
        const projectionObjects = createProjectionFromName('globe', options.transformConstrain);
        camera.migrateProjection(projectionObjects.transform, projectionObjects.cameraHelper);
    }

    if (jumpToOptions) {
        camera.jumpTo(jumpToOptions);
    }

    return {camera, queue};
}

async function simulateAllAnimationFrames(stub: ReturnType<typeof vi.spyOn>, camera: Camera, queue: TaskQueue, duration: number) {
    for (let t = 1; t <= duration; t++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        stub.mockImplementation(() => t);
        queue.run();
    }
}

describe('calculateCameraOptionsFromTo', () => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    const {camera} = createCamera(null, false, {zoom: 1});

    test('look at north', () => {
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromTo({lng: 1, lat: 0}, 0, {lng: 1, lat: 1});
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.center).toBeDefined();
        expect(cameraOptions.bearing).toBeCloseTo(0);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('look at west', () => {
        const cameraOptions = camera.calculateCameraOptionsFromTo({lng: 1, lat: 0}, 0, {lng: 0, lat: 0});
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.bearing).toBeCloseTo(-90);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('pitch 45', () => {
        // altitude same as grounddistance => 45°
        // distance between lng x and lng x+1 is 111.2km at same lat
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromTo({lng: 1, lat: 0}, 111200, {lng: 0, lat: 0});
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(45);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('pitch 90', () => {
        const cameraOptions = camera.calculateCameraOptionsFromTo({lng: 1, lat: 0}, 0, {lng: 0, lat: 0});
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(90);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('pitch 153.435', () => {

        // distance between lng x and lng x+1 is 111.2km at same lat
        // (elevation difference of cam and center) / 2 = grounddistance =>
        // acos(111.2 / sqrt(111.2² + (111.2 * 2)²)) = acos(1/sqrt(5)) => 63.435 + 90 (looking up) = 153.435
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromTo({lng: 1, lat: 0}, 111200, {lng: 0, lat: 0}, 111200 * 3);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(153.435);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('zoom distance 1000', () => {
        const expectedZoom = Math.log2(camera.transform.cameraToCenterDistance / mercatorZfromAltitude(1000, 0) / camera.transform.tileSize);
        const cameraOptions = camera.calculateCameraOptionsFromTo({lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 1000);

        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('zoom distance 1 lng (111.2km), 111.2km altitude away', () => {
        const expectedZoom = Math.log2(camera.transform.cameraToCenterDistance / mercatorZfromAltitude(Math.hypot(111200, 111200), 0) / camera.transform.tileSize);
        const cameraOptions = camera.calculateCameraOptionsFromTo({lng: 0, lat: 0}, 0, {lng: 1, lat: 0}, 111200);

        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('same To as From error', () => {
        expect(() => camera.calculateCameraOptionsFromTo({lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 0)).toThrow();
    });
});

describe('calculateCameraOptionsFromCameraLngLatAltRotation', () => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    const {camera} = createCamera({maxPitch: 180}, false, {zoom: 1});

    test('look straight down', () => {
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromCameraLngLatAltRotation({lng: 1, lat: 0}, 0, 0, 0);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.center).toBeDefined();
        const center = cameraOptions.center as LngLat;
        expect(center.lng).toBeCloseTo(1);
        expect(center.lat).toBeCloseTo(0);
        expect(cameraOptions.elevation).toBeDefined();
        expect(cameraOptions.elevation).toBeLessThan(0);
        expect(cameraOptions.zoom).toBeGreaterThan(0);
        expect(cameraOptions.bearing).toBeCloseTo(0);
        expect(cameraOptions.pitch).toBeCloseTo(0);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('look straight up', () => {
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromCameraLngLatAltRotation({lng: 1, lat: 0}, 0, 0, 180);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.center).toBeDefined();
        const center = cameraOptions.center as LngLat;
        expect(center.lng).toBeCloseTo(1);
        expect(center.lat).toBeCloseTo(0);
        expect(cameraOptions.elevation).toBeDefined();
        expect(cameraOptions.elevation).toBeGreaterThan(0);
        expect(cameraOptions.zoom).toBeGreaterThan(0);
        expect(cameraOptions.bearing).toBeCloseTo(0);
        expect(cameraOptions.pitch).toBeCloseTo(180);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('look level', () => {
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromCameraLngLatAltRotation({lng: 1, lat: 0}, 0, 0, 90);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.center).toBeDefined();
        expect(cameraOptions.elevation).toBeDefined();
        expect(cameraOptions.elevation).toBeCloseTo(0);
        expect(cameraOptions.zoom).toBeGreaterThan(0);
        expect(cameraOptions.bearing).toBeCloseTo(0);
        expect(cameraOptions.pitch).toBeCloseTo(90);
        expect(cameraOptions.roll).toBeUndefined();
    });

    test('roll passthru', () => {
        const cameraOptions: CameraOptions = camera.calculateCameraOptionsFromCameraLngLatAltRotation({lng: 1, lat: 55}, 0, 34, 45, 123.4);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.center).toBeDefined();
        expect(cameraOptions.elevation).toBeDefined();
        expect(cameraOptions.elevation).toBeLessThan(0);
        expect(cameraOptions.zoom).toBeGreaterThan(0);
        expect(cameraOptions.bearing).toBeCloseTo(34);
        expect(cameraOptions.pitch).toBeCloseTo(45);
        expect(cameraOptions.roll).toBeCloseTo(123.4);
    });
});

describe('jumpTo', () => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    const {camera} = createCamera(null, false, {zoom: 1});

    test('sets center', () => {
        camera.jumpTo({center: [1, 2]});
        expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
    });

    test('throws on invalid center argument', () => {
        expect(() => {
            camera.jumpTo({center: 1 as any});
        }).toThrow(Error);
    });

    test('keeps current center if not specified', () => {
        camera.jumpTo({});
        expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
    });

    test('sets zoom', () => {
        camera.jumpTo({zoom: 3});
        expect(camera.getZoom()).toBe(3);
    });

    test('keeps current zoom if not specified', () => {
        camera.jumpTo({});
        expect(camera.getZoom()).toBe(3);
    });

    test('sets bearing', () => {
        camera.jumpTo({bearing: 4});
        expect(camera.getBearing()).toBe(4);
    });

    test('keeps current bearing if not specified', () => {
        camera.jumpTo({});
        expect(camera.getBearing()).toBe(4);
    });

    test('sets pitch', () => {
        camera.jumpTo({pitch: 45});
        expect(camera.getPitch()).toBe(45);
    });

    test('keeps current pitch if not specified', () => {
        camera.jumpTo({});
        expect(camera.getPitch()).toBe(45);
    });

    test('sets roll', () => {
        camera.jumpTo({pitch: 0, roll: 45});
        expect(camera.getRoll()).toBe(45);
        expect(camera.getPitch()).toBe(0);
    });

    test('keeps current roll if not specified', () => {
        camera.jumpTo({});
        expect(camera.getRoll()).toBe(45);
    });

    test('sets field of view', () => {
        camera.setVerticalFieldOfView(29);
        expect(camera.getVerticalFieldOfView()).toBeCloseTo(29, 10);
    });

    test('sets multiple properties', () => {
        camera.jumpTo({
            center: [10, 20],
            zoom: 10,
            bearing: 180,
            pitch: 60
        });
        expect(camera.getCenter()).toEqual({lng: 10, lat: 20});
        expect(camera.getZoom()).toBe(10);
        expect(camera.getBearing()).toBe(180);
        expect(camera.getPitch()).toBe(60);
    });

    test('sets more properties', () => {
        camera.jumpTo({
            center: [1, 2],
            zoom: 9,
            bearing: 120,
            pitch: 40,
            roll: 20
        });
        expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
        expect(camera.getZoom()).toBe(9);
        expect(camera.getBearing()).toBe(120);
        expect(camera.getPitch()).toBe(40);
        expect(camera.getRoll()).toBe(20);
    });

    test('emits move events, preserving eventData', () => {
        let started, moved, ended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => started = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('moveend', (d) => ended = (d as any).data);

        camera.jumpTo({center: [1, 2]}, eventData);
        expect(started).toBe('ok');
        expect(moved).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('emits move events when FOV changes, preserving eventData', () => {
        let started, moved, ended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => started = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('moveend', (d) => ended = (d as any).data);

        camera.setVerticalFieldOfView(44, eventData);
        expect(started).toBe('ok');
        expect(moved).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('emits zoom events, preserving eventData', () => {
        let started, zoomed, ended;
        const eventData = {data: 'ok'};

        camera.on('zoomstart', (d) => started = (d as any).data);
        camera.on('zoom', (d) => zoomed = (d as any).data);
        camera.on('zoomend', (d) => ended = (d as any).data);

        camera.jumpTo({zoom: 3}, eventData);
        expect(started).toBe('ok');
        expect(zoomed).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('emits rotate events, preserving eventData', () => {
        let started, rotated, ended;
        const eventData = {data: 'ok'};

        camera.on('rotatestart', (d) => started = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        camera.on('rotateend', (d) => ended = (d as any).data);

        camera.jumpTo({bearing: 90}, eventData);
        expect(started).toBe('ok');
        expect(rotated).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('emits pitch events, preserving eventData', () => {
        let started, pitched, ended;
        const eventData = {data: 'ok'};

        camera.on('pitchstart', (d) => started = (d as any).data);
        camera.on('pitch', (d) => pitched = (d as any).data);
        camera.on('pitchend', (d) => ended = (d as any).data);

        camera.jumpTo({pitch: 10}, eventData);
        expect(started).toBe('ok');
        expect(pitched).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('emits roll events, preserving eventData', () => {
        let started, rolled, ended;
        const eventData = {data: 'ok'};

        camera.on('rollstart', (d) => started = (d as any).data);
        camera.on('roll', (d) => rolled = (d as any).data);
        camera.on('rollend', (d) => ended = (d as any).data);

        camera.jumpTo({roll: 10}, eventData);
        expect(started).toBe('ok');
        expect(rolled).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('cancels in-progress easing', () => {
        camera.panTo([3, 4]);
        expect(camera.isEasing()).toBeTruthy();
        camera.jumpTo({center: [1, 2]});
        expect(!camera.isEasing()).toBeTruthy();
    });

    test('respects zoomSnap', () => {
        const {camera} = createCamera({zoomSnap: 1});
        camera.jumpTo({zoom: 2.3});
        expect(camera.getZoom()).toBe(2);
    });

    test('zoomSnap=0 does not snap zoom', () => {
        const {camera} = createCamera({zoomSnap: 0});
        camera.jumpTo({zoom: 2.3});
        expect(camera.getZoom()).toBe(2.3);
    });
});

describe('setCenter', () => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    const {camera} = createCamera(null, false, {zoom: 1});

    test('sets center', () => {
        camera.setCenter([1, 2]);
        expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
    });

    test('throws on invalid center argument', () => {
        expect(() => {
            camera.jumpTo({center: 1 as any});
        }).toThrow(Error);
    });

    test('emits move events, preserving eventData', () => {
        let started, moved, ended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => started = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('moveend', (d) => ended = (d as any).data);

        camera.setCenter([10, 20], eventData);
        expect(started).toBe('ok');
        expect(moved).toBe('ok');
        expect(ended).toBe('ok');
    });

    test('cancels in-progress easing', () => {
        camera.panTo([3, 4]);
        expect(camera.isEasing()).toBeTruthy();
        camera.setCenter([1, 2]);
        expect(!camera.isEasing()).toBeTruthy();
    });
});

describe('setZoom', () => {
    const {camera} = createCamera();

    test('sets zoom', () => {
        camera.setZoom(3);
        expect(camera.getZoom()).toBe(3);
    });

    test('emits move and zoom events, preserving eventData', () => {
        let movestarted, moved, moveended, zoomstarted, zoomed, zoomended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('moveend', (d) => moveended = (d as any).data);
        camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
        camera.on('zoom', (d) => zoomed = (d as any).data);
        camera.on('zoomend', (d) => zoomended = (d as any).data);

        camera.setZoom(4, eventData);
        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect(moveended).toBe('ok');
        expect(zoomstarted).toBe('ok');
        expect(zoomed).toBe('ok');
        expect(zoomended).toBe('ok');
    });

    test('cancels in-progress easing', () => {
        camera.panTo([3, 4]);
        expect(camera.isEasing()).toBeTruthy();
        camera.setZoom(5);
        expect(!camera.isEasing()).toBeTruthy();
    });

    test('respects zoomSnap', () => {
        const {camera} = createCamera({zoomSnap: 0.5});
        camera.setZoom(2.7);
        expect(camera.getZoom()).toBe(2.5);
    });
});

describe('setBearing', () => {
    const {camera} = createCamera();

    test('sets bearing', () => {
        camera.setBearing(4);
        expect(camera.getBearing()).toBe(4);
    });

    test('emits move and rotate events, preserving eventData', () => {
        let movestarted, moved, moveended, rotatestarted, rotated, rotateended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('moveend', (d) => moveended = (d as any).data);
        camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        camera.on('rotateend', (d) => rotateended = (d as any).data);

        camera.setBearing(5, eventData);
        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect(moveended).toBe('ok');
        expect(rotatestarted).toBe('ok');
        expect(rotated).toBe('ok');
        expect(rotateended).toBe('ok');
    });

    test('cancels in-progress easing', () => {
        camera.panTo([4, 3]);
        expect(camera.isEasing()).toBeTruthy();
        camera.setBearing(6);
        expect(!camera.isEasing()).toBeTruthy();
    });
});

describe('setRoll', () => {
    const {camera} = createCamera();

    test('sets roll', () => {
        camera.setRoll(4);
        expect(camera.getRoll()).toBe(4);
    });

    test('emits move and roll events, preserving eventData', () => {
        let movestarted, moved, moveended, rollstarted, rolled, rollended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('moveend', (d) => moveended = (d as any).data);
        camera.on('rollstart', (d) => rollstarted = (d as any).data);
        camera.on('roll', (d) => rolled = (d as any).data);
        camera.on('rollend', (d) => rollended = (d as any).data);

        camera.setRoll(5, eventData);
        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect(moveended).toBe('ok');
        expect(rollstarted).toBe('ok');
        expect(rolled).toBe('ok');
        expect(rollended).toBe('ok');
    });

    test('cancels in-progress easing', () => {
        camera.panTo([3, 4]);
        expect(camera.isEasing()).toBeTruthy();
        camera.setRoll(6);
        expect(!camera.isEasing()).toBeTruthy();
    });
});

describe('setPadding', () => {
    test('sets padding', () => {
        const {camera} = createCamera();
        const padding = {left: 300, top: 100, right: 50, bottom: 10};
        camera.setPadding(padding);
        expect(camera.getPadding()).toEqual(padding);
    });

    test('existing padding is retained if no new values are passed in', () => {
        const {camera} = createCamera();
        const padding = {left: 300, top: 100, right: 50, bottom: 10};
        camera.setPadding(padding);
        camera.setPadding({} as any);

        const currentPadding = camera.getPadding();
        expect(currentPadding).toEqual(padding);
    });

    test('doesn\'t change padding that\'s already present if new value isn\'t passed in', () => {
        const {camera} = createCamera();
        const padding = {left: 300, top: 100, right: 50, bottom: 10};
        camera.setPadding(padding);
        const padding1 = {right: 100};
        camera.setPadding(padding1);

        const currentPadding = camera.getPadding();
        expect(currentPadding.left).toBe(padding.left);
        expect(currentPadding.top).toBe(padding.top);
        // padding1 here
        expect(currentPadding.right).toBe(padding1.right);
        expect(currentPadding.bottom).toBe(padding.bottom);
    });
});

describe('panBy', () => {
    test('pans by specified amount', () => {
        const {camera} = createCamera();
        camera.panBy([100, 0], {duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 70.3125, lat: 0});
    });

    test('pans relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.panBy([100, 0], {duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: -70.3125, lat: 0});
    });

    test('emits move events, preserving eventData', async () => {
        const {camera} = createCamera();
        let started, moved;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => started = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        const promise = camera.once('moveend');

        camera.panBy([100, 0], {duration: 0}, eventData);

        const d = await promise;
        expect(started).toBe('ok');
        expect(moved).toBe('ok');
        expect((d as any).data).toBe('ok');
    });

    test('suppresses movestart if noMoveStart option is true', async () => {
        const {camera} = createCamera();
        let started;
        // fire once in advance to satisfy assertions that moveend only comes after movestart
        camera.fire('movestart');

        camera.on('movestart', () => started = true);
        const promise = camera.once('moveend');

        camera.panBy([100, 0], {duration: 0, noMoveStart: true});

        await promise;
        expect(started).toBeFalsy();
    });
});

describe('panTo', () => {
    test('pans to specified location', () => {
        const {camera} = createCamera();
        camera.panTo([100, 0], {duration: 0});
        expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
    });

    test('throws on invalid center argument', () => {
        const {camera} = createCamera();
        expect(() => {
            camera.panTo({center: 1} as any);
        }).toThrow(Error);
    });

    test('pans with specified offset', () => {
        const {camera} = createCamera();
        camera.panTo([100, 0], {offset: [100, 0], duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
    });

    test('pans with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.panTo([100, 0], {offset: [100, 0], duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
    });

    test('emits move events, preserving eventData', async () => {
        const {camera} = createCamera();
        let started, moved;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => started = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        const promise = camera.once('moveend');

        camera.panTo([100, 0], {duration: 0}, eventData);

        const d = await promise;
        expect(started).toBe('ok');
        expect(moved).toBe('ok');
        expect((d as any).data).toBe('ok');
    });

    test('suppresses movestart if noMoveStart option is true', async () => {
        const {camera} = createCamera();
        let started;

        // fire once in advance to satisfy assertions that moveend only comes after movestart
        camera.fire('movestart');

        camera.on('movestart', () => started = true);
        const promise = camera.once('moveend');

        camera.panTo([100, 0], {duration: 0, noMoveStart: true});

        await promise;
        expect(started).toBeFalsy();
    });
});

describe('zoomTo', () => {
    test('zooms to specified level', () => {
        const {camera} = createCamera();
        camera.zoomTo(3.2, {duration: 0});
        expect(camera.getZoom()).toBe(3.2);
    });

    test('zooms around specified location', () => {
        const {camera} = createCamera();
        camera.zoomTo(3.2, {around: [5, 0], duration: 0});
        expect(camera.getZoom()).toBe(3.2);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.455905897939886, lat: 0}));
    });

    test('zooms with specified offset', () => {
        const {camera} = createCamera();
        camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
        expect(camera.getZoom()).toBe(3.2);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
    });

    test('zooms with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
        expect(camera.getZoom()).toBe(3.2);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
    });

    test('emits move and zoom events, preserving eventData', async () => {
        const {camera} = createCamera();
        let movestarted, moved, zoomstarted, zoomed;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        const movePromise = camera.once('moveend');

        camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
        camera.on('zoom', (d) => zoomed = (d as any).data);
        const zoomPromise = camera.once('zoomend');

        camera.zoomTo(5, {duration: 0}, eventData);

        const moveResult = await movePromise;
        const zoomResult = await zoomPromise;

        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect((moveResult as any).data).toBe('ok');
        expect(zoomstarted).toBe('ok');
        expect(zoomed).toBe('ok');
        expect((zoomResult as any).data).toBe('ok');
    });
});

describe('rotateTo', () => {
    test('rotates to specified bearing', () => {
        const {camera} = createCamera();
        camera.rotateTo(90, {duration: 0});
        expect(camera.getBearing()).toBe(90);
    });

    test('rotates around specified location', () => {
        const {camera} = createCamera(null, false, {zoom: 3});
        camera.rotateTo(90, {around: [5, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.999999999999972, lat: 4.993665859353271}));
    });

    test('rotates around specified location, constrained to fit the view', () => {
        const {camera} = createCamera(null, false, {zoom: 0});
        camera.rotateTo(90, {around: [5, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.999999999999972, lat: 0.000002552471840999715}));
    });

    test('rotates with specified offset', () => {
        const {camera} = createCamera(null, false, {zoom: 1});
        camera.rotateTo(90, {offset: [200, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 57.3265212252}));
    });

    test('rotates with specified offset, constrained to fit the view', () => {
        const {camera} = createCamera(null, false, {zoom: 0});
        camera.rotateTo(90, {offset: [100, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
    });

    test('rotates with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180, zoom: 1});
        camera.rotateTo(90, {offset: [200, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 57.3265212252}));
    });

    test('emits move and rotate events, preserving eventData', async () => {
        const {camera} = createCamera();
        let movestarted, moved, rotatestarted, rotated;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        const movePromise = camera.once('moveend');

        camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        const rotatePRomise = camera.once('rotateend');

        camera.rotateTo(90, {duration: 0}, eventData);

        const moveResults = await movePromise;
        const rotateReults = await rotatePRomise;
        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect((moveResults as any).data).toBe('ok');
        expect(rotatestarted).toBe('ok');
        expect(rotated).toBe('ok');
        expect((rotateReults as any).data).toBe('ok');
    });
});

describe('easeTo', () => {
    test('pans to specified location', () => {
        const {camera} = createCamera();
        camera.easeTo({center: [100, 0], duration: 0});
        expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
    });

    test('zooms to specified level', () => {
        const {camera} = createCamera();
        camera.easeTo({zoom: 3.2, duration: 0});
        expect(camera.getZoom()).toBe(3.2);
    });

    test('rotates to specified bearing', () => {
        const {camera} = createCamera();
        camera.easeTo({bearing: 90, duration: 0});
        expect(camera.getBearing()).toBe(90);
    });

    test('pitches to specified pitch', () => {
        const {camera} = createCamera();
        camera.easeTo({pitch: 45, duration: 0});
        expect(camera.getPitch()).toBeCloseTo(45, 6);
    });

    test('rolls to specified roll', () => {
        const {camera} = createCamera();
        camera.easeTo({pitch: 1, roll: 45, duration: 0});
        expect(camera.getRoll()).toBeCloseTo(45, 6);
    });

    test('roll behavior at Euler angle singularity', () => {
        const {camera} = createCamera();
        camera.easeTo({bearing: 0, pitch: 0, roll: 45, duration: 0});
        expect(camera.getRoll()).toBeCloseTo(45, 6);
        expect(camera.getPitch()).toBeCloseTo(0, 6);
        expect(camera.getBearing()).toBeCloseTo(0, 6);
    });

    test('bearing behavior at Euler angle singularity', () => {
        const {camera} = createCamera();
        camera.easeTo({bearing: 45, pitch: 0, roll: 0, duration: 0});
        expect(camera.getRoll()).toBeCloseTo(0, 6);
        expect(camera.getPitch()).toBeCloseTo(0, 6);
        expect(camera.getBearing()).toBeCloseTo(45, 6);
    });

    test('pans and zooms', () => {
        const {camera} = createCamera();
        camera.easeTo({center: [100, 0], zoom: 3.2, duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
        expect(camera.getZoom()).toBe(3.2);
    });

    test('zooms around a point', () => {
        const {camera} = createCamera();
        camera.easeTo({around: [100, 0], zoom: 3, duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 87.5, lat: 0}));
        expect(camera.getZoom()).toBe(3);
    });

    test('pans and rotates', () => {
        const {camera} = createCamera();
        camera.easeTo({center: [100, 0], bearing: 90, duration: 0});
        expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        expect(camera.getBearing()).toBe(90);
    });

    test('zooms and rotates', () => {
        const {camera} = createCamera();
        camera.easeTo({zoom: 3.2, bearing: 90, duration: 0});
        expect(camera.getZoom()).toBe(3.2);
        expect(camera.getBearing()).toBe(90);
    });

    test('pans, zooms, and rotates', () => {
        const {camera} = createCamera(null, false, {bearing: -90});
        camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
        expect(camera.getZoom()).toBe(3.2);
        expect(camera.getBearing()).toBe(90);
    });

    test('noop', () => {
        const {camera} = createCamera();
        camera.easeTo({duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
        expect(camera.getZoom()).toBe(0);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('noop with offset', () => {
        const {camera} = createCamera();
        camera.easeTo({offset: [100, 0], duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
        expect(camera.getZoom()).toBe(0);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('pans with specified offset', () => {
        const {camera} = createCamera();
        camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
    });

    test('pans with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
    });

    test('offset computed from inertia (small) does not cross horizon when pitched', () => {
        const {camera} = createCamera(null, false, {pitch: 85, zoom: 10});
        const easeOptions = camera.cameraHelper.handlePanInertia(new Point(0, 100), camera.transform);
        expect(easeOptions.easingOffset.mag()).toBeLessThan(Math.abs(getMercatorHorizon(camera.transform)));
    });

    test('offset computed from inertia (large) does not cross horizon when pitched', () => {
        const {camera} = createCamera(null, false, {pitch: 85, zoom: 10});
        const easeOptions = camera.cameraHelper.handlePanInertia(new Point(0, 500), camera.transform);
        expect(easeOptions.easingOffset.mag()).toBeLessThan(Math.abs(getMercatorHorizon(camera.transform)));
    });

    test('offset computed from inertia (large) does not cross horizon when pitched and rotated', () => {
        const {camera} = createCamera(null, false, {pitch: 85, bearing: 135, zoom: 10});
        const easeOptions = camera.cameraHelper.handlePanInertia(new Point(0, 500), camera.transform);
        expect(easeOptions.easingOffset.mag()).toBeLessThan(Math.abs(getMercatorHorizon(camera.transform)));
    });

    test('zooms with specified offset', () => {
        const {camera} = createCamera();
        camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
        expect(camera.getZoom()).toBe(3.2);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
    });

    test('zooms with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
        expect(camera.getZoom()).toBe(3.2);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
    });

    test('rotates with specified offset', () => {
        const {camera} = createCamera();
        camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
    });

    test('rotates with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
        expect(camera.getBearing()).toBe(90);
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 0.000002552471840999715}));
    });

    test('emits move, zoom, rotate, pitch, and roll events, preserving eventData', async () => {
        const {camera} = createCamera();
        let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched, rollstarted, rolled;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        const movePromise = camera.once('moveend');

        camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
        camera.on('zoom', (d) => zoomed = (d as any).data);
        const zoomPromise = camera.once('zoomend');

        camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        const rotatePromise = camera.once('rotateend');

        camera.on('pitchstart', (d) => pitchstarted = (d as any).data);
        camera.on('pitch', (d) => pitched = (d as any).data);
        const pitchPromise = camera.once('pitchend');

        camera.on('rollstart', (d) => rollstarted = (d as any).data);
        camera.on('roll', (d) => rolled = (d as any).data);
        const rollPromise = camera.once('rollend');

        camera.easeTo(
            {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, roll: 30},
            eventData);

        const moveResults = await movePromise;
        expect(camera._zooming).toBeFalsy();
        expect(camera._rotating).toBeFalsy();
        expect(camera._rolling).toBeFalsy();

        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect(zoomed).toBe('ok');
        expect(rotated).toBe('ok');
        expect(rolled).toBe('ok');
        expect(pitched).toBe('ok');
        expect((moveResults as any).data).toBe('ok');

        const zoomResults = await zoomPromise;
        expect(zoomstarted).toBe('ok');
        expect(zoomed).toBe('ok');
        expect((zoomResults as any).data).toBe('ok');

        const rotateResults = await rotatePromise;
        expect(rotatestarted).toBe('ok');
        expect(rotated).toBe('ok');
        expect((rotateResults as any).data).toBe('ok');

        const pitchResults = await pitchPromise;
        expect(pitchstarted).toBe('ok');
        expect(pitched).toBe('ok');
        expect((pitchResults as any).data).toBe('ok');

        const rollResults = await rollPromise;
        expect(rollstarted).toBe('ok');
        expect(rolled).toBe('ok');
        expect((rollResults as any).data).toBe('ok');
    });

    test('does not emit zoom events if not zooming', async () => {
        const {camera} = createCamera();
        const spy = vi.fn();
        camera.on('zoomstart', spy);
        camera.on('zoom', spy);
        camera.on('zoomend', spy);
        const promise = camera.once('moveend');

        camera.easeTo({center: [100, 0], duration: 0});

        await promise;
        expect(spy).not.toHaveBeenCalled();
    });

    test('stops existing ease', () => {
        const {camera} = createCamera();
        camera.easeTo({center: [200, 0], duration: 100});
        camera.easeTo({center: [100, 0], duration: 0});
        expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
    });

    test('can be called from within a moveend event handler', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        stub.mockImplementation(() => 0);
        camera.easeTo({center: [100, 0], duration: 10});

        let promise = camera.once('moveend');

        // setTimeout to avoid a synchronous callback
        setTimeout(() => {
            stub.mockImplementation(() => 10);
            queue.run();
        }, 0);

        await promise;
        camera.easeTo({center: [200, 0], duration: 10});
        promise = camera.once('moveend');

        // setTimeout to avoid a synchronous callback
        setTimeout(() => {
            stub.mockImplementation(() => 20);
            queue.run();
        }, 0);

        await promise;
        camera.easeTo({center: [300, 0], duration: 10});
        promise = camera.once('moveend');

        setTimeout(() => {
            stub.mockImplementation(() => 30);
            queue.run();
        }, 0);

        await promise;
    });

    test('pans eastward across the antimeridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([170, 0]);
        let crossedAntimeridian;

        camera.on('move', () => {
            if (camera.getCenter().lng > 170) {
                crossedAntimeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.easeTo({center: [-170, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(crossedAntimeridian).toBeTruthy();
    });

    test('does not pan eastward across the antimeridian on a single-globe mercator map', async () => {
        const {camera} = createCamera({renderWorldCopies: false}, false, {zoom: 2});
        camera.setCenter([170, 0]);
        const initialLng = camera.getCenter().lng;
        const promise = camera.once('moveend');
        camera.easeTo({center: [210, 0], duration: 0});

        await promise;
        expect(camera.getCenter().lng).toBeCloseTo(initialLng, 0);
    });

    test('pans westward across the antimeridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([-170, 0]);
        let crossedAntimeridian;

        camera.on('move', () => {
            if (camera.getCenter().lng < -170) {
                crossedAntimeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.easeTo({center: [170, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(crossedAntimeridian).toBeTruthy();
    });

    test('does not pan westward across the antimeridian on a single-globe mercator map', async () => {
        const {camera} = createCamera({renderWorldCopies: false}, false, {zoom: 2});
        camera.setCenter([-170, 0]);
        const initialLng = camera.getCenter().lng;
        const promise = camera.once('moveend');
        camera.easeTo({center: [-210, 0], duration: 0});

        await promise;
        expect(camera.getCenter().lng).toBeCloseTo(initialLng, 0);
    });

    test('animation occurs when prefers-reduced-motion: reduce is set but overridden by essential: true', async () => {
        const {camera, queue} = createCamera();
        Object.defineProperty(browser, 'prefersReducedMotion', {value: true});
        const stubNow = vi.spyOn(timeControl, 'now');

        // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
        // when a duration of 200 is requested
        const min = 100;
        const max = 300;

        let startTime;
        camera.on('movestart', () => startTime = timeControl.now());
        const promise = camera.once('moveend');

        setTimeout(() => {
            stubNow.mockImplementation(() => 0);
            queue.run();

            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200, essential: true});

            setTimeout(() => {
                stubNow.mockImplementation(() => 200);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        const endTime = timeControl.now();
        const timeDiff = endTime - startTime;
        expect(timeDiff >= min && timeDiff < max).toBeTruthy();
    });

    test('duration is 0 when prefers-reduced-motion: reduce is set', async () => {
        const {camera} = createCamera();
        Object.defineProperty(browser, 'prefersReducedMotion', {value: true});

        let startTime;
        camera.on('movestart', () => startTime = new Date());
        const promise = camera.once('moveend');

        camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 1000});

        await promise;
        const endTime = new Date();
        const timeDiff = endTime.getTime() - startTime.getTime();
        expect(timeDiff >= 0 && timeDiff < 10).toBeTruthy();
    });

    test('jumpTo on("move") during easeTo with zoom, pitch, etc', () => {
        const {camera, queue} = createCamera();

        const spy = vi.fn();
        camera.on('moveend', spy);

        camera.easeTo({zoom: 20, bearing: 90, pitch: 60, duration: 500}, {done: true});
        camera.once('move', () => {
            camera.jumpTo({pitch: 40});
        });

        queue.run();
        queue.run();

        expect(spy.mock.calls.find(c => 'done' in c[0])).toBeTruthy();
    });

    test('jumpTo on("zoom") during easeTo', () => {
        const {camera, queue} = createCamera();

        const spy = vi.fn();
        camera.on('moveend', spy);

        camera.easeTo({zoom: 20, duration: 500}, {done: true});
        camera.once('zoom', () => {
            camera.jumpTo({pitch: 40});
        });

        queue.run();
        queue.run();

        expect(spy.mock.calls.find(c => 'done' in c[0])).toBeTruthy();
    });

    test('jumpTo on("pitch") during easeTo', () => {
        const {camera, queue} = createCamera();

        const spy = vi.fn();
        camera.on('moveend', spy);

        camera.easeTo({pitch: 60, duration: 500}, {done: true});
        camera.once('pitch', () => {
            camera.jumpTo({pitch: 40});
        });

        queue.run();
        queue.run();

        expect(spy.mock.calls.find(c => 'done' in c[0])).toBeTruthy();
    });

    test('jumpTo on("rotate") during easeTo', () => {
        const {camera, queue} = createCamera();

        const spy = vi.fn();
        camera.on('moveend', spy);

        camera.easeTo({bearing: 90, duration: 500}, {done: true});
        camera.once('rotate', () => {
            camera.jumpTo({pitch: 40});
        });

        queue.run();
        queue.run();

        expect(spy.mock.calls.find(c => 'done' in c[0])).toBeTruthy();
    });

    test('terrain set during easeTo', () => {
        let terrain: Terrain = null;
        const {camera, queue} = createCamera({terrain});
        const stubNow = vi.spyOn(timeControl, 'now');

        stubNow.mockImplementation(() => 0);

        camera.easeTo({bearing: 97, duration: 500});

        stubNow.mockImplementation(() => 100);
        queue.run();

        terrain = {
            getMinTileElevationForLngLatZoom: () => 0,
            getElevationForLngLatZoom: () => 0
        } as any as Terrain;

        stubNow.mockImplementation(() => 500);
        queue.run();

        expect(camera.getBearing()).toEqual(97);
    });

    test('respects zoomSnap', () => {
        const {camera} = createCamera({zoomSnap: 1});
        camera.easeTo({zoom: 2.7, duration: 0});
        expect(camera.getZoom()).toBe(3);
    });

    test('zoomSnap=0 does not snap zoom', () => {
        const {camera} = createCamera({zoomSnap: 0});
        camera.easeTo({zoom: 2.7, duration: 0});
        expect(camera.getZoom()).toBe(2.7);
    });
});

describe('flyTo', () => {
    test('pans to specified location', () => {
        const {camera} = createCamera();
        camera.flyTo({center: [100, 0], animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
    });

    test('throws on invalid center argument', () => {
        const {camera} = createCamera();
        expect(() => {
            camera.flyTo({center: 1 as any});
        }).toThrow(Error);
    });

    test('does not throw when cameras current zoom is sufficiently greater than passed zoom option', () => {
        const {camera} = createCamera(null, false, {zoom: 22, center: [0, 0]});
        expect(() => camera.flyTo({zoom: 10, center: [0, 0]})).not.toThrow();
    });

    test('does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor', () => {
        const {camera} = createCamera({minZoom: 0, maxZoom: 20.9999, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        camera.jumpTo({zoom: 21, center: [0, 0]});
        expect(() => camera.flyTo({zoom: 7.5, center: [0, 0], offset: [0, 70]})).not.toThrow();
    });

    test('zooms to specified level', () => {
        const {camera} = createCamera();
        camera.flyTo({zoom: 3.2, animate: false});
        expect(fixedNum(camera.getZoom())).toBe(3.2);
    });

    test('zooms to integer level without floating point errors', () => {
        const {camera} = createCamera(null, false, {zoom: 0.6});
        camera.flyTo({zoom: 2, animate: false});
        expect(camera.getZoom()).toBe(2);
    });

    test('Zoom out from the same position to the same position with animation', async () => {
        const pos = {lng: 0, lat: 0};
        const {camera, queue} = createCamera(null, false, {zoom: 20, center: pos});
        const stub = vi.spyOn(timeControl, 'now');

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({zoom: 19, center: pos, duration: 2});

        stub.mockImplementation(() => 3);
        queue.run();

        await promise;
        expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat(pos));
        expect(camera.getZoom()).toBe(19);
    });

    test('rotates to specified bearing', () => {
        const {camera} = createCamera();
        camera.flyTo({bearing: 90, animate: false});
        expect(camera.getBearing()).toBe(90);
    });

    test('tilts to specified pitch', () => {
        const {camera} = createCamera();
        camera.flyTo({pitch: 45, animate: false});
        expect(camera.getPitch()).toBeCloseTo(45, 6);
    });

    test('rolls to specified roll', () => {
        const {camera} = createCamera();
        camera.flyTo({pitch: 1, roll: 45, animate: false});
        expect(camera.getRoll()).toBeCloseTo(45, 6);
    });

    test('roll behavior at Euler angle singularity', () => {
        const {camera} = createCamera();
        camera.flyTo({bearing: 0, pitch: 0, roll: 45, animate: false});
        expect(camera.getRoll()).toBeCloseTo(45, 6);
        expect(camera.getPitch()).toBeCloseTo(0, 6);
        expect(camera.getBearing()).toBeCloseTo(0, 6);
    });

    test('bearing behavior at Euler angle singularity', () => {
        const {camera} = createCamera();
        camera.flyTo({bearing: 45, pitch: 0, roll: 0, animate: false});
        expect(camera.getRoll()).toBeCloseTo(0, 6);
        expect(camera.getPitch()).toBeCloseTo(0, 6);
        expect(camera.getBearing()).toBeCloseTo(45, 6);
    });

    test('pans and zooms', () => {
        const {camera} = createCamera();
        camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        expect(fixedNum(camera.getZoom())).toBe(3.2);
    });

    test('pans and rotates', () => {
        const {camera} = createCamera();
        camera.flyTo({center: [100, 0], bearing: 90, animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        expect(camera.getBearing()).toBe(90);
    });

    test('zooms and rotates', () => {
        const {camera} = createCamera();
        camera.flyTo({zoom: 3.2, bearing: 90, animate: false});
        expect(fixedNum(camera.getZoom())).toBe(3.2);
        expect(camera.getBearing()).toBe(90);
    });

    test('pans, zooms, and rotates', () => {
        const {camera} = createCamera();
        camera.flyTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
        expect(fixedNum(camera.getZoom())).toBe(3.2);
        expect(camera.getBearing()).toBe(90);
    });

    test('noop', () => {
        const {camera} = createCamera();
        camera.flyTo({animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
        expect(camera.getZoom()).toBe(0);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('noop with offset', () => {
        const {camera} = createCamera();
        camera.flyTo({offset: [100, 0], animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
        expect(camera.getZoom()).toBe(0);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('pans with specified offset', () => {
        const {camera} = createCamera();
        camera.flyTo({center: [100, 0], offset: [100, 0], animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
    });

    test('pans with specified offset relative to viewport on a rotated camera', () => {
        const {camera} = createCamera(null, false, {bearing: 180});
        camera.easeTo({center: [100, 0], offset: [100, 0], animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
    });

    test('emits move, zoom, rotate, pitch, and roll events, preserving eventData', async () => {
        const {camera} = createCamera();
        let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched, rollstarted, rolled;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        camera.on('pitch', (d) => pitched = (d as any).data);
        camera.on('roll', (d) => rolled = (d as any).data);
        const movePromise = camera.once('moveend');

        camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
        camera.on('zoom', (d) => zoomed = (d as any).data);
        const zoomPromise = camera.once('zoomend');

        camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        const rotatePromise = camera.once('rotateend');

        camera.on('pitchstart', (d) => pitchstarted = (d as any).data);
        camera.on('pitch', (d) => pitched = (d as any).data);
        const pitchPromise = camera.once('pitchend');

        camera.on('rollstart', (d) => rollstarted = (d as any).data);
        camera.on('roll', (d) => rolled = (d as any).data);
        const rollPromise = camera.once('rollend');

        camera.flyTo(
            {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, roll: 20, animate: false},
            eventData);

        const moveResult = await movePromise;
        expect(camera._zooming).toBeFalsy();
        expect(camera._rotating).toBeFalsy();

        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect(zoomed).toBe('ok');
        expect(rotated).toBe('ok');
        expect(pitched).toBe('ok');
        expect(rolled).toBe('ok');
        expect((moveResult as any).data).toBe('ok');

        const zoomResult = await zoomPromise;
        expect(zoomstarted).toBe('ok');
        expect(zoomed).toBe('ok');
        expect((zoomResult as any).data).toBe('ok');

        const rotateResult = await rotatePromise;
        expect(rotatestarted).toBe('ok');
        expect(rotated).toBe('ok');
        expect((rotateResult as any).data).toBe('ok');

        const pitchResult = await pitchPromise;
        expect(pitchstarted).toBe('ok');
        expect(pitched).toBe('ok');
        expect((pitchResult as any).data).toBe('ok');

        const rollResult = await rollPromise;
        expect(rollstarted).toBe('ok');
        expect(rolled).toBe('ok');
        expect((rollResult as any).data).toBe('ok');
    });

    test('for short flights, emits (solely) move events, preserving eventData', async () => {
        //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
        //As such; it deserves a separate test case. This test case flies the map from A to A.
        const {camera, queue} = createCamera(null, false, {center: [100, 0]});
        let movestarted, moved,
            zoomstarted, zoomed, zoomended,
            rotatestarted, rotated, rotateended,
            pitchstarted, pitched, pitchended;
        const eventData = {data: 'ok'};

        camera.on('movestart', (d) => movestarted = (d as any).data);
        camera.on('move', (d) => moved = (d as any).data);
        camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
        camera.on('zoom', (d) => zoomed = (d as any).data);
        camera.on('zoomend', (d) => zoomended = (d as any).data);
        camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
        camera.on('rotate', (d) => rotated = (d as any).data);
        camera.on('rotateend', (d) => rotateended = (d as any).data);
        camera.on('pitchstart', (d) => pitchstarted = (d as any).data);
        camera.on('pitch', (d) => pitched = (d as any).data);
        camera.on('pitchend', (d) => pitchended = (d as any).data);
        const promise = camera.once('moveend');

        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);

        camera.flyTo({center: [100, 0], duration: 10}, eventData);

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        const d = await promise;
        expect(camera._zooming).toBeFalsy();
        expect(camera._rotating).toBeFalsy();

        expect(movestarted).toBe('ok');
        expect(moved).toBe('ok');
        expect(zoomstarted).toBeUndefined();
        expect(zoomed).toBeUndefined();
        expect(zoomended).toBeUndefined();
        expect(rotatestarted).toBeUndefined();
        expect(rotated).toBeUndefined();
        expect(rotateended).toBeUndefined();
        expect(pitched).toBeUndefined();
        expect(pitchstarted).toBeUndefined();
        expect(pitchended).toBeUndefined();
        expect((d as any).data).toBe('ok');
    });

    test('stops existing ease', () => {
        const {camera} = createCamera();
        camera.flyTo({center: [200, 0], duration: 100});
        camera.flyTo({center: [100, 0], duration: 0});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
    });

    test('no roll when motion is interrupted', () => {
        const stub = vi.spyOn(timeControl, 'now');

        const {camera, queue} = createCamera();
        stub.mockImplementation(() => 0);
        camera.easeTo({pitch: 10, bearing: 100, duration: 1000});
        stub.mockImplementation(() => 100);
        queue.run();
        camera.easeTo({elevation: 1, duration: 0});
        expect(camera.getRoll()).toBe(0);
    });

    test('no roll when motion is interrupted: globe', () => {
        const stub = vi.spyOn(timeControl, 'now');

        const {camera, queue} = createCamera(null, true);
        stub.mockImplementation(() => 0);
        camera.easeTo({pitch: 10, bearing: 100, duration: 1000});
        stub.mockImplementation(() => 100);
        queue.run();
        camera.easeTo({elevation: 1, duration: 0});
        expect(camera.getRoll()).toBe(0);
    });

    test('angles when motion is interrupted', () => {
        const stub = vi.spyOn(timeControl, 'now');

        const {camera, queue} = createCamera();
        stub.mockImplementation(() => 0);
        camera.easeTo({pitch: 10, bearing: 20, roll: 30, duration: 1000});
        stub.mockImplementation(() => 500);
        queue.run();
        camera.easeTo({elevation: 1, duration: 0});
        expect(camera.getRoll()).toBeCloseTo(25.041890412598942);
        expect(camera.getPitch()).toBeCloseTo(8.116189398053095);
        expect(camera.getBearing()).toBeCloseTo(15.041890412599061);
    });

    test('angles when motion is interrupted: globe', () => {
        const stub = vi.spyOn(timeControl, 'now');

        const {camera, queue} = createCamera(null, true);
        stub.mockImplementation(() => 0);
        camera.easeTo({pitch: 10, bearing: 20, roll: 30, duration: 1000});
        stub.mockImplementation(() => 500);
        queue.run();
        camera.easeTo({elevation: 1, duration: 0});
        expect(camera.getRoll()).toBeCloseTo(25.041890412598942);
        expect(camera.getPitch()).toBeCloseTo(8.116189398053095);
        expect(camera.getBearing()).toBeCloseTo(15.041890412599061);
    });

    test('can be called from within a moveend event handler', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);

        camera.flyTo({center: [100, 0], duration: 10});
        let promise = camera.once('moveend');

        setTimeout(() => {
            stub.mockImplementation(() => 10);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 20);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 30);
                    queue.run();
                }, 0);
            }, 0);
        }, 0);
        await promise;
        camera.flyTo({center: [200, 0], duration: 10});
        promise = camera.once('moveend');
        await promise;
        camera.flyTo({center: [300, 0], duration: 10});
        await camera.once('moveend');
    });

    test('ascends', async () => {
        const {camera, queue} = createCamera();
        camera.setZoom(18);
        let ascended;

        camera.on('zoom', () => {
            if (camera.getZoom() < 18) {
                ascended = true;
            }
        });

        const promise = camera.once('moveend');

        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);

        camera.flyTo({center: [100, 0], zoom: 18, duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);
        await promise;
        expect(ascended).toBeTruthy();
    });

    test('pans eastward across the prime meridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([-10, 0]);
        let crossedPrimeMeridian;

        camera.on('move', () => {
            if (Math.abs(camera.getCenter().lng) < 10) {
                crossedPrimeMeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [10, 0], duration: 20});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 20);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(crossedPrimeMeridian).toBeTruthy();
    });

    test('pans westward across the prime meridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([10, 0]);
        let crossedPrimeMeridian;

        camera.on('move', () => {
            if (Math.abs(camera.getCenter().lng) < 10) {
                crossedPrimeMeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [-10, 0], duration: 20});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 20);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(crossedPrimeMeridian).toBeTruthy();
    });

    test('pans eastward across the antimeridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([170, 0]);
        let crossedAntimeridian;

        camera.on('move', () => {
            if (camera.getCenter().lng > 170) {
                crossedAntimeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [-170, 0], duration: 20});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 20);
                queue.run();
            }, 0);
        }, 0);
        await promise;
        expect(crossedAntimeridian).toBeTruthy();
    });

    test('pans westward across the antimeridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([-170, 0]);
        let crossedAntimeridian;

        camera.on('move', () => {
            if (camera.getCenter().lng < -170) {
                crossedAntimeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [170, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);
        await promise;
        expect(crossedAntimeridian).toBeTruthy();
    });

    test('does not pan eastward across the antimeridian if no world copies', async () => {
        const {camera, queue} = createCamera({renderWorldCopies: false});
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([170, 0]);
        let crossedAntimeridian;

        camera.on('move', () => {
            if (camera.getCenter().lng > 170) {
                crossedAntimeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [-170, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(crossedAntimeridian).toBeFalsy();
    });

    test('does not pan westward across the antimeridian if no world copies', async () => {
        const {camera, queue} = createCamera({renderWorldCopies: false});
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([-170, 0]);
        let crossedAntimeridian;

        camera.on('move', () => {
            if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                crossedAntimeridian = true;
            }
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [170, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(crossedAntimeridian).toBeFalsy();
    });

    test('jumps back to world 0 when crossing the antimeridian', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');

        camera.setCenter([-170, 0]);

        let leftWorld0 = false;

        camera.on('move', () => {
            leftWorld0 ||= (camera.getCenter().lng < -180);
        });

        const promise = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [170, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
        expect(leftWorld0).toBeFalsy();
    });

    test('flight arc does not zoom below the minZoom flyTo option', async () => {
        const {camera, queue} = createCamera(null, false, {zoom: 20});
        const stub = vi.spyOn(timeControl, 'now');

        const minZoom = 10;
        const zoomValues: number[] = [];
        const zoomSpy = vi.fn(() => zoomValues.push(camera.getZoom()));
        camera.on('zoom', zoomSpy);

        const promise = camera.once('moveend');

        const duration = 10;
        stub.mockImplementation(() => 0);
        camera.flyTo({center: [1, 0], zoom: 20, minZoom, duration});

        await simulateAllAnimationFrames(stub, camera, queue, duration);

        await promise;
        expect(zoomSpy).toHaveBeenCalled();
        expect(Math.min(...zoomValues)).toBeGreaterThanOrEqual(minZoom);
    });

    test('flight arc does not zoom below transform minZoom when only map setMinZoom is used', async () => {
        const {camera, queue} = createCamera(null, false, {zoom: 20});
        camera.transform.setMinZoom(10);
        const stub = vi.spyOn(timeControl, 'now');

        const mapMinZoom = 10;
        const zoomValues: number[] = [];
        const zoomSpy = vi.fn(() => zoomValues.push(camera.getZoom()));
        camera.on('zoom', zoomSpy);

        const promise = camera.once('moveend');

        const duration = 10;
        stub.mockImplementation(() => 0);
        camera.flyTo({center: [1, 0], zoom: 20, duration});

        await simulateAllAnimationFrames(stub, camera, queue, duration);

        await promise;
        expect(zoomSpy).toHaveBeenCalled();
        expect(Math.min(...zoomValues)).toBeGreaterThanOrEqual(mapMinZoom);
    });

    test('respects transform\'s maxZoom', async () => {

        const {camera, queue} = createCamera({minZoom: 2, maxZoom: 10, minPitch: 0, maxPitch: 60, renderWorldCopies: false});

        const promise = camera.once('moveend');

        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.flyTo({center: [12, 34], zoom: 30, duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 10);
            queue.run();
        }, 0);

        await promise;
        expect(camera.getZoom()).toBeCloseTo(10);
        const {lng, lat} = camera.getCenter();
        expect(lng).toBeCloseTo(12);
        expect(lat).toBeCloseTo(34);
    });

    test('respects transform\'s minZoom', async () => {

        const {camera, queue} = createCamera({minZoom: 2, maxZoom: 10, minPitch: 0, maxPitch: 60, renderWorldCopies: false});

        const promise = camera.once('moveend');

        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.flyTo({center: [12, 34], zoom: 1, duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 10);
            queue.run();
        }, 0);

        await promise;
        expect(camera.getZoom()).toBeCloseTo(2);
        const {lng, lat} = camera.getCenter();
        expect(lng).toBeCloseTo(12);
        expect(lat).toBeCloseTo(34);
    });

    test('center moves toward target at intermediate frames when transform minZoom limits zoom', async () => {

        const {camera, queue} = createCamera({minZoom: 10, maxZoom: 20, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        camera.jumpTo({center: [0, 0], zoom: 10});

        let midLng: number | undefined;
        camera.on('move', () => {
            if (midLng === undefined) midLng = camera.getCenter().lng;
        });

        const promise = camera.once('moveend');
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.flyTo({center: [40, 0], zoom: 10, duration: 10});

        await new Promise(resolve => setTimeout(resolve, 0));
        stub.mockImplementation(() => 5);
        queue.run();

        await new Promise(resolve => setTimeout(resolve, 0));
        stub.mockImplementation(() => 10);
        queue.run();

        await promise;

        const startLng = 0;
        const targetLng = 40;
        expect(midLng).toBeGreaterThan((startLng + targetLng) / 2);
        expect(midLng).toBeLessThanOrEqual(targetLng);
        expect(camera.getCenter().lng).toBeCloseTo(targetLng);
    });

    test('resets duration to 0 if it exceeds maxDuration', async () => {
        let startTime: number;
        const {camera} = createCamera(null, false, {center: [37.63454, 55.75868], zoom: 18});

        camera.on('movestart', () => startTime = new Date().getTime());
        const promise = camera.once('moveend');

        camera.flyTo({center: [-122.3998631, 37.7884307], maxDuration: 100});

        await promise;
        const endTime = new Date().getTime();
        const timeDiff = endTime - startTime;
        expect(timeDiff).toBeLessThan(30);
    });

    test('flys instantly when prefers-reduce-motion:reduce is set', async () => {
        const {camera} = createCamera();
        Object.defineProperty(browser, 'prefersReducedMotion', {value: true});
        let startTime;
        camera.on('movestart', () => startTime = new Date());
        const promise = camera.once('moveend');

        camera.flyTo({center: [100, 0], bearing: 90, animate: true});

        await promise;
        const endTime = new Date();
        const timeDiff = endTime.getTime() - startTime.getTime();
        expect(timeDiff >= 0 && timeDiff < 10).toBeTruthy();
    });

    test('applies the padding option when prefers-reduce-motion:reduce is set', async () => {
        const {camera} = createCamera();
        Object.defineProperty(browser, 'prefersReducedMotion', {value: true});

        camera.flyTo({padding: {top: 50, right: 30}});

        expect(camera.getPadding()).toEqual({top: 50, bottom: 0, left: 0, right: 30});
    });

    test('check elevation events freezeElevation=false', async () => {
        const terrain = {getElevationForLngLatZoom: () => 0} as any as Terrain; 
        const {camera, queue} = createCamera({terrain});
        const stub = vi.spyOn(timeControl, 'now');

        const terrainCallbacks = {prepare: 0, update: 0, finalize: 0} as any;
        camera._prepareElevation = () => terrainCallbacks.prepare++;
        camera._updateElevation = () => terrainCallbacks.update++;
        camera._finalizeElevation = () => terrainCallbacks.finalize++;
        camera.setCenter([-10, 0]);
        const moveEnded = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [10, 0], duration: 20, freezeElevation: false});
        stub.mockImplementation(() => 1);
        queue.run();
        stub.mockImplementation(() => 20);
        queue.run();
        await moveEnded;
        expect(terrainCallbacks.prepare).toBe(1);
        expect(terrainCallbacks.update).toBe(2);
        expect(terrainCallbacks.finalize).toBe(0);
    });

    test('check elevation events freezeElevation=true', async() => {
        const terrain = {getElevationForLngLatZoom: () => 0} as any as Terrain;
        const {camera, queue} = createCamera({terrain});
        const stub = vi.spyOn(timeControl, 'now');

        const terrainCallbacks = {prepare: 0, update: 0, finalize: 0} as any;
        camera._prepareElevation = () => terrainCallbacks.prepare++;
        camera._updateElevation = () => terrainCallbacks.update++;
        camera._finalizeElevation = () => terrainCallbacks.finalize++;
        camera.setCenter([-10, 0]);
        const moveEnded = camera.once('moveend');

        stub.mockImplementation(() => 0);
        camera.flyTo({center: [10, 0], duration: 20, freezeElevation: true});
        stub.mockImplementation(() => 1);
        queue.run();
        stub.mockImplementation(() => 20);
        queue.run();
        await moveEnded;
        expect(terrainCallbacks.prepare).toBe(1);
        expect(terrainCallbacks.update).toBe(0);
        expect(terrainCallbacks.finalize).toBe(1);
    });

    test('check elevation callbacks', () => {
        const terrain = {
            getElevationForLngLatZoom: () => 100,
            getMinTileElevationForLngLatZoom: () => 200
        } as any;
        const {camera} = createCamera({terrain});

        camera.transform = {
            elevation: 0,
            recalculateZoomAndCenter: () => true,
            setMinElevationForCurrentTile: (_a) => true,
            setElevation: (e) => (camera.transform as any).elevation = e
        } as any;

        camera._prepareElevation(new LngLat(10, 0));
        // expect(camera._elevationCenter).toBe([10, 0]);
        expect(camera._elevationStart).toBe(0);
        expect(camera._elevationTarget).toBe(100);
        expect(camera.elevationFreeze).toBeTruthy();

        terrain.getElevationForLngLatZoom = () => 200;
        camera._updateElevation(0.5);
        expect(camera._elevationStart).toBe(-100);
        expect(camera._elevationTarget).toBe(200);

        camera._finalizeElevation();
        expect(camera.elevationFreeze).toBeFalsy();
    });

    test('respects zoomSnap', () => {
        const {camera} = createCamera({zoomSnap: 1});
        camera.flyTo({zoom: 2.7, animate: false});
        expect(camera.getZoom()).toBe(3);
    });

    test('zoomSnap=0 does not snap zoom', () => {
        const {camera} = createCamera({zoomSnap: 0});
        camera.flyTo({zoom: 2.7, animate: false});
        expect(camera.getZoom()).toBe(2.7);
    });
});

describe('isEasing', () => {
    test('returns false when not easing', () => {
        const {camera} = createCamera();
        expect(!camera.isEasing()).toBeTruthy();
    });

    test('returns true when panning', () => {
        const {camera} = createCamera();
        camera.panTo([100, 0], {duration: 1});
        expect(camera.isEasing()).toBeTruthy();
    });

    test('returns false when done panning', async () => {
        const {camera, queue} = createCamera();
        const promise = camera.once('moveend');
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.panTo([100, 0], {duration: 1});
        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();
        }, 0);

        await promise;
        expect(camera.isEasing()).toBeFalsy();
    });

    test('returns true when zooming', () => {
        const {camera} = createCamera();
        camera.zoomTo(3.2, {duration: 1});

        expect(camera.isEasing()).toBeTruthy();
    });

    test('returns false when done zooming', async () => {
        const {camera, queue} = createCamera();
        const promise = camera.once('moveend');
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.zoomTo(3.2, {duration: 1});
        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();
        }, 0);

        await promise;
        expect(camera.isEasing()).toBeFalsy();
    });

    test('returns true when rotating', () => {
        const {camera} = createCamera();
        camera.rotateTo(90, {duration: 1});
        expect(camera.isEasing()).toBeTruthy();
    });

    test('returns false when done rotating', async () => {
        const {camera, queue} = createCamera();
        const promise = camera.once('moveend');
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.rotateTo(90, {duration: 1});
        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();
        }, 0);

        await promise;
        expect(camera.isEasing()).toBeFalsy();
    });
});

describe('stop', () => {
    test('resets camera._zooming', () => {
        const {camera} = createCamera();
        camera.zoomTo(3.2);
        camera.stop();
        expect(!camera._zooming).toBeTruthy();
    });

    test('resets camera._rotating', () => {
        const {camera} = createCamera();
        camera.rotateTo(90);
        camera.stop();
        expect(!camera._rotating).toBeTruthy();
    });

    test('emits moveend if panning, preserving eventData', async () => {
        const {camera} = createCamera();
        const eventData = {data: 'ok'};

        const promise = camera.once('moveend');

        camera.panTo([100, 0], {}, eventData);
        camera.stop();

        const d = await promise;
        expect((d as any).data).toBe('ok');
    });

    test('emits moveend if zooming, preserving eventData', async () => {
        const {camera} = createCamera();
        const eventData = {data: 'ok'};

        const promise = camera.once('moveend');

        camera.zoomTo(3.2, {}, eventData);
        camera.stop();

        const d = await promise;
        expect((d as any).data).toBe('ok');
    });

    test('emits moveend if rotating, preserving eventData', async () => {
        const {camera} = createCamera();
        const eventData = {data: 'ok'};

        const promise = camera.once('moveend');

        camera.rotateTo(90, {}, eventData);
        camera.stop();

        const d = await promise;
        expect((d as any).data).toBe('ok');
    });

    test('does not emit moveend if not moving', async () => {
        const {camera, queue} = createCamera();
        const eventData = {data: 'ok'};

        const promise = camera.once('moveend');
        const spy = vi.fn();
        camera.on('moveend', spy);

        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);
        camera.panTo([100, 0], {duration: 1}, eventData);

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();
        }, 0);

        const d = await promise;
        expect((d as any).data).toBe('ok');
        camera.stop();

        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe('cameraForBounds', () => {
    test('no options passed', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb);

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(transform.zoom, 3)).toBe(2.469);
    });

    test('bearing positive number', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {bearing: 175});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(transform.zoom, 3)).toBe(2.396);
        expect(transform.bearing).toBe(175);
    });

    test('bearing negative number', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {bearing: -30});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(transform.zoom, 3)).toBe(2.222);
        expect(transform.bearing).toBe(-30);
    });

    test('padding number', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {padding: 15});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(transform.zoom, 3)).toBe(2.382);
    });

    test('padding object', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {padding: {top: 15, right: 15, bottom: 15, left: 15}});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
    });

    test('asymmetrical padding', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -96.5558, lat: 32.0833});
    });

    test('bearing and asymmetrical padding', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -103.3761, lat: 31.7099});
    });

    test('offset', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {offset: [0, 100]});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 44.4717});
    });

    test('offset and padding', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100]});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -96.5558, lat: 44.4189});
    });

    test('bearing, asymmetrical padding, and offset', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100]});

        expect(fixedLngLat(transform.center, 4)).toEqual({lng: -103.3761, lat: 43.0929});
    });

    test('asymmetrical transform using LngLatBounds instance', () => {
        const {camera} = createCamera({minZoom: 2, maxZoom: 10, minPitch: 0, maxPitch: 60, renderWorldCopies: false});
        camera.transform.resize(2048, 512, true);

        const bb = new LngLatBounds();
        bb.extend([-66.9326, 49.5904]);
        bb.extend([-125.0011, 24.9493]);

        const rotatedTransform = camera.cameraForBounds(bb, {bearing: 45});

        expect(fixedLngLat(rotatedTransform.center, 4)).toEqual({lng: -95.9669, lat: 38.3048});
        expect(fixedNum(rotatedTransform.zoom, 3)).toBe(2.507);
        expect(rotatedTransform.bearing).toBe(45);
    });
});

describe('fitBounds', () => {
    test('no padding passed', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(camera.getZoom(), 3)).toBe(2.469);
    });

    test('padding number', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {padding: 15, duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(camera.getZoom(), 3)).toBe(2.382);
    });

    test('padding object', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -96.5558, lat: 32.0833});
    });

    test('padding does not get propagated to transform.padding', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
        const padding = camera.transform.padding;

        expect(padding).toEqual({
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        });
    });

    test('fiji (crossing antimeridian)', () => {
        const {camera} = createCamera();
        const bb = [[175.813127, -20.157768], [-178.340903, -15.449124]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: 178.7361, lat: -17.819});
        expect(fixedNum(camera.getZoom(), 3)).toBe(5.944);
    });

    test('not crossing antimeridian', () => {
        const {camera} = createCamera();
        const bb = [[-10, -10], [10, 10]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: 0, lat: 0});
        expect(fixedNum(camera.getZoom(), 3)).toBe(4.163);
    });

    test('zoomSnap=0 does not change fitBounds behavior', () => {
        const {camera} = createCamera({zoomSnap: 0});
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(fixedNum(camera.getZoom(), 3)).toBe(2.469);
    });

    test('zoomSnap=1 snaps zoom down', () => {
        const {camera} = createCamera({zoomSnap: 1});
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(camera.getZoom()).toBe(2);
    });

    test('zoomSnap=0 does not change fitBounds behavior for which would round up', () => {
        const {camera} = createCamera({zoomSnap: 0});
        const bb = [[-120, 20], [-60, 45]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(fixedNum(camera.getZoom(), 3)).toBe(2.585);
    });

    test('zoomSnap=0.5 snaps zoom half-down', () => {
        const {camera} = createCamera({zoomSnap: 0.5});
        const bb = [[-120, 20], [-60, 45]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(camera.getZoom()).toBe(2.5);
    });
});

describe('fitScreenCoordinates', () => {
    test('bearing 225', () => {
        const {camera} = createCamera();
        const p0 = [128, 128] as PointLike;
        const p1 = [256, 256] as PointLike;
        const bearing = 225;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 40.9799});
        expect(fixedNum(camera.getZoom(), 3)).toBe(1.5);
        expect(camera.getBearing()).toBe(-135);
    });

    test('bearing 0', () => {
        const {camera} = createCamera();
        const p0 = [128, 128] as PointLike;
        const p1 = [256, 256] as PointLike;
        const bearing = 0;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 40.9799});
        expect(fixedNum(camera.getZoom(), 3)).toBe(2);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('inverted points', () => {
        const {camera} = createCamera();
        const p1 = [128, 128] as PointLike;
        const p0 = [256, 256] as PointLike;
        const bearing = 0;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 40.9799});
        expect(fixedNum(camera.getZoom(), 3)).toBe(2);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('zoomSnap=1 snaps zoom down', () => {
        const {camera} = createCamera({zoomSnap: 1});
        const p0 = [128, 128] as PointLike;
        const p1 = [256, 256] as PointLike;
        const bearing = 225;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(camera.getZoom()).toBe(1);
    });

    test('zoomSnap=0 does not affect zoom', () => {
        const {camera} = createCamera({zoomSnap: 0});
        const p0 = [128, 128] as PointLike;
        const p1 = [256, 256] as PointLike;
        const bearing = 225;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(camera.getZoom()).toBeCloseTo(1.5);
    });
});

describe('transformCameraUpdate', () => {

    test('invoke transformCameraUpdate callback during jumpTo', async () => {
        const {camera} = createCamera();

        let callbackCount = 0;
        let eventCount = 0;

        camera.transformCameraUpdate = () => {
            callbackCount++;
            return {};
        };

        camera.on('move', () => {
            eventCount++;
            expect(eventCount).toBe(callbackCount);
        });
        const promise = camera.once('moveend');

        camera.jumpTo({center: [100, 0]});

        await promise;
    });

    test('invoke transformCameraUpdate callback during easeTo', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);

        let callbackCount = 0;
        let eventCount = 0;

        camera.transformCameraUpdate = () => {
            callbackCount++;
            return {};
        };

        camera.on('move', () => {
            eventCount++;
            expect(eventCount).toBe(callbackCount);
        });
        const promise = camera.once('moveend');

        camera.easeTo({center: [100, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
    });

    test('invoke transformCameraUpdate callback during flyTo', async () => {
        const {camera, queue} = createCamera();
        const stub = vi.spyOn(timeControl, 'now');
        stub.mockImplementation(() => 0);

        let callbackCount = 0;
        let eventCount = 0;

        camera.transformCameraUpdate = () => {
            callbackCount++;
            return {};
        };

        camera.on('move', () => {
            eventCount++;
            expect(eventCount).toBe(callbackCount);
        });
        const promise = camera.once('moveend');

        camera.flyTo({center: [100, 0], duration: 10});

        setTimeout(() => {
            stub.mockImplementation(() => 1);
            queue.run();

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);
        }, 0);

        await promise;
    });

    test('transformCameraUpdate overrides proposed camera settings', () => {
        const {camera} = createCamera();

        camera.transformCameraUpdate = ({center, zoom}) => {
            return {
                center: LngLat.convert([center.lng, center.lat + 10]),
                zoom: Math.round(zoom)
            };
        };

        camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
        expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 10});
        expect(fixedNum(camera.getZoom())).toBe(3);
    });
});

test('create camera with globe returns make globe controls true', () => {
    const {camera} = createCamera(null, true);
    expect(camera.cameraHelper.useGlobeControls).toBeTruthy();
});

describe('jumpTo globe projection', () => {
    describe('globe specific behavior', () => {
        let camera: Camera;

        beforeEach(() => {
            ({camera} = createCamera(null, true, {zoom: 1}));
        });

        test('changing center with no zoom specified should adjusts zoom', () => {
            camera.jumpTo({center: [0, 40]});
            expect(camera.getCenter()).toEqual({lng: 0, lat: 40});
            expect(camera.getZoom()).toBe(0.6154999996223638);
        });

        test('changing center with zoom specified should not adjusts zoom', () => {
            camera.jumpTo({center: [0, 40], zoom: 3});
            expect(camera.getCenter()).toEqual({lng: 0, lat: 40});
            expect(camera.getZoom()).toBe(3);
        });
    });

    describe('mercator test equivalents', () => {
        // Modifications to this camera from one test should carry over to later tests
        const {camera} = createCamera(null, true, {zoom: 1});

        test('sets center', () => {
            camera.jumpTo({center: [1, 2]});
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
        });

        test('throws on invalid center argument', () => {
            expect(() => {
                camera.jumpTo({center: 1 as any});
            }).toThrow(Error);
        });

        test('keeps current center if not specified', () => {
            camera.jumpTo({});
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
        });

        test('sets zoom', () => {
            camera.jumpTo({zoom: 3});
            expect(camera.getZoom()).toBe(3);
        });

        test('keeps current zoom if not specified', () => {
            camera.jumpTo({});
            expect(camera.getZoom()).toBe(3);
        });

        test('sets bearing', () => {
            camera.jumpTo({bearing: 4});
            expect(camera.getBearing()).toBe(4);
        });

        test('keeps current bearing if not specified', () => {
            camera.jumpTo({});
            expect(camera.getBearing()).toBe(4);
        });

        test('sets pitch', () => {
            camera.jumpTo({pitch: 45});
            expect(camera.getPitch()).toBe(45);
        });

        test('keeps current pitch if not specified', () => {
            camera.jumpTo({});
            expect(camera.getPitch()).toBe(45);
        });

        test('sets roll', () => {
            camera.jumpTo({roll: 45});
            expect(camera.getRoll()).toBe(45);
        });

        test('keeps current roll if not specified', () => {
            camera.jumpTo({});
            expect(camera.getRoll()).toBe(45);
        });

        test('sets multiple properties', () => {
            camera.jumpTo({
                center: [10, 20],
                zoom: 10,
                bearing: 180,
                pitch: 60
            });
            expect(camera.getCenter()).toEqual({lng: 10, lat: 20});
            expect(camera.getZoom()).toBe(10);
            expect(camera.getBearing()).toBe(180);
            expect(camera.getPitch()).toBe(60);
        });

        test('emits move events, preserving eventData', () => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera.on('movestart', (d) => started = (d as any).data);
            camera.on('move', (d) => moved = (d as any).data);
            camera.on('moveend', (d) => ended = (d as any).data);

            camera.jumpTo({center: [1, 2]}, eventData);
            expect(started).toBe('ok');
            expect(moved).toBe('ok');
            expect(ended).toBe('ok');
        });

        test('emits zoom events, preserving eventData', () => {
            let started, zoomed, ended;
            const eventData = {data: 'ok'};

            camera.on('zoomstart', (d) => started = (d as any).data);
            camera.on('zoom', (d) => zoomed = (d as any).data);
            camera.on('zoomend', (d) => ended = (d as any).data);

            camera.jumpTo({zoom: 3}, eventData);
            expect(started).toBe('ok');
            expect(zoomed).toBe('ok');
            expect(ended).toBe('ok');
        });

        test('emits rotate events, preserving eventData', () => {
            let started, rotated, ended;
            const eventData = {data: 'ok'};

            camera.on('rotatestart', (d) => started = (d as any).data);
            camera.on('rotate', (d) => rotated = (d as any).data);
            camera.on('rotateend', (d) => ended = (d as any).data);

            camera.jumpTo({bearing: 90}, eventData);
            expect(started).toBe('ok');
            expect(rotated).toBe('ok');
            expect(ended).toBe('ok');
        });

        test('emits pitch events, preserving eventData', () => {
            let started, pitched, ended;
            const eventData = {data: 'ok'};

            camera.on('pitchstart', (d) => started = (d as any).data);
            camera.on('pitch', (d) => pitched = (d as any).data);
            camera.on('pitchend', (d) => ended = (d as any).data);

            camera.jumpTo({pitch: 10}, eventData);
            expect(started).toBe('ok');
            expect(pitched).toBe('ok');
            expect(ended).toBe('ok');
        });

        test('cancels in-progress easing', () => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.jumpTo({center: [1, 2]});
            expect(!camera.isEasing()).toBeTruthy();
        });
    });
});

describe('easeTo globe projection', () => {
    describe('globe specific behavior', () => {
        let camera: Camera;

        beforeEach(() => {
            ({camera} = createCamera(null, true, {zoom: 1}));
        });

        test('changing center with no zoom specified should adjusts zoom', () => {
            camera.easeTo({center: [0, 40], duration: 0});
            expect(camera.getCenter()).toEqual({lng: 0, lat: 40});
            expect(camera.getZoom()).toBe(0.6154999996223638);
        });

        test('changing center with zoom specified should not adjusts zoom', () => {
            camera.easeTo({center: [0, 40], zoom: 3, duration: 0});
            expect(camera.getCenter()).toEqual({lng: 0, lat: 40});
            expect(camera.getZoom()).toBe(3);
        });
    });

    describe('mercator test equivalents', () => {
        test('pans to specified location', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({center: [100, 0], duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('zooms to specified level', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({zoom: 3.2, duration: 0});
            expect(camera.getZoom()).toBe(3.2);
        });

        test('rotates to specified bearing', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({bearing: 90, duration: 0});
            expect(camera.getBearing()).toBe(90);
        });

        test('pitches to specified pitch', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({pitch: 45, duration: 0});
            expect(camera.getPitch()).toBe(45);
        });

        test('rolls to specified roll', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({pitch: 1, roll: 45, duration: 0});
            expect(camera.getPitch()).toBeCloseTo(1, 6);
            expect(camera.getRoll()).toBeCloseTo(45, 6);
        });

        test('roll behavior at Euler angle singularity', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({bearing: 0, pitch: 0, roll: 45, duration: 0});
            expect(camera.getRoll()).toBeCloseTo(45, 6);
            expect(camera.getPitch()).toBeCloseTo(0, 6);
            expect(camera.getBearing()).toBeCloseTo(0, 6);
        });

        test('bearing behavior at Euler angle singularity', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({bearing: 45, pitch: 0, roll: 0, duration: 0});
            expect(camera.getRoll()).toBeCloseTo(0, 6);
            expect(camera.getPitch()).toBeCloseTo(0, 6);
            expect(camera.getBearing()).toBeCloseTo(45, 6);
        });

        test('pans and zooms', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({center: [100, 0], zoom: 3.2, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            expect(camera.getZoom()).toBe(3.2);
        });

        test('pans and rotates', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({center: [100, 0], bearing: 90, duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            expect(camera.getBearing()).toBe(90);
        });

        test('immediately sets padding with duration = 0', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({center: [100, 0], duration: 0, padding: {left: 100}});
            expect(camera.getPadding()).toEqual({
                bottom: 0,
                left: 100,
                right: 0,
                top: 0,
            });

            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('smoothly sets given padding with duration > 0', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');
            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);

            camera.easeTo({center: [100, 0], duration: 100, padding: {left: 100}});

            stub.mockImplementation(() => 50);
            queue.run();

            const padding = camera.getPadding();

            expect(padding.bottom).toBe(0);
            expect(padding.left).toBeCloseTo(80.2403, 4);
            expect(padding.right).toBe(0);
            expect(padding.top).toBe(0);

            stub.mockImplementation(() => 100);
            queue.run();

            await promise;

            expect(camera.getPadding()).toEqual({
                bottom: 0,
                left: 100,
                right: 0,
                top: 0,
            });

            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
        });

        test('zooms and rotates', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({zoom: 3.2, bearing: 90, duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
        });

        test('pans, zooms, and rotates', () => {
            const {camera} = createCamera(null, true, {bearing: -90});
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            expect(camera.getZoom()).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
        });

        test('noop', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBeCloseTo(0);
        });

        // The behavior of "offset" differs from mercator because mercator doesn't follow the docs
        // that offset should be relative to the *target* map state, not *starting* map state.
        // Globe does follow the docs for now.

        test('noop with offset', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: -84.49542091, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBeCloseTo(0);
        });

        test('pans with specified offset', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 15.50457909, lat: 0});
        });

        test('pans with specified offset relative to viewport on a rotated camera', () => {
            const {camera} = createCamera(null, true, {bearing: 180});
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: -175.50457909, lat: 0});
        });

        test('offset computed from inertia (small) does not cross horizon when pitched', () => {
            const {camera} = createCamera(null, true, {pitch: 85, zoom: 10});
            const easeOptions = camera.cameraHelper.handlePanInertia(new Point(0, 100), camera.transform);
            expect(easeOptions.easingOffset.mag()).toBeLessThan(Math.abs(getMercatorHorizon(camera.transform)));
        });

        test('offset computed from inertia (large) does not cross horizon when pitched', () => {
            const {camera} = createCamera(null, true, {pitch: 85, zoom: 10});
            const easeOptions = camera.cameraHelper.handlePanInertia(new Point(0, 500), camera.transform);
            expect(easeOptions.easingOffset.mag()).toBeLessThan(Math.abs(getMercatorHorizon(camera.transform)));
        });

        test('offset computed from inertia (large) does not cross horizon when pitched and rotated', () => {
            const {camera} = createCamera(null, true, {pitch: 85, bearing: 135, zoom: 10});
            const easeOptions = camera.cameraHelper.handlePanInertia(new Point(0, 500), camera.transform);
            expect(easeOptions.easingOffset.mag()).toBeLessThan(Math.abs(getMercatorHorizon(camera.transform)));
        });

        test('zooms with specified offset', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -7.742888378, lat: 0}));
        });

        test('zooms with specified offset relative to viewport on a rotated camera', () => {
            const {camera} = createCamera(null, true, {bearing: 180});
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 7.742888378, lat: 0}));
        });

        test('rotates with specified offset', () => {
            const {camera} = createCamera(null, true);
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 0, lat: 84.49542091}));
        });

        test('rotates with specified offset relative to viewport on a rotated camera', () => {
            const {camera} = createCamera(null, true, {bearing: 180});
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 0, lat: 84.49542091}));
        });

        test('emits zoom events if changing latitude but not zooming', async () => {
            const {camera} = createCamera(null, true);

            const zoomstart = vi.fn();
            const zoom = vi.fn();
            const zoomend = vi.fn();

            camera.on('zoomstart', zoomstart);
            camera.on('zoom', zoom);
            camera.on('zoomend', zoomend);
            const promise = camera.once('moveend');

            camera.easeTo({center: [0, 20], duration: 0});

            await promise;
            expect(zoomstart).toHaveBeenCalled();
            expect(zoom).toHaveBeenCalled();
            expect(zoomend).toHaveBeenCalled();
        });

        test('does not emit zoom events if not changing latitude and not zooming', async () => {
            const {camera} = createCamera(null, true);

            const spy = vi.fn();
            camera.on('zoomstart', spy);
            camera.on('zoom', spy);
            camera.on('zoomend', spy);
            const promise = camera.once('moveend');

            camera.easeTo({center: [100, 0], duration: 0});

            await promise;
            expect(spy).not.toHaveBeenCalled();
        });

        test('pans eastward across the antimeridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.easeTo({center: [-170, 0], duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedAntimeridian).toBeTruthy();
        });

        test('does pan eastward across the antimeridian on a renderWorldCopies: false map if globe is enabled', async () => {
            const {camera} = createCamera({renderWorldCopies: false}, true, {zoom: 2});
            camera.setCenter([170, 0]);
            const promise = camera.once('moveend');
            camera.easeTo({center: [210, 0], duration: 0});

            await promise;
            expect(camera.getCenter().lng).toBeCloseTo(-150, 0);
        });

        test('pans westward across the antimeridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.easeTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedAntimeridian).toBeTruthy();
        });

        test('does pan westward across the antimeridian on a renderWorldCopies: false map if globe is enabled', async () => {
            const {camera} = createCamera({renderWorldCopies: false}, true, {zoom: 2});
            camera.setCenter([-170, 0]);
            const promise = camera.once('moveend');
            camera.easeTo({center: [-210, 0], duration: 0});

            await promise;
            expect(camera.getCenter().lng).toBeCloseTo(150, 0);
        });
    });
});

describe('flyTo globe projection', () => {
    describe('globe specific behavior', () => {
        let camera: Camera;

        beforeEach(() => {
            ({camera} = createCamera(null, true, {zoom: 1}));
        });

        test('changing center with no zoom specified should adjusts zoom', () => {
            camera.flyTo({center: [0, 40], animate: false});
            expect(camera.getCenter().lng).toBeCloseTo(0, 9);
            expect(camera.getCenter().lat).toBeCloseTo(40, 9);
            expect(camera.getZoom()).toBe(0.6154999996223638);
        });

        test('changing center with zoom specified should not adjusts zoom', () => {
            camera.flyTo({center: [0, 40], zoom: 3, animate: false});
            expect(camera.getCenter().lng).toBeCloseTo(0, 9);
            expect(camera.getCenter().lat).toBeCloseTo(40, 9);
            expect(camera.getZoom()).toBe(3);
        });
    });

    describe('mercator test equivalents', () => {
        test('pans to specified location', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({center: [100, 0], animate: false});
            expect(camera.getCenter().lng).toBeCloseTo(100, 9);
            expect(camera.getCenter().lat).toBeCloseTo(0, 9);
        });

        test('throws on invalid center argument', () => {
            const {camera} = createCamera(null, true);
            expect(() => {
                camera.flyTo({center: 1 as any});
            }).toThrow(Error);
        });

        test('does not throw when cameras current zoom is sufficiently greater than passed zoom option', () => {
            const {camera} = createCamera(null, true, {zoom: 22, center: [0, 0]});
            expect(() => camera.flyTo({zoom: 10, center: [0, 0]})).not.toThrow();
        });

        test('zooms to specified level', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({zoom: 3.2, animate: false});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
        });

        test('zooms to integer level without floating point errors', () => {
            const {camera} = createCamera(null, true, {zoom: 0.6});
            camera.flyTo({zoom: 2, animate: false});
            expect(camera.getZoom()).toBe(2);
        });

        test('Zoom out from the same position to the same position with animation', async () => {
            const pos = {lng: 0, lat: 0};
            const {camera, queue} = createCamera(null, true, {zoom: 20, center: pos});
            const stub = vi.spyOn(timeControl, 'now');

            const promise = camera.once('zoomend');

            stub.mockImplementation(() => 0);
            camera.flyTo({zoom: 19, center: pos, duration: 2});

            stub.mockImplementation(() => 3);
            queue.run();

            await promise;

            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat(pos));
            expect(camera.getZoom()).toBe(19);
        });

        test('rotates to specified bearing', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({bearing: 90, animate: false});
            expect(camera.getBearing()).toBe(90);
        });

        test('tilts to specified pitch', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({pitch: 45, animate: false});
            expect(camera.getPitch()).toBe(45);
        });

        test('rolls to specified roll', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({pitch: 1, roll: 45, animate: false});
            expect(camera.getPitch()).toBeCloseTo(1, 6);
            expect(camera.getRoll()).toBeCloseTo(45, 6);
        });

        test('roll behavior at Euler angle singularity', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({bearing: 0, pitch: 0, roll: 45, animate: false});
            expect(camera.getRoll()).toBeCloseTo(45, 6);
            expect(camera.getPitch()).toBeCloseTo(0, 6);
            expect(camera.getBearing()).toBeCloseTo(0, 6);
        });

        test('bearing behavior at Euler angle singularity', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({bearing: 45, pitch: 0, roll: 0, animate: false});
            expect(camera.getRoll()).toBeCloseTo(0, 6);
            expect(camera.getPitch()).toBeCloseTo(0, 6);
            expect(camera.getBearing()).toBeCloseTo(45, 6);
        });

        test('pans and zooms', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
        });

        test('pans and rotates', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({center: [100, 0], bearing: 90, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(camera.getBearing()).toBe(90);
        });

        test('immediately sets padding with duration = 0', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({center: [100, 0], duration: 0, padding: {left: 100}});
            expect(camera.getPadding()).toEqual({
                bottom: 0,
                left: 100,
                right: 0,
                top: 0,
            });

        });

        test('smoothly sets given padding with duration > 0', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');
            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);

            camera.flyTo({center: [100, 0], duration: 100, padding: {left: 100}});

            stub.mockImplementation(() => 100);
            queue.run();

            const padding = camera.getPadding();

            expect(padding.bottom).toBe(0);
            expect(padding.left).toBeCloseTo(100, 4);
            expect(padding.right).toBe(0);
            expect(padding.top).toBe(0);

            stub.mockImplementation(() => 100);
            queue.run();

            await promise;

            expect(camera.getPadding()).toEqual({
                bottom: 0,
                left: 100,
                right: 0,
                top: 0,
            });
        });

        test('zooms and rotates', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({zoom: 3.2, bearing: 90, animate: false});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
        });

        test('pans, zooms, and rotates', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
        });

        test('noop', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBeCloseTo(0);
        });

        // Globe animations with offset are different from mercator because
        // globe animations follow docs, see comment in easeTo globe tests.

        test('noop with offset', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 84.49542091, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBeCloseTo(0);
        });

        test('pans with specified offset', () => {
            const {camera} = createCamera(null, true);
            camera.flyTo({center: [100, 0], offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 15.50457909, lat: 0});
        });

        test('pans with specified offset relative to viewport on a rotated camera', () => {
            const {camera} = createCamera(null, true, {bearing: 180});
            camera.easeTo({center: [100, 0], offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: -175.50457909, lat: 0});
        });

        test('emits move, zoom, rotate, pitch, and roll events, preserving eventData', async () => {

            const {camera} = createCamera(null, true);
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched, rollstarted, rolled;
            const eventData = {data: 'ok'};

            camera.on('movestart', (d) => movestarted = (d as any).data);
            camera.on('move', (d) => moved = (d as any).data);
            camera.on('rotate', (d) => rotated = (d as any).data);
            camera.on('pitch', (d) => pitched = (d as any).data);
            camera.on('roll', (d) => rolled = (d as any).data);
            const movePromise = camera.once('moveend');

            camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
            camera.on('zoom', (d) => zoomed = (d as any).data);
            const zoomPromise = camera.once('zoomend');

            camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
            camera.on('rotate', (d) => rotated = (d as any).data);
            const rotatePromise = camera.once('rotateend');

            camera.on('pitchstart', (d) => pitchstarted = (d as any).data);
            camera.on('pitch', (d) => pitched = (d as any).data);
            const pitchPromise = camera.once('pitchend');

            camera.on('rollstart', (d) => rollstarted = (d as any).data);
            camera.on('roll', (d) => rolled = (d as any).data);
            const rollPromise = camera.once('rollend');

            camera.flyTo(
                {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, roll: 10, animate: false},
                eventData);

            const moveResult = await movePromise;
            expect(camera._zooming).toBeFalsy();
            expect(camera._rotating).toBeFalsy();
            expect(camera._pitching).toBeFalsy();
            expect(camera._rolling).toBeFalsy();

            expect(movestarted).toBe('ok');
            expect(moved).toBe('ok');
            expect(zoomed).toBe('ok');
            expect(rotated).toBe('ok');
            expect(pitched).toBe('ok');
            expect(rolled).toBe('ok');
            expect((moveResult as any).data).toBe('ok');

            const zoomResult = await zoomPromise;
            expect(zoomstarted).toBe('ok');
            expect(zoomed).toBe('ok');
            expect((zoomResult as any).data).toBe('ok');

            const rotateResult = await rotatePromise;
            expect(rotatestarted).toBe('ok');
            expect(rotated).toBe('ok');
            expect((rotateResult as any).data).toBe('ok');

            const pitchResult = await pitchPromise;
            expect(pitchstarted).toBe('ok');
            expect(pitched).toBe('ok');
            expect((pitchResult as any).data).toBe('ok');

            const rollResult = await rollPromise;
            expect(rollstarted).toBe('ok');
            expect(rolled).toBe('ok');
            expect((rollResult as any).data).toBe('ok');
        });

        test('for short flights, emits (solely) move events, preserving eventData', async () => {
            //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
            //As such; it deserves a separate test case. This test case flies the map from A to A.
            const {camera, queue} = createCamera(null, true, {center: [100, 0]});
            let movestarted, moved,
                zoomstarted, zoomed, zoomended,
                rotatestarted, rotated, rotateended,
                pitchstarted, pitched, pitchended;
            const eventData = {data: 'ok'};

            camera.on('movestart', (d) => movestarted = (d as any).data);
            camera.on('move', (d) => moved = (d as any).data);
            camera.on('zoomstart', (d) => zoomstarted = (d as any).data);
            camera.on('zoom', (d) => zoomed = (d as any).data);
            camera.on('zoomend', (d) => zoomended = (d as any).data);
            camera.on('rotatestart', (d) => rotatestarted = (d as any).data);
            camera.on('rotate', (d) => rotated = (d as any).data);
            camera.on('rotateend', (d) => rotateended = (d as any).data);
            camera.on('pitchstart', (d) => pitchstarted = (d as any).data);
            camera.on('pitch', (d) => pitched = (d as any).data);
            camera.on('pitchend', (d) => pitchended = (d as any).data);
            const promise = camera.once('moveend');

            const stub = vi.spyOn(timeControl, 'now');
            stub.mockImplementation(() => 0);

            camera.flyTo({center: [100, 0], duration: 10}, eventData);

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            const d = await promise;
            expect(camera._zooming).toBeFalsy();
            expect(camera._rotating).toBeFalsy();

            expect(movestarted).toBe('ok');
            expect(moved).toBe('ok');
            expect(zoomstarted).toBeUndefined();
            expect(zoomed).toBeUndefined();
            expect(zoomended).toBeUndefined();
            expect(rotatestarted).toBeUndefined();
            expect(rotated).toBeUndefined();
            expect(rotateended).toBeUndefined();
            expect(pitched).toBeUndefined();
            expect(pitchstarted).toBeUndefined();
            expect(pitchended).toBeUndefined();
            expect((d as any).data).toBe('ok');
        });

        test('ascends', async () => {
            const {camera, queue} = createCamera(null, true);
            camera.setZoom(18);
            let ascended;
            const normalizedStartZoom = camera.getZoom() + getZoomAdjustment(camera.getCenter().lat, 0);
            camera.on('zoom', () => {
                const normalizedZoom = camera.getZoom() + getZoomAdjustment(camera.getCenter().lat, 0);
                if (normalizedZoom < normalizedStartZoom) {
                    ascended = true;
                }
            });

            const promise = camera.once('moveend');

            const stub = vi.spyOn(timeControl, 'now');
            stub.mockImplementation(() => 0);

            camera.flyTo({center: [100, 0], zoom: 18, duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(ascended).toBeTruthy();
        });

        test('pans eastward across the prime meridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([-10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [10, 0], duration: 20});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 20);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedPrimeMeridian).toBeTruthy();
        });

        test('pans westward across the prime meridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [-10, 0], duration: 20});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 20);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedPrimeMeridian).toBeTruthy();
        });

        test('pans eastward across the antimeridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [-170, 0], duration: 20});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 20);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedAntimeridian).toBeTruthy();
        });

        test('pans westward across the antimeridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedAntimeridian).toBeTruthy();
        });

        test('pans eastward across the antimeridian even if renderWorldCopies: false', async () => {
            const {camera, queue} = createCamera({renderWorldCopies: false}, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [-170, 0], duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedAntimeridian).toBeTruthy();
        });

        test('pans westward across the antimeridian even if renderWorldCopies: false', async () => {
            const {camera, queue} = createCamera({renderWorldCopies: false}, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(crossedAntimeridian).toBeTruthy();
        });

        test('jumps back to world 0 when crossing the antimeridian', async () => {
            const {camera, queue} = createCamera(null, true);
            const stub = vi.spyOn(timeControl, 'now');

            camera.setCenter([-170, 0]);

            let leftWorld0 = false;

            camera.on('move', () => {
                leftWorld0 ||= (camera.getCenter().lng < -180);
            });

            const promise = camera.once('moveend');

            stub.mockImplementation(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 1);
                queue.run();

                setTimeout(() => {
                    stub.mockImplementation(() => 10);
                    queue.run();
                }, 0);
            }, 0);

            await promise;
            expect(leftWorld0).toBeFalsy();
        });

        test('flight arc does not zoom below the minZoom flyTo option (globe projection)', async () => {
            const {camera, queue} = createCamera(null, true, {zoom: 20});
            const stub = vi.spyOn(timeControl, 'now');

            const minZoom = 10;
            const zoomValues: number[] = [];
            const zoomSpy = vi.fn(() => zoomValues.push(camera.getZoom()));
            camera.on('zoom', zoomSpy);

            const promise = camera.once('moveend');

            const duration = 10;
            stub.mockImplementation(() => 0);
            camera.flyTo({center: [1, 0], zoom: 20, minZoom, duration});

            await simulateAllAnimationFrames(stub, camera, queue,duration);

            await promise;
            expect(zoomSpy).toHaveBeenCalled();
            expect(Math.min(...zoomValues)).toBeGreaterThanOrEqual(minZoom);
        });

        test('flight arc does not zoom below transform minZoom when only map setMinZoom is used (globe projection)', async () => {
            const {camera, queue} = createCamera(null, true, {zoom: 20});
            camera.transform.setMinZoom(10);
            const stub = vi.spyOn(timeControl, 'now');

            const mapMinZoom = 10;
            const zoomValues: number[] = [];
            const zoomSpy = vi.fn(() => zoomValues.push(camera.getZoom()));
            camera.on('zoom', zoomSpy);

            const promise = camera.once('moveend');

            const duration = 10;
            stub.mockImplementation(() => 0);
            camera.flyTo({center: [1, 0], zoom: 20, duration});

            await simulateAllAnimationFrames(stub, camera, queue,duration);

            await promise;
            expect(zoomSpy).toHaveBeenCalled();
            expect(Math.min(...zoomValues)).toBeGreaterThanOrEqual(mapMinZoom);
        });

        test('respects transform\'s maxZoom', async () => {
            const {camera, queue} = createCamera(null, true);
            camera.transform.setMinZoom(2);
            camera.transform.setMaxZoom(10);

            const promise = camera.once('moveend');

            const stub = vi.spyOn(timeControl, 'now');
            stub.mockImplementation(() => 0);
            camera.flyTo({center: [12, 34], zoom: 30, duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);

            await promise;
            expect(camera.getZoom()).toBeCloseTo(10);
            const {lng, lat} = camera.getCenter();
            expect(lng).toBeCloseTo(12);
            expect(lat).toBeCloseTo(34);
        });

        test('respects transform\'s minZoom', async () => {
            const {camera, queue} = createCamera({minZoom: 2, maxZoom: 10}, true);

            const start = camera.getCenter();
            const target = new LngLat(12, 34);

            const promise = camera.once('moveend');

            const stub = vi.spyOn(timeControl, 'now');
            stub.mockImplementation(() => 0);
            camera.flyTo({center: target, zoom: 1, duration: 10});

            setTimeout(() => {
                stub.mockImplementation(() => 10);
                queue.run();
            }, 0);

            await promise;
            expect(camera.getZoom()).toBeCloseTo(2 + getZoomAdjustment(start.lat, target.lat));
            const {lng, lat} = camera.getCenter();
            expect(lng).toBeCloseTo(12);
            expect(lat).toBeCloseTo(34);
        });

        test('resets duration to 0 if it exceeds maxDuration', async () => {
            let startTime: number;
            const {camera} = createCamera(null, true, {center: [37.63454, 55.75868], zoom: 18});

            camera.on('movestart', () => startTime = new Date().getTime());
            const promise = camera.once('moveend');

            camera.flyTo({center: [-122.3998631, 37.7884307], maxDuration: 100});

            await promise;
            const endTime = new Date().getTime();
            const timeDiff = endTime - startTime;
            expect(timeDiff).toBeLessThan(30);
        });

        // No terrain/elevation tests for globe, as terrain isn't supported (yet?)
    });
});

describe('fitBounds globe projection', () => {
    test('no padding passed', () => {
        const {camera} = createCamera(null, true);
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(camera.getZoom(), 3)).toBe(2.496);
    });

    test('padding number', () => {
        const {camera} = createCamera(null, true);
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {padding: 15, duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(camera.getZoom(), 3)).toBe(2.399);
    });

    test('padding object', () => {
        const {camera} = createCamera(null, true);
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -96.5558, lat: 32.0833});
    });

    test('padding does not get propagated to transform.padding', () => {
        const {camera} = createCamera();
        const bb = [[-133, 16], [-68, 50]] as [LngLatLike, LngLatLike];
        camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
        const padding = camera.transform.padding;

        expect(padding).toEqual({
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        });
    });

    test('maxZoom is respected', () => {
        const {camera} = createCamera(null, true);
        const bb = [[-0.01, -0.01], [0.01, 0.01]] as [LngLatLike, LngLatLike];
        const result = camera.cameraForBounds(bb, {maxZoom: 10});

        expect(result.zoom).toBeLessThanOrEqual(10);
    });

    test('maxZoom is respected with zoomSnap', () => {
        const {camera} = createCamera({zoomSnap: 1}, true, {zoom: 3});
        const bb = [[-0.01, -0.01], [0.01, 0.01]] as [LngLatLike, LngLatLike];
        const result = camera.cameraForBounds(bb, {maxZoom: 10.5});

        expect(result.zoom).toBe(10);
    });
});

describe('fitScreenCoordinates globe projection', () => {
    test('bearing 225', () => {
        const {camera} = createCamera(null, true, {zoom: 3});
        const p0 = [128, 128] as PointLike;
        const p1 = [256, 256] as PointLike;
        const bearing = 225;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -5.9948, lat: 5.8987});
        expect(fixedNum(camera.getZoom(), 3)).toBe(4.454);
        expect(camera.getBearing()).toBe(-135);
    });

    test('bearing 0', () => {
        const {camera} = createCamera(null, true, {zoom: 3});
        const p0 = [128, 128] as PointLike;
        const p1 = [256, 256] as PointLike;
        const bearing = 0;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -5.9948, lat: 5.8987});
        expect(fixedNum(camera.getZoom(), 3)).toBe(4.936);
        expect(camera.getBearing()).toBeCloseTo(0);
    });

    test('inverted points', () => {
        const {camera} = createCamera(null, true, {zoom: 3});
        const p1 = [128, 128] as PointLike;
        const p0 = [256, 256] as PointLike;
        const bearing = 0;
        camera.fitScreenCoordinates(p0, p1, bearing, {duration: 0});

        expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -5.9948, lat: 5.8987});
        expect(fixedNum(camera.getZoom(), 3)).toBe(4.936);
        expect(camera.getBearing()).toBeCloseTo(0);
    });
});

describe('zoomSnap', () => {
    test('zoomIn() with zoomSnap set to 1.0', () => {
        const {camera} = createCamera({zoomSnap: 1.0});
        camera.setZoom(9.7);
        camera.zoomIn({duration: 0});
        expect(camera.getZoom()).toBe(11.0);
    });

    test('zoomOut() with zoomSnap set to 1.0', () => {
        const {camera} = createCamera({zoomSnap: 1.0});
        camera.setZoom(10.3);
        camera.zoomOut({duration: 0});
        expect(camera.getZoom()).toBe(9.0);
    });

    test('zoomIn() with zoomSnap set to 0.5', () => {
        const {camera} = createCamera({zoomSnap: 0.5});
        camera.setZoom(9.1);
        camera.zoomIn({duration: 0});
        expect(camera.getZoom()).toBe(10.0);
    });
});
