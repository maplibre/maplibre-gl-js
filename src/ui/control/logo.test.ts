import {test} from '../../../util/test';
import {createMap as globalCreateMap} from '../../../util';
import VectorTileSource from '../../source/vector_tile_source';

function createMap(t, logoPosition, logoRequired) {
    return globalCreateMap(t, {
        style: {
            version: 8,
            sources: {
                'composite': createSource({
                    minzoom: 1,
                    maxzoom: 10,
                    attribution: 'Mapbox',
                    tiles: [
                        'http://example.com/{z}/{x}/{y}.png'
                    ]
                }, logoRequired)
            },
            layers: []
        },
        logoPosition: logoPosition || undefined
    });
}

function createSource(options, logoRequired) {
    const source = new VectorTileSource('id', options, {send () {}});
    source.onAdd({
        _requestManager: {
            _skuToken: '1234567890123',
            canonicalizeTileset: tileJSON => tileJSON.tiles
        },
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1
    });
    source.on('error', (e) => {
        throw e.error;
    });
    const logoFlag = 'maplibreLogo';
    source[logoFlag] = logoRequired === undefined ? true : logoRequired;
    return source;
}
describe('LogoControl appears in bottom-left by default', done => {
    const map = createMap(t);
    map.on('load', () => {
        expect(map.getContainer().querySelectorAll(
            '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-logo'
        ).length).toBe(1);
        done();
    });
});

describe('LogoControl appears in the position specified by the position option', done => {
    const map = createMap(t, 'top-left');
    map.on('load', () => {
        expect(map.getContainer().querySelectorAll(
            '.maplibregl-ctrl-top-left .maplibregl-ctrl-logo'
        ).length).toBe(1);
        done();
    });
});

describe('LogoControl is not displayed when the maplibreLogo property is false', done => {
    const map = createMap(t, 'top-left', false);
    map.on('load', () => {
        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-left > .maplibregl-ctrl')[0].style.display
        ).toBe('none');
        done();
    });
});
describe('LogoControl is not added more than once', done => {
    const map = createMap(t);
    const source = createSource({
        minzoom: 1,
        maxzoom: 10,
        attribution: 'Mapbox',
        tiles: [
            'http://example.com/{z}/{x}/{y}.png'
        ]
    });
    map.on('load', () => {
        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-logo').length).toBe(1);
        map.addSource('source2', source);
        map.on('sourcedata', (e) => {
            if (e.isSourceLoaded && e.sourceId === 'source2' && e.sourceDataType === 'metadata') {
                expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-logo').length).toBe(1);
                done();
            }
        });
    });
});

describe('LogoControl appears in compact mode if container is less then 250 pixel wide', done => {
    const map = createMap(t);
    const container = map.getContainer();

    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 255, configurable: true});
    map.resize();
    expect(
        container.querySelectorAll('.maplibregl-ctrl-logo:not(.maplibregl-compact)').length
    ).toBe(1);

    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 245, configurable: true});
    map.resize();
    expect(
        container.querySelectorAll('.maplibregl-ctrl-logo.maplibregl-compact').length
    ).toBe(1);

    done();
});

describe('LogoControl has `rel` nooper and nofollow', done => {
    const map = createMap(t);

    map.on('load', () => {
        const container = map.getContainer();
        const logo = container.querySelector('.maplibregl-ctrl-logo');

        expect(logo.rel).toBe('noopener nofollow');

        done();
    });
});
