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
    test('warn when terrain and hillshade source identical', done => {
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
    });
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
