import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Terrain, TerrainData} from './terrain.ts';
import type {RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthRangeType} from '../webgl/types.ts';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

/** Plain values that describe one frame. The map builds them once per frame. */
export type FrameRenderData = {
    readonly showOverdrawInspector: boolean;
    readonly showTileBoundaries: boolean;
    readonly showPadding: boolean;
    readonly rotating: boolean;
    readonly zooming: boolean;
    readonly moving: boolean;
    readonly fadeDuration: number;
    /** Progress of the symbol fade since the last placement. */
    readonly symbolFadeChange: number;
    readonly anisotropicFilterPitch: number;
    readonly projectionTransition: number;
    readonly isRenderingGlobe: boolean;
};

/**
 * @internal
 * Shared draw state, created per render and updated as rendering proceeds.
 * Corresponds to part of MapLibre Native's `PaintParameters`.
 */
export type FrameRenderContext = {
    currentPass: RenderPass;
    currentLayer: number;
    opaquePassCutoff: number;
    depthRangeFor3D: DepthRangeType;
    isRenderingToTexture: boolean;
    readonly transform: IReadonlyTransform;
    readonly terrain: Terrain | null;
    readonly data: FrameRenderData;
};

export function createFrameRenderContext(transform: IReadonlyTransform, terrain: Terrain | null, data: FrameRenderData): FrameRenderContext {
    return {
        currentPass: 'offscreen',
        currentLayer: 0,
        opaquePassCutoff: Infinity,
        depthRangeFor3D: [0, 1],
        isRenderingToTexture: false,
        transform,
        terrain,
        data
    };
}

export function getProjectionDataForTile(frameRenderContext: FrameRenderContext, tileID: OverscaledTileID, options: {aligned?: boolean; applyTerrainMatrix?: boolean} = {}): RendererProjectionData {
    const projectionData = frameRenderContext.transform.getProjectionData({
        overscaledTileID: tileID,
        aligned: options.aligned,
        applyGlobeMatrix: !frameRenderContext.isRenderingToTexture,
        applyTerrainMatrix: options.applyTerrainMatrix ?? true
    });
    if (frameRenderContext.isRenderingToTexture) return projectionData;

    projectionData.uniformBufferKey = options.aligned ? `${tileID.key}/aligned` : tileID.key;
    return projectionData;
}

/**
 * Returns terrain data for a tile.
 * Returns null if terrain is not configured or tiles are being rendered to a texture.
 */
export function getTerrainDataForTile(frameRenderContext: FrameRenderContext, tileID: OverscaledTileID): TerrainData | null {
    if (frameRenderContext.isRenderingToTexture) return null;
    return frameRenderContext.terrain?.getTerrainData(tileID) ?? null;
}
