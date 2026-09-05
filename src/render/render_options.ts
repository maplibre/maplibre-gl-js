import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Projection} from '../geo/projection/projection.ts';
import type {Terrain} from './terrain.ts';
import type {DepthRangeType} from '../webgl/types.ts';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

/**
 * @internal
 * Shared draw state, created per render and updated as rendering proceeds.
 * Corresponds to part of MapLibre Native's `PaintParameters`.
 */
export class RenderOptions {
    currentPass: RenderPass = 'offscreen';
    currentLayer: number = 0;
    opaquePassCutoff: number = Infinity;
    depthRangeFor3D: DepthRangeType = [0, 1];
    isRenderingToTexture: boolean = false;
    readonly transform: IReadonlyTransform;
    readonly terrain: Terrain | null;
    readonly projectionTransition: number;
    readonly isRenderingGlobe: boolean;

    constructor(transform: IReadonlyTransform, projection: Projection | undefined, terrain: Terrain | null) {
        this.transform = transform;
        this.terrain = terrain;
        this.projectionTransition = projection?.transitionState ?? 0;
        this.isRenderingGlobe = this.projectionTransition > 0;
    }
}
