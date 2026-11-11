import {describe, test, expect, vi} from 'vitest';
import {FrameRenderContext} from './frame_render_context.ts';
import {createGlobeCameraProjection, createMercatorCameraProjection} from '../geo/projection/camera_projection.ts';
import {getProjectionData} from '../geo/projection/camera_math.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createFrameRenderData, createTestCamera} from '../util/test/util.ts';

import type {Terrain} from './terrain.ts';

describe('getProjectionDataForTile', () => {
    test('selects projection options for regular and terrain-texture draws', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const cameraProjection = createGlobeCameraProjection();
        const {camera: projectedCamera} = createTestCamera({width: 512, height: 512}, cameraProjection);
        const frameRenderContext = new FrameRenderContext({projectedCamera, cameraProjection, terrain: null, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'offscreen', projection: null});

        const projectionData = frameRenderContext.getProjectionDataForTile(tileID);
        frameRenderContext.isRenderingToTexture = true;
        const textureProjectionData = frameRenderContext.getProjectionDataForTile(tileID, {aligned: true, applyTerrainMatrix: false});

        expect(projectionData).toEqual({
            ...getProjectionData(projectedCamera, {overscaledTileID: tileID, aligned: undefined, applyGlobeMatrix: true, applyTerrainMatrix: true}),
            uniformBufferKey: tileID.key,
        });
        expect(textureProjectionData).toEqual(getProjectionData(projectedCamera, {overscaledTileID: tileID, aligned: true, applyGlobeMatrix: false, applyTerrainMatrix: false}));
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
        const frameRenderContext = new FrameRenderContext({projectedCamera: createTestCamera().camera, cameraProjection: createMercatorCameraProjection(), terrain, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'offscreen', projection: null});

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBe(terrainData);
        expect(getTerrainData).toHaveBeenCalledWith(tileID);
    });

    test('skips terrain data for Mercator render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const frameRenderContext = new FrameRenderContext({projectedCamera: createTestCamera().camera, cameraProjection: createMercatorCameraProjection(), terrain, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'offscreen', projection: null});
        frameRenderContext.isRenderingToTexture = true;

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });

    test('skips terrain data for globe render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const cameraProjection = createGlobeCameraProjection();
        const frameRenderContext = new FrameRenderContext({projectedCamera: createTestCamera({}, cameraProjection).camera, cameraProjection, terrain, data: {...createFrameRenderData(), projectionTransition: 1, isRenderingGlobe: true}, context: null, programCache: null, currentPass: 'offscreen', projection: null});
        frameRenderContext.isRenderingToTexture = true;

        expect(frameRenderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });
});
