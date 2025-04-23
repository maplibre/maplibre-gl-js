import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {AttributionControl, defaultAttributionControlOptions} from './attribution_control';
import {createMap as globalCreateMap, beforeMapTest, sleep} from '../../util/test/util';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {fakeServer} from 'nise';
import {type Map} from '../../ui/map';
import {type MapSourceDataEvent} from '../events';

function createMap() {

    return globalCreateMap({
        attributionControl: false,
        style: {
            version: 8,
            sources: {},
            layers: [],
            owner: 'maplibre',
            id: 'demotiles',
        },
        hash: true
    });
}

let map: Map;

beforeEach(() => {
    beforeMapTest();
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
        map.addControl(new AttributionControl({}));

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

    test('dedupes attributions that are substrings of others', async () => {
        const attribution = new AttributionControl();
        map.addControl(attribution);

        const spy = vi.fn();
        map.on('data', spy);
        await map.once('load');
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

        await sleep(100);

        expect(attribution._innerContainer.innerHTML).toBe(`Hello World | Another Source | GeoJSON Source | ${defaultAttributionControlOptions.customAttribution}`);
        expect(spy.mock.calls.filter((call) => call[0].dataType === 'source' && call[0].sourceDataType === 'visibility')).toHaveLength(7);

    });

    test('is hidden if empty', async () => {
        const attribution = new AttributionControl({});
        map.addControl(attribution);
        await map.once('load');
        map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
        map.addLayer({id: '1', type: 'fill', source: '1'});
        const container = map.getContainer();
        const spy = vi.fn();
        map.on('data', spy);

        await sleep(100);
        expect(spy.mock.calls.filter((call) => call[0].dataType === 'source' && call[0].sourceDataType === 'visibility')).toHaveLength(1);
        expect(attribution._innerContainer.innerHTML).toBe('');
        expect(container.querySelectorAll('.maplibregl-attrib-empty')).toHaveLength(1);
    });

    test('is not hidden if adding a source with attribution', async () => {
        const attribution = new AttributionControl({});
        map.addControl(attribution);
        await map.once('load');
        map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
        map.addLayer({id: '1', type: 'fill', source: '1'});
        const container = map.getContainer();
        const spy = vi.fn();
        map.on('data', spy);

        await sleep(100);
        map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
        map.addLayer({id: '2', type: 'fill', source: '2'});

        await sleep(100);

        expect(spy.mock.calls.filter((call) => call[0].dataType === 'source' && call[0].sourceDataType === 'visibility')).toHaveLength(2);
        expect(attribution._innerContainer.innerHTML).toBe('Hello World');
        expect(container.querySelectorAll('.maplibregl-attrib-empty')).toHaveLength(0);
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

    test('hides attributions for sources that are not currently visible', async () => {
        const attribution = new AttributionControl();
        map.addControl(attribution);

        const spy = vi.fn();
        map.on('data', spy);
        await map.once('load');
        map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Used'});
        map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Not used'});
        map.addSource('3', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Visibility none'});
        map.addLayer({id: 'layer1', type: 'fill', source: '1'});
        map.addLayer({id: 'layer3', type: 'fill', source: '3', layout: {visibility: 'none'}});

        await sleep(100);

        expect(spy.mock.calls.filter((call) => {
            const mapDataEvent: MapSourceDataEvent = call[0];

            // the only one visible should be '1'.
            // source 2 does not have layer and source 3 is not visible
            return mapDataEvent.dataType === 'source' &&
                   mapDataEvent.sourceDataType === 'visibility' &&
                   mapDataEvent.sourceId === '1';
        })).toHaveLength(1);

        expect(attribution._innerContainer.innerHTML).toBe(`Used | ${defaultAttributionControlOptions.customAttribution}`);
    });

    test('does not show attributions for sources that are used for terrain when they are not in use', async () => {
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

        const spy = vi.fn();
        map.on('data', spy);
        await map.once('load');
        map.addSource('1', {type: 'raster-dem', url: '/source.json'});
        server.respond();

        await sleep(100);

        // there should not be a visibility event since there is no layer
        expect(spy.mock.calls.filter((call) => {
            const mapDataEvent: MapSourceDataEvent = call[0];
            return mapDataEvent.dataType === 'source' &&
                   mapDataEvent.sourceDataType === 'visibility';
        })).toHaveLength(0);

        expect(attribution._innerContainer.innerHTML).toBe(defaultAttributionControlOptions.customAttribution);
    });

    test('shows attributions for sources that are used for terrain', async () => {
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

        const spy = vi.fn();
        map.on('data', spy);
        await map.once('load');
        map.addSource('1', {type: 'raster-dem', url: '/source.json'});
        server.respond();
        map.setTerrain({source: '1'});
        await sleep(100);

        // there should not be a visibility event since there is no layer
        expect(spy.mock.calls.filter((call) => {
            const mapDataEvent: MapSourceDataEvent = call[0];
            return mapDataEvent.dataType === 'source' &&
                   mapDataEvent.sourceDataType === 'visibility';
        })).toHaveLength(0);

        expect(attribution._innerContainer.innerHTML).toBe(`Terrain | ${defaultAttributionControlOptions.customAttribution}`);
    });

    test('toggles attributions for sources whose visibility changes when zooming', async () => {
        const attribution = new AttributionControl({});
        map.addControl(attribution);

        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                map.setZoom(13);
            }
        });

        await map.once('load');
        map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Used'});
        map.addLayer({id: '1', type: 'fill', source: '1', minzoom: 12});

        await sleep(100);
        expect(map.getZoom()).toBe(13);
        expect(attribution._innerContainer.innerHTML).toBe('Used');
    });

    test('sanitizes html content in attributions', async () => {
        const attributionControl = new AttributionControl({
            customAttribution: 'MapLibre<script>alert("xss")</script>'
        });
        map.addControl(attributionControl);
        await map.once('load');

        expect(attributionControl._innerContainer.innerHTML).toBe('MapLibre');
    });

    test('only recreates attributions if sanitized attribution content changes', async () => {
        const attributionControl = new AttributionControl({
            customAttribution: 'MapLibre<script>alert("xss")</script>'
        });
        map.addControl(attributionControl);
        await map.once('load');

        // this will be overwritten if the attribution control re-renders for any reason
        attributionControl._innerContainer.innerHTML = 'unchanged';
        map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});

        await sleep(100);

        expect(attributionControl._innerContainer.innerHTML).toBe('unchanged');
    });
});

describe('AttributionControl test regarding the HTML elements details and summary', () => {
    describe('Details is set correct for compact view', () => {
        test('It should NOT contain the attribute open="" on first load.', () => {
            const attributionControl = new AttributionControl({
                compact: true,
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();
        });

        test('It SHOULD contain the attribute open="" after click on summary.', () => {
            const attributionControl = new AttributionControl({
                compact: true,
            });
            map.addControl(attributionControl);
            const container = map.getContainer();
            const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

            simulate.click(toggle);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBe('');
        });

        test('It should NOT contain the attribute open="" after two clicks on summary.', () => {
            const attributionControl = new AttributionControl({
                compact: true,
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
                customAttribution: undefined
            });
            map.addControl(attributionControl);

            expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')[0].getAttribute('open')).toBeNull();
        });

        test('It SHOULD contain the attribute open="" if offsetWidth > 640.', () => {
            Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 641, configurable: true});
            const attributionControl = new AttributionControl({});
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
            const attributionControl = new AttributionControl({});
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
            const attributionControl = new AttributionControl({});
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
            const attributionControl = new AttributionControl({});
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
