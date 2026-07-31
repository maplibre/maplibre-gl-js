import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Point from '@mapbox/point-geometry';

import type {HandlerManager, MapControlsScenarioOptions, EventInProgress, EventsInProgress} from './handler_manager.ts';
import type {Map} from './map.ts';
import {LngLat} from '../geo/lng_lat.ts';
import type {ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper.ts';
import type {Terrain} from '../render/terrain.ts';
import type {ITransform} from '../geo/transform_interface.ts';
import {Event as MapEvent} from '../util/evented.ts';
import {beforeMapTest, createMap, createTerrain} from '../util/test/util.ts';
import simulate from '../../test/unit/lib/simulate_interaction.ts';

let map: Map;
let manager: HandlerManager;

beforeEach(() => {
    beforeMapTest();
    map = createMap();
    manager = map._handlers;
});

afterEach(() => {
    map.remove();
    vi.restoreAllMocks();
});

describe('HandlerManager terrain scenarios', () => {
    it('_handleMapControls keeps terrain movement disabled when terrain is not enabled', () => {
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

    it('_handleMapControls enables terrain movement for globe terrain handling', () => {
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

    it('_handleMapControls keeps terrain movement state when globe terrain is already active', () => {
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

    it('_handleMapControls activates terrain movement on first drag in mercator terrain', () => {
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

    it('_handleMapControls drags using transform when already moving in mercator terrain', () => {
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

    it('_handleMapControls falls back to helper panning when not dragging in mercator terrain', () => {
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
    // With terrain enabled, a touch gesture must keep the terrain point grabbed at
    // gesture start under the fingers, exactly as the flat map does. Today the
    // terrain path solves pan against the frozen center-elevation plane and applies
    // pinch zoom around the screen center (handler_manager _handleMapControls),
    // so terrain under the fingers slips by roughly the centroid travel.
    // Related: #2937 (rotation float), #7989/#4688 (elevation refreeze snap).

    const setupGestureMap = async (): Promise<HTMLElement> => {
        map.remove();
        map = createMap({interactive: true, zoom: 11, center: [7.5, 45.9], pitch: 0, bearing: 0});
        map.touchZoomRotate.disableRotation();
        map._handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        await map.once('style.load');
        return map.getCanvas();
    };

    const gestureStep = (kind: 'touchstart' | 'touchmove', target: HTMLElement, positions: Point[]) => {
        const touches = positions.map((p, i) => ({target, identifier: i + 1, clientX: p.x, clientY: p.y}));
        simulate[kind](target, {touches});
        map._renderTaskQueue.run();
    };

    const endGesture = (target: HTMLElement) => {
        simulate.touchend(target, {touches: []});
        map._renderTaskQueue.run();
        map._renderTaskQueue.run();
    };

    const pinchTouches = (mid: Point, halfSpread: number): Point[] => [
        new Point(mid.x, mid.y - halfSpread),
        new Point(mid.x, mid.y + halfSpread),
    ];

    // Screen distance between where the grabbed terrain point actually renders
    // (terrain-aware projection) and where the gesture currently holds it.
    const slipOf = (anchor: LngLat, expectedAt: Point): number => map.project(anchor).dist(expectedAt);

    it('moving-centroid pinch with terrain keeps the grabbed terrain point under the fingers', async () => {
        const target = await setupGestureMap();
        map.terrain = createTerrain(); // uniform 1000 m DEM stub

        // Grab a terrain point away from the screen center: start the pinch with the
        // finger midpoint exactly where that point renders.
        const anchor = new LngLat(7.49, 45.905);
        const start = map.project(anchor);
        expect(start.x).toBeGreaterThan(20);
        expect(start.x).toBeLessThan(180);
        expect(start.y).toBeGreaterThan(20);
        expect(start.y).toBeLessThan(180);

        gestureStep('touchstart', target, pinchTouches(start, 30));
        // Fingers travel while spreading: midpoint moves 3 x (15, 10) px, spread doubles.
        let mid = start;
        let halfSpread = 30;
        for (let step = 0; step < 3; step++) {
            mid = mid.add(new Point(15, 10));
            halfSpread += 10;
            gestureStep('touchmove', target, pinchTouches(mid, halfSpread));
        }

        // The gesture really ran: pinch zoomed in about one level.
        expect(map.getZoom()).toBeGreaterThan(11.5);

        const slip = slipOf(anchor, mid);
        endGesture(target);
        expect(slip).toBeLessThan(1.5);
    });

    it('touch drag with terrain keeps a grabbed point elevated above the center plane under the finger', async () => {
        const target = await setupGestureMap();
        // A 2000 m ridge east of the center; the center itself sits at 0 m, so the
        // frozen center-elevation plane and the grabbed point disagree by 2000 m.
        const ridgeStartLng = map.getCenter().lng + 0.003;
        const elevationAt = (lngLat: LngLat) => lngLat.lng > ridgeStartLng ? 2000 : 0;
        map.terrain = {
            ...createTerrain(),
            getElevationForLngLat: (lngLat: LngLat) => elevationAt(lngLat),
            getElevationForLngLatZoom: (lngLat: LngLat) => elevationAt(lngLat),
        } as any as Terrain;

        const anchor = new LngLat(map.getCenter().lng + 0.012, map.getCenter().lat);
        const start = map.project(anchor);
        expect(start.x).toBeGreaterThan(20);
        expect(start.x).toBeLessThan(180);

        gestureStep('touchstart', target, [start]);
        let finger = start;
        for (let step = 0; step < 3; step++) {
            finger = finger.add(new Point(-20, 0));
            gestureStep('touchmove', target, [finger]);
        }

        // The gesture really ran: the map panned.
        expect(map.getCenter().lng).not.toBeCloseTo(7.5, 5);

        const slip = slipOf(anchor, finger);
        endGesture(target);
        expect(slip).toBeLessThan(1.5);
    });

    it('control: the same moving-centroid pinch without terrain keeps the grabbed point under the fingers', async () => {
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
        expect(slip).toBeLessThan(1.5);
    });
});
