import {describe, it, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';

import {HandlerManager} from './handler_manager';
import type {TerrainScenarioOptions, EventsInProgress, EventInProgress} from './handler_manager';
import type {Map} from './map';
import {LngLat} from '../geo/lng_lat';
import type {ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper';
import type {Terrain} from '../render/terrain';
import type {ITransform} from '../geo/transform_interface';
import {Event as MapEvent} from '../util/evented';

type ManagerWithInternals = HandlerManager & Record<string, unknown>;

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
    options: TerrainScenarioOptions;
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

    const options: TerrainScenarioOptions = {
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
    describe('_applyTerrainScenario', () => {
        it('delegates to no-terrain scenario when terrain is missing', () => {
            const {manager} = createManager();
            const noTerrain = vi.spyOn(manager, '_applyNoTerrainScenario');
            const globeTerrain = vi.spyOn(manager, '_applyGlobeTerrainScenario');
            const mercatorTerrain = vi.spyOn(manager, '_applyMercatorTerrainScenario');
            const {options} = createTerrainOptions({terrain: undefined});

            manager._applyTerrainScenario(options);

            expect(noTerrain).toHaveBeenCalledWith(options);
            expect(globeTerrain).not.toHaveBeenCalled();
            expect(mercatorTerrain).not.toHaveBeenCalled();
        });

        it('delegates to globe terrain scenario when globe controls are active', () => {
            const {manager} = createManager(true);
            const globeTerrain = vi.spyOn(manager, '_applyGlobeTerrainScenario');
            const mercatorTerrain = vi.spyOn(manager, '_applyMercatorTerrainScenario');
            const {options} = createTerrainOptions();

            manager._applyTerrainScenario(options);

            expect(globeTerrain).toHaveBeenCalledWith(options);
            expect(mercatorTerrain).not.toHaveBeenCalled();
        });

        it('delegates to mercator terrain scenario when globe controls are inactive', () => {
            const {manager} = createManager(false);
            const globeTerrain = vi.spyOn(manager, '_applyGlobeTerrainScenario');
            const mercatorTerrain = vi.spyOn(manager, '_applyMercatorTerrainScenario');
            const {options} = createTerrainOptions();

            manager._applyTerrainScenario(options);

            expect(mercatorTerrain).toHaveBeenCalledWith(options);
            expect(globeTerrain).not.toHaveBeenCalled();
        });
    });

    describe('_applyGlobeTerrainScenario', () => {
        it('enables terrain movement and freezes elevation on new drag or zoom', () => {
            const {manager, handleZoom, handlePan} = createManager(true);
            const {options} = createTerrainOptions({combinedEventsInProgress: {drag: true}});

            manager._applyGlobeTerrainScenario(options);

            expect(handleZoom).toHaveBeenCalledWith(options.deltasForHelper, options.tr);
            expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
            expect(manager._terrainMovement).toBe(true);
            expect(manager._map._elevationFreeze).toBe(true);
        });

        it('keeps terrain movement state when already active', () => {
            const {manager, handlePan} = createManager(true);
            const {options} = createTerrainOptions();

            manager._terrainMovement = true;
            manager._map._elevationFreeze = true;
            manager._applyGlobeTerrainScenario(options);

            expect(manager._terrainMovement).toBe(true);
            expect(manager._map._elevationFreeze).toBe(true);
            expect(handlePan).toHaveBeenCalled();
        });
    });

    describe('_applyMercatorTerrainScenario', () => {
        it('activates terrain movement on first drag or zoom', () => {
            const {manager, handlePan} = createManager(false);
            const {options, setCenterMock} = createTerrainOptions({combinedEventsInProgress: {drag: true}});

            manager._applyMercatorTerrainScenario(options);

            expect(manager._terrainMovement).toBe(true);
            expect(manager._map._elevationFreeze).toBe(true);
            expect(handlePan).toHaveBeenCalledTimes(1);
            expect(setCenterMock).not.toHaveBeenCalled();
        });

        it('drags map using transform when already in terrain movement', () => {
            const {manager, handlePan} = createManager(false);
            const panDelta = new Point(2, 3);
            const screenPointToLocationResult = new LngLat(7, 7);
            const {options, screenPointToLocationMock, setCenterMock} = createTerrainOptions({
                combinedEventsInProgress: {drag: true},
                panDelta,
                centerPoint: new Point(5, 5),
                screenPointToLocationResult,
            });

            manager._terrainMovement = true;
            manager._applyMercatorTerrainScenario(options);

            expect(screenPointToLocationMock).toHaveBeenCalled();
            expect(setCenterMock).toHaveBeenCalledWith(screenPointToLocationResult);
            expect(handlePan).not.toHaveBeenCalled();
        });

        it('falls back to helper panning when not dragging', () => {
            const {manager, handlePan} = createManager(false);
            const {options} = createTerrainOptions({combinedEventsInProgress: {}});

            manager._terrainMovement = true;
            manager._applyMercatorTerrainScenario(options);

            expect(handlePan).toHaveBeenCalledWith(options.deltasForHelper, options.tr, options.preZoomAroundLoc);
        });
    });
});
