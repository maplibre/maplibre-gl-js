import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent.ts';
import {LngLat, earthRadius} from '../geo/lng_lat.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createDEM, createDEMTerrain, createTestCamera} from '../util/test/util.ts';
import {createCameraViewState} from './camera_view_state.ts';
import {createCameraContext} from './camera_context.ts';
import {getCameraMath} from './camera_math_factory.ts';
import {projectCamera} from './project_camera.ts';
import {getCameraPoint} from './projected_camera.ts';
import {resize, setBearing, setCenter, setPitch, setRoll, setZoom} from './camera_updates.ts';
import {getCameraSolver} from './camera_solver_factory.ts';

import type {CameraViewState} from './camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';

function createContext(): CameraContext {
    return createCameraContext({projection: 'vertical-perspective'});
}

/** A 512 x 512 vertical perspective camera, centered on `center` before it is zoomed to `zoom`. */
function createCenteredState(context: CameraContext, center: LngLat, zoom: number): CameraViewState {
    let view = resize(createCameraViewState(), context, 512, 512);
    view = setCenter(view, context, center);
    return setZoom(view, context, zoom);
}

describe('screenTerrainPointToMercatorCoordinate', () => {
    test('hits the terrain under the globe center', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 0), 1), context);

        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBeCloseTo(1000, 6);
        expect(result.x).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).x, 6);
        expect(result.y).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).y, 6);
    });

    test('returns null for a ray that misses the planet', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 0), 0), context);

        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(0, 0), terrain)).toBeNull();
    });

    test('caps the poles at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 2000));
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 85), 1), context);

        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain).z).toBeCloseTo(2000, 6);

        const beyondTheMercatorEdge = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 200), terrain);

        expect(beyondTheMercatorEdge).not.toBeNull();
        expect(beyondTheMercatorEdge.z).toBe(0);
    });

    test('returns null when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 0), 1), context);

        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain)).toBeNull();
    });

    test('returns null for a ray that hits the planet outside the renderable tiles', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(90, -45), 1), context);

        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain)).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 0), 1), context);

        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
        expect(result.x).toBeCloseTo(0.5, 6);
        expect(result.y).toBeCloseTo(0.5, 6);
    });

    test('hits entirely flat terrain at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 0), 1), context);

        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x, y) => 500 * x + 300 * y));
        const context = createContext();
        const projectedCamera = projectCamera(createCenteredState(context, new LngLat(0, 0), 2), context);

        for (const p of [new Point(256, 256), new Point(230, 280), new Point(300, 220)]) {
            const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, p, terrain);
            expect(result).not.toBeNull();
            expect(terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT)).toBeCloseTo(result.z, 3);
        }
    });
});

describe('camera position', () => {
    test('matches the mercator camera at high zoom, where the globe is nearly flat', () => {
        const {projectedCamera, context} = createTestCamera({width: 800, height: 600, zoom: 15, center: [8, 47], pitch: 60}, {projection: 'vertical-perspective'});
        const mercator = createTestCamera({width: 800, height: 600, zoom: 15, center: [8, 47], pitch: 60});

        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(732.384055, 6);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(getCameraMath(mercator.projectedCamera).getCameraAltitude(mercator.projectedCamera), 0);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(getCameraMath(mercator.projectedCamera).getCameraLngLat(mercator.projectedCamera, mercator.context.worldCoordinateHelper).lng, 6);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(getCameraMath(mercator.projectedCamera).getCameraLngLat(mercator.projectedCamera, mercator.context.worldCoordinateHelper).lat, 5);
    });

    test('altitude follows the sphere at low zoom, where the flat formula underestimates it', () => {
        const {projectedCamera} = createTestCamera({width: 800, height: 600, zoom: 4, center: [8, 47], pitch: 60}, {projection: 'vertical-perspective'});

        // 2999 km camera distance, 2597 km sideways => 1500 km above the center's plane + 418 km the sphere drops beneath the camera
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(1917203.7524, 3);
    });

    test('altitude stays positive past 90° pitch while the camera is outside the globe', () => {
        const {projectedCamera} = createTestCamera({maxPitch: 180, width: 800, height: 600, zoom: 4, center: [8, 47], pitch: 100}, {projection: 'vertical-perspective'});

        // cos 100° => 521 km below the center's plane + 703 km the sphere drops beneath the camera => 183 km above the surface
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(182564.5961, 3);
    });

    test('camera lng/lat is the center at pitch 0', () => {
        const {projectedCamera, context} = createTestCamera({width: 800, height: 600, zoom: 15, center: [8, 47]}, {projection: 'vertical-perspective'});

        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(8, 6);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(47, 6);
    });

    test('camera lng/lat lies behind the center along the bearing and does not move with roll', () => {
        const {state: view, context, projectedCamera} = createTestCamera({width: 800, height: 600, zoom: 4, center: [8, 47], pitch: 60}, {projection: 'vertical-perspective'});

        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(8, 6);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(28.7359793, 6);

        const bearing90 = setBearing(view, 90);
        const turned = projectCamera(bearing90, context);
        expect(getCameraMath(turned).getCameraLngLat(turned, context.worldCoordinateHelper).lng).toBeCloseTo(-17.8225358, 6);
        expect(getCameraMath(turned).getCameraLngLat(turned, context.worldCoordinateHelper).lat).toBeCloseTo(43.9881758, 6);
        expect(getCameraMath(turned).getCameraAltitude(turned)).toBeCloseTo(1917203.7524, 3);

        const rolled = projectCamera(setRoll(bearing90, 31), context);
        expect(getCameraMath(rolled).getCameraLngLat(rolled, context.worldCoordinateHelper).lng).toBeCloseTo(-17.8225358, 6);
        expect(getCameraMath(rolled).getCameraLngLat(rolled, context.worldCoordinateHelper).lat).toBeCloseTo(43.9881758, 6);
        expect(getCameraMath(rolled).getCameraAltitude(rolled)).toBeCloseTo(1917203.7524, 3);
    });
});

describe('calculateCameraOptionsFromTo', () => {
    test('round-trips the camera\'s own position, past 90° pitch and with a bearing', () => {
        const {state: view, context, projectedCamera} = createTestCamera({maxPitch: 180, width: 800, height: 600, zoom: 4, center: [8, 47], bearing: 35, pitch: 100}, {projection: 'vertical-perspective'});

        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper), getCameraMath(projectedCamera).getCameraAltitude(projectedCamera), view.center, 0);
        expect(cameraOptions.center.lng).toBeCloseTo(8, 9);
        expect(cameraOptions.center.lat).toBeCloseTo(47, 9);
        expect(cameraOptions.elevation).toBe(0);
        expect(cameraOptions.zoom).toBeCloseTo(4, 6);
        expect(cameraOptions.pitch).toBeCloseTo(100, 6);
        expect(cameraOptions.bearing).toBeCloseTo(35, 6);
    });

    test('from one earth radius up the horizon is 60° away, and the target altitude becomes the center elevation instead of tilting the camera up', () => {
        const {state: view, context} = createTestCamera({maxPitch: 180, width: 800, height: 600}, {projection: 'vertical-perspective'});

        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, new LngLat(0, 0), earthRadius, new LngLat(60, 0), 2 * earthRadius);
        expect(cameraOptions.center.lng).toBe(60);
        expect(cameraOptions.center.lat).toBe(0);
        expect(cameraOptions.elevation).toBe(2 * earthRadius);
        expect(cameraOptions.pitch).toBeCloseTo(90, 6);
        expect(cameraOptions.bearing).toBeCloseTo(90, 6);
        expect(cameraOptions.zoom).toBeCloseTo(2.6727961, 6);

        const {projectedCamera} = createTestCamera({
            maxPitch: 180, width: 800, height: 600,
            zoom: cameraOptions.zoom, center: cameraOptions.center, elevation: cameraOptions.elevation, pitch: cameraOptions.pitch, bearing: cameraOptions.bearing
        }, context);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(earthRadius, 3);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(0, 6);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(0, 6);
    });

    test('a camera straight above the center keeps the state\'s bearing', () => {
        const {state: view, context} = createTestCamera({width: 800, height: 600, bearing: 35}, {projection: 'vertical-perspective'});

        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, new LngLat(8, 47), 1000, new LngLat(8, 47), 0);
        expect(cameraOptions.pitch).toBeCloseTo(0, 6);
        expect(cameraOptions.bearing).toBe(35);
        expect(cameraOptions.zoom).toBeCloseTo(15.5504236, 6);
    });

    test('throws for the same From and To, also across the antimeridian and regardless of altitude', () => {
        const {state: view, context} = createTestCamera({width: 800, height: 600}, {projection: 'vertical-perspective'});

        expect(() => getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 0)).toThrow('Can\'t calculate camera options with same From and To');
        expect(() => getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 180, lat: 0}, 0, {lng: -180, lat: 0}, 0)).toThrow('Can\'t calculate camera options with same From and To');
        expect(() => getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 1000, {lng: 0, lat: 0}, 1000)).toThrow('Can\'t calculate camera options with same From and To');
        expect(() => getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 1000)).toThrow('Can\'t calculate camera options with same From and To');
    });

    test('lifts a camera that dipped into the sphere onto the surface, still looking past the horizon', () => {
        const {state: view, context, projectedCamera} = createTestCamera({maxPitch: 180, width: 800, height: 600, zoom: 5, center: [13.44, 52.5], pitch: 100}, {projection: 'vertical-perspective'});
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(-92490.7408, 3);

        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper), 0, view.center, 0);
        // θ = 12.12° from the center, the chord to it dips θ/2 below the horizon => 90 + θ/2
        expect(cameraOptions.pitch).toBeCloseTo(96.0602239, 6);
        expect(cameraOptions.zoom).toBeCloseTo(4.9929031, 6);
        expect(cameraOptions.bearing).toBeCloseTo(0, 6);

        let lifted = setZoom(view, context, cameraOptions.zoom);
        lifted = setPitch(lifted, cameraOptions.pitch);
        lifted = setBearing(lifted, cameraOptions.bearing);
        const liftedCamera = projectCamera(lifted, context);
        expect(getCameraMath(liftedCamera).getCameraAltitude(liftedCamera)).toBeCloseTo(0, 3);
    });
});

describe('isLocationOccluded', () => {
    test('a location just past the horizon is hidden on the ground and in view once raised above the horizon plane', () => {
        const context = createContext();
        let view = resize(createCameraViewState(), context, 512, 512);
        const oneEarthRadiusAboveTheEquator = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, new LngLat(0, 0), earthRadius, new LngLat(0, 0.001), 0);
        view = setCenter(view, context, oneEarthRadiusAboveTheEquator.center);
        view = setZoom(view, context, oneEarthRadiusAboveTheEquator.zoom);
        view = setPitch(view, oneEarthRadiusAboveTheEquator.pitch);
        view = setBearing(view, oneEarthRadiusAboveTheEquator.bearing);
        const projectedCamera = projectCamera(view, context);
        const justPastTheSixtyDegreeHorizon = new LngLat(0, 60.03);
        const highEnoughToClearTheHorizonPlane = 8000;

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, justPastTheSixtyDegreeHorizon)).toBe(true);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, justPastTheSixtyDegreeHorizon, undefined, highEnoughToClearTheHorizonPlane)).toBe(false);
    });

    test('a location behind a ridge is hidden and one in front of it is in view', () => {
        const tileSpanAtZoom12 = 360 / (1 << 12);
        const ridgeAcrossTheTwoMiddleRows = createDEM((_x, y) => (y === 3 || y === 4) ? 3000 : 0);
        const terrain = createDEMTerrain([new OverscaledTileID(12, 0, 12, 2048, 2047)], ridgeAcrossTheTwoMiddleRows);
        const context = createContext();
        const view = setPitch(createCenteredState(context, new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.25), 12), 75);
        const projectedCamera = projectCamera(view, context);
        const behindRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.8);
        const inFrontOfRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.3);

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindRidge, terrain)).toBe(true);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, inFrontOfRidge, terrain)).toBe(false);
    });

    test('a location behind a ridge is in view once raised above the ridge', () => {
        const tileSpanAtZoom12 = 360 / (1 << 12);
        const ridgeAcrossTheTwoMiddleRows = createDEM((_x, y) => (y === 3 || y === 4) ? 3000 : 0);
        const terrain = createDEMTerrain([new OverscaledTileID(12, 0, 12, 2048, 2047)], ridgeAcrossTheTwoMiddleRows);
        const context = createContext();
        const view = setPitch(createCenteredState(context, new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.25), 12), 75);
        const projectedCamera = projectCamera(view, context);
        const behindRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.8);
        const elevationAboveRidge = 3500;

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindRidge, terrain, elevationAboveRidge)).toBe(false);
    });

    test('a location behind the camera is hidden', () => {
        const tileSpanAtZoom12 = 360 / (1 << 12);
        const terrain = createDEMTerrain([new OverscaledTileID(12, 0, 12, 2048, 2047)], createDEM(() => 0));
        const context = createContext();
        const view = setPitch(createCenteredState(context, new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.25), 12), 75);
        const projectedCamera = projectCamera(view, context);
        const behindTheCamera = new LngLat(tileSpanAtZoom12 / 2, -tileSpanAtZoom12 * 2);

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindTheCamera, terrain)).toBe(true);
    });

    test('nothing is hidden when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const {projectedCamera, context} = createTestCamera({width: 512, height: 512}, {projection: 'vertical-perspective'});

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, new LngLat(0, 0.01), terrain)).toBe(false);
    });
});

test('resize does not constrain the center when told not to', () => {
    const context = createContext();
    let view = setZoom(createCameraViewState(), context, 5);
    view = setCenter(view, context, new LngLat(0, 89));

    view = resize(view, context, 640, 480, false);

    expect(view.center.lat).toBe(89);
});

test('getCameraQueryGeometry uses the line to the camera point for a point off the globe', () => {
    const {projectedCamera, context} = createTestCamera({width: 512, height: 512}, {projection: 'vertical-perspective'});
    const corner = new Point(0, 0);

    expect(getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, corner)).toBe(false);
    expect(getCameraMath(projectedCamera).getCameraQueryGeometry(projectedCamera, [corner])).toEqual([corner, getCameraPoint(projectedCamera)]);
});

test('getCameraQueryGeometry follows the arc on the globe from a point query to the point below the camera', () => {
    const {projectedCamera, context} = createTestCamera({width: 512, height: 512, zoom: 3, pitch: 50}, {projection: 'vertical-perspective'});
    const query = new Point(256, 300);

    const geometry = getCameraMath(projectedCamera).getCameraQueryGeometry(projectedCamera, [query]);

    expect(geometry).toHaveLength(9);
    expect(geometry[0]).toEqual(query);
    const below = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper));
    expect(geometry[8].x).toBeCloseTo(below.x, 3);
    expect(geometry[8].y).toBeCloseTo(below.y, 3);
});
