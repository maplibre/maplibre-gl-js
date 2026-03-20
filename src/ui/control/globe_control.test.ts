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
    });
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
        await map.once('load');

        map.addControl(new GlobeControl());
        expect(map.style.projection.name).toBe('mercator');
        const button = map.getContainer().querySelector('.maplibregl-ctrl-globe');

        button.click();
        expect(map.style.projection.name).toBe('globe');

        button.click();
        expect(map.style.projection.name).toBe('mercator');
    });

    describe('updates control state when Map.setProjection is called', () => {
        beforeEach(async () => {
            map.addControl(new GlobeControl());
            await map.once('load');
        });

        test('default without call to setProjection', () => {
            const button = map.getContainer().querySelector('.maplibregl-ctrl-globe');
            expect(map.style.projection.name).toBe('mercator');
            expect(button.classList.contains('maplibregl-ctrl-globe')).toBeTruthy();
            expect(button.classList.contains('maplibregl-ctrl-globe-enabled')).toBeFalsy();
        });

        test('setProjection({type: "mercator" -> "globe")', () => {
            map.setProjection({type: 'mercator'});
            map.setProjection({type: 'globe'});

            // mercator = disabled state
            const button = map.getContainer().querySelector('.maplibregl-ctrl-globe-enabled');
            expect(map.style.projection.name).toBe('globe');
            expect(button).not.toBeNull();
            expect(button.classList.contains('maplibregl-ctrl-globe-enabled')).toBeTruthy();
            expect(button.classList.contains('maplibregl-ctrl-globe')).toBeFalsy();
        });

        test('setProjection({type: "globe" -> "mercator")', () => {
            map.setProjection({type: 'globe'});
            map.setProjection({type: 'mercator'});

            // mercator = disabled state
            const button = map.getContainer().querySelector('.maplibregl-ctrl-globe');
            expect(map.style.projection.name).toBe('mercator');
            expect(button.classList.contains('maplibregl-ctrl-globe')).toBeTruthy();
            expect(button.classList.contains('maplibregl-ctrl-globe-enabled')).toBeFalsy();
        });
    });
});
