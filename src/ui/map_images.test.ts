import {Map, MapOptions} from './map';
import {createMap, beforeMapTest, sleep, createStyle, createStyleSource} from '../util/test/util';
import {LngLat} from '../geo/lng_lat';
import {Tile} from '../source/tile';
import {OverscaledTileID} from '../source/tile_id';
import {Event as EventedEvent, ErrorEvent} from '../util/evented';
import simulate from '../../test/unit/lib/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../test/unit/lib/fixed';
import {GeoJSONSourceSpecification, LayerSpecification, SourceSpecification, StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {RequestTransformFunction} from '../util/request_manager';
import {extend} from '../util/util';
import {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import {IControl} from './control/control';
import {EvaluationParameters} from '../style/evaluation_parameters';
import {fakeServer, FakeServer} from 'nise';
import {CameraOptions} from './camera';
import {Terrain} from '../render/terrain';
import {mercatorZfromAltitude} from '../geo/mercator_coordinate';
import {Transform} from '../geo/transform';
import {StyleImageInterface} from '../style/style_image';
import {Style} from '../style/style';
import {MapSourceDataEvent} from './events';
import {config} from '../util/config';
import {MessageType} from '../util/actor_messages';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

test('#listImages', done => {
    const map = createMap();

    map.on('load', () => {
        expect(map.listImages()).toHaveLength(0);

        map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

        const images = map.listImages();
        expect(images).toHaveLength(1);
        expect(images[0]).toBe('img');
        done();
    });
});

test('#listImages throws an error if called before "load"', () => {
    const map = createMap();
    expect(() => {
        map.listImages();
    }).toThrow(Error);
});

test('map fires `styleimagemissing` for missing icons', async () => {
    const map = createMap();

    const id = 'missing-image';

    const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};

    let called: string;
    map.on('styleimagemissing', e => {
        map.addImage(e.id, sampleImage);
        called = e.id;
    });

    expect(map.hasImage(id)).toBeFalsy();

    const generatedImage = await map.style.imageManager.getImages([id]);
    expect(generatedImage[id].data.width).toEqual(sampleImage.width);
    expect(generatedImage[id].data.height).toEqual(sampleImage.height);
    expect(generatedImage[id].data.data).toEqual(sampleImage.data);
    expect(called).toBe(id);
    expect(map.hasImage(id)).toBeTruthy();
});

test('map getImage matches addImage, uintArray', () => {
    const map = createMap();
    const id = 'add-get-uint';
    const inputImage = {width: 2, height: 1, data: new Uint8Array(8)};

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, uintClampedArray', () => {
    const map = createMap();
    const id = 'add-get-uint-clamped';
    const inputImage = {width: 1, height: 2, data: new Uint8ClampedArray(8)};

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, ImageData', () => {
    const map = createMap();
    const id = 'add-get-image-data';
    const inputImage = new ImageData(1, 3);

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface uint', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-uint';
    const inputImage: StyleImageInterface = {
        width: 3,
        height: 1,
        data: new Uint8Array(12)
    };

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface clamped', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-clamped';
    const inputImage: StyleImageInterface = {
        width: 4,
        height: 1,
        data: new Uint8ClampedArray(16)
    };

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface SDF', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-sdf';
    const inputImage: StyleImageInterface = {
        width: 5,
        height: 1,
        data: new Uint8Array(20)
    };

    map.addImage(id, inputImage, {sdf: true});
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = map.getImage(id);
    expect(gotImage.data.width).toEqual(inputImage.width);
    expect(gotImage.data.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(true);
});

test('map does not fire `styleimagemissing` for empty icon values', done => {
    const map = createMap();

    map.on('load', () => {
        map.on('idle', () => {
            done();
        });

        map.addSource('foo', {
            type: 'geojson',
            data: {type: 'Point', coordinates: [0, 0]}
        });
        map.addLayer({
            id: 'foo',
            type: 'symbol',
            source: 'foo',
            layout: {
                'icon-image': ['case', true, '', '']
            }
        });

        map.on('styleimagemissing', ({id}) => {
            done(`styleimagemissing fired for value ${id}`);
        });
    });
});
