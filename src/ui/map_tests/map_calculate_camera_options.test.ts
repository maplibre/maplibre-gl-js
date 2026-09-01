import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import {LngLat} from '../../geo/lng_lat.ts';
import {type OverscaledTileID} from '../../tile/tile_id.ts';
import {type CameraOptions} from '../camera.ts';
import {type Terrain} from '../../render/terrain.ts';
import {mercatorZfromAltitude} from '../../geo/mercator_coordinate.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('calculateCameraOptionsFromTo', () => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    test('pitch 90 with terrain', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat) => 111200);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLat = mockedGetElevation;
        map.terrain = terrainStub;

        // distance between lng x and lng x+1 is 111.2km at same lat
        // altitude same as center elevation => 90° pitch
        const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(1, 0), 111200, new LngLat(0, 0));
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(90);
        expect(mockedGetElevation).toHaveBeenCalledTimes(1);
    });

    test('pitch 153.435 with terrain', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat) => 111200 * 3);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLat = mockedGetElevation;
        map.terrain = terrainStub;
        // distance between lng x and lng x+1 is 111.2km at same lat
        // (elevation difference of cam and center) / 2 = grounddistance =>
        // acos(111.2 / sqrt(111.2² + (111.2 * 2)²)) = acos(1/sqrt(5)) => 63.435 + 90 = 153.435
        const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(1, 0), 111200, new LngLat(0, 0));
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(153.435);
        expect(mockedGetElevation).toHaveBeenCalledTimes(1);
    });

    test('pitch 63 with terrain', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat) => 111200 / 2);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLat = mockedGetElevation;
        map.terrain = terrainStub;

        // distance between lng x and lng x+1 is 111.2km at same lat
        // (elevation difference of cam and center) * 2 = grounddistance =>
        // acos(111.2 / sqrt(111.2² + (111.2 * 0.5)²)) = acos(1/sqrt(1.25)) => 90 (looking down) - 26.565 = 63.435
        const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 111200, new LngLat(1, 0));
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(63.435);
        expect(mockedGetElevation).toHaveBeenCalledTimes(1);
    });

    test('zoom distance 1000', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat) => 1000);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLat = mockedGetElevation;
        map.terrain = terrainStub;

        const expectedZoom = Math.log2(map._camera.transform.cameraToCenterDistance / mercatorZfromAltitude(1000, 0) / map._camera.transform.tileSize);
        const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(0, 0));

        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
        expect(mockedGetElevation).toHaveBeenCalledTimes(1);
    });

    test('don\'t call getElevation when altitude supplied', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number) => 0);

        const terrainStub = {} as Terrain;
        terrainStub.getElevation = mockedGetElevation;
        map.terrain = terrainStub;

        const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(0, 0), 1000);

        expect(cameraOptions).toBeDefined();
        expect(mockedGetElevation).toHaveBeenCalledTimes(0);
    });

    test('don\'t call getElevation when altitude 0 supplied', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number) => 0);

        const terrainStub = {} as Terrain;
        terrainStub.getElevation = mockedGetElevation;
        map.terrain = terrainStub;

        const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(1, 0), 0);

        expect(cameraOptions).toBeDefined();
        expect(mockedGetElevation).toHaveBeenCalledTimes(0);
    });
});

describe('calculateCameraOptions', () => {
    test('returns a complete state without changing the map or firing movement events', () => {
        const map = createMap({center: [12, 34], zoom: 4, bearing: 20, pitch: 30, roll: 5});
        const before = map.calculateCameraOptions({});
        const move = vi.fn();
        map.on('move', move);

        const result = map.calculateCameraOptions({
            center: [40, 20], zoom: 7, bearing: 80, pitch: 45, roll: 10,
            elevation: 123, padding: {top: 1, right: 2, bottom: 3, left: 4}
        });

        expect(result).toMatchObject({zoom: 7, bearing: 80, pitch: 45, roll: 10, elevation: 123});
        expect(result.center.lng).toBeCloseTo(40);
        expect(result.center.lat).toBeCloseTo(20);
        expect(result.padding).toEqual({top: 1, right: 2, bottom: 3, left: 4});
        expect(map.calculateCameraOptions({})).toEqual(before);
        expect(move).not.toHaveBeenCalled();
    });

    test('matches the endpoint of easeTo, including constraints and normalization', () => {
        const options = {center: [190, 89] as [number, number], zoom: 100, bearing: 370, pitch: 100, roll: -350};
        const calculatedMap = createMap({center: [170, 10], zoom: 3, bearing: 5, pitch: 20});
        const appliedMap = createMap({center: [170, 10], zoom: 3, bearing: 5, pitch: 20});
        const result = calculatedMap.calculateCameraOptions(options);
        appliedMap.easeTo({...options, duration: 0});

        expect(result.center.lng).toBeCloseTo(appliedMap.getCenter().lng);
        expect(result.center.lat).toBeCloseTo(appliedMap.getCenter().lat);
        expect(result.zoom).toBeCloseTo(appliedMap.getZoom());
        expect(result.bearing).toBeCloseTo(appliedMap.getBearing());
        expect(result.pitch).toBeCloseTo(appliedMap.getPitch());
        expect(result.roll).toBeCloseTo(appliedMap.getRoll());
    });

    test('keeps an around location at its current point with pitch and bearing', () => {
        const map = createMap({center: [0, 0], zoom: 3, pitch: 50, bearing: 35});
        const around = new LngLat(5, 3);
        const point = map.project(around);
        const result = map.calculateCameraOptions({around, zoom: 6});
        map.jumpTo(result);
        expect(map.project(around).x).toBeCloseTo(point.x);
        expect(map.project(around).y).toBeCloseTo(point.y);
    });

    test('supports an explicit aroundPoint and validates a missing around', () => {
        const map = createMap({center: [0, 0], zoom: 3, pitch: 35, bearing: 25});
        const around = new LngLat(2, 1);
        const aroundPoint: [number, number] = [100, 150];
        const projected = map.project(around);
        expect(Math.hypot(projected.x - aroundPoint[0], projected.y - aroundPoint[1])).toBeGreaterThan(1);

        const result = map.calculateCameraOptions({around, aroundPoint, zoom: 5});
        map.jumpTo(result);
        expect(map.project(around).x).toBeCloseTo(aroundPoint[0]);
        expect(map.project(around).y).toBeCloseTo(aroundPoint[1]);
        expect(() => map.calculateCameraOptions({aroundPoint})).toThrow('`aroundPoint` requires `around`');
    });

    test('repeated calculations are independent and preserve world-copy behavior', () => {
        const map = createMap({center: [350, 0], zoom: 3, renderWorldCopies: true});
        const clone = vi.spyOn(map._camera.transform, 'clone');
        const options = {center: [-350, 5] as [number, number], zoom: 4};
        const first = map.calculateCameraOptions(options);
        const second = map.calculateCameraOptions(options);
        expect(second).toEqual(first);
        expect(clone).toHaveBeenCalledTimes(1);

        const applied = createMap({center: [350, 0], zoom: 3, renderWorldCopies: true});
        applied.easeTo({...options, duration: 0});
        expect(first.center.lng).toBeCloseTo(applied.getCenter().lng);
    });

    test('matches easeTo under globe projection', () => {
        const style = {version: 8 as const, sources: {}, layers: [], projection: {type: 'globe' as const}};
        const calculatedMap = createMap({center: [10, 20], zoom: 2, style});
        const appliedMap = createMap({center: [10, 20], zoom: 2, style});
        const options = {center: [70, 35] as [number, number], zoom: 4, bearing: 25};
        const result = calculatedMap.calculateCameraOptions(options);
        appliedMap.easeTo({...options, duration: 0});

        expect(result.center.lng).toBeCloseTo(appliedMap.getCenter().lng);
        expect(result.center.lat).toBeCloseTo(appliedMap.getCenter().lat);
        expect(result.zoom).toBeCloseTo(appliedMap.getZoom());
    });

    test('uses terrain elevation without mutating the live elevation', () => {
        const map = createMap({center: [0, 0], zoom: 10});
        const terrain = {
            getElevationForLngLat: vi.fn(() => 50),
            getElevationForLngLatZoom: vi.fn(() => -1000)
        } as unknown as Terrain;
        map.terrain = terrain;
        map._camera.terrain = terrain;
        const before = map.getCenterElevation();

        const result = map.calculateCameraOptions({center: [1, 1]});

        expect(result.elevation).toBe(50);
        expect(map.getCenterElevation()).toBe(before);
    });

    test('applies transformCameraUpdate without changing the live camera', () => {
        const transformCameraUpdate = vi.fn(({zoom}) => ({zoom: zoom + 1, center: new LngLat(20, 30)}));
        const map = createMap({center: [0, 0], zoom: 3});
        map.setTransformCameraUpdate(transformCameraUpdate);

        const result = map.calculateCameraOptions({zoom: 5});

        expect(result.zoom).toBe(6);
        expect(result.center.lng).toBeCloseTo(20);
        expect(result.center.lat).toBeCloseTo(30);
        expect(map.getZoom()).toBe(3);
        expect(map.getCenter()).toEqual(new LngLat(0, 0));
        expect(transformCameraUpdate).toHaveBeenCalledTimes(1);
    });
});
