import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {LngLat} from '../../geo/lng_lat';
import {type OverscaledTileID} from '../../source/tile_id';
import {type CameraOptions} from '../camera';
import {type Terrain} from '../../render/terrain';
import {mercatorZfromAltitude} from '../../geo/mercator_coordinate';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#calculateCameraOptionsFromTo', () => {
    // Choose initial zoom to avoid center being constrained by mercator latitude limits.
    test('pitch 90 with terrain', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat, _zoom: number) => 111200);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = mockedGetElevation;
        map.terrain = terrainStub;

        // distance between lng x and lng x+1 is 111.2km at same lat
        // altitude same as center elevation => 90° pitch
        const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(1, 0), 111200, new LngLat(0, 0));
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(90);
        expect(mockedGetElevation.mock.calls).toHaveLength(1);
    });

    test('pitch 153.435 with terrain', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat, _zoom: number) => 111200 * 3);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = mockedGetElevation;
        map.terrain = terrainStub;
        // distance between lng x and lng x+1 is 111.2km at same lat
        // (elevation difference of cam and center) / 2 = grounddistance =>
        // acos(111.2 / sqrt(111.2² + (111.2 * 2)²)) = acos(1/sqrt(5)) => 63.435 + 90 = 153.435
        const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(1, 0), 111200, new LngLat(0, 0));
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(153.435);
        expect(mockedGetElevation.mock.calls).toHaveLength(1);
    });

    test('pitch 63 with terrain', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat, _zoom: number) => 111200 / 2);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = mockedGetElevation;
        map.terrain = terrainStub;

        // distance between lng x and lng x+1 is 111.2km at same lat
        // (elevation difference of cam and center) * 2 = grounddistance =>
        // acos(111.2 / sqrt(111.2² + (111.2 * 0.5)²)) = acos(1/sqrt(1.25)) => 90 (looking down) - 26.565 = 63.435
        const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 111200, new LngLat(1, 0));
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(63.435);
        expect(mockedGetElevation.mock.calls).toHaveLength(1);
    });

    test('zoom distance 1000', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_lngLat: LngLat, _zoom: number) => 1000);

        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = mockedGetElevation;
        map.terrain = terrainStub;

        const expectedZoom = Math.log2(map.transform.cameraToCenterDistance / mercatorZfromAltitude(1000, 0) / map.transform.tileSize);
        const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(0, 0));

        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
        expect(mockedGetElevation.mock.calls).toHaveLength(1);
    });

    test('don\'t call getElevation when altitude supplied', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number) => 0);

        const terrainStub = {} as Terrain;
        terrainStub.getElevation = mockedGetElevation;
        map.terrain = terrainStub;

        const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(0, 0), 1000);

        expect(cameraOptions).toBeDefined();
        expect(mockedGetElevation.mock.calls).toHaveLength(0);
    });

    test('don\'t call getElevation when altitude 0 supplied', () => {
        const map = createMap();

        const mockedGetElevation = vi.fn((_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number) => 0);

        const terrainStub = {} as Terrain;
        terrainStub.getElevation = mockedGetElevation;
        map.terrain = terrainStub;

        const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(1, 0), 0);

        expect(cameraOptions).toBeDefined();
        expect(mockedGetElevation.mock.calls).toHaveLength(0);
    });
});
