import {Map, MapOptions} from '../map';
import {createMap, beforeMapTest, sleep, createStyle, createStyleSource} from '../../util/test/util';
import {LngLat} from '../../geo/lng_lat';
import {Tile} from '../../source/tile';
import {OverscaledTileID} from '../../source/tile_id';
import {Event as EventedEvent, ErrorEvent} from '../../util/evented';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../../test/unit/lib/fixed';
import {GeoJSONSourceSpecification, LayerSpecification, SourceSpecification, StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {RequestTransformFunction} from '../../util/request_manager';
import {extend} from '../../util/util';
import {LngLatBoundsLike} from '../../geo/lng_lat_bounds';
import {IControl} from '../control/control';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import {fakeServer, FakeServer} from 'nise';
import {CameraOptions} from '../camera';
import {Terrain} from '../../render/terrain';
import {mercatorZfromAltitude} from '../../geo/mercator_coordinate';
import {Transform} from '../../geo/transform';
import {StyleImageInterface} from '../../style/style_image';
import {Style} from '../../style/style';
import {MapSourceDataEvent} from '../events';
import {config} from '../../util/config';
import {MessageType} from '../../util/actor_messages';

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
