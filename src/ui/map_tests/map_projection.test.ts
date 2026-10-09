import {afterEach, beforeEach, describe, test, expect} from 'vitest';
import {createMap, beforeMapTest, createIdentityCrsAnsweringInside, createPolarStereographicCrs, createRotatedCrs} from '../../util/test/util.ts';
import {addProjection, removeProjection} from '../../geo/projection/projection_crud.ts';
import {MAX_VALID_LATITUDE} from '../../util/util.ts';
import {LngLat} from '../../geo/lng_lat.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Map in the identity projection', () => {
    test('loads a style that declares the identity projection', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'identity'}}});
        await map.once('style.load');

        expect(map.getProjection()).toEqual({type: 'identity'});
    });

    test('keeps an initial center north of the mercator latitude limit', async () => {
        const latitudeNorthOfMercatorLimit = MAX_VALID_LATITUDE + 1;
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'identity'}}, center: [0, latitudeNorthOfMercatorLimit], zoom: 6});
        await map.once('style.load');

        expect(map.getCenter().lat).toBeCloseTo(latitudeNorthOfMercatorLimit, 6);
    });

    test('returns to the identity projection after a round trip through globe', async () => {
        const map = createMap();
        await map.once('style.load');

        map.setProjection({type: 'identity'});
        map.setProjection({type: 'globe'});
        expect(map.getProjection()).toEqual({type: 'globe'});

        map.setProjection({type: 'identity'});
        expect(map.getProjection()).toEqual({type: 'identity'});
    });

    test('stops the center where the viewport reaches the east edge of the world square', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'identity'}}, zoom: 3});
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
        const {origin, extentAtZoom0} = crs.tileMatrixSet;
        const crsPoint = {x: origin[0] + worldFractionOfCrsPoint.x * extentAtZoom0, y: origin[1] - worldFractionOfCrsPoint.y * extentAtZoom0};

        const [lng, lat] = crs.projection.inverse([crsPoint.x, crsPoint.y]);
        const screenPoint = map.project([lng, lat]);

        expect(screenPoint.x).toBeCloseTo(worldFractionOfCrsPoint.x * worldSizeAtZoom0 - worldOffsetInContainer, 6);
        expect(screenPoint.y).toBeCloseTo(worldFractionOfCrsPoint.y * worldSizeAtZoom0 - worldOffsetInContainer, 6);
    });
});

describe('Map in a polar stereographic CRS', () => {
    afterEach(() => {
        removeProjection(createPolarStereographicCrs().name);
    });

    test('fits the cap north of 60N with the pole at the center', async () => {
        const crs = createPolarStereographicCrs();
        addProjection(crs);
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}});
        await map.once('style.load');

        const camera = map.cameraForBounds([[-180, 60], [180, 90]]);

        expect(LngLat.convert(camera.center).lat).toBeCloseTo(90, 6);
    });

    test('keeps a center on the far side of the pole inside maxBounds of the cap north of 60N', async () => {
        const crs = createPolarStereographicCrs();
        addProjection(crs);
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}, maxBounds: [[-180, 60], [180, 90]], zoom: 3});
        await map.once('style.load');

        map.setCenter([45, 70]);

        expect(map.getCenter().lng).toBeCloseTo(45, 6);
        expect(map.getCenter().lat).toBeCloseTo(70, 6);
    });
});

describe('Map in a CRS whose converter answers only inside its tile matrix set', () => {
    afterEach(() => {
        removeProjection(createIdentityCrsAnsweringInside(null).name);
    });

    test('unprojects a point past the west edge of the world square to the edge', async () => {
        const crs = createIdentityCrsAnsweringInside(null);
        addProjection(crs);
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}});
        await map.once('style.load');
        const containerMiddle = 100;

        const pastTheWestEdge = map.unproject([-1000, containerMiddle]);

        expect(pastTheWestEdge.lng).toBeCloseTo(-90, 6);
        expect(pastTheWestEdge.lat).toBeCloseTo(0, 6);
    });
});
