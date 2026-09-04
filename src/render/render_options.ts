import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Projection} from '../geo/projection/projection.ts';
import type {Terrain} from './terrain.ts';
import type {RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthRangeType} from '../webgl/types.ts';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

/**
 * @internal
 * Shared draw state, created per render and updated as rendering proceeds.
 * Corresponds to part of MapLibre Native's `PaintParameters`.
 */
export type RenderOptions = {
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

export function createRenderOptions(transform: IReadonlyTransform, projection: Projection | undefined, terrain: Terrain | null): RenderOptions {
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

export function getProjectionDataForTile(renderOptions: RenderOptions, tileID: OverscaledTileID, options: {aligned?: boolean; applyTerrainMatrix?: boolean} = {}): RendererProjectionData {
    return renderOptions.transform.getProjectionData({
        overscaledTileID: tileID,
        aligned: options.aligned,
        applyGlobeMatrix: !renderOptions.isRenderingToTexture,
        applyTerrainMatrix: options.applyTerrainMatrix ?? true
    });
}
