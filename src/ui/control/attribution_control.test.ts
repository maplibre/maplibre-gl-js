import AttributionControl from './attribution_control';
import {createMap as globalCreateMap, setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';
import simulate from '../../../test/util/simulate_interaction';

function createMap() {

    return globalCreateMap({
        attributionControl: false,
        style: {
            version: 8,
            sources: {},
            layers: [],
            owner: 'mapbox',
            id: 'streets-v10',
        },
        hash: true
    }, undefined);
}

describe('AttributionControl', () => {
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
            compact: true
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

    test('appears in compact mode if container is less then 640 pixel wide', () => {
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
        ).toHaveLength(1);
    });

    test('compact mode control toggles attribution', () => {
        map.addControl(new AttributionControl({
            compact: true
        }));

        const container = map.getContainer();
        const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

        expect(container.querySelectorAll('.maplibregl-compact-show')).toHaveLength(0);

        simulate.click(toggle);

        expect(container.querySelectorAll('.maplibregl-compact-show')).toHaveLength(1);

        simulate.click(toggle);

        expect(container.querySelectorAll('.maplibregl-compact-show')).toHaveLength(0);
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

    test('details is set correct for compact view after map load. In particular, it should NOT contain the attribute open="".', () => {
        const attributionControl = new AttributionControl({
            compact: true
        });
        map.addControl(attributionControl);

        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')).toMatchInlineSnapshot(`
NodeList [
  <details
    class="maplibregl-ctrl maplibregl-ctrl-attrib mapboxgl-ctrl mapboxgl-ctrl-attrib maplibregl-compact mapboxgl-compact maplibregl-attrib-empty mapboxgl-attrib-empty"
  >
    <summary
      aria-label="Toggle attribution"
      class="maplibregl-ctrl-attrib-button mapboxgl-ctrl-attrib-button"
      title="Toggle attribution"
    />
    <div
      class="maplibregl-ctrl-attrib-inner mapboxgl-ctrl-attrib-inner"
    />
  </details>,
]
`);
    });

    test('details is set correct for compact view after click on summary. In particular, it SHOULD contain the attribute open="".', () => {
        const attributionControl = new AttributionControl({
            compact: true
        });
        map.addControl(attributionControl);
        const container = map.getContainer();
        const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

        simulate.click(toggle);

        expect(container.querySelectorAll('.maplibregl-ctrl-attrib')).toMatchInlineSnapshot(`
NodeList [
  <details
    class="maplibregl-ctrl maplibregl-ctrl-attrib mapboxgl-ctrl mapboxgl-ctrl-attrib maplibregl-compact mapboxgl-compact maplibregl-attrib-empty mapboxgl-attrib-empty maplibregl-compact-show mapboxgl-compact-show"
    open=""
  >
    <summary
      aria-label="Toggle attribution"
      class="maplibregl-ctrl-attrib-button mapboxgl-ctrl-attrib-button"
      title="Toggle attribution"
    />
    <div
      class="maplibregl-ctrl-attrib-inner mapboxgl-ctrl-attrib-inner"
    />
  </details>,
]
`);
    });

    test('details is set correct for compact view after two clicks on summary. In particular, it should NOT contain the attribute open="".', () => {
        const attributionControl = new AttributionControl({
            compact: true
        });
        map.addControl(attributionControl);
        const container = map.getContainer();
        const toggle = container.querySelector('.maplibregl-ctrl-attrib-button');

        simulate.click(toggle);
        simulate.click(toggle);

        expect(container.querySelectorAll('.maplibregl-ctrl-attrib')).toMatchInlineSnapshot(`
NodeList [
  <details
    class="maplibregl-ctrl maplibregl-ctrl-attrib mapboxgl-ctrl mapboxgl-ctrl-attrib maplibregl-compact mapboxgl-compact maplibregl-attrib-empty mapboxgl-attrib-empty"
  >
    <summary
      aria-label="Toggle attribution"
      class="maplibregl-ctrl-attrib-button mapboxgl-ctrl-attrib-button"
      title="Toggle attribution"
    />
    <div
      class="maplibregl-ctrl-attrib-inner mapboxgl-ctrl-attrib-inner"
    />
  </details>,
]
`);
    });

    test('details is set correct for default view. In particular, it SHOULD contain the attribute open="".', () => {
        const attributionControl = new AttributionControl({
        });
        map.addControl(attributionControl);

        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-attrib')).toMatchInlineSnapshot(`
NodeList [
  <details
    class="maplibregl-ctrl maplibregl-ctrl-attrib mapboxgl-ctrl mapboxgl-ctrl-attrib maplibregl-attrib-empty mapboxgl-attrib-empty maplibregl-compact mapboxgl-compact"
    open=""
  >
    <summary
      aria-label="Toggle attribution"
      class="maplibregl-ctrl-attrib-button mapboxgl-ctrl-attrib-button"
      title="Toggle attribution"
    />
    <div
      class="maplibregl-ctrl-attrib-inner mapboxgl-ctrl-attrib-inner"
    />
  </details>,
]
`);
    });
});
