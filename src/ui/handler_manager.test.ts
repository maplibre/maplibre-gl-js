import {afterEach, beforeEach, describe, expect, vi, test} from 'vitest';
import Point from '@mapbox/point-geometry';

import type {HandlerManager, MapControlsScenarioOptions, EventInProgress, EventsInProgress} from './handler_manager.ts';
import type {Map} from './map.ts';
import {LngLat} from '../geo/lng_lat.ts';
import type {ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper.ts';
import type {Terrain} from '../render/terrain.ts';
import type {ITransform} from '../geo/transform_interface.ts';
import {Event as MapEvent} from '../util/evented.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {beforeMapTest, createMap, createTerrain} from '../util/test/util.ts';
import simulate from '../../test/unit/lib/simulate_interaction.ts';

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

    test('_handleMapControls keeps terrain movement disabled when terrain is not enabled', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map._camera.cameraHelper = {
            handleMapControlsRollPitchBearingZoom: handleZoom,
            handleMapControlsPan: handlePan,
            useGlobeControls: false,
        } as unknown as ICameraHelper;

        const setCenterMock = vi.fn();
        const transform = {
            centerPoint: new Point(0, 0),
            center: new LngLat(0, 0),
            screenPointToLocation: vi.fn(() => new LngLat(1, 1)),
            setCenter: setCenterMock,
        } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;
        const deltas: MapControlsDeltas = {
            panDelta: new Point(0, 0),
            zoomDelta: 0,
            rollDelta: 0,
            pitchDelta: 0,
            bearingDelta: 0,
            around: new Point(0, 0),
        };
        const combinedEvents: EventsInProgress = {
            drag: createEventInProgress('drag'),
        };
        const options: MapControlsScenarioOptions = {
            terrain: null,
            tr: transform as unknown as ITransform,
            deltasForHelper: deltas,
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: combinedEvents,
            panDelta: deltas.panDelta,
        };

        manager._terrainMovement = false;
        map._camera.elevationFreeze = false;

        manager._handleMapControls(options);

        expect(handleZoom).toHaveBeenCalledWith(options.deltasForHelper, options.tr);
        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
        expect(map._camera.elevationFreeze).toBe(false);
        expect(manager._terrainMovement).toBe(false);
        expect(setCenterMock).not.toHaveBeenCalled();
    });

    test('_handleMapControls enables terrain movement for globe terrain handling', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map._camera.cameraHelper = {
            handleMapControlsRollPitchBearingZoom: handleZoom,
            handleMapControlsPan: handlePan,
            useGlobeControls: true,
        } as unknown as ICameraHelper;

        const transform = {
            centerPoint: new Point(0, 0),
            center: new LngLat(0, 0),
            screenPointToLocation: vi.fn(() => new LngLat(0, 0)),
            setCenter: vi.fn(),
        } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            tr: transform as unknown as ITransform,
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

        manager._terrainMovement = false;
        map._camera.elevationFreeze = false;

        manager._handleMapControls(options);

        expect(manager._terrainMovement).toBe(true);
        expect(map._camera.elevationFreeze).toBe(true);
        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
    });

    test('_handleMapControls keeps terrain movement state when globe terrain is already active', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map._camera.cameraHelper = {
            handleMapControlsRollPitchBearingZoom: handleZoom,
            handleMapControlsPan: handlePan,
            useGlobeControls: true,
        } as unknown as ICameraHelper;

        const transform = {
            centerPoint: new Point(0, 0),
            center: new LngLat(0, 0),
            screenPointToLocation: vi.fn(() => new LngLat(0, 0)),
            setCenter: vi.fn(),
        } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            tr: transform as unknown as ITransform,
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

        manager._terrainMovement = true;
        map._camera.elevationFreeze = true;

        manager._handleMapControls(options);

        expect(manager._terrainMovement).toBe(true);
        expect(map._camera.elevationFreeze).toBe(true);
        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
    });

    test('_handleMapControls activates terrain movement on first drag in mercator terrain', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map._camera.cameraHelper = {
            handleMapControlsRollPitchBearingZoom: handleZoom,
            handleMapControlsPan: handlePan,
            useGlobeControls: false,
        } as unknown as ICameraHelper;

        const setCenterMock = vi.fn();
        const transform = {
            centerPoint: new Point(0, 0),
            center: new LngLat(0, 0),
            screenPointToLocation: vi.fn(() => new LngLat(5, 5)),
            setCenter: setCenterMock,
        } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;
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
            tr: transform as unknown as ITransform,
            deltasForHelper: deltas,
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {drag: createEventInProgress('drag')},
            panDelta: deltas.panDelta,
        };

        manager._terrainMovement = false;
        map._camera.elevationFreeze = false;

        manager._handleMapControls(options);

        expect(manager._terrainMovement).toBe(true);
        expect(map._camera.elevationFreeze).toBe(true);
        expect(handlePan).toHaveBeenCalledTimes(1);
        expect(setCenterMock).not.toHaveBeenCalled();
    });

    test('_handleMapControls drags using transform when already moving in mercator terrain', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map._camera.cameraHelper = {
            handleMapControlsRollPitchBearingZoom: handleZoom,
            handleMapControlsPan: handlePan,
            useGlobeControls: false,
        } as unknown as ICameraHelper;

        const setCenterMock = vi.fn();
        const screenPointToLocation = vi.fn(() => new LngLat(7, 8));
        const transform = {
            centerPoint: new Point(10, 12),
            center: new LngLat(0, 0),
            screenPointToLocation,
            setCenter: setCenterMock,
        } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            tr: transform as unknown as ITransform,
            deltasForHelper: {
                panDelta: new Point(4, 6),
                zoomDelta: 0,
                rollDelta: 0,
                pitchDelta: 0,
                bearingDelta: 0,
                around: new Point(0, 0),
            },
            preZoomAroundLoc: new LngLat(0, 0),
            combinedEventsInProgress: {drag: createEventInProgress('drag')},
            panDelta: new Point(4, 6),
        };

        manager._terrainMovement = true;
        map._camera.elevationFreeze = true;

        manager._handleMapControls(options);

        expect(screenPointToLocation).toHaveBeenCalled();
        expect(setCenterMock).toHaveBeenCalledTimes(1);
        const centerArg = setCenterMock.mock.calls[0][0] as LngLat;
        expect(centerArg.lng).toBeCloseTo(7);
        expect(centerArg.lat).toBeCloseTo(8);
        expect(handlePan).not.toHaveBeenCalled();
    });

    test('_handleMapControls falls back to helper panning when not dragging in mercator terrain', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map._camera.cameraHelper = {
            handleMapControlsRollPitchBearingZoom: handleZoom,
            handleMapControlsPan: handlePan,
            useGlobeControls: false,
        } as unknown as ICameraHelper;

        const transform = {
            centerPoint: new Point(0, 0),
            center: new LngLat(0, 0),
            screenPointToLocation: vi.fn(() => new LngLat(0, 0)),
            setCenter: vi.fn(),
        } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;
        const options: MapControlsScenarioOptions = {
            terrain: {} as Terrain,
            tr: transform as unknown as ITransform,
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

        manager._terrainMovement = true;
        map._camera.elevationFreeze = true;

        manager._handleMapControls(options);

        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
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
        const anchorCoordinate = MercatorCoordinate.fromLngLat(anchor);
        map.terrain = createTerrain();
        const raycastSpy = vi.spyOn(map._camera.transform, 'screenTerrainPointToMercatorCoordinate').mockReturnValue(new MercatorCoordinate(anchorCoordinate.x, anchorCoordinate.y, 1000));

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
            raycastSpy.mockReturnValue(new MercatorCoordinate(anchorCoordinate.x, anchorCoordinate.y, 4000));
        }

        expect(map.getZoom()).toBeGreaterThan(11.5);
        expect(map._handlers._terrainGestureAnchorElevation).toBe(1000);

        const slip = slipOf(anchor, mid);
        endGesture(target);
        expect(slip).toBeLessThan(0.5);
        expect(map._handlers._terrainGestureAnchorElevation).toBeNull();
    });

    test('pitched moving-centroid pinch with terrain keeps the grabbed terrain point under the fingers', async () => {
        const target = await setupGestureMap(60);
        const anchor = new LngLat(7.494, 45.904);
        const anchorCoordinate = MercatorCoordinate.fromLngLat(anchor);
        map.terrain = createTerrain();
        vi.spyOn(map._camera.transform, 'screenTerrainPointToMercatorCoordinate').mockReturnValue(new MercatorCoordinate(anchorCoordinate.x, anchorCoordinate.y, 1000));

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
        const elevationAt = (lngLat: LngLat) => lngLat.lng > ridgeStartLng ? 2000 : 300;
        const anchor = new LngLat(map.getCenter().lng + 0.012, map.getCenter().lat);
        const anchorCoordinate = MercatorCoordinate.fromLngLat(anchor);
        map.terrain = {
            ...createTerrain(),
            getElevationForLngLat: (lngLat: LngLat) => elevationAt(lngLat),
            getElevationForLngLatZoom: (lngLat: LngLat) => elevationAt(lngLat),
        } as any as Terrain;
        vi.spyOn(map._camera.transform, 'screenTerrainPointToMercatorCoordinate').mockReturnValue(new MercatorCoordinate(anchorCoordinate.x, anchorCoordinate.y, 2000));
        map._camera.transform.setElevation(300);

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
        const anchor = new LngLat(7.49, 45.905);
        const anchorCoordinate = MercatorCoordinate.fromLngLat(anchor);
        map.terrain = createTerrain();
        vi.spyOn(map._camera.transform, 'screenTerrainPointToMercatorCoordinate').mockReturnValue(new MercatorCoordinate(anchorCoordinate.x, anchorCoordinate.y, 1000));

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

    test('falls back to the center-elevation behavior when the grabbed terrain point is above the camera altitude', async () => {
        const target = await setupGestureMap();
        map.terrain = createTerrain();
        vi.spyOn(map._camera.transform, 'screenTerrainPointToMercatorCoordinate').mockReturnValue(new MercatorCoordinate(0.5, 0.35, 1e6));

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
