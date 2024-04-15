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

describe('#resize', () => {
    test('sets width and height from container clients', () => {
        const map = createMap(),
            container = map.getContainer();

        Object.defineProperty(container, 'clientWidth', {value: 250});
        Object.defineProperty(container, 'clientHeight', {value: 250});
        map.resize();

        expect(map.transform.width).toBe(250);
        expect(map.transform.height).toBe(250);

    });

    test('fires movestart, move, resize, and moveend events', () => {
        const map = createMap(),
            events = [];

        (['movestart', 'move', 'resize', 'moveend'] as any).forEach((event) => {
            map.on(event, (e) => {
                events.push(e.type);
            });
        });

        map.resize();
        expect(events).toEqual(['movestart', 'move', 'resize', 'moveend']);

    });

    test('listen to window resize event', () => {
        const spy = jest.fn();
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: spy
        }));

        createMap();

        expect(spy).toHaveBeenCalled();
    });

    test('do not resize if trackResize is false', () => {
        let observerCallback: Function = null;
        global.ResizeObserver = jest.fn().mockImplementation((c) => ({
            observe: () => { observerCallback = c; }
        }));

        const map = createMap({trackResize: false});

        const spyA = jest.spyOn(map, 'stop');
        const spyB = jest.spyOn(map, '_update');
        const spyC = jest.spyOn(map, 'resize');

        observerCallback();

        expect(spyA).not.toHaveBeenCalled();
        expect(spyB).not.toHaveBeenCalled();
        expect(spyC).not.toHaveBeenCalled();
    });

    test('do resize if trackResize is true (default)', async () => {
        let observerCallback: Function = null;
        global.ResizeObserver = jest.fn().mockImplementation((c) => ({
            observe: () => { observerCallback = c; }
        }));

        const map = createMap();

        const updateSpy = jest.spyOn(map, '_update');
        const resizeSpy = jest.spyOn(map, 'resize');

        // The initial "observe" event fired by ResizeObserver should be captured/muted
        // in the map constructor

        observerCallback();
        expect(updateSpy).not.toHaveBeenCalled();
        expect(resizeSpy).not.toHaveBeenCalled();

        // The next "observe" event should fire a resize / _update

        observerCallback();
        expect(updateSpy).toHaveBeenCalled();
        expect(resizeSpy).toHaveBeenCalledTimes(1);

        // Additional "observe" events should be throttled
        observerCallback();
        observerCallback();
        observerCallback();
        observerCallback();
        expect(resizeSpy).toHaveBeenCalledTimes(1);
        await sleep(100);
        expect(resizeSpy).toHaveBeenCalledTimes(2);
    });

    test('width and height correctly rounded', () => {
        const map = createMap();
        const container = map.getContainer();

        Object.defineProperty(container, 'clientWidth', {value: 250.6});
        Object.defineProperty(container, 'clientHeight', {value: 250.6});
        map.resize();

        expect(map.getCanvas().width).toBe(250);
        expect(map.getCanvas().height).toBe(250);
        expect(map.painter.width).toBe(250);
        expect(map.painter.height).toBe(250);
    });
});