import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {GlobeControl} from './globe_control';
import {createMap as globalCreateMap, beforeMapTest} from '../../util/test/util';

function createMap() {
    return globalCreateMap({
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

    test('toggles projection when clicked', async () => {
        await new Promise(resolve => map.on('load', resolve));

        map.addControl(new GlobeControl());
        expect(map.style.projection.name).toBe('mercator');
        const button = map.getContainer().querySelector('.maplibregl-ctrl-globe');

        button.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(map.style.projection.name).toBe('globe');

        button.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(map.style.projection.name).toBe('mercator');
    });
});
