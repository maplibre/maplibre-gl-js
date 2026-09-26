import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, waitForEvent, createTerrain, createCoverageIndex} from '../../util/test/util.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';
import {LngLat, earthRadius} from '../../geo/lng_lat.ts';
import {MercatorCoordinate} from '../../geo/mercator_coordinate.ts';
import {fakeServer, type FakeServer} from 'nise';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {AttributionControl, defaultAttributionControlOptions} from '../control/attribution_control.ts';
import {ImageRequest} from '../../util/image_request.ts';
import {Painter, type RTTObject} from '../../render/painter.ts';
import {MapSourceDataEvent} from '../events.ts';
import * as timeControl from '../../util/time_control.ts';

import type {Map, MapOptions} from '../map.ts';
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
        vi.restoreAllMocks();
    });

    test('Try to move camera into terrain', () => {
        let terrainElevation = 10;
        const terrainStub = {} as Terrain;
        terrainStub.getElevationForLngLatZoom = vi.fn(
            (_lngLat: LngLat, _zoom: number) => terrainElevation
        );
        terrainStub.getElevationForLngLat = vi.fn(() => terrainElevation);
        terrainStub.getCoverageIndex = () => null;
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

    type TerrainHeight = (lng: number, lat: number) => number;

    const frameMs = 1000 / 60;
    const wheelNotch = 25 * simulate.magicWheelZoomDelta;
    const metersPerDegree = 2 * Math.PI * earthRadius / 360;
    const framesOfTheWheelEasing = 13;
    const framesUntilTheZoomEnds = 15;

    /** Every terrain sampler reads `height`: the DEM tiles, the drawn surface, and the ground under the center. */
    function setTerrainHeight(map: Map, height: TerrainHeight, min: number, max: number): void {
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockImplementation(lngLat => height(lngLat.lng, lngLat.lat));
        vi.spyOn(map.terrain, 'getElevationForLngLatZoom').mockImplementation(lngLat => height(lngLat.lng, lngLat.lat));
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(height, min, max));
    }

    /** A map over terrain whose clock and timers the returned `frame` advances by one frame before it renders. */
    async function createMapOverShapedTerrain(options: Partial<MapOptions>, height: TerrainHeight, min: number, max: number): Promise<{map: Map; frame: () => void}> {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);
        const map = createMap({interactive: true, ...options});
        await map.once('load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        setTerrainHeight(map, height, min, max);
        map.redraw();
        vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
        return {map, frame: () => {
            now += frameMs;
            timeControlNow.mockReturnValue(now);
            vi.advanceTimersByTime(frameMs);
            map.redraw();
        }};
    }

    function createMapOverFlatTerrain(options: Partial<MapOptions>, elevation: number): Promise<{map: Map; frame: () => void}> {
        return createMapOverShapedTerrain(options, () => elevation, elevation, elevation);
    }

    /** Terrain at sea level with ridges running east and west, `height` meters tall and `width` meters to each side of their crest, `y` meters north of the equator. */
    function ridges(list: Array<{y: number; height: number; width: number}>): TerrainHeight {
        return (_lng, lat) => {
            const y = lat * metersPerDegree;
            let elevation = 0;
            for (const ridge of list) {
                const d = (y - ridge.y) / ridge.width;
                if (Math.abs(d) < 1) elevation += ridge.height * (1 - d * d);
            }
            return elevation;
        };
    }

    function cameraPosition(map: Map): [number, number, number] {
        const {lng, lat} = map._camera.transform.getCameraLngLat();
        return [lng * metersPerDegree, lat * metersPerDegree, map._camera.transform.getCameraAltitude()];
    }

    function cameraMove(from: [number, number, number], to: [number, number, number]): number {
        return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    }

    function lowestNearPlaneAltitude(map: Map): number {
        return Math.min(...map._camera.transform.getCameraFrustum().points.slice(0, 4).map(corner => corner[2]));
    }

    /** A map at zoom 11 and pitch 45 whose DEM and drawn terrain are at 20000 m while the ground under the center is at sea level. */
    async function createMapUnderATerrainFloorAt20000Meters(options: Partial<MapOptions>): Promise<Map> {
        const map = createMap({interactive: true, zoom: 11, pitch: 45, maxPitch: 85, ...options});
        await map.once('load');
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLatZoom').mockReturnValue(20000);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(() => 20000, 20000, 20000));
        map.redraw();
        return map;
    }

    test('a pitch drag that would put the camera into the terrain lifts the center, and the camera with it, and keeps the pitch', async () => {
        const map = await createMapUnderATerrainFloorAt20000Meters({});

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();
        expect(map.getPitch()).toBe(70);
        expect(map.getCameraTargetElevation()).toBeCloseTo(16183.0, 1);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(20000, 0);

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 80});
        map._renderTaskQueue.run();
        expect(map.getPitch()).toBe(80);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(20000, 0);
        const cameraAltitude = map._camera.transform.getCameraAltitude();

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 80});
        map._renderTaskQueue.run();
        expect(map.getPitch()).toBe(80);
        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(cameraAltitude, 1);
    });

    test('a pitch drag after a lifted one starts from the center elevation that one ended with', async () => {
        const map = await createMapUnderATerrainFloorAt20000Meters({});
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 100});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(0);
    });

    test('a pitch drag that brings a narrow ridge under the middle of the near clipping plane lifts the plane over the ridge', async () => {
        const {map, frame} = await createMapOverFlatTerrain({zoom: 12, pitch: 55, maxPitch: 85}, 0);
        const atTheDragsEnd = map._camera.transform.clone();
        atTheDragsEnd.setPitch(60);
        const corners = atTheDragsEnd.getCameraFrustum().points.slice(0, 4);
        const middle = new MercatorCoordinate(corners.reduce((sum, c) => sum + c[0], 0) / 4, corners.reduce((sum, c) => sum + c[1], 0) / 4).toLngLat();
        const middleAltitude = corners.reduce((sum, c) => sum + c[2], 0) / 4;
        const ridgeAboveTheMiddle = 8;
        const halfWidthInDegrees = 10 / metersPerDegree;
        setTerrainHeight(map, (_lng, lat) => {
            const d = (lat - middle.lat) / halfWidthInDegrees;
            return Math.abs(d) < 1 ? (middleAltitude + ridgeAboveTheMiddle) * (1 - d * d) : 0;
        }, 0, middleAltitude + ridgeAboveTheMiddle);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 140});
        frame();

        expect(map.getPitch()).toBeCloseTo(60, 6);
        expect(map.getCameraTargetElevation()).toBeCloseTo(ridgeAboveTheMiddle, 3);
    });

    test('a pitch drag held over a floor that ends looking where no terrain is drawn leaves the camera on the floor', async () => {
        const map = await createMapUnderATerrainFloorAt20000Meters({});
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockImplementation((lngLat: LngLat) => lngLat.lat < 0.001 ? 10000 : 0);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(null);
        map.redraw();

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();
        map.redraw();

        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(20000, 1);
    });

    test('a pitch drag over terrain whose DEM has not loaded keeps the near clipping plane above the flat surface drawn in its place', async () => {
        const {map, frame} = await createMapOverFlatTerrain({zoom: 17, pitch: 30, maxPitch: 85}, -500);
        const drawnWhileItsDemLoads = createCoverageIndex(() => 0, 0, 0);
        drawnWhileItsDemLoads.samplerPerTile.set('0/0/0/0', null);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(drawnWhileItsDemLoads);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        frame();

        expect(map.getPitch()).toBeCloseTo(55, 6);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(0, 1);
    });

    test('a transformCameraUpdate that sets the center elevation during a pitch drag into the terrain leaves the camera and its near clipping plane above it', async () => {
        const map = await createMapUnderATerrainFloorAt20000Meters({transformCameraUpdate: () => ({elevation: 0})});

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(0);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(20000, 0);
    });

    test('a rotate drag that swings the camera over a hill and past it lowers the camera again, to where it started', async () => {
        const hill: TerrainHeight = (lng, lat) => {
            const d = Math.hypot(lng * metersPerDegree + 600, lat * metersPerDegree + 300) / 250;
            return d < 1 ? 450 * (1 - d * d) : 0;
        };
        const {map, frame} = await createMapOverShapedTerrain({zoom: 15, pitch: 70, maxPitch: 85}, hill, 0, 450);
        const start = cameraPosition(map);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 40, clientY: 100});
        for (let move = 1; move <= 40; move++) {
            simulate.mousemove(window.document.body, {buttons: 2, clientX: 40 + 3 * move, clientY: 100});
            frame();
        }
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 160, clientY: 100});
        for (let i = 0; i < 90; i++) frame();

        expect(map.getZoom()).toBeCloseTo(15, 6);
        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(start[2], 1);
    });

    test('a wheel zoom over terrain that rose under the held center moves the center onto that terrain, and its end leaves the camera and the zoom where they were', async () => {
        const {map, frame} = await createMapOverFlatTerrain({zoom: 12, pitch: 70, maxZoom: 18}, 0);

        simulate.wheel(map.getCanvas(), {deltaY: -4 * wheelNotch, clientX: 100, clientY: 100});
        frame();
        setTerrainHeight(map, () => 1000, 1000, 1000);
        for (let notch = 0; notch < 12; notch++) {
            simulate.wheel(map.getCanvas(), {deltaY: -4 * wheelNotch, clientX: 100, clientY: 100});
            for (let i = 0; i < 4; i++) frame();
        }
        for (let i = 0; i < framesOfTheWheelEasing; i++) frame();
        expect(map.isMoving()).toBe(true);
        expect(map.getCameraTargetElevation()).toBe(1000);
        const zoom = map.getZoom();
        const camera = cameraPosition(map);

        for (let i = 0; i < framesUntilTheZoomEnds; i++) frame();

        expect(map.isMoving()).toBe(false);
        expect(map.getCameraTargetElevation()).toBe(1000);
        expect(map.getZoom()).toBe(zoom);
        expect(cameraMove(camera, cameraPosition(map))).toBeLessThan(0.01);
    });

    test('a wheel zoom-out over a crest between the camera and the center moves the camera as it would over flat ground at the center\'s elevation', async () => {
        const crest = ridges([{y: -157.7, height: 878.4, width: 318.2}]);
        const zoomOut = async (height: TerrainHeight, max: number) => {
            const {map, frame} = await createMapOverShapedTerrain({zoom: 16.2, pitch: 60, maxZoom: 18}, height, 0, max);
            const moves: number[] = [];
            for (let notch = 0; notch < 4; notch++) {
                simulate.wheel(map.getCanvas(), {deltaY: wheelNotch, clientX: 111, clientY: 124});
                for (let i = 0; i < 4; i++) {
                    const before = cameraPosition(map);
                    frame();
                    moves.push(cameraMove(before, cameraPosition(map)));
                }
            }
            vi.useRealTimers();
            return moves;
        };
        const overTheCrest = await zoomOut(crest, 880);
        const centerElevation = crest(0, 0);

        const overFlatGround = await zoomOut(() => centerElevation, centerElevation);

        expect(Math.max(...overTheCrest.map((move, i) => Math.abs(move - overFlatGround[i])))).toBeLessThan(1e-5);
    });

    test('a wheel zoom whose screen center slips over a crest never speeds up more than 2.3 times from one frame to the next', async () => {
        const terrain = ridges([{y: -423.8, height: 652.7, width: 363.3}, {y: 8.26, height: 876.5, width: 301.4}, {y: -852.2, height: 382.6, width: 300.4}]);
        const {map, frame} = await createMapOverShapedTerrain({zoom: 14.6, pitch: 70, bearing: 30, maxPitch: 85, maxZoom: 18}, terrain, 0, 2020);
        const moves: number[] = [];

        for (let notch = 0; notch < 13; notch++) {
            simulate.wheel(map.getCanvas(), {deltaY: -wheelNotch, clientX: 23, clientY: 79});
            for (let i = 0; i < 4; i++) {
                const before = cameraPosition(map);
                frame();
                moves.push(cameraMove(before, cameraPosition(map)));
            }
        }
        const speedUps = moves.slice(1).map((move, i) => moves[i] > 1 ? move / moves[i] : 0);

        expect(Math.max(...speedUps)).toBeLessThan(2.3);
    });

    test('a wheel zoom around a point over terrain that falls away under the center follows it down, and its end leaves the camera where it was', async () => {
        const fallingSouthward: TerrainHeight = (_lng, lat) => 1000 + 0.2 * lat * metersPerDegree;
        const {map, frame} = await createMapOverShapedTerrain({zoom: 15, pitch: 60, maxZoom: 18}, fallingSouthward, 0, 2000);

        for (let notch = 0; notch < 6; notch++) {
            simulate.wheel(map.getCanvas(), {deltaY: -wheelNotch, clientX: 100, clientY: 170});
            for (let i = 0; i < 4; i++) frame();
        }
        for (let i = 0; i < framesOfTheWheelEasing; i++) frame();
        expect(map.isMoving()).toBe(true);
        expect(map.getCameraTargetElevation()).toBeCloseTo(fallingSouthward(map.getCenter().lng, map.getCenter().lat), 1);
        const camera = cameraPosition(map);

        for (let i = 0; i < framesUntilTheZoomEnds; i++) frame();

        expect(map.isMoving()).toBe(false);
        expect(cameraMove(camera, cameraPosition(map))).toBeLessThan(0.001);
    });

    test('a wheel zoom-in toward terrain nearer than maxZoom allows never moves the camera back', async () => {
        const blockSouthEdge = -0.06, blockNorthEdge = -0.04;
        const block: TerrainHeight = (_lng, lat) => lat > blockSouthEdge && lat < blockNorthEdge ? 500 : 0;
        const {map, frame} = await createMapOverShapedTerrain({center: [0.1758, -0.03], zoom: 12, pitch: 80, maxPitch: 85, maxZoom: 12.5}, block, 0, 500);
        const southwardMoves: number[] = [];

        simulate.wheel(map.getCanvas(), {deltaY: -wheelNotch, clientX: 100, clientY: 100});
        for (let i = 0; i < framesOfTheWheelEasing + framesUntilTheZoomEnds; i++) {
            const before = cameraPosition(map);
            frame();
            southwardMoves.push(before[1] - cameraPosition(map)[1]);
        }

        expect(map.isMoving()).toBe(false);
        expect(Math.max(...southwardMoves)).toBeLessThanOrEqual(0);
    });

    test('a wheel zoom over a rise in the terrain under the center that is not drawn yet leaves the held center elevation alone', async () => {
        const slopeRisingNorth = (rise: number): TerrainHeight => (_lng, lat) => 1000 + rise + 50000 * lat;
        const {map, frame} = await createMapOverShapedTerrain({zoom: 14, pitch: 60, maxZoom: 18}, slopeRisingNorth(0), 0, 2000);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(null);
        simulate.wheel(map.getCanvas(), {deltaY: -wheelNotch, clientX: 100, clientY: 100});
        frame();

        setTerrainHeight(map, slopeRisingNorth(500), 0, 2000);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(null);
        for (let i = 0; i < 8; i++) frame();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a wheel zoom with the center not clamped to the ground leaves the center elevation where it was', async () => {
        const {map, frame} = await createMapOverFlatTerrain({zoom: 12, pitch: 70, maxZoom: 18, centerClampedToGround: false}, 1000);

        for (let notch = 0; notch < 4; notch++) {
            simulate.wheel(map.getCanvas(), {deltaY: -4 * wheelNotch, clientX: 100, clientY: 100});
            for (let i = 0; i < 4; i++) frame();
        }

        expect(map.getCameraTargetElevation()).toBe(0);
    });

    test('an easeTo that would end with the camera inside the terrain ends with the camera and its near clipping plane above it', async () => {
        const {map, frame} = await createMapOverFlatTerrain({zoom: 13, pitch: 60}, 0);
        const cliffSouthEdge = -0.01;
        setTerrainHeight(map, (_lng, lat) => lat < cliffSouthEdge ? 5000 : 0, 0, 5000);

        map.easeTo({pitch: 70, duration: 500});
        for (let i = 0; i < 45; i++) frame();

        expect(map.getCameraTargetElevation()).toBe(0);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(5000, 0);
    });

    test('a jumpTo whose camera would be inside the terrain raises the camera and its near clipping plane above it, where the camera was', async () => {
        const {map} = await createMapOverFlatTerrain({zoom: 13, pitch: 45, maxPitch: 85}, 0);
        const cliffSouthEdge = -0.01;
        setTerrainHeight(map, (_lng, lat) => lat < cliffSouthEdge ? 3000 : 0, 0, 3000);
        const asked = map._camera.transform.clone();
        asked.setZoom(13.5);
        asked.setPitch(60);

        map.jumpTo({zoom: 13.5, pitch: 60});

        expect(map.getCameraTargetElevation()).toBe(0);
        expect(map.getZoom()).toBeCloseTo(12.7034, 4);
        expect(map.getPitch()).toBeCloseTo(29.9058, 4);
        expect(lowestNearPlaneAltitude(map)).toBeCloseTo(3000, 1);
        expect(map._camera.transform.getCameraLngLat().lat).toBeCloseTo(asked.getCameraLngLat().lat, 9);
    });

    test('a pitch drag past 90 degrees over terrain that rests before its release leaves the camera where it rested', async () => {
        const {map, frame} = await createMapOverFlatTerrain({zoom: 14, pitch: 60, maxPitch: 110}, 500);
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 190});
        for (let i = 1; i <= 40; i++) {
            simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 190 - 190 * i / 40});
            frame();
        }
        for (let i = 0; i < 10; i++) frame();
        const camera = cameraPosition(map);

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 0});
        for (let i = 0; i < 30; i++) frame();

        expect(cameraMove(camera, cameraPosition(map))).toBeLessThan(0.01);
    });

    test('a pitch drag into terrain on a globe raises the camera onto the terrain and no higher', async () => {
        const map = createMap({interactive: true, zoom: 8, pitch: 45, center: [10, 45]});
        await map.once('load');
        map.setProjection({type: 'globe'});
        map.addSource('dem', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']});
        map.setTerrain({source: 'dem'});
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLatZoom').mockReturnValue(40000);
        vi.spyOn(map.terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(() => 40000, 40000, 40000));
        map.redraw();

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 190});
        for (let i = 1; i <= 20; i++) {
            simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 190 - 9 * i});
            map._renderTaskQueue.run();
        }

        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(40000, 1);
    });

    test('a jumpTo on a globe from a zoom it draws as a globe to one it draws as mercator keeps the pitch of a camera above the terrain', async () => {
        const {map} = await createMapOverFlatTerrain({zoom: 11, pitch: 0, maxPitch: 85}, 600);
        map.setProjection({type: 'globe'});
        map.redraw();

        map.jumpTo({zoom: 14.6, pitch: 80});

        expect(map.getPitch()).toBe(80);
        expect(map.getZoom()).toBeCloseTo(14.6, 6);
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
