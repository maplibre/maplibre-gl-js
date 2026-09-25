import {describe, test, expect, vi} from 'vitest';
import {RenderContext} from './render_context.ts';
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
        const renderContext = new RenderContext({transform, projection: new MercatorProjection(), terrain: null, context: null, programs: {}, showOverdrawInspector: false});
        const projectionDataSpy = vi.spyOn(transform, 'getProjectionData');

        const projectionData = renderContext.getProjectionDataForTile(tileID);
        renderContext.isRenderingToTexture = true;
        renderContext.getProjectionDataForTile(tileID, {aligned: true, applyTerrainMatrix: false});

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
        const renderContext = new RenderContext({transform: new MercatorTransform(), projection: new MercatorProjection(), terrain, context: null, programs: {}, showOverdrawInspector: false});

        expect(renderContext.getTerrainDataForTile(tileID)).toBe(terrainData);
        expect(getTerrainData).toHaveBeenCalledWith(tileID);
    });

    test('skips terrain data for Mercator render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const renderContext = new RenderContext({transform: new MercatorTransform(), projection: new MercatorProjection(), terrain, context: null, programs: {}, showOverdrawInspector: false});
        renderContext.isRenderingToTexture = true;

        expect(renderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });

    test('skips terrain data for globe render-to-texture draws', () => {
        const {tileID, getTerrainData, terrain} = mockTerrainData();
        const {projection, transform} = createProjectionFromName('globe', undefined, {});
        const renderContext = new RenderContext({transform, projection, terrain, context: null, programs: {}, showOverdrawInspector: false});
        renderContext.isRenderingToTexture = true;

        expect(renderContext.getTerrainDataForTile(tileID)).toBeNull();
        expect(getTerrainData).not.toHaveBeenCalled();
    });
});
