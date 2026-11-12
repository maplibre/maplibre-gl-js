import {describe, test, expect, vi} from 'vitest';
import {FrameRenderContext} from './frame_render_context.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';
import {getCameraMath} from '../geo/projection/camera_math_factory.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createFrameRenderData, createTestCamera} from '../util/test/util.ts';

import type {Terrain} from './terrain.ts';

describe('getProjectionDataForTile', () => {
    test('selects projection options for regular and terrain-texture draws', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const {projectedCamera, context} = createTestCamera({width: 512, height: 512}, {projection: 'globe'});
        const frameRenderContext = new FrameRenderContext({projectedCamera, worldCoordinateHelper: context.worldCoordinateHelper, terrain: null, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'offscreen', projection: null});

        const projectionData = frameRenderContext.getProjectionDataForTile(tileID);
        frameRenderContext.isRenderingToTexture = true;
        const textureProjectionData = frameRenderContext.getProjectionDataForTile(tileID, {aligned: true, applyTerrainMatrix: false});

        expect(projectionData).toEqual({
            ...getCameraMath(projectedCamera).getProjectionData(projectedCamera, {overscaledTileID: tileID, aligned: undefined, applyGlobeMatrix: true, applyTerrainMatrix: true}),
            uniformBufferKey: tileID.key,
        });
        expect(textureProjectionData).toEqual(getCameraMath(projectedCamera).getProjectionData(projectedCamera, {overscaledTileID: tileID, aligned: true, applyGlobeMatrix: false, applyTerrainMatrix: false}));
        expect(textureProjectionData.projectionTransition).not.toBe(projectionData.projectionTransition);
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
        const frameRenderContext = new FrameRenderContext({projectedCamera: createTestCamera().projectedCamera, worldCoordinateHelper: mercatorWorldCoordinateHelper, terrain, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'offscreen', projection: null});

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBe(terrainData);
        expect(getTerrainData).toHaveBeenCalledWith(tileID);
    });

    test('skips terrain data for Mercator render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const frameRenderContext = new FrameRenderContext({projectedCamera: createTestCamera().projectedCamera, worldCoordinateHelper: mercatorWorldCoordinateHelper, terrain, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'offscreen', projection: null});
        frameRenderContext.isRenderingToTexture = true;

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });

    test('skips terrain data for globe render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const {projectedCamera, context} = createTestCamera({}, {projection: 'globe'});
        const frameRenderContext = new FrameRenderContext({projectedCamera, worldCoordinateHelper: context.worldCoordinateHelper, terrain, data: {...createFrameRenderData(), projectionTransition: 1, isRenderingGlobe: true}, context: null, programCache: null, currentPass: 'offscreen', projection: null});
        frameRenderContext.isRenderingToTexture = true;

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });
});
