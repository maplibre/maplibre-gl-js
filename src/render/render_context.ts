import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Projection} from '../geo/projection/projection.ts';
import type {Terrain, TerrainData} from './terrain.ts';
import type {RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthRangeType} from '../webgl/types.ts';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

/**
 * @internal
 * Shared draw state, created per render and updated as rendering proceeds.
 * Corresponds to part of MapLibre Native's `PaintParameters`.
 */
export type RenderContext = {
    currentPass: RenderPass;
    currentLayer: number;
    opaquePassCutoff: number;
    depthRangeFor3D: DepthRangeType;
    isRenderingToTexture: boolean;
    readonly transform: IReadonlyTransform;
    readonly terrain: Terrain | null;
    readonly projectionTransition: number;
    readonly isRenderingGlobe: boolean;
};

export function createRenderContext(transform: IReadonlyTransform, projection: Projection | undefined, terrain: Terrain | null): RenderContext {
    const projectionTransition = projection?.transitionState ?? 0;
    return {
        currentPass: 'offscreen',
        currentLayer: 0,
        opaquePassCutoff: Infinity,
        depthRangeFor3D: [0, 1],
        isRenderingToTexture: false,
        transform,
        terrain,
        projectionTransition,
        isRenderingGlobe: projectionTransition > 0
    };
}

export function getProjectionDataForTile(renderContext: RenderContext, tileID: OverscaledTileID, options: {aligned?: boolean; applyTerrainMatrix?: boolean} = {}): RendererProjectionData {
    const projectionData = renderContext.transform.getProjectionData({
        overscaledTileID: tileID,
        aligned: options.aligned,
        applyGlobeMatrix: !renderContext.isRenderingToTexture,
        applyTerrainMatrix: options.applyTerrainMatrix ?? true
    });
    if (renderContext.isRenderingToTexture) return projectionData;

    projectionData.uniformBufferKey = options.aligned ? `${tileID.key}/aligned` : tileID.key;
    return projectionData;
}

/**
 * Returns terrain data for a tile.
 * Returns null if terrain is not configured or tiles are being rendered to a texture.
 */
export function getTerrainDataForTile(renderContext: RenderContext, tileID: OverscaledTileID): TerrainData | null {
    if (renderContext.isRenderingToTexture) return null;
    return renderContext.terrain?.getTerrainData(tileID) ?? null;
}
