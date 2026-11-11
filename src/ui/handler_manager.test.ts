import {afterEach, beforeEach, describe, expect, vi, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {Event as MapEvent} from '../util/evented.ts';
import * as cameraMath from '../geo/projection/camera_math.ts';
import * as cameraUpdates from '../geo/projection/camera_updates.ts';
import {beforeMapTest, createMap, createTerrain, createCoverageIndex} from '../util/test/util.ts';
import simulate from '../../test/unit/lib/simulate_interaction.ts';
import * as timeControl from '../util/time_control.ts';
import {MercatorCameraHelper} from '../geo/projection/mercator_camera_helper.ts';
import {VerticalPerspectiveCameraHelper} from '../geo/projection/vertical_perspective_camera_helper.ts';

import type {HandlerManager, MapControlsScenarioOptions, EventInProgress, EventsInProgress} from './handler_manager.ts';
import type {Map} from './map.ts';
import type {MapControlsDeltas} from '../geo/projection/camera_helper.ts';
import type {Terrain} from '../render/terrain.ts';

let map: Map;
let manager: HandlerManager;

beforeEach(() => {
    beforeMapTest();
});

afterEach(() => {
    map.remove();
    vi.restoreAllMocks();
});

describe('HandlerManager terrain scenarios', () => {
    beforeEach(() => {
        map = createMap();
        manager = map._handlers;
    });

    test('_handleMapControls pans through the camera helper when terrain is not enabled and the pointer is on the map', () => {
        const handleZoom = vi.spyOn(MercatorCameraHelper.prototype, 'handleMapControlsRollPitchBearingZoom');
        const handlePan = vi.spyOn(MercatorCameraHelper.prototype, 'handleMapControlsPan').mockImplementation(state => ({...state}));
        const deltas: MapControlsDeltas = {
            panDelta: new Point(0, 0),
            zoomDelta: 0,
            rollDelta: 0,
            pitchDelta: 0,
            bearingDelta: 0,
            around: new Point(0, 0),
        };
        const options: MapControlsScenarioOptions = {
            terrain: null,
            state: map._camera.cameraState,
            deltasForHelper: deltas,
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {drag: createEventInProgress('drag')},
            panDelta: deltas.panDelta,
        };

        manager._terrainGesture.inFlight = false;

        const result = manager._handleMapControls(options);

        expect(handleZoom).toHaveBeenCalledWith(options.state, map._camera.context, options.deltasForHelper);
        expect(handlePan).toHaveBeenCalledWith(handleZoom.mock.results[0].value, map._camera.context, options.deltasForHelper, options.preZoomAroundLoc);
        expect(result).toBe(handlePan.mock.results[0].value);
        expect(map._camera.isHoldingElevation()).toBe(false);
        expect(manager._terrainGesture.inFlight).toBe(false);
    });

    test('_handleMapControls enables terrain movement for globe terrain handling', async () => {
        await map.once('load');
        map.setProjection({type: 'globe'});
        const handlePan = vi.spyOn(VerticalPerspectiveCameraHelper.prototype, 'handleMapControlsPan');
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            state: map._camera.cameraState,
            deltasForHelper: {
                panDelta: new Point(1, 1),
                zoomDelta: 0,
                rollDelta: 0,
                pitchDelta: 0,
                bearingDelta: 0,
                around: new Point(0, 0),
            },
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {drag: createEventInProgress('drag')},
            panDelta: new Point(1, 1),
        };

        manager._terrainGesture.inFlight = false;

        manager._handleMapControls(options);

        expect(manager._terrainGesture.inFlight).toBe(true);
        expect(map._camera.isHoldingElevation()).toBe(true);
        expect(handlePan).toHaveBeenCalledWith(expect.anything(), map._camera.context, options.deltasForHelper, options.preZoomAroundLoc);
    });

    test('_handleMapControls keeps terrain movement state when globe terrain is already active', async () => {
        await map.once('load');
        map.setProjection({type: 'globe'});
        const handlePan = vi.spyOn(VerticalPerspectiveCameraHelper.prototype, 'handleMapControlsPan');
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            state: map._camera.cameraState,
            deltasForHelper: {
                panDelta: new Point(0, 0),
                zoomDelta: 0,
                rollDelta: 0,
                pitchDelta: 0,
                bearingDelta: 0,
                around: new Point(0, 0),
            },
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {},
            panDelta: undefined,
        };

        manager._terrainGesture.inFlight = true;
        map._camera.holdElevation('gesture');

        manager._handleMapControls(options);

        expect(manager._terrainGesture.inFlight).toBe(true);
        expect(map._camera.isHoldingElevation()).toBe(true);
        expect(handlePan).toHaveBeenCalledWith(expect.anything(), map._camera.context, options.deltasForHelper, options.preZoomAroundLoc);
    });

    test('_handleMapControls activates terrain movement on first drag in mercator terrain', () => {
        const handlePan = vi.spyOn(MercatorCameraHelper.prototype, 'handleMapControlsPan').mockImplementation(state => ({...state}));
        const deltas: MapControlsDeltas = {
            panDelta: new Point(2, 3),
            zoomDelta: 0,
            rollDelta: 0,
            pitchDelta: 0,
            bearingDelta: 0,
            around: new Point(0, 0),
        };
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            state: map._camera.cameraState,
            deltasForHelper: deltas,
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {drag: createEventInProgress('drag')},
            panDelta: deltas.panDelta,
        };

        manager._terrainGesture.inFlight = false;

        const result = manager._handleMapControls(options);

        expect(manager._terrainGesture.inFlight).toBe(true);
        expect(map._camera.isHoldingElevation()).toBe(true);
        expect(handlePan).toHaveBeenCalledTimes(1);
        expect(result).toBe(handlePan.mock.results[0].value);
    });

    test('_handleMapControls drags by pixels on the center-elevation plane when already moving in mercator terrain', () => {
        const handlePan = vi.spyOn(MercatorCameraHelper.prototype, 'handleMapControlsPan');
        const panDelta = new Point(4, 6);
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            state: map._camera.cameraState,
            deltasForHelper: {
                panDelta,
                zoomDelta: 0,
                rollDelta: 0,
                pitchDelta: 0,
                bearingDelta: 0,
                around: new Point(0, 0),
            },
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {drag: createEventInProgress('drag')},
            panDelta,
        };
        const draggedToTheCenter = map.unproject(map._camera.projectedCamera.centerPoint.sub(panDelta));

        manager._terrainGesture.inFlight = true;
        map._camera.holdElevation('gesture');

        const result = manager._handleMapControls(options);

        expect(result.center.lng).toBeCloseTo(draggedToTheCenter.lng, 9);
        expect(result.center.lat).toBeCloseTo(draggedToTheCenter.lat, 9);
        expect(handlePan).not.toHaveBeenCalled();
    });

    test('_handleMapControls falls back to helper panning when not dragging in mercator terrain', () => {
        const handlePan = vi.spyOn(MercatorCameraHelper.prototype, 'handleMapControlsPan');
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            state: map._camera.cameraState,
            deltasForHelper: {
                panDelta: new Point(0, 0),
                zoomDelta: 0,
                rollDelta: 0,
                pitchDelta: 0,
                bearingDelta: 0,
                around: new Point(0, 0),
            },
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {},
            panDelta: undefined,
        };

        manager._terrainGesture.inFlight = true;
        map._camera.holdElevation('gesture');

        manager._handleMapControls(options);

        expect(handlePan).toHaveBeenCalledWith(expect.anything(), map._camera.context, options.deltasForHelper, options.preZoomAroundLoc);
    });
});

function createEventInProgress(name: keyof EventsInProgress): EventInProgress {
    return {
        handlerName: name,
        originalEvent: new MapEvent(`${String(name)}start`),
    };
}

describe('terrain gesture anchoring', () => {
    async function setupGestureMap(pitch: number = 0): Promise<HTMLElement> {
        map = createMap({interactive: true, zoom: 11, center: [7.5, 45.9], pitch, bearing: 0});
        map.touchZoomRotate.disableRotation();
        map._handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        await map.once('style.load');
        return map.getCanvas();
    }

    function gestureStep(kind: 'touchstart' | 'touchmove', target: HTMLElement, positions: Point[]): void {
        const touches = positions.map((p, i) => ({target, identifier: i + 1, clientX: p.x, clientY: p.y}));
        simulate[kind](target, {touches});
        map._renderTaskQueue.run();
    }

    function endGesture(target: HTMLElement): void {
        simulate.touchend(target, {touches: []});
        map._renderTaskQueue.run();
        map._renderTaskQueue.run();
    }

    function pinchTouches(mid: Point, halfSpread: number): Point[] {
        return [
            new Point(mid.x, mid.y - halfSpread),
            new Point(mid.x, mid.y + halfSpread),
        ];
    }

    function slipOf(anchor: LngLat, expectedAt: Point): number {
        return map.project(anchor).dist(expectedAt);
    }

    test('moving-centroid pinch with terrain keeps the grabbed terrain point under the fingers', async () => {
        const target = await setupGestureMap();
        const anchor = new LngLat(7.49, 45.905);
        map.terrain = createTerrain();
        map._camera.setTerrain(map.terrain);
        const coverage = vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(() => 1000, 1000, 1000));

        // Start the pinch with the finger midpoint exactly where the grabbed point renders
        const start = map.project(anchor);
        expect(start.x).toBeGreaterThan(20);
        expect(start.x).toBeLessThan(180);
        expect(start.y).toBeGreaterThan(20);
        expect(start.y).toBeLessThan(180);

        gestureStep('touchstart', target, pinchTouches(start, 30));
        let mid = start;
        let halfSpread = 30;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(15, 10));
            halfSpread += 10;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
            // terrain "loading" mid-gesture must not move the anchor plane
            coverage.mockReturnValue(createCoverageIndex(() => 4000, 4000, 4000));
        }

        expect(map.getZoom()).toBeGreaterThan(11.5);
        expect(map._handlers._terrainGesture.anchorElevation).toBe(1000);

        const slip = slipOf(anchor, mid);
        endGesture(target);
        expect(slip).toBeLessThan(0.5);
        expect(map._handlers._terrainGesture.anchorElevation).toBeNull();
    });

    test('pitched moving-centroid pinch with terrain keeps the grabbed terrain point under the fingers', async () => {
        const target = await setupGestureMap(60);
        const anchor = new LngLat(7.494, 45.904);
        map.terrain = createTerrain();
        map._camera.setTerrain(map.terrain);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(() => 1000, 1000, 1000));

        const start = map.project(anchor);
        expect(start.x).toBeGreaterThan(20);
        expect(start.x).toBeLessThan(180);
        expect(start.y).toBeGreaterThan(20);
        expect(start.y).toBeLessThan(180);

        gestureStep('touchstart', target, pinchTouches(start, 25));
        let mid = start;
        let halfSpread = 25;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(12, 8));
            halfSpread += 8;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
        }

        expect(map.getZoom()).toBeGreaterThan(11.5);

        const slip = slipOf(anchor, mid);
        endGesture(target);
        expect(slip).toBeLessThan(0.5);
    });

    test('touch drag with terrain keeps a grabbed point elevated above the center plane under the finger', async () => {
        const target = await setupGestureMap();
        // a 2000 m ridge east of the center, with the center itself at 300 m
        const ridgeStartLng = map.getCenter().lng + 0.003;
        const elevationAt = (lng: number) => lng > ridgeStartLng ? 2000 : 300;
        const anchor = new LngLat(map.getCenter().lng + 0.012, map.getCenter().lat);
        map.terrain = {
            ...createTerrain(),
            exaggeration: 1,
            getElevationForLngLat: (lngLat: LngLat) => elevationAt(lngLat.lng),
            getElevationAndDEMStateForLngLat: (lngLat: LngLat) => ({elevation: elevationAt(lngLat.lng), demState: 'loaded'}),
        } as any as Terrain;
        map._camera.setTerrain(map.terrain);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(elevationAt, 300, 2000));
        map._camera.applyStateChange((state, context) => cameraUpdates.setElevation(state, context, 300));

        const start = map.project(anchor);
        expect(start.x).toBeGreaterThan(20);
        expect(start.x).toBeLessThan(180);

        gestureStep('touchstart', target, [start]);
        let finger = start;
        for (let step = 0; step < 3; step++) {
            finger = finger.add(new Point(-20, 0));
            gestureStep('touchmove', target, [finger]);
        }

        expect(map.getCenter().lng).not.toBeCloseTo(7.5, 5);

        const slip = slipOf(anchor, finger);
        endGesture(target);
        expect(slip).toBeLessThan(0.5);
    });

    test('center-anchored pinch over terrain still pans with the centroid', async () => {
        const target = await setupGestureMap();
        map.touchZoomRotate.enable({around: 'center'});
        map.terrain = createTerrain();
        map._camera.setTerrain(map.terrain);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(() => 1000, 1000, 1000));

        const startCenter = map.getCenter();
        const start = new Point(80, 90);
        gestureStep('touchstart', target, pinchTouches(start, 30));
        let mid = start;
        let halfSpread = 30;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(15, 10));
            halfSpread += 10;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
        }

        expect(map.getZoom()).toBeGreaterThan(11.5);
        // center-anchored zoom keeps the center fixed, so only the pan moves it
        const centerMovedPx = map.project(startCenter).dist(new Point(100, 100));
        endGesture(target);
        expect(centerMovedPx).toBeGreaterThan(20);
    });

    test('falls back to the center-elevation behavior when the terrain under the gesture is not loaded', async () => {
        const target = await setupGestureMap();
        map.terrain = createTerrain();
        map._camera.setTerrain(map.terrain);

        const startCenter = map.getCenter();
        const start = new Point(80, 90);
        gestureStep('touchstart', target, pinchTouches(start, 30));
        let mid = start;
        let halfSpread = 30;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(15, 10));
            halfSpread += 10;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
        }

        // the gesture still zooms and pans sanely near where it started
        expect(map.getZoom()).toBeGreaterThan(11.5);
        expect(Math.abs(map.getCenter().lng - startCenter.lng)).toBeLessThan(0.5);
        expect(Math.abs(map.getCenter().lat - startCenter.lat)).toBeLessThan(0.5);
        endGesture(target);
    });

    test('a drag that starts over terrain that is not loaded moves the map the same distance per pixel when that terrain loads mid-drag', async () => {
        const target = await setupGestureMap(45);
        map.terrain = createTerrain();
        map._camera.setTerrain(map.terrain);
        const coverage = vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(null);

        gestureStep('touchstart', target, [new Point(100, 150)]);
        gestureStep('touchmove', target, [new Point(100, 140)]);
        const latitudeAfterFirstMove = map.getCenter().lat;
        gestureStep('touchmove', target, [new Point(100, 130)]);
        const latitudeAfterSecondMove = map.getCenter().lat;
        coverage.mockReturnValue(createCoverageIndex(() => 3000, 3000, 3000));
        gestureStep('touchmove', target, [new Point(100, 120)]);
        const latitudeAfterThirdMove = map.getCenter().lat;
        endGesture(target);

        expect(latitudeAfterThirdMove - latitudeAfterSecondMove).toBeCloseTo(latitudeAfterSecondMove - latitudeAfterFirstMove, 5);
    });

    test('falls back to the center-elevation behavior when the grabbed terrain point is nearly as high as the camera', async () => {
        const target = await setupGestureMap();
        map.terrain = createTerrain();
        map._camera.setTerrain(map.terrain);
        const start = new Point(80, 90);
        const {projectedCamera, context} = map._camera;
        const centerElevation = map.getCameraTargetElevation();
        // a plateau just under the camera, whose edge is where the ray through the pinch's first midpoint meets it
        const firstMid = start.add(new Point(15, 10));
        const plateauTop = centerElevation + 0.95 * (cameraMath.getCameraAltitude(projectedCamera) - centerElevation);
        const edge = cameraMath.screenPointToLocationAtElevation(projectedCamera, context.projection, firstMid, plateauTop);
        const height = (lng: number, lat: number) => lng < edge.lng + 1e-5 && lat > edge.lat - 1e-5 ? plateauTop : centerElevation;
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(height, centerElevation, plateauTop));
        expect(cameraMath.screenTerrainPointToMercatorCoordinate(projectedCamera, context.projection, firstMid, map.terrain).z).toBeCloseTo(plateauTop, 0);

        const startCenter = map.getCenter();
        gestureStep('touchstart', target, pinchTouches(start, 30));
        let mid = start;
        let halfSpread = 30;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(15, 10));
            halfSpread += 10;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
        }

        // the gesture still zooms and pans sanely near where it started
        expect(map.getZoom()).toBeGreaterThan(11.5);
        expect(Math.abs(map.getCenter().lng - startCenter.lng)).toBeLessThan(0.5);
        expect(Math.abs(map.getCenter().lat - startCenter.lat)).toBeLessThan(0.5);
        endGesture(target);
    });

    test('control: the same moving-centroid pinch without terrain keeps the grabbed point under the fingers', async () => {
        const target = await setupGestureMap();

        const start = new Point(67, 76);
        const anchor = map.unproject(start);

        gestureStep('touchstart', target, pinchTouches(start, 30));
        let mid = start;
        let halfSpread = 30;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(15, 10));
            halfSpread += 10;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
        }

        expect(map.getZoom()).toBeGreaterThan(11.5);

        const slip = slipOf(anchor, mid);
        endGesture(target);
        expect(slip).toBeLessThan(0.5);
    });
});

describe('dragRotate around the pointer', () => {
    test('a new right-button drag turns around the point where it starts, not where the last one started', async () => {
        map = createMap({interactive: true, dragRotate: {around: 'pointer'}, zoom: 12, pitch: 45});
        await map.once('load');
        vi.spyOn(timeControl, 'now').mockReturnValue(0);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 60, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 80, clientY: 140});
        map.redraw();
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 80, clientY: 140});
        map.redraw();
        const secondPivot = map.unproject([140, 120]);
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 140, clientY: 120});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 160, clientY: 110});
        map.redraw();

        expect(map.project(secondPivot).dist(new Point(140, 120))).toBeLessThan(0.1);
    });
});
