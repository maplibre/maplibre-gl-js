import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, waitForEvent, createTerrain, createDEM, waitForMetadataEvent} from '../../util/test/util.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';
import {LngLat} from '../../geo/lng_lat.ts';
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
import type {RasterDEMTileSource} from '../../source/raster_dem_tile_source.ts';
import type {Tile} from '../../tile/tile.ts';

type WaitingDem = {
    land: (elevation: number) => Promise<void>;
    landAwayFrom: (elevation: number, lngLat: LngLat) => Promise<void>;
    landAtZoom: (elevation: number, zoom: number) => Promise<void>;
};

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

    async function addWaitingDemSource(map: Map, id: string): Promise<WaitingDem> {
        map.addSource(id, {type: 'raster-dem', tiles: [`http://example.com/${id}/{z}/{x}/{y}.png`]});
        const source = map.getSource<RasterDEMTileSource>(id);
        await waitForMetadataEvent(source);
        let waiting: Array<{tile: Tile; load: (elevation: number) => void}> = [];
        vi.spyOn(source, 'loadTile').mockImplementation(tile => new Promise(resolve => {
            waiting.push({tile, load: elevation => {
                tile.dem = createDEM(() => elevation);
                tile.state = 'loaded';
                resolve();
            }});
        }));
        const landTiles = (elevation: number, lands: (tile: Tile) => boolean) => new Promise<void>(landed => {
            const loads = waiting.filter(({tile}) => !tile.aborted && lands(tile));
            waiting = waiting.filter(entry => !loads.includes(entry));
            let remaining = loads.length;
            if (remaining === 0) return landed();
            const onData = (e: MapSourceDataEvent) => {
                if (e.tile && --remaining === 0) {
                    source.off('data', onData);
                    landed();
                }
            };
            source.on('data', onData);
            for (const {load} of loads) load(elevation);
        });
        const covers = (tile: Tile, lngLat: LngLat) => {
            const {x, y} = MercatorCoordinate.fromLngLat(lngLat);
            const {z, x: tileX, y: tileY} = tile.tileID.canonical;
            return Math.floor(x * (1 << z)) === tileX && Math.floor(y * (1 << z)) === tileY;
        };
        return {
            land: elevation => landTiles(elevation, () => true),
            landAwayFrom: (elevation, lngLat) => landTiles(elevation, tile => !covers(tile, lngLat)),
            landAtZoom: (elevation, zoom) => landTiles(elevation, tile => tile.tileID.canonical.z === zoom)
        };
    }

    async function createMapWithWaitingDem(options: Partial<MapOptions>): Promise<{map: Map} & WaitingDem> {
        const map = createMap({interactive: true, ...options});
        await map.once('load');
        return {map, ...await addWaitingDemSource(map, 'dem')};
    }

    function startPitchDragThatSwitchesTerrainOn(map: Map): void {
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 130});
        map._renderTaskQueue.run();
        map.setTerrain({source: 'dem'});
        map.redraw();
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();
    }

    function startPitchDrag(map: Map): void {
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 130});
        map._renderTaskQueue.run();
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('a pitch drag that switches terrain on takes the DEM elevation when it lands while the pointer rests, and releases where it is', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});

        startPitchDragThatSwitchesTerrainOn(map);
        await land(1000);
        expect(map.getCameraTargetElevation()).toBe(1000);

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();
        expect(map.getZoom()).toBeCloseTo(17, 6);
    });

    test('a pitch drag that switches terrain on does not take the elevation of a coarser DEM tile lower than the camera while the tile under the center loads', async () => {
        const {map, landAtZoom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const zoomOfACoarserDemTile = 5;
        startPitchDragThatSwitchesTerrainOn(map);
        await landAtZoom(100, zoomOfACoarserDemTile);

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(0);
    });

    test('a pitch drag that switches terrain on does not lower the center elevation to a coarser DEM tile below it while the camera is inside the terrain', async () => {
        const {map, landAtZoom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const zoomOfDemTilesNotDrawn = 16;
        const zoomOfACoarserDemTile = 5;
        startPitchDragThatSwitchesTerrainOn(map);
        await landAtZoom(1000, zoomOfDemTilesNotDrawn);
        await landAtZoom(-400, zoomOfACoarserDemTile);

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(0);
    });

    test('a pitch drag that switches terrain on takes the elevation of a coarser DEM tile higher than the camera when it lands while the pointer rests', async () => {
        const {map, landAtZoom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const zoomOfACoarserDemTile = 5;
        startPitchDragThatSwitchesTerrainOn(map);

        await landAtZoom(1000, zoomOfACoarserDemTile);

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a pitch drag that switches terrain on keeps its zoom when it ends over a coarser DEM tile higher than the camera before the tile under the center loads', async () => {
        const {map, landAtZoom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const zoomOfACoarserDemTile = 5;
        startPitchDragThatSwitchesTerrainOn(map);
        await landAtZoom(1000, zoomOfACoarserDemTile);

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();

        expect(map.getZoom()).toBeCloseTo(17, 6);
    });

    test('a pitch drag that switches terrain on takes the DEM elevation of the tile under the center when it lands after a coarser tile higher than the camera', async () => {
        const {map, landAtZoom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const zoomOfACoarserDemTile = 5;
        const zoomOfTheDrawnDemTiles = 15;
        startPitchDragThatSwitchesTerrainOn(map);
        await landAtZoom(1000, zoomOfACoarserDemTile);
        await landAtZoom(500, zoomOfTheDrawnDemTiles);

        expect(map.getCameraTargetElevation()).toBe(500);
    });

    test('a drag that switches terrain on takes the DEM elevation once the center moves over a tile that has landed, and holds it when the last tile lands lower', async () => {
        const {map, land, landAwayFrom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 100, clientY: 100});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 105, clientY: 105});
        map._renderTaskQueue.run();
        map.setTerrain({source: 'dem'});
        map.redraw();
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 110, clientY: 110});
        map._renderTaskQueue.run();
        await landAwayFrom(1000, map.getCenter());

        simulate.mousemove(window.document.body, {buttons: 1, clientX: 40, clientY: 40});
        map._renderTaskQueue.run();
        expect(map.getCameraTargetElevation()).toBe(1000);

        await land(500);
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 150, clientY: 150});
        map._renderTaskQueue.run();
        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a drag over terrain that starts before its DEM lands keeps the ground under the pointer once the DEM lands', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        map.setTerrain({source: 'dem'});
        map.redraw();
        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 60, clientY: 100});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 70, clientY: 100});
        map._renderTaskQueue.run();
        await land(1000);
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 80, clientY: 100});
        map._renderTaskQueue.run();
        const groundUnderThePointer = map.unproject([80, 100]);

        simulate.mousemove(window.document.body, {buttons: 1, clientX: 90, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.project(groundUnderThePointer).x).toBeCloseTo(90, 0);
    });

    test('a drag over terrain that starts before its DEM lands keeps the ground under the pointer once the DEM lands below sea level', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 14, pitch: 0});
        map.setTerrain({source: 'dem'});
        map.redraw();
        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 60, clientY: 100});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 70, clientY: 100});
        map._renderTaskQueue.run();
        await land(-400);
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 80, clientY: 100});
        map._renderTaskQueue.run();
        const groundUnderThePointer = map.unproject([80, 100]);

        simulate.mousemove(window.document.body, {buttons: 1, clientX: 90, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.project(groundUnderThePointer).x).toBeCloseTo(90, 0);
    });

    test('a pitch drag that switches terrain on and ends before the DEM lands takes it during its inertia', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        const frameAt = (time: number) => {
            now.mockReturnValue(time);
            map._renderTaskQueue.run();
        };

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 100, clientY: 150});
        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 145});
        frameAt(16);
        map.setTerrain({source: 'dem'});
        map.redraw();
        for (let move = 1; move <= 10; move++) {
            simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 145 - 5 * move});
            frameAt(16 + 16 * move);
        }
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 95});
        frameAt(192);
        await land(1000);
        frameAt(256);

        expect(map.isMoving()).toBe(true);
        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a flyTo with freezeElevation takes the DEM elevation once it lands under the center', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 30});
        map.setTerrain({source: 'dem'});
        map.redraw();
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);

        map.flyTo({center: [0.001, 0], duration: 1000, freezeElevation: true, easing: k => k});
        await land(1000);
        now.mockReturnValue(500);
        map.redraw();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a drag that starts before the DEM lands keeps its zoom when it ends over a tile whose DEM has not landed', async () => {
        const {map, landAwayFrom} = await createMapWithWaitingDem({zoom: 17, pitch: 0, center: [0.0005, -0.0001]});
        map.setTerrain({source: 'dem'});
        map.redraw();
        const whereTheDragEnds = new LngLat(0.0005, 0.0003);
        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 100, clientY: 60});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 100, clientY: 64});
        map._renderTaskQueue.run();
        await landAwayFrom(50, whereTheDragEnds);
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 100, clientY: 125});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 0, clientX: 100, clientY: 125});
        map._renderTaskQueue.run();

        expect(map.getZoom()).toBeCloseTo(17, 6);
    });

    test('an easeTo with freezeElevation that takes the DEM keeps the camera out of the terrain when it ends over a tile whose DEM has not landed', async () => {
        const {map, landAwayFrom} = await createMapWithWaitingDem({zoom: 17, pitch: 30, center: [0.0005, -0.0012]});
        map.setTerrain({source: 'dem'});
        map.redraw();
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.easeTo({center: [0.0005, 0.0005], duration: 1000, freezeElevation: true, easing: k => k});
        now.mockReturnValue(100);
        map.redraw();
        await landAwayFrom(1000, new LngLat(0.0005, 0.0005));
        now.mockReturnValue(200);
        map.redraw();

        now.mockReturnValue(1000);
        map.redraw();

        expect(map._camera.transform.getCameraAltitude()).toBeCloseTo(1000, 0);
    });

    test('a pitch drag with the center not clamped to the ground keeps the center elevation when the terrain switches off before it ends', async () => {
        const {map} = await createMapWithWaitingDem({zoom: 17, pitch: 0, centerClampedToGround: false});
        map.setTerrain({source: 'dem'});
        map.redraw();
        map.setCenterElevation(3000);
        startPitchDrag(map);
        map.setTerrain(null);
        map.redraw();

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(3000);
    });

    test('an easeTo after an easeTo with freezeElevation that ended with the terrain switched off does not jump to the DEM elevation when it lands', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.setTerrain({source: 'dem'});
        map.redraw();
        map.easeTo({center: [0.0001, 0], duration: 1000, freezeElevation: true, easing: k => k});
        map.setTerrain(null);
        now.mockReturnValue(1000);
        map.redraw();
        map.setTerrain({source: 'dem'});
        map.redraw();

        map.easeTo({center: [0.001, 0], duration: 1000, easing: k => k});
        await land(100);
        now.mockReturnValue(1100);
        map.redraw();

        expect(map.getCameraTargetElevation()).toBe(0);
    });

    test('a pitch drag over loaded terrain keeps the center elevation when the terrain switches off and on and its DEM lands lower', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        map.setTerrain({source: 'dem'});
        map.redraw();
        await land(1000);
        map.redraw();
        startPitchDrag(map);
        map.setTerrain(null);
        map.redraw();
        map.setTerrain({source: 'dem'});
        map.redraw();
        await land(500);

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a pitch drag that switches terrain on takes the DEM elevation of another DEM source the terrain switches to when it lands', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const otherDem = await addWaitingDemSource(map, 'otherDem');
        startPitchDragThatSwitchesTerrainOn(map);
        await land(1000);
        map.setTerrain({source: 'otherDem'});
        map.redraw();

        await otherDem.land(500);

        expect(map.getCameraTargetElevation()).toBe(500);
    });

    test('a pitch drag that switches terrain on keeps its zoom when the field of view changes and the terrain switches to another DEM source after the DEM landed', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        await addWaitingDemSource(map, 'otherDem');
        startPitchDragThatSwitchesTerrainOn(map);
        await land(1000);
        map.setVerticalFieldOfView(40);
        map.setTerrain({source: 'otherDem'});

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();

        expect(map.getZoom()).toBeCloseTo(17, 6);
    });

    test('a pitch drag that switches terrain on keeps the elevation it took when the terrain switches off and on while a hillshade layer keeps its DEM loaded', async () => {
        const {map, land, landAtZoom} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const zoomOfDemTilesNotDrawn = 16;
        map.addLayer({id: 'hillshade', type: 'hillshade', source: 'dem'});
        startPitchDragThatSwitchesTerrainOn(map);
        await landAtZoom(1010, zoomOfDemTilesNotDrawn);
        await land(1000);
        map.setTerrain(null);
        map.redraw();
        map.setTerrain({source: 'dem'});

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a pitch drag that switches terrain on keeps the elevation it took when the terrain exaggeration changes', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        startPitchDragThatSwitchesTerrainOn(map);
        await land(1000);
        map.setTerrain({source: 'dem', exaggeration: 2});
        map.redraw();

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('a pitch drag that switches terrain on keeps the elevation it took once the center is not clamped to the ground when the terrain switches off and on', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        startPitchDragThatSwitchesTerrainOn(map);
        await land(1000);
        map.setCenterClampedToGround(false);
        map.setTerrain(null);
        map.redraw();
        map.setTerrain({source: 'dem'});

        simulate.mousemove(window.document.body, {buttons: 2, clientX: 100, clientY: 100});
        map._renderTaskQueue.run();

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('an easeTo after a pitch drag that switches terrain on does not jump to the DEM elevation when the terrain switches off and on during it and the DEM lands', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 17, pitch: 0});
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        startPitchDragThatSwitchesTerrainOn(map);
        await land(1000);
        now.mockReturnValue(1000);
        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2, clientX: 100, clientY: 110});
        map._renderTaskQueue.run();
        map.easeTo({center: [0.001, 0.001], duration: 1000, easing: k => k});
        map.setTerrain(null);
        map.redraw();
        map.setTerrain({source: 'dem'});
        map.redraw();

        await land(500);

        expect(map.getCameraTargetElevation()).toBe(1000);
    });

    test('an easeTo with freezeElevation that starts before the DEM lands ends at its zoom when the style reloads with the same terrain source after the DEM landed', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 15, pitch: 40});
        map.setTerrain({source: 'dem'});
        map.redraw();
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.easeTo({center: [0.002, 0.001], zoom: 16, pitch: 50, duration: 1000, freezeElevation: true, easing: k => k});
        now.mockReturnValue(200);
        map.redraw();
        await land(1000);
        map.setStyle({version: 8, sources: {dem: {type: 'raster-dem', tiles: ['http://example.com/dem/{z}/{x}/{y}.png']}}, layers: [], terrain: {source: 'dem'}}, {diff: false});
        await map.once('style.load');

        now.mockReturnValue(1000);
        map.redraw();

        expect(map.getZoom()).toBeCloseTo(16, 6);
    });

    test('an easeTo with freezeElevation that starts before the DEM lands takes the DEM elevation of another DEM source the terrain switches to after a field of view change', async () => {
        const {map, land} = await createMapWithWaitingDem({zoom: 15, pitch: 40});
        const otherDem = await addWaitingDemSource(map, 'otherDem');
        map.setTerrain({source: 'dem'});
        map.redraw();
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        map.easeTo({center: [0.002, 0.001], zoom: 16, pitch: 50, duration: 1000, freezeElevation: true, easing: k => k});
        now.mockReturnValue(200);
        map.redraw();
        await land(1000);
        map.setVerticalFieldOfView(40);
        map.setTerrain({source: 'otherDem'});
        map.redraw();
        await otherDem.land(500);

        now.mockReturnValue(300);
        map.redraw();

        expect(map.getCameraTargetElevation()).toBe(500);
    });

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

    test('easeTo leaves the center elevation alone when the center is not clamped to the ground', async () => {
        const map = await createMapOverTerrain(60);
        map.setCenterClampedToGround(false);
        map.setCenterElevation(1500);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(1000);

        map.easeTo({center: [1, 1], duration: 1000});
        now.mockReturnValue(1000);
        map.redraw();

        expect(map.getCenterElevation()).toBe(1500);
    });

    test('flyTo leaves the center elevation alone when the center is not clamped to the ground', async () => {
        const map = await createMapOverTerrain(60);
        map.setCenterClampedToGround(false);
        map.setCenterElevation(1500);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(1000);

        map.flyTo({center: [1, 1], duration: 1000});
        now.mockReturnValue(1000);
        map.redraw();

        expect(map.getCenterElevation()).toBe(1500);
    });

    test('jumpTo leaves the center elevation alone when the center is not clamped to the ground', async () => {
        const map = await createMapOverTerrain(60);
        map.setCenterClampedToGround(false);
        map.setCenterElevation(1500);
        vi.spyOn(map.terrain, 'getElevationForLngLat').mockReturnValue(1000);

        map.jumpTo({center: [1, 1]});

        expect(map.getCenterElevation()).toBe(1500);
    });

    test('a DEM minimum below sea level does not keep the map rendering when the center is not clamped to the ground', async () => {
        const map = await createMapOverTerrain(60);
        map.setCenterClampedToGround(false);
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        vi.spyOn(map.terrain, 'getMinTileElevationForLngLatZoom').mockReturnValue(-455.5);
        const frameLength = 16;
        const settleFrames = 110;
        const watchedFrames = 20;
        for (let frame = 0; frame < settleFrames; frame++) {
            now.mockReturnValue(frame * frameLength);
            map.redraw();
        }
        const repaint = vi.spyOn(map, 'triggerRepaint');

        for (let frame = settleFrames; frame < settleFrames + watchedFrames; frame++) {
            now.mockReturnValue(frame * frameLength);
            map.redraw();
        }

        expect(repaint).not.toHaveBeenCalled();
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
