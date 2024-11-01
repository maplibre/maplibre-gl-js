import {GlobeControl} from './globe_control';
import {createMap as globalCreateMap, beforeMapTest} from '../../util/test/util';

function createMap() {
    return globalCreateMap({
        projection: 'mercator',
        attributionControl: false,
        style: {
            version: 8,
            sources: {},
            layers: [],
            owner: 'maplibre',
            id: 'basic'
        },
        hash: true
    }, undefined);
}

let map;

beforeEach(() => {
    beforeMapTest();
    map = createMap();
});

afterEach(() => {
    map.remove();
});

describe('GlobeControl', () => {
    test('appears in top-right by default', () => {
        map.addControl(new GlobeControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-right .maplibregl-ctrl-globe')
        ).toHaveLength(1);
    });

    test('appears in the position specified by the position option', () => {
        map.addControl(new GlobeControl(), 'bottom-right');

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-globe')
        ).toHaveLength(1);

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-right .maplibregl-ctrl-globe')
        ).toHaveLength(0);
    });

});
