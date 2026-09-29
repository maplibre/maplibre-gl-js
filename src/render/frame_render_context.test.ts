import {describe, test, expect, vi} from 'vitest';
import {FrameRenderContext} from './frame_render_context.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {createProjectionFromName} from '../geo/projection/projection_factory.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createFrameRenderData} from '../util/test/util.ts';

import type {Terrain} from './terrain.ts';

describe('getProjectionDataForTile', () => {
    test('selects projection options for regular and terrain-texture draws', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(512, 512);
        const frameRenderContext = new FrameRenderContext({transform, terrain: null, data: createFrameRenderData(), context: null, programCache: null});
        const projectionDataSpy = vi.spyOn(transform, 'getProjectionData');

        const projectionData = frameRenderContext.getProjectionDataForTile(tileID);
        frameRenderContext.isRenderingToTexture = true;
        frameRenderContext.getProjectionDataForTile(tileID, {aligned: true, applyTerrainMatrix: false});

        expect(projectionData).toEqual(projectionDataSpy.mock.results[0].value);
        expect(projectionDataSpy).toHaveBeenCalledTimes(2);
        expect(projectionDataSpy).toHaveBeenNthCalledWith(1, {overscaledTileID: tileID, aligned: undefined, applyGlobeMatrix: true, applyTerrainMatrix: true});
        expect(projectionDataSpy).toHaveBeenNthCalledWith(2, {overscaledTileID: tileID, aligned: true, applyGlobeMatrix: false, applyTerrainMatrix: false});
    });
});

describe('getTerrainDataForTile', () => {
    function mockTerrainData() {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrainData = {tile: null};
        const getTerrainData = vi.fn(() => terrainData);
        const terrain = {getTerrainData} as unknown as Terrain;

        return {tileID, terrainData, getTerrainData, terrain};
    }

    test('uses terrain data for regular Mercator draws', () => {
        const {tileID, terrainData, getTerrainData, terrain} = mockTerrainData();
        const frameRenderContext = new FrameRenderContext({transform: new MercatorTransform(), terrain, data: createFrameRenderData(), context: null, programCache: null});

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBe(terrainData);
        expect(getTerrainData).toHaveBeenCalledWith(tileID);
    });

    test('skips terrain data for Mercator render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const frameRenderContext = new FrameRenderContext({transform: new MercatorTransform(), terrain, data: createFrameRenderData(), context: null, programCache: null});
        frameRenderContext.isRenderingToTexture = true;

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });

    test('skips terrain data for globe render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const {transform} = createProjectionFromName('globe', undefined, {});
        const frameRenderContext = new FrameRenderContext({transform, terrain, data: {...createFrameRenderData(), projectionTransition: 1, isRenderingGlobe: true}, context: null, programCache: null});
        frameRenderContext.isRenderingToTexture = true;

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });
});
