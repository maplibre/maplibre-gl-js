import {createMap, beforeMapTest} from '../../util/test/util';
import {LngLat} from '../../geo/lng_lat';
import {fakeServer, FakeServer} from 'nise';
import {Terrain} from '../../render/terrain';
import {Transform} from '../../geo/transform';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('#setTerrain', () => {
    test('warn when terrain and hillshade source identical', () => new Promise<void>(done => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 5,
            maxzoom: 12,
            attribution: 'Terrain',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));

        const map = createMap();

        map.on('load', () => {
            map.addSource('terrainrgb', {type: 'raster-dem', url: '/source.json'});
            server.respond();
            map.addLayer({id: 'hillshade', type: 'hillshade', source: 'terrainrgb'});
            const stub = jest.spyOn(console, 'warn').mockImplementation(() => { });
            stub.mockReset();
            map.setTerrain({
                source: 'terrainrgb'
            });
            expect(console.warn).toHaveBeenCalledTimes(1);
            done();
        });
    }));
});

describe('#getTerrain', () => {
    test('returns null when not set', () => {
        const map = createMap();
        expect(map.getTerrain()).toBeNull();
    });
});

describe('getCameraTargetElevation', () => {
    test('Elevation is zero without terrain, and matches any given terrain', () => {
        const map = createMap();
        expect(map.getCameraTargetElevation()).toBe(0);

        const terrainStub = {} as Terrain;
        map.terrain = terrainStub;

        const transform = new Transform(0, 22, 0, 60, true);
        transform.elevation = 200;
        transform.center = new LngLat(10.0, 50.0);
        transform.zoom = 14;
        transform.resize(512, 512);
        transform.elevation = 2000;
        map.transform = transform;

        expect(map.getCameraTargetElevation()).toBe(2000);
    });
});

describe('Keep camera outside terrain', () => {
    test('Try to move camera into terrain', () => {
        const map = createMap();

        let terrainElevation = 10;
        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = jest.fn(
            (_lngLat: LngLat, _zoom: number) => terrainElevation
        );
        map.terrain = terrainStub;

        // Terrain elevation is 10 everywhere, we are above it at zoom level 15
        // with pitch 45 deg.
        map.jumpTo({center: [0.0, 0.0], bearing: 0, pitch: 45, zoom: 15});
        const initialCamPosition = map.transform.getCameraPosition();
        expect(initialCamPosition.altitude).toBeCloseTo(506, 0);

        // Now we set the elevation to 5000 everywhere and try to jump to the
        // same position. This would lead to a jump into the terrain, which
        // must not be possible.
        // Camera should be above the terrain, but at the same location as
        // before and with decreased pitch.
        terrainElevation = 5000;
        map.jumpTo({center: [0.0, 0.0], pitch: 45, zoom: 15});

        expect(map.transform.getCameraPosition().lngLat.lng).toBeCloseTo(initialCamPosition.lngLat.lng);
        expect(map.transform.getCameraPosition().lngLat.lat).toBeCloseTo(initialCamPosition.lngLat.lat);
        expect(map.transform.pitch).toBeLessThan(45);
        expect(map.transform.getCameraPosition().altitude).toBeGreaterThan(initialCamPosition.altitude);
        expect(map.transform.getCameraPosition().altitude).toBeGreaterThan(terrainElevation);
    });
});
