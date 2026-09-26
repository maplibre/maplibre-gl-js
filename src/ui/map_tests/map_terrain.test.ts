import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, waitForEvent, createTerrain, createDEM, createDEMTerrain} from '../../util/test/util.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';
import {LngLat} from '../../geo/lng_lat.ts';
import {fakeServer, type FakeServer} from 'nise';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {AttributionControl, defaultAttributionControlOptions} from '../control/attribution_control.ts';
import {ImageRequest} from '../../util/image_request.ts';
import {Painter, type RTTObject} from '../../render/painter.ts';
import {MapSourceDataEvent} from '../events.ts';
import * as timeControl from '../../util/time_control.ts';

import type {Map} from '../map.ts';
import type {Terrain} from '../../render/terrain.ts';

let server: FakeServer;
let map: Map;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
    map = createMap();
});

afterEach(() => {
    server.restore();
});

describe('setTerrain', () => {
    afterEach(() => {
        map.remove();
        vi.restoreAllMocks();
    });

    test('warn when terrain and hillshade source identical', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 5,
            maxzoom: 12,
            attribution: 'Terrain',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));

        await map.once('load');
        map.addSource('terrainrgb', {type: 'raster-dem', url: '/source.json'});
        server.respond();
        map.addLayer({id: 'hillshade', type: 'hillshade', source: 'terrainrgb'});
        const originalWarn = console.warn;
        console.warn = vi.fn();
        map.setTerrain({
            source: 'terrainrgb'
        });
        expect(console.warn).toHaveBeenCalledTimes(1);
        console.warn = originalWarn;
    });

    test('fires an error and does not apply terrain the spec rejects', async () => {
        await map.once('style.load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256});
        const errorSpy = vi.fn();
        map.on('error', errorSpy);

        map.setTerrain({source: 'dem', nonsense: 1} as any);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0].error.message).toContain('unknown property "nonsense"');
        expect(map.getTerrain()).toBeNull();
    });

    test('applies terrain the spec accepts', async () => {
        await map.once('style.load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256});
        const errorSpy = vi.fn();
        map.on('error', errorSpy);

        map.setTerrain({source: 'dem', exaggeration: 2});

        expect(errorSpy).not.toHaveBeenCalled();
        expect(map.getTerrain()).toEqual({source: 'dem', exaggeration: 2});
    });

    test('removing terrain frees the pooled drape textures', async () => {
        await map.once('style.load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256});
        map.setTerrain({source: 'dem'});
        const drape = map.painter.acquireRTT(512);
        vi.spyOn(drape.texture, 'destroy');
        map.painter.releaseRTT(drape);

        map.setTerrain(null);

        expect(drape.texture.destroy).toHaveBeenCalledTimes(1);
    });

    test('destroys the drapes a zoom out leaves unused once the map is at rest', async () => {
        vi.spyOn(ImageRequest, 'getImage').mockResolvedValue({data: null});
        map = createMap({zoom: 14, style: {
            version: 8,
            sources: {
                dem: {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256},
                land: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]}}}
            },
            layers: [{id: 'land', type: 'fill', source: 'land'}],
            terrain: {source: 'dem'}
        }});
        const acquireRTT = vi.spyOn(map.painter, 'acquireRTT');
        await map.once('idle');
        const drapesAtZoom14 = [...new Set(acquireRTT.mock.results.map(({value}) => value as RTTObject))];
        for (const drape of drapesAtZoom14) vi.spyOn(drape.texture, 'destroy');
        const terrainTilesAtZoom14 = map.terrain.tileManager.getRenderableTiles().length;

        map.jumpTo({zoom: 0});
        await map.once('idle');

        const terrainTilesAtZoom0 = map.terrain.tileManager.getRenderableTiles().length;
        expect(terrainTilesAtZoom0).toBeLessThan(terrainTilesAtZoom14);
        const destroyedDrapes = drapesAtZoom14.filter(({texture}) => vi.mocked(texture.destroy).mock.calls.length > 0);
        expect(destroyedDrapes).toHaveLength(drapesAtZoom14.length - terrainTilesAtZoom0);
    });

    test('drops the previous source attribution when switching terrain to a new source', async () => {
        const attribution = new AttributionControl();
        map.addControl(attribution);
        await map.once('style.load');
        const demALoaded = waitForEvent(map, 'sourcedata', (e) => e.sourceId === 'dem-a' && e.sourceDataType === 'metadata');
        const demBLoaded = waitForEvent(map, 'sourcedata', (e) => e.sourceId === 'dem-b' && e.sourceDataType === 'metadata');
        map.addSource('dem-a', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'DEM A'});
        map.addSource('dem-b', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'DEM B'});
        await Promise.all([demALoaded, demBLoaded]);

        map.setTerrain({source: 'dem-a'});
        const terrainEvent = map.once('terrain');
        map.setTerrain({source: 'dem-b'});
        await terrainEvent;

        const innerContainer = map.getContainer().querySelector('.maplibregl-ctrl-attrib-inner');
        expect(innerContainer.innerHTML).toBe(`DEM B | ${defaultAttributionControlOptions.customAttribution}`);
    });

    test('invalidates cached elevation when terrain source data changes without a tile', async () => {
        await map.once('load');
        map.addSource('terrainrgb', {
            type: 'raster-dem',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        map.setTerrain({source: 'terrainrgb'});
        if (!map.terrain) throw new Error('Expected terrain to be set');
        const resetElevationCache = vi.spyOn(map.terrain, 'resetElevationCache');

        map._terrainDataCallback({
            dataType: 'source',
            sourceId: 'terrainrgb',
            sourceDataType: 'content',
            source: {type: 'raster-dem'}
        } as any);

        expect(resetElevationCache).toHaveBeenCalledTimes(1);
    });

    test('invalidates terrain depth only for tiles from the terrain source', async () => {
        await map.once('load');
        const terrainLoaded = waitForEvent(map, 'sourcedata', (e) => e.sourceId === 'terrainrgb' && e.sourceDataType === 'metadata');
        const otherLoaded = waitForEvent(map, 'sourcedata', (e) => e.sourceId === 'other' && e.sourceDataType === 'metadata');
        map.addSource('terrainrgb', {
            type: 'raster-dem',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        map.addSource('other', {
            type: 'raster-dem',
            tiles: ['http://example.com/other/{z}/{x}/{y}.png']
        });
        await Promise.all([terrainLoaded, otherLoaded]);

        const markTerrainDepthDirty = vi.spyOn(Painter.prototype, 'markTerrainDepthDirty');
        map.setTerrain({source: 'terrainrgb'});
        expect(markTerrainDepthDirty).toHaveBeenCalledTimes(1);
        markTerrainDepthDirty.mockClear();

        const terrainSource = map.getSource('terrainrgb');
        const otherSource = map.getSource('other');
        expect(terrainSource).toBeDefined();
        expect(otherSource).toBeDefined();
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const tile = {tileID};

        otherSource.fire(new MapSourceDataEvent('data', {tile, coord: tileID}));
        expect(markTerrainDepthDirty).not.toHaveBeenCalled();

        terrainSource.fire(new MapSourceDataEvent('data', {sourceDataType: 'content'}));
        expect(markTerrainDepthDirty).not.toHaveBeenCalled();

        terrainSource.fire(new MapSourceDataEvent('data', {tile, coord: tileID}));
        expect(markTerrainDepthDirty).toHaveBeenCalledTimes(1);

        terrainSource.fire(new MapSourceDataEvent('data', {tile, coord: tileID, sourceDataType: 'content'}));
        expect(markTerrainDepthDirty).toHaveBeenCalledTimes(2);
    });

    test('re-places symbols when terrain is set', async () => {
        await map.once('load');
        map.addSource('terrainrgb', {
            type: 'raster-dem',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        const triggerSymbolPlacement = vi.spyOn(map.style, 'triggerSymbolPlacement');

        map.setTerrain({source: 'terrainrgb'});

        expect(triggerSymbolPlacement).toHaveBeenCalledTimes(1);
    });

    test('re-places symbols when terrain source data changes, but not for data from another source', async () => {
        await map.once('load');
        map.addSource('terrainrgb', {
            type: 'raster-dem',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        map.setTerrain({source: 'terrainrgb'});
        const triggerSymbolPlacement = vi.spyOn(map.style, 'triggerSymbolPlacement');

        map._terrainDataCallback({
            dataType: 'source',
            sourceId: 'other',
            sourceDataType: 'content',
            source: {type: 'geojson'}
        } as any);
        expect(triggerSymbolPlacement).not.toHaveBeenCalled();

        map._terrainDataCallback({
            dataType: 'source',
            sourceId: 'terrainrgb',
            sourceDataType: 'content',
            source: {type: 'raster-dem'}
        } as any);
        expect(triggerSymbolPlacement).toHaveBeenCalledTimes(1);
    });
});

describe('getTerrain', () => {
    test('returns null when not set', () => {
        const map = createMap();
        expect(map.getTerrain()).toBeNull();
    });
});

describe('getCameraTargetElevation', () => {
    test('Elevation is zero without terrain, and matches any given terrain', () => {
        expect(map.getCameraTargetElevation()).toBe(0);

        map.terrain = {} as Terrain;

        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setCenter(new LngLat(10.0, 50.0));
        transform.setZoom(14);
        transform.resize(512, 512);
        transform.setElevation(2000);
        map._camera.transform = transform;

        expect(map.getCameraTargetElevation()).toBe(2000);
    });
});

describe('Gesture end on terrain', () => {
    test('the center elevation after a drag is the rendered surface elevation, not the tile-zoom DEM sample', async () => {
        const map = createMap({interactive: true, clickTolerance: 4});
        await map.once('style.load');
        map.terrain = {
            ...createTerrain(),
            getElevationForLngLat: () => 400,
            getElevationForLngLatZoom: () => 1000,
        } as any as Terrain;
        map._camera.terrain = map.terrain;

        simulate.dragWithMove(map.getCanvas(), {x: 100, y: 100}, {x: 100, y: 150});
        map._renderTaskQueue.run();

        expect(map.getCenterElevation()).toBe(400);
    });

    test('the camera stays in place when a drag ends at pitch 85', async () => {
        const map = createMap({interactive: true, zoom: 11, maxPitch: 85, pitch: 85});
        await map.once('load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(400);

        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 100, clientY: 100});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 100, clientY: 150});
        map.redraw();
        const probe = map.unproject([100, 150]);
        const probeAtRelease = map.project(probe);
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 0, clientX: 100, clientY: 150});
        map.redraw();

        expect(map.project(probe).dist(probeAtRelease)).toBeLessThan(0.01);
    });
});

describe('Terrain changing under and around a gesture', () => {
    async function createMapOverTerrain(pitch: number): Promise<Map> {
        const map = createMap({interactive: true, zoom: 11, pitch});
        await map.once('load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        return map;
    }

    function demTileLands(map: Map): void {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        map.getSource('dem').fire(new MapSourceDataEvent('data', {tile: {tileID}, coord: tileID}));
    }

    test('a rotate drag holds the center elevation until it ends and turns the same bearing per pixel while the terrain under the center rises', async () => {
        const map = await createMapOverTerrain(60);
        const terrainElevation = vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);

        const bearingAtStart = map.getBearing();
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 40, clientY: 180});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 50, clientY: 180});
        map._renderTaskQueue.run();
        const bearingAfterFirstMove = map.getBearing();
        terrainElevation.mockReturnValue(3000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(0);
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 60, clientY: 180});
        map._renderTaskQueue.run();
        const bearingAfterSecondMove = map.getBearing();
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 60, clientY: 180});
        map._renderTaskQueue.run();

        expect(bearingAfterSecondMove - bearingAfterFirstMove).toBeCloseTo(bearingAfterFirstMove - bearingAtStart, 5);
        expect(map.getCameraTargetElevation()).toBe(3000);
    });

    test('a DEM tile landing while a pan drag is in flight leaves the camera where the drag put it, and the release re-solves the zoom onto the new terrain without moving it', async () => {
        const map = await createMapOverTerrain(0);
        const terrainElevation = vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);

        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 110, clientY: 150});
        map._renderTaskQueue.run();
        terrainElevation.mockReturnValue(1000);
        demTileLands(map);
        expect(map.getCameraTargetElevation()).toBe(0);
        expect(map.getZoom()).toBe(11);

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 0, clientX: 110, clientY: 150});
        map._renderTaskQueue.run();
        expect(map.getCameraTargetElevation()).toBe(1000);
        expect(map.getZoom()).toBeCloseTo(11.131812, 5);
    });

    test('after easeTo or flyTo the center elevation follows the terrain again on the next frame', async () => {
        const map = await createMapOverTerrain(0);
        const terrainElevation = vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);

        map.easeTo({center: [2, 2], zoom: 12, duration: 0});
        terrainElevation.mockReturnValue(2000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(2000);
        expect(map.getZoom()).toBe(12);

        map.flyTo({center: [3, 3], zoom: 13, animate: false});
        terrainElevation.mockReturnValue(3000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(3000);
        expect(map.getZoom()).toBe(13);
    });

    test('the gesture after terrain changes at rest starts from the camera as rendered, after a click, a DEM tile landing and the per-frame clamp moving it further', async () => {
        const map = await createMapOverTerrain(0);
        const terrainElevation = vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 110, clientY: 150});
        map._renderTaskQueue.run();
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 110, clientY: 150});
        map._renderTaskQueue.run();
        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 110, clientY: 150});
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 0, clientX: 110, clientY: 150});
        map._renderTaskQueue.run();
        terrainElevation.mockReturnValue(1000);
        demTileLands(map);
        expect(map.getCameraTargetElevation()).toBe(1000);
        terrainElevation.mockReturnValue(1500);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(1500);

        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 110, clientY: 150});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(1500);
    });

    test('easeTo after a pitch limit change starts from the camera as rendered, after a DEM tile landing', async () => {
        const map = await createMapOverTerrain(60);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        const terrainElevation = vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);

        map.setMaxPitch(70);
        terrainElevation.mockReturnValue(1000);
        demTileLands(map);
        map.easeTo({center: [1, 1], duration: 1000, easing: k => k});
        now.mockReturnValue(500);
        map.redraw();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('easeTo and flyTo ease the center elevation to the terrain under the destination, and the frame after the animation leaves it there', async () => {
        const map = await createMapOverTerrain(60);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockImplementation((lnglat: LngLat) => lnglat.lat > 2.5 ? 3000 : lnglat.lat > 0.5 ? 1000 : 0);

        map.easeTo({center: [1, 1], zoom: 12, duration: 1000, easing: k => k});
        now.mockReturnValue(500);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(500);
        now.mockReturnValue(1000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(1000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(1000);

        map.flyTo({center: [3, 3], zoom: 13, duration: 1000, easing: k => k});
        now.mockReturnValue(1500);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(2000);
        now.mockReturnValue(2000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(3000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(3000);
    });

    test('easeTo around a point, as a double-click zoom does, eases the center elevation to the terrain under the center it ends on', async () => {
        const map = await createMapOverTerrain(60);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockImplementation((lnglat: LngLat) => lnglat.lat > 0.75 ? 2000 : lnglat.lat > 0.25 ? 1000 : 0);

        map.easeTo({zoom: 12, around: [1, 1], duration: 1000, easing: k => k});
        now.mockReturnValue(500);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(500);
        now.mockReturnValue(1000);
        map.redraw();
        expect(map.getCenter().lat).toBeCloseTo(0.5, 3);
        expect(map.getCameraTargetElevation()).toBe(1000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('easeTo and flyTo with an offset, each turning the bearing, ease the center elevation to the terrain under the center, not under the offset point', async () => {
        const map = await createMapOverTerrain(60);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        const terrainElevation = vi.spyOn(map.terrain, 'getElevationForLngLat');
        const offsetBelowCenter: [number, number] = [0, 100];

        terrainElevation.mockImplementation((lnglat: LngLat) => lnglat.lng > 1.01 ? 1000 : lnglat.lat > 0.5 ? 500 : 0);
        map.easeTo({center: [1, 1], zoom: 12, bearing: 90, offset: offsetBelowCenter, duration: 1000, easing: k => k});
        now.mockReturnValue(900);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(900);
        now.mockReturnValue(1000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(1000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(1000);

        terrainElevation.mockImplementation((lnglat: LngLat) => lnglat.lat > 2.995 ? 2000 : lnglat.lat > 2.5 ? 3000 : 1000);
        map.flyTo({center: [3, 3], zoom: 13, bearing: 180, offset: offsetBelowCenter, duration: 1000, easing: k => k});
        now.mockReturnValue(1900);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(2800);
        now.mockReturnValue(2000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(3000);
        map.redraw();
        expect(map.getCameraTargetElevation()).toBe(3000);
    });
});

describe('Keep camera outside terrain', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test('Try to move camera into terrain', () => {
        let terrainElevation = 10;
        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = vi.fn(
            (_lngLat: LngLat, _zoom: number) => terrainElevation
        );
        terrainStub.getElevationForLngLat = vi.fn(() => terrainElevation);
        map.terrain = terrainStub;
        map._camera.terrain = terrainStub;

        // Terrain elevation is 10 everywhere, we are above it at zoom level 15
        // with pitch 45 deg.
        map.jumpTo({center: [0.0, 0.0], bearing: 0, pitch: 45, zoom: 15});
        const initialLngLat = map._camera.transform.screenPointToLocation(map._camera.transform.getCameraPoint());
        const initialAltitude = map._camera.transform.getCameraAltitude();
        expect(initialAltitude).toBeCloseTo(516, 0);

        // Now we set the elevation to 5000 everywhere and try to jump to the
        // same position. This would lead to a jump into the terrain, which
        // must not be possible.
        // Camera should be above the terrain, but at the same location as
        // before and with decreased pitch.
        terrainElevation = 5000;
        map.jumpTo({center: [0.0, 0.0], pitch: 45, zoom: 15});

        const lngLat = map._camera.transform.screenPointToLocation(map._camera.transform.getCameraPoint());
        expect(lngLat.lng).toBeCloseTo(initialLngLat.lng);
        expect(lngLat.lat).toBeCloseTo(initialLngLat.lat);
        expect(map._camera.transform.getCameraAltitude()).toBeGreaterThan(initialAltitude);
        expect(map._camera.transform.getCameraAltitude()).toBeGreaterThan(terrainElevation);
    });

    async function createMapOverTerrainWithACameraFloor(floor: number): Promise<Map> {
        const map = createMap({interactive: true, zoom: 11, pitch: 45});
        await map.once('load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLatZoom').mockReturnValue(floor);
        map.redraw();
        return map;
    }

    function lowestNearPlaneAltitude(map: Map): number {
        return Math.min(...map._camera.transform.getCameraFrustum().points.slice(0, 4).map(corner => corner[2]));
    }

    test('a pitch drag that would put the camera into the terrain lifts the center, and the camera with it, and keeps the pitch', async () => {
        const map = await createMapOverTerrainWithACameraFloor(20000);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();
        expect(map.getPitch()).toBe(60);
        expect(map.getCameraTargetElevation()).toBeCloseTo(14394.1, 1);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(20000, 0);

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 60});
        map._renderTaskQueue.run();
        expect(map.getPitch()).toBe(60);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(20000, 0);
        const cameraAltitude = map._camera.transform.getCameraAltitude();

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 60});
        map._renderTaskQueue.run();
        expect(map.getPitch()).toBe(60);
        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(cameraAltitude, 1);
    });

    test('a wheel zoom over terrain that rose under the held center moves the center onto that terrain, and its end leaves the camera and the zoom where they were', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);
        const map = createMap({interactive: true, zoom: 12, pitch: 70, maxZoom: 18});
        await map.once('load');
        vi.useFakeTimers();
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        const elevation = vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);
        const tileElevation = vi.spyOn(map.terrain, 'getElevationForLngLatZoom').mockReturnValue(0);
        map.redraw();
        const frame = () => { now += 1000 / 60; timeControlNow.mockReturnValue(now); map._renderTaskQueue.run(); };

        simulate.wheel(map.getCanvas(), {deltaY: -400.0244140625, clientX: 100, clientY: 100});
        frame();
        const plateau = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(plateau.getCoverageIndex());
        elevation.mockReturnValue(1000);
        tileElevation.mockReturnValue(1000);
        for (let notch = 0; notch < 12; notch++) {
            simulate.wheel(map.getCanvas(), {deltaY: -400.0244140625, clientX: 100, clientY: 100});
            for (let i = 0; i < 4; i++) frame();
        }
        for (let i = 0; i < 20; i++) frame();
        expect(map.getCameraTargetElevation()).toBe(1000);
        expect(map.getZoom()).toBe(18);
        const cameraAltitude = map._camera.transform.getCameraAltitude();
        const cameraLngLat = map._camera.transform.getCameraLngLat();

        vi.advanceTimersByTime(250);
        for (let i = 0; i < 3; i++) frame();

        expect(map._camera.elevationFreeze).toBe(false);
        expect(map.getCameraTargetElevation()).toBe(1000);
        expect(map.getZoom()).toBe(18);
        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(cameraAltitude, 1);
        expect(map._camera.transform.getCameraLngLat().lng).toBeCloseTo(cameraLngLat.lng, 7);
        expect(map._camera.transform.getCameraLngLat().lat).toBeCloseTo(cameraLngLat.lat, 7);
    });

    async function createMapForAWheelZoomOverTerrain(options: {zoom: number; pitch: number; maxPitch?: number; minZoom?: number}, elevation: number): Promise<{map: Map; frame: () => void}> {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);
        const map = createMap({interactive: true, ...options});
        await map.once('load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        setTerrainElevation(map, elevation);
        map.redraw();
        return {map, frame: () => { now += 1000 / 60; timeControlNow.mockReturnValue(now); map._renderTaskQueue.run(); }};
    }

    function setTerrainElevation(map: Map, elevation: number) {
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(elevation);
        vi.spyOn(map.terrain, 'getElevationForLngLatZoom').mockReturnValue(elevation);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => elevation)).getCoverageIndex());
    }

    test('a wheel zoom within 0.75 degrees of a level view over terrain that fell under the held center zooms by the notch', async () => {
        const {map, frame} = await createMapForAWheelZoomOverTerrain({zoom: 14, pitch: 89.5, maxPitch: 90}, 0);
        simulate.wheel(map.getCanvas(), {deltaY: -100.006103515625, clientX: 100, clientY: 100});
        frame();
        setTerrainElevation(map, -100);

        for (let i = 0; i < 20; i++) frame();

        expect(map.getZoom()).toBeCloseTo(14.15, 2);
    });

    test('a wheel zoom-out over terrain that fell away farther than minZoom allows keeps raising the camera', async () => {
        const {map, frame} = await createMapForAWheelZoomOverTerrain({zoom: 10.4, pitch: 60, minZoom: 10}, 3000);
        simulate.wheel(map.getCanvas(), {deltaY: 100.006103515625, clientX: 100, clientY: 100});
        frame();
        setTerrainElevation(map, 0);
        const cameraAltitude = map._camera.transform.getCameraAltitude();

        for (let i = 0; i < 20; i++) frame();

        expect(map._camera.transform.getCameraAltitude()).toBeGreaterThan(cameraAltitude);
    });
});

describe('queryTerrainElevation', () => {
    test('should return null if terrain is not set', () => {
        map.terrain = null;
        const result = map.queryTerrainElevation([0, 0]);
        expect(result).toBeNull();
    });

    test('Calls getElevationForLngLatZoom with correct arguments', () => {
        const getElevationForLngLat = vi.fn();
        map.terrain = {getElevationForLngLat} as any as Terrain;
        map._camera.transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});

        map.queryTerrainElevation([1, 2]);

        expect(map.terrain.getElevationForLngLat).toHaveBeenCalledWith(
            expect.objectContaining({lng: 1, lat: 2,}),
            map._camera.transform
        );
    });
});
