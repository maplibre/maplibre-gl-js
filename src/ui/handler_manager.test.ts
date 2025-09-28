import {describe, it, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';

import {HandlerManager} from './handler_manager';
import type {MapControlsScenarioOptions, EventsInProgress, EventInProgress} from './handler_manager';
import type {Map} from './map';
import {LngLat} from '../geo/lng_lat';
import type {ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper';
import type {Terrain} from '../render/terrain';
import type {ITransform} from '../geo/transform_interface';
import {Event as MapEvent} from '../util/evented';

type ManagerWithInternals = HandlerManager & {
    _handleMapControls(options: MapControlsScenarioOptions): void;
};

type CameraHelperStub = Pick<ICameraHelper, 'handleMapControlsRollPitchBearingZoom' | 'handleMapControlsPan'> & {
    readonly useGlobeControls: boolean;
};

const createManager = (useGlobeControls = false) => {
    const manager = Object.create(HandlerManager.prototype) as ManagerWithInternals;
    const handleZoom = vi.fn<(deltas: MapControlsDeltas, tr: ITransform) => void>();
    const handlePan = vi.fn<(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat) => void>();

    const cameraHelper: CameraHelperStub = {
        handleMapControlsRollPitchBearingZoom: handleZoom,
        handleMapControlsPan: handlePan,
        useGlobeControls,
    };

    const mapStub: Pick<Map, 'cameraHelper' | '_elevationFreeze'> = {
        cameraHelper: cameraHelper as unknown as ICameraHelper,
        _elevationFreeze: false,
    };

    manager._map = mapStub as Map;
    manager._terrainMovement = false;

    return {manager, handleZoom, handlePan};
};

type TerrainOptionsParams = {
    terrain?: Terrain | null;
    combinedEventsInProgress?: Partial<Record<keyof EventsInProgress, boolean>>;
    panDelta?: Point;
    centerPoint?: Point;
    screenPointToLocationResult?: LngLat;
};

const createTerrainOptions = (params: TerrainOptionsParams = {}): {
    options: MapControlsScenarioOptions;
    screenPointToLocationMock: ReturnType<typeof vi.fn>;
    setCenterMock: ReturnType<typeof vi.fn>;
} => {
    const panDelta = params.panDelta;
    const terrain = Object.prototype.hasOwnProperty.call(params, 'terrain') ? params.terrain : ({} as Terrain);
    const combinedEventsInProgressFlags = params.combinedEventsInProgress ?? {};
    const screenPointToLocationMock = vi.fn<(point: Point) => LngLat>(() => params.screenPointToLocationResult ?? new LngLat(1, 1));
    const setCenterMock = vi.fn<(center: LngLat) => void>();

    const transformStub = {
        centerPoint: params.centerPoint ?? new Point(0, 0),
        center: new LngLat(0, 0),
        screenPointToLocation: screenPointToLocationMock,
        setCenter: setCenterMock,
    } satisfies Pick<ITransform, 'centerPoint' | 'center' | 'screenPointToLocation' | 'setCenter'>;

    const deltasForHelper: MapControlsDeltas = {
        panDelta: panDelta ?? new Point(0, 0),
        zoomDelta: 0,
        rollDelta: 0,
        pitchDelta: 0,
        bearingDelta: 0,
        around: new Point(0, 0),
    };

    const options: MapControlsScenarioOptions = {
        terrain,
        tr: transformStub as unknown as ITransform,
        deltasForHelper,
        preZoomAroundLoc: new LngLat(0, 0),
        combinedEventsInProgress: buildEventsInProgress(combinedEventsInProgressFlags),
        panDelta,
    };

    return {
        options,
        screenPointToLocationMock,
        setCenterMock,
    };
};

function buildEventsInProgress(flags: Partial<Record<keyof EventsInProgress, boolean>>): EventsInProgress {
    const events: EventsInProgress = {};
    (Object.keys(flags) as Array<keyof EventsInProgress>).forEach((key) => {
        if (!flags[key]) return;
        events[key] = createEventInProgress(key);
    });
    return events;
}

function createEventInProgress(name: keyof EventsInProgress): EventInProgress {
    return {
        handlerName: name,
        originalEvent: new MapEvent(`${String(name)}start`),
    };
}

describe('HandlerManager terrain scenarios', () => {
    describe('_handleMapControls', () => {
        it('keeps terrain movement disabled when terrain is not enabled', () => {
            const {manager, handleZoom, handlePan} = createManager(false);
            const {options, setCenterMock} = createTerrainOptions({
                terrain: null,
                combinedEventsInProgress: {drag: true},
            });

            manager._terrainMovement = false;
            manager._map._elevationFreeze = false;

            manager._handleMapControls(options);

            expect(handleZoom).toHaveBeenCalledWith(options.deltasForHelper, options.tr);
            expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
            expect(manager._terrainMovement).toBe(false);
            expect(manager._map._elevationFreeze).toBe(false);
            expect(setCenterMock).not.toHaveBeenCalled();
        });

        it('enables terrain movement for globe terrain handling', () => {
            const {manager, handlePan} = createManager(true);
            const {options} = createTerrainOptions({
                combinedEventsInProgress: {drag: true},
            });

            manager._terrainMovement = false;
            manager._map._elevationFreeze = false;

            manager._handleMapControls(options);

            expect(manager._terrainMovement).toBe(true);
            expect(manager._map._elevationFreeze).toBe(true);
            expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
        });

        it('keeps terrain movement state when globe terrain is already active', () => {
            const {manager, handlePan} = createManager(true);
            const {options} = createTerrainOptions();

            manager._terrainMovement = true;
            manager._map._elevationFreeze = true;

            manager._handleMapControls(options);

            expect(manager._terrainMovement).toBe(true);
            expect(manager._map._elevationFreeze).toBe(true);
            expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
        });

        it('activates terrain movement on first drag in mercator terrain', () => {
            const {manager, handlePan} = createManager(false);
            const {options, setCenterMock} = createTerrainOptions({combinedEventsInProgress: {drag: true}});

            manager._terrainMovement = false;
            manager._map._elevationFreeze = false;

            manager._handleMapControls(options);

            expect(manager._terrainMovement).toBe(true);
            expect(manager._map._elevationFreeze).toBe(true);
            expect(handlePan).toHaveBeenCalledTimes(1);
            expect(setCenterMock).not.toHaveBeenCalled();
        });

        it('drags using transform when already moving in mercator terrain', () => {
            const {manager, handlePan} = createManager(false);
            const panDelta = new Point(3, 4);
            const screenPointToLocationResult = new LngLat(9, 10);
            const {options, screenPointToLocationMock, setCenterMock} = createTerrainOptions({
                combinedEventsInProgress: {drag: true},
                panDelta,
                centerPoint: new Point(1, 2),
                screenPointToLocationResult,
            });

            manager._terrainMovement = true;

            manager._handleMapControls(options);

            expect(screenPointToLocationMock).toHaveBeenCalled();
            expect(setCenterMock).toHaveBeenCalledWith(screenPointToLocationResult);
            expect(handlePan).not.toHaveBeenCalled();
        });

        it('falls back to helper panning when not dragging in mercator terrain', () => {
            const {manager, handlePan} = createManager(false);
            const {options} = createTerrainOptions({combinedEventsInProgress: {}});

            manager._terrainMovement = true;

            manager._handleMapControls(options);

            expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
        });
    });
});
