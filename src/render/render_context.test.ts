import {describe, test, expect, vi} from 'vitest';
import {createRenderContext, getProjectionDataForTile, getTerrainDataForTile} from './render_context.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {MercatorProjection} from '../geo/projection/mercator_projection.ts';
import {createProjectionFromName} from '../geo/projection/projection_factory.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';

import type {Terrain} from './terrain.ts';

describe('getProjectionDataForTile', () => {
    test('selects projection options for regular and terrain-texture draws', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(512, 512);
        const renderContext = createRenderContext(transform, new MercatorProjection(), null);
        const projectionDataSpy = vi.spyOn(transform, 'getProjectionData');

        const projectionData = getProjectionDataForTile(renderContext, tileID);
        renderContext.isRenderingToTexture = true;
        getProjectionDataForTile(renderContext, tileID, {aligned: true, applyTerrainMatrix: false});

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
        const renderContext = createRenderContext(new MercatorTransform(), new MercatorProjection(), terrain);

        expect(getTerrainDataForTile(renderContext, tileID)).toBe(terrainData);
        expect(getTerrainData).toHaveBeenCalledWith(tileID);
    });

    test('skips terrain data for Mercator render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const renderContext = createRenderContext(new MercatorTransform(), new MercatorProjection(), terrain);
        renderContext.isRenderingToTexture = true;

        expect(getTerrainDataForTile(renderContext, tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });

    test('skips terrain data for globe render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const {projection, transform} = createProjectionFromName('globe', undefined, {});
        const renderContext = createRenderContext(transform, projection, terrain);
        renderContext.isRenderingToTexture = true;

        expect(getTerrainDataForTile(renderContext, tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });
});
