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
    /** Whether the configured projection is Mercator, independent of transition progress. */
    readonly isMercator: boolean;
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
        isRenderingGlobe: projectionTransition > 0,
        isMercator: projection?.name === 'mercator'
    };
}

export function getProjectionDataForTile(renderContext: RenderContext, tileID: OverscaledTileID, options: {aligned?: boolean; applyTerrainMatrix?: boolean} = {}): RendererProjectionData {
    return renderContext.transform.getProjectionData({
        overscaledTileID: tileID,
        aligned: options.aligned,
        applyGlobeMatrix: !renderContext.isRenderingToTexture,
        applyTerrainMatrix: options.applyTerrainMatrix ?? true
    });
}

/**
 * Returns terrain data for a tile.
 * Returns null if terrain is not configured or Mercator tiles are being rendered to a texture.
 */
export function getTerrainDataForTile(renderContext: RenderContext, tileID: OverscaledTileID): TerrainData | null {
    if (renderContext.isRenderingToTexture && renderContext.isMercator) return null;
    return renderContext.terrain?.getTerrainData(tileID) ?? null;
}
