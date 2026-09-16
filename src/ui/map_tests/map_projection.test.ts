import {afterEach, beforeEach, describe, test, expect} from 'vitest';
import {createMap, beforeMapTest, createRotatedCrs} from '../../util/test/util.ts';
import {addProjection, removeProjection} from '../../geo/projection/projection_crud.ts';
import {MAX_VALID_LATITUDE} from '../../util/util.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Map in the simple projection', () => {
    test('loads a style that declares the simple projection', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'simple'}}});
        await map.once('style.load');

        expect(map.getProjection()).toEqual({type: 'simple'});
    });

    test('keeps an initial center north of the mercator latitude limit', async () => {
        const latitudeNorthOfMercatorLimit = MAX_VALID_LATITUDE + 1;
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'simple'}}, center: [0, latitudeNorthOfMercatorLimit], zoom: 6});
        await map.once('style.load');

        expect(map.getCenter().lat).toBeCloseTo(latitudeNorthOfMercatorLimit, 6);
    });

    test('returns to the simple projection after a round trip through globe', async () => {
        const map = createMap();
        await map.once('style.load');

        map.setProjection({type: 'simple'});
        map.setProjection({type: 'globe'});
        expect(map.getProjection()).toEqual({type: 'globe'});

        map.setProjection({type: 'simple'});
        expect(map.getProjection()).toEqual({type: 'simple'});
    });

    test('stops the center where the viewport reaches the east edge of the world square', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'simple'}}, zoom: 3});
        await map.once('style.load');
        const worldSizeAtZoom3 = 4096;
        const degreesPerPixel = 180 / worldSizeAtZoom3;
        const halfContainer = map.getContainer().clientWidth / 2;

        map.setCenter([170, 0]);

        expect(map.getCenter().lng).toBeCloseTo(90 - halfContainer * degreesPerPixel, 6);
    });
});

describe('Map in a CRS registered with addProjection', () => {
    afterEach(() => {
        removeProjection(createRotatedCrs().name);
    });

    test('setProjection accepts the registered name', async () => {
        const crs = createRotatedCrs();
        addProjection(crs);
        const map = createMap();
        await map.once('style.load');

        map.setProjection({type: crs.name});

        expect(map.getProjection()).toEqual({type: crs.name});
    });

    test('projects lng/lat to the screen through the registered CRS', async () => {
        const crs = createRotatedCrs();
        addProjection(crs);
        const map = createMap();
        await map.once('style.load');
        map.setProjection({type: crs.name});
        const worldSizeAtZoom0 = 512;
        const worldOffsetInContainer = (worldSizeAtZoom0 - map.getContainer().clientWidth) / 2;
        const worldFractionOfCrsPoint = {x: 0.7, y: 0.5};
        const {origin, extentAtZoom0} = crs.tileMatrix;
        const crsPoint = {x: origin[0] + worldFractionOfCrsPoint.x * extentAtZoom0, y: origin[1] - worldFractionOfCrsPoint.y * extentAtZoom0};

        const screenPoint = map.project(crs.unproject(crsPoint.x, crsPoint.y));

        expect(screenPoint.x).toBeCloseTo(worldFractionOfCrsPoint.x * worldSizeAtZoom0 - worldOffsetInContainer, 6);
        expect(screenPoint.y).toBeCloseTo(worldFractionOfCrsPoint.y * worldSizeAtZoom0 - worldOffsetInContainer, 6);
    });
});
