import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Point from '@mapbox/point-geometry';

import type {HandlerManager, MapControlsScenarioOptions, EventInProgress, EventsInProgress} from './handler_manager';
import type {Map} from './map';
import {LngLat} from '../geo/lng_lat';
import type {ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper';
import type {Terrain} from '../render/terrain';
import type {ITransform} from '../geo/transform_interface';
import {Event as MapEvent} from '../util/evented';
import {beforeMapTest, createMap} from '../util/test/util';

let map: Map;
let manager: HandlerManager;

beforeEach(() => {
    beforeMapTest();
    map = createMap();
    manager = map.handlers as HandlerManager;
});

afterEach(() => {
    map.remove();
    vi.restoreAllMocks();
});

describe('HandlerManager terrain scenarios', () => {
    it('_handleMapControls keeps terrain movement disabled when terrain is not enabled', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map.cameraHelper = {
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
        map._elevationFreeze = false;

        manager._handleMapControls(options);

        expect(handleZoom).toHaveBeenCalledWith(options.deltasForHelper, options.tr);
        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
        expect(map._elevationFreeze).toBe(false);
        expect(manager._terrainMovement).toBe(false);
        expect(setCenterMock).not.toHaveBeenCalled();
    });

    it('_handleMapControls enables terrain movement for globe terrain handling', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map.cameraHelper = {
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
        map._elevationFreeze = false;

        manager._handleMapControls(options);

        expect(manager._terrainMovement).toBe(true);
        expect(map._elevationFreeze).toBe(true);
        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
    });

    it('_handleMapControls keeps terrain movement state when globe terrain is already active', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map.cameraHelper = {
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
        map._elevationFreeze = true;

        manager._handleMapControls(options);

        expect(manager._terrainMovement).toBe(true);
        expect(map._elevationFreeze).toBe(true);
        expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
    });

    it('_handleMapControls activates terrain movement on first drag in mercator terrain', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map.cameraHelper = {
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
        map._elevationFreeze = false;

        manager._handleMapControls(options);

        expect(manager._terrainMovement).toBe(true);
        expect(map._elevationFreeze).toBe(true);
        expect(handlePan).toHaveBeenCalledTimes(1);
        expect(setCenterMock).not.toHaveBeenCalled();
    });

    it('_handleMapControls drags using transform when already moving in mercator terrain', () => {
        const handleZoom = vi.fn();
        const handlePan = vi.fn();
        map.cameraHelper = {
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
        map._elevationFreeze = true;

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
        map.cameraHelper = {
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
        map._elevationFreeze = true;

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
