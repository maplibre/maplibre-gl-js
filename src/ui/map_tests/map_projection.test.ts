import {afterEach, beforeEach, describe, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, createIdentityCrsAnsweringInside, createPolarStereographicCrs, createRotatedCrs, createWidePlateCarreeCrs} from '../../util/test/util.ts';
import {addProjection, removeProjection} from '../../geo/projection/projection_crud.ts';
import {MAX_VALID_LATITUDE} from '../../util/util.ts';
import {LngLat} from '../../geo/lng_lat.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';
import * as timeControl from '../../util/time_control.ts';

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

    test('keeps mercator between its latitude limits after max bounds were cleared in the identity projection', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'identity'}}, zoom: 3});
        await map.once('style.load');
        map.setMaxBounds(null);
        map.setProjection({type: 'mercator'});

        map.setCenter([0, 89]);

        expect(map.getCenter().lat).toBeCloseTo(84.231948, 6);
    });

    test('stops the center at the east edge of the world square', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: 'identity'}}, zoom: 3});
        await map.once('style.load');

        map.setCenter([170, 0]);

        expect(map.getCenter().lng).toBeCloseTo(90, 6);
    });

    test('pans by the distance dragged from north of the world square', async () => {
        const map = createMap({interactive: true, style: {version: 8, sources: {}, layers: [], projection: {type: 'identity'}}, center: [0, 90], zoom: -1});
        await map.once('style.load');
        expect(map.project([0, 90]).y).toBeCloseTo(100, 6);

        simulate.mousedown(map.getCanvas(), {buttons: 1, clientX: 100, clientY: 40});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 100, clientY: 30});
        map.redraw();
        simulate.mouseup(window.document.body);

        expect(map.project([0, 90]).y).toBeCloseTo(90, 6);
    });
});

describe('Map in a CRS registered with addProjection', () => {
    const crs = createRotatedCrs();

    beforeEach(() => {
        addProjection(crs);
    });

    afterEach(() => {
        removeProjection(crs.name);
    });

    test('setProjection accepts the registered name', async () => {
        const map = createMap();
        await map.once('style.load');

        map.setProjection({type: crs.name});

        expect(map.getProjection()).toEqual({type: crs.name});
    });

    test('projects lng/lat to the screen through the registered CRS', async () => {
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

describe('Map in a CRS with a camera affine', () => {
    const custom = {...createRotatedCrs(), name: 'test:camera-affine'};
    const transform = [1.4, 0.25, -0.3, 0.8] as const;

    beforeEach(() => addProjection({...custom, getCameraAffine: () => transform}));
    afterEach(() => removeProjection(custom.name));

    test('projects the tile plane about the view center and picks the same location after bearing, pitch and padding', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: custom.name}}, center: [8, 14], zoom: 2});
        await map.once('style.load');
        const center = map.getCenter();
        const point = new LngLat(9, 16);
        const [x, y] = custom.projection.forward(point.toArray());
        const [cx, cy] = custom.projection.forward(center.toArray());
        const scale = 512 * 2 ** map.getZoom() / custom.tileMatrixSet.extentAtZoom0;
        const dx = (x - cx) * scale, dy = (cy - y) * scale;
        const screen = map.project(point), origin = map.project(center);
        expect(screen.x - origin.x).toBeCloseTo(transform[0] * dx + transform[2] * dy, 9);
        expect(screen.y - origin.y).toBeCloseTo(transform[1] * dx + transform[3] * dy, 9);
        map.jumpTo({bearing: 30, pitch: 35, padding: {left: 16, right: 8, top: 12, bottom: 4}});
        const at = map.project(point), picked = map.unproject(at);
        expect(picked.lng).toBeCloseTo(point.lng, 9);
        expect(picked.lat).toBeCloseTo(point.lat, 9);
        const click = map.once('click');
        map.getCanvas().dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: Math.round(at.x), clientY: Math.round(at.y)}));
        const event = await click;
        expect(map.project(event.lngLat).x).toBeCloseTo(Math.round(at.x), 8);
        expect(map.project(event.lngLat).y).toBeCloseTo(Math.round(at.y), 8);
    });
});

describe('Map in a polar stereographic CRS', () => {
    const crs = createPolarStereographicCrs();

    beforeEach(() => {
        addProjection(crs);
    });

    afterEach(() => {
        removeProjection(crs.name);
    });

    test('fits the cap north of 60N with the pole at the center', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}});
        await map.once('style.load');

        const camera = map.cameraForBounds([[-180, 60], [180, 90]]);

        expect(LngLat.convert(camera.center).lat).toBeCloseTo(90, 6);
    });

    test('keeps a center on the far side of the pole inside maxBounds of the cap north of 60N', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}, maxBounds: [[-180, 60], [180, 90]], zoom: 3});
        await map.once('style.load');

        map.setCenter([45, 70]);

        expect(map.getCenter().lng).toBeCloseTo(45, 6);
        expect(map.getCenter().lat).toBeCloseTo(70, 6);
    });
});

describe('Map in a CRS whose converter answers only inside its tile matrix set', () => {
    const crs = createIdentityCrsAnsweringInside(null);

    beforeEach(() => {
        addProjection(crs);
    });

    afterEach(() => {
        removeProjection(crs.name);
    });

    test('unprojects a point past the west edge of the world square to the edge', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}});
        await map.once('style.load');
        const containerMiddle = 100;

        const pastTheWestEdge = map.unproject([-1000, containerMiddle]);

        expect(pastTheWestEdge.lng).toBeCloseTo(-90, 6);
        expect(pastTheWestEdge.lat).toBeCloseTo(0, 6);
    });
});

describe('Map in a CRS wider than ±180°', () => {
    const crs = createWidePlateCarreeCrs();

    beforeEach(() => {
        addProjection(crs);
    });

    afterEach(() => {
        removeProjection(crs.name);
    });

    test('eases to a center past 180° without wrapping it', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}});
        await map.once('style.load');

        map.easeTo({center: [200, 0], duration: 0});

        expect(map.getCenter().lng).toBeCloseTo(200, 6);
    });

    test('flies to a center past 180° without wrapping it', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [], projection: {type: crs.name}}});
        await map.once('style.load');

        map.flyTo({center: [200, 0], duration: 0});

        expect(map.getCenter().lng).toBeCloseTo(200, 6);
    });
});

describe('Map changing its projection to globe during an animation', () => {
    test('an easeTo ends at the zoom it was asked for', async () => {
        const map = createMap({center: [10, 40], zoom: 2});
        await map.once('style.load');
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.easeTo({center: [20, 50], zoom: 5, duration: 1000});
        now.mockReturnValue(400);
        map.redraw();

        map.setProjection({type: 'globe'});
        now.mockReturnValue(1000);
        map.redraw();

        expect(map.getZoom()).toBe(5);
    });

    test('an easeTo around a point ends at the zoom it was asked for', async () => {
        const map = createMap({center: [10, 40], zoom: 2});
        await map.once('style.load');
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.easeTo({around: [20, 50], zoom: 5, duration: 1000});
        now.mockReturnValue(400);
        map.redraw();

        map.setProjection({type: 'globe'});
        now.mockReturnValue(1000);
        map.redraw();

        expect(map.getZoom()).toBe(5);
    });

    test('a flyTo ends at the zoom it was asked for', async () => {
        const map = createMap({center: [10, 40], zoom: 2});
        await map.once('style.load');
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.flyTo({center: [20, 50], zoom: 5, duration: 1000});
        now.mockReturnValue(400);
        map.redraw();

        map.setProjection({type: 'globe'});
        now.mockReturnValue(1000);
        map.redraw();

        expect(map.getZoom()).toBe(5);
    });
});
