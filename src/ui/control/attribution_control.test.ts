import AttributionControl from './attribution_control';
import {createMap as globalCreateMap, setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {fakeServer} from 'nise';

function createMap() {

    return globalCreateMap({
        attributionControl: false,
        style: {
            version: 8,
            sources: {},
            layers: [],
            owner: 'mapblibre',
            id: 'demotiles',
        },
        hash: true
    }, undefined);
}

let map;

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
    map = createMap();
});

afterEach(() => {
    map.remove();
});

describe('AttributionControl', () => {
    test('appears in bottom-right by default', () => {
        map.addControl(new AttributionControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib')
        ).toHaveLength(1);
    });

    test('appears in the position specified by the position option', () => {
        map.addControl(new AttributionControl(), 'top-left');

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-left .maplibregl-ctrl-attrib')
        ).toHaveLength(1);
    });

    test('appears in compact mode if compact option is used', () => {
        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});

        let attributionControl = new AttributionControl({
            compact: true,
            customAttribution: 'MapLibre'
        });
        map.addControl(attributionControl);

        const container = map.getContainer();

        expect(
            container.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact')
        ).toHaveLength(1);
        map.removeControl(attributionControl);

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
        attributionControl = new AttributionControl({
            compact: false
        });

        map.addControl(attributionControl);
        expect(
            container.querySelectorAll('.maplibregl-ctrl-attrib:not(.maplibregl-compact)')
        ).toHaveLength(1);
    });

    test('appears in compact mode if container is less then 640 pixel wide and attributions are not empty', () => {
        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});
        const attributionControl = new AttributionControl({
            customAttribution: 'MapLibre'
        });
        map.addControl(attributionControl);

        const container = map.getContainer();

        expect(
            container.querySelectorAll('.maplibregl-ctrl-attrib:not(.maplibregl-compact)')
        ).toHaveLength(1);

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
        map.resize();

        expect(
            container.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact')
        ).toHaveLength(1);

        expect(
            container.querySelectorAll('.maplibregl-attrib-empty')
        ).toHaveLength(0);
    });

    test('does not appear in compact mode if container is less then 640 pixel wide and attributions are empty', () => {
        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});
        map.addControl(new AttributionControl());

        const container = map.getContainer();

        expect(
            container.querySelectorAll('.maplibregl-ctrl-attrib:not(.maplibregl-compact)')
        ).toHaveLength(1);

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
        map.resize();

        expect(
            container.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact')
        ).toHaveLength(0);

        expect(
            container.querySelectorAll('.maplibregl-attrib-empty')
        ).toHaveLength(1);
    });

    test('compact mode control toggles attribution', () => {
        map.addControl(new AttributionControl({
            compact: true,
            customAttribution: 'MapLibre'
        }));

        const container = map.getContainer();
        const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

        expect(container.querySelectorAll('.maplibregl-compact-show')).toHaveLength(1);

        simulate.click(toggle);

        expect(container.querySelectorAll('.maplibregl-compact-show')).toHaveLength(0);

        simulate.click(toggle);

        expect(container.querySelectorAll('.maplibregl-compact-show')).toHaveLength(1);
    });

    test('dedupes attributions that are substrings of others', done => {
        const attribution = new AttributionControl();
        map.addControl(attribution);

        map.on('load', () => {
            map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'World'});
            map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
            map.addSource('3', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Another Source'});
            map.addSource('4', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello'});
            map.addSource('5', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
            map.addSource('6', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
            map.addSource('7', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'GeoJSON Source'});
            map.addLayer({id: '1', type: 'fill', source: '1'});
            map.addLayer({id: '2', type: 'fill', source: '2'});
            map.addLayer({id: '3', type: 'fill', source: '3'});
            map.addLayer({id: '4', type: 'fill', source: '4'});
            map.addLayer({id: '5', type: 'fill', source: '5'});
            map.addLayer({id: '6', type: 'fill', source: '6'});
            map.addLayer({id: '7', type: 'fill', source: '7'});
        });

        let times = 0;
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                if (++times === 7) {
                    expect(attribution._innerContainer.innerHTML).toBe('Hello World | Another Source | GeoJSON Source');
                    done();
                }
            }
        });
    });

    test('is hidden if empty', done => {
        const attribution = new AttributionControl();
        map.addControl(attribution);
        map.on('load', () => {
            map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
            map.addLayer({id: '1', type: 'fill', source: '1'});
        });

        const container = map.getContainer();

        const checkEmptyFirst = () => {
            expect(attribution._innerContainer.innerHTML).toBe('');
            expect(container.querySelectorAll('.maplibregl-attrib-empty')).toHaveLength(1);

            map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
            map.addLayer({id: '2', type: 'fill', source: '2'});
        };

        const checkNotEmptyLater = () => {
            expect(attribution._innerContainer.innerHTML).toBe('Hello World');
            expect(container.querySelectorAll('.maplibregl-attrib-empty')).toHaveLength(0);
            done();
        };

        let times = 0;
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                times++;
                if (times === 1) {
                    checkEmptyFirst();
                } else if (times === 2) {
                    checkNotEmptyLater();
                }
            }
        });
    });

    test('shows custom attribution if customAttribution option is provided', () => {
        const attributionControl = new AttributionControl({
            customAttribution: 'Custom string'
        });
        map.addControl(attributionControl);

        expect(attributionControl._innerContainer.innerHTML).toBe('Custom string');
    });

    test('shows custom attribution if customAttribution option is provided, control is removed and added back', () => {
        const attributionControl = new AttributionControl({
            customAttribution: 'Custom string'
        });
        map.addControl(attributionControl);
        map.removeControl(attributionControl);
        map.addControl(attributionControl);

        expect(attributionControl._innerContainer.innerHTML).toBe('Custom string');
    });

    test('in compact mode shows custom attribution if customAttribution option is provided', () => {
        const attributionControl = new AttributionControl({
            customAttribution: 'Custom string',
            compact: true
        });
        map.addControl(attributionControl);

        expect(attributionControl._innerContainer.innerHTML).toBe('Custom string');
    });

    test('shows all custom attributions if customAttribution array of strings is provided', () => {
        const attributionControl = new AttributionControl({
            customAttribution: ['Some very long custom string', 'Custom string', 'Another custom string']
        });
        map.addControl(attributionControl);

        expect(attributionControl._innerContainer.innerHTML).toBe('Custom string | Another custom string | Some very long custom string');
    });

    test('hides attributions for sources that are not currently visible', done => {
        const attribution = new AttributionControl();
        map.addControl(attribution);

        map.on('load', () => {
            map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Used'});
            map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Not used'});
            map.addSource('3', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Vibility none'});
            map.addLayer({id: '1', type: 'fill', source: '1'});
            map.addLayer({id: '3', type: 'fill', source: '3', layout: {visibility: 'none'}});
        });

        let times = 0;
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                if (++times === 3) {
                    expect(attribution._innerContainer.innerHTML).toBe('Used');
                    done();
                }
            }
        });
    });

    test('does not show attributions for sources that are used for terrain when they are not in use', done => {
        global.fetch = null;
        const server = fakeServer.create();
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 5,
            maxzoom: 12,
            attribution: 'Terrain',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));

        const attribution = new AttributionControl();
        map.addControl(attribution);

        map.on('load', () => {
            map.addSource('1', {type: 'raster-dem', url: '/source.json'});
            server.respond();
        });

        let times = 0;
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                if (++times === 1) {
                    expect(attribution._innerContainer.innerHTML).toBe('');
                    done();
                }
            }
        });
    });

    test('shows attributions for sources that are used for terrain', done => {
        global.fetch = null;
        const server = fakeServer.create();
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 5,
            maxzoom: 12,
            attribution: 'Terrain',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));

        const attribution = new AttributionControl();
        map.addControl(attribution);

        map.on('load', () => {
            map.addSource('1', {type: 'raster-dem', url: '/source.json'});
            server.respond();
            map.setTerrain({source: '1'});
        });

        let times = 0;
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                if (++times === 1) {
                    expect(attribution._innerContainer.innerHTML).toBe('Terrain');
                    done();
                }
            }
        });
    });

    test('toggles attributions for sources whose visibility changes when zooming', done => {
        const attribution = new AttributionControl();
        map.addControl(attribution);

        map.on('load', () => {
            map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Used'});
            map.addLayer({id: '1', type: 'fill', source: '1', minzoom: 12});
        });

        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(attribution._innerContainer.innerHTML).toBe('');
                map.setZoom(13);
            }
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                if (map.getZoom() === 13) {
                    expect(attribution._innerContainer.innerHTML).toBe('Used');
                    done();
                }
            }
        });
    });

});

describe('AttributionControl test regarding the HTML elements details and summary', () => {
    describe('Details is set correct for compact view', () => {
        test('It should NOT contain the attribute open="" on first load.', () => {
            const attributionControl = new AttributionControl({
                compact: true
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();
        });

        test('It SHOULD contain the attribute open="" after click on summary.', () => {
            const attributionControl = new AttributionControl({
                compact: true
            });
            map.addControl(attributionControl);
            const container = map.getContainer();
            const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

            simulate.click(toggle);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('It should NOT contain the attribute open="" after two clicks on summary.', () => {
            const attributionControl = new AttributionControl({
                compact: true
            });
            map.addControl(attributionControl);
            const container = map.getContainer();
            const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

            simulate.click(toggle);
            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            simulate.click(toggle);
            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();
        });
    });

    describe('Details is set correct for default view (compact === undefined)', () => {
        test('It should NOT contain the attribute open="" if offsetWidth <= 640.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            const attributionControl = new AttributionControl({
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();
        });

        test('It SHOULD contain the attribute open="" if offsetWidth > 640.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            const attributionControl = new AttributionControl({
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('The attribute open="" SHOULD exist after resize from size > 640 to <= 640 and and vice versa.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            const attributionControl = new AttributionControl({
                customAttribution: 'MapLibre'
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact')).toHaveLength(1);
            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib:not(.maplibregl-compact)')).toHaveLength(1);
            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact')).toHaveLength(1);
            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('The attribute open="" should NOT change on resize from > 640 to another > 640.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            const attributionControl = new AttributionControl({
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 650, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('The attribute open="" should NOT change on resize from <= 640 to another <= 640 if it is closed.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            const attributionControl = new AttributionControl({
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 630, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();
        });

        test('The attribute open="" should NOT change on resize from <= 640 to another <= 640 if it is open.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            const attributionControl = new AttributionControl({
            });
            map.addControl(attributionControl);
            const toggle = map.getContainer().querySelector('.maplibregl-ctrl-attrib-button');
            simulate.click(toggle);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 630, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });
    });

    describe('Details is set correct for default view (compact === false)', () => {
        test('It SHOULD contain the attribute open="" if offsetWidth <= 640.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            const attributionControl = new AttributionControl({
                compact: false
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('It SHOULD contain the attribute open="" if offsetWidth > 640.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            const attributionControl = new AttributionControl({
                compact: false
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('The attribute open="" should NOT change on resize.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            const attributionControl = new AttributionControl({
                compact: false
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');

            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 640, configurable: true});
            map.resize();

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });
    });
});
