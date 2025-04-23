import {describe, beforeEach, test, expect} from 'vitest';
import {createMap as globalCreateMap, beforeMapTest} from '../../util/test/util';

function createMap(logoPosition, maplibreLogo) {

    const mapobj = {
        logoPosition,
        maplibreLogo,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    };

    return globalCreateMap(mapobj);
}

beforeEach(() => {
    beforeMapTest();
});

describe('LogoControl', () => {
    test('does not appear by default', async () => {
        const map = createMap(undefined, undefined);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.maplibregl-ctrl-logo'
        )).toHaveLength(0);
    });

    test('is not displayed when the maplibreLogo property is false', async () => {
        const map = createMap(undefined, false);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.maplibregl-ctrl-logo'
        )).toHaveLength(0);
    });

    test('appears in bottom-left when maplibreLogo is true and logoPosition is undefined', async () => {
        const map = createMap(undefined, true);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-logo'
        )).toHaveLength(1);
    });

    test('appears in the position specified by the position option', async () => {
        const map = createMap('top-left', true);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.maplibregl-ctrl-top-left .maplibregl-ctrl-logo'
        )).toHaveLength(1);
    });

    test('appears in compact mode if container is less then 640 pixel wide', () => {
        const map = createMap(undefined, true);
        const container = map.getContainer();

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 645, configurable: true});
        map.resize();
        expect(
            container.querySelectorAll('.maplibregl-ctrl-logo:not(.maplibregl-compact)')
        ).toHaveLength(1);

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 635, configurable: true});
        map.resize();
        expect(
            container.querySelectorAll('.maplibregl-ctrl-logo.maplibregl-compact')
        ).toHaveLength(1);
    });

    test('has `rel` noopener and nofollow', async () => {
        const map = createMap(undefined, true);

        await map.once('load');
        const container = map.getContainer();
        const logo = container.querySelector('.maplibregl-ctrl-logo');
        expect(logo).toHaveProperty('rel', 'noopener nofollow');
    });
});
