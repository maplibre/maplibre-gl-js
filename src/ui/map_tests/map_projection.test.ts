import {afterEach, beforeEach, describe, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import {addProjection, removeProjection} from '../../geo/projection/projection_crud.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

afterEach(() => {
    removeProjection('map-test-crs');
});

describe('Map with a registered planar CRS', () => {
    test('loads a style that declares the simple projection', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'simple'}}});
        await map.once('style.load');

        expect(map.getProjection()).toEqual({type: 'simple'});
    });

    test('does not clamp the initial center to mercator latitudes before a planar style loads', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'simple'}}, center: [0, 89], zoom: 6});
        await map.once('style.load');

        expect(map.getCenter().lat).toBeCloseTo(89, 6);
    });

    test('setProjection switches to a CRS registered with addProjection and projects through it', async () => {
        addProjection({
            name: 'map-test-crs',
            project: (lng, lat) => [lng, lat],
            unproject: (x, y) => [x, y],
            tileMatrix: {origin: [-180, 180], extentAtZoom0: 360},
        });
        const map = createMap();
        await map.once('style.load');

        map.setProjection({type: 'map-test-crs'});

        expect(map.getProjection()).toEqual({type: 'map-test-crs'});
        const worldSizeAtZoom0 = 512;
        const worldOffsetInContainer = (worldSizeAtZoom0 - map.getContainer().clientWidth) / 2;
        const worldFractionOfLngLat90 = {x: 0.75, y: 0.25};
        const screenPoint = map.project([90, 90]);
        expect(screenPoint.x).toBeCloseTo(worldFractionOfLngLat90.x * worldSizeAtZoom0 - worldOffsetInContainer, 6);
        expect(screenPoint.y).toBeCloseTo(worldFractionOfLngLat90.y * worldSizeAtZoom0 - worldOffsetInContainer, 6);
    });

    test('returns to the CRS after a round trip through globe', async () => {
        const map = createMap();
        await map.once('style.load');

        map.setProjection({type: 'simple'});
        map.setProjection({type: 'globe'});
        expect(map.getProjection()).toEqual({type: 'globe'});

        map.setProjection({type: 'simple'});
        expect(map.getProjection()).toEqual({type: 'simple'});
    });

    test('constrains the center to the CRS square', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'simple'}}, zoom: 3});
        await map.once('style.load');

        map.setCenter([170, 0]);

        expect(map.getCenter().lng).toBeLessThanOrEqual(90);
    });
});
