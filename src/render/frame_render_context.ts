import {Color} from '@maplibre/maplibre-gl-style-spec';
import {TileManager} from '../tile/tile_manager.ts';
import {DepthMode} from '../webgl/depth_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {shaders} from '../shaders/shaders.ts';
import {MercatorShaderDefine, MercatorShaderVariantKey} from '../geo/projection/mercator_projection.ts';

import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Terrain, TerrainData} from './terrain.ts';
import type {RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthRangeType, DepthMaskType, DepthFuncType} from '../webgl/types.ts';
import type {Context} from '../webgl/context.ts';
import type {Program} from '../webgl/program.ts';
import type {ProgramCache} from '../webgl/program_cache.ts';
import type {ProgramConfiguration} from '../data/program_configuration.ts';
import type {PreparedShader} from '../shaders/shaders.ts';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

/** The code a projection adds to every shader, and the name that tells its programs apart. */
export type ProjectionShaderVariant = {
    readonly name: string;
    readonly define: string;
    readonly prelude: PreparedShader;
};

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
    /** The projection's shader variant for this frame, undefined until the style has a projection. Globe switches it during its transition. */
    readonly projectionShaderVariant: ProjectionShaderVariant | undefined;
};

type FrameRenderContextOptions = {
    transform: IReadonlyTransform;
    terrain: Terrain | null;
    data: FrameRenderData;
    context: Context;
    programCache: ProgramCache;
    currentPass: RenderPass;
};

/** Distinct z-planes within each layer that can be drawn to, implemented with the WebGL depth buffer. */
const NUM_SUBLAYERS: number = TileManager.maxOverzooming + TileManager.maxUnderzooming + 1;

/** Depth distance between two neighboring sublayers. */
const DEPTH_EPSILON: number = 1 / Math.pow(2, 16);

/** The mercator variant, for draws that force the simple projection, like fullscreen quads. */
const MERCATOR_SHADER_VARIANT: ProjectionShaderVariant = {
    name: MercatorShaderVariantKey,
    define: MercatorShaderDefine,
    prelude: shaders.projectionMercator
};

/**
 * @internal
 * The state of one frame, created per render and updated as rendering proceeds.
 * Corresponds to part of MapLibre Native's `PaintParameters`.
 */
export class FrameRenderContext {
    currentPass: RenderPass;
    currentLayer: number = 0;
    opaquePassCutoff: number = Infinity;
    depthRangeFor3D: DepthRangeType = [0, 1];
    isRenderingToTexture: boolean = false;
    readonly transform: IReadonlyTransform;
    readonly terrain: Terrain | null;
    readonly data: FrameRenderData;
    readonly context: Context;
    readonly programCache: ProgramCache;

    constructor(options: FrameRenderContextOptions) {
        this.transform = options.transform;
        this.terrain = options.terrain;
        this.data = options.data;
        this.context = options.context;
        this.programCache = options.programCache;
        this.currentPass = options.currentPass;
    }

    getProjectionDataForTile(tileID: OverscaledTileID, options: {aligned?: boolean; applyTerrainMatrix?: boolean} = {}): RendererProjectionData {
        const projectionData = this.transform.getProjectionData({
            overscaledTileID: tileID,
            aligned: options.aligned,
            applyGlobeMatrix: !this.isRenderingToTexture,
            applyTerrainMatrix: options.applyTerrainMatrix ?? true
        });
        if (this.isRenderingToTexture) return projectionData;

        projectionData.uniformBufferKey = options.aligned ? `${tileID.key}/aligned` : tileID.key;
        return projectionData;
    }

    /**
     * Returns terrain data for a tile.
     * Returns null if terrain is not configured or tiles are being rendered to a texture.
     */
    getTerrainDataForTile(tileID: OverscaledTileID): TerrainData | null {
        if (this.isRenderingToTexture) return null;
        return this.terrain?.getTerrainData(tileID) ?? null;
    }

    /**
     * Finds the required shader and its variant (base/terrain/globe, etc.) and binds it, compiling a new shader if required.
     * @param name - Name of the desired shader.
     * @param programConfiguration - Configuration of shader's inputs.
     * @param forceSimpleProjection - Whether to force the use of a shader variant with simple mercator projection vertex shader.
     * False by default. Use true when drawing with a simple projection matrix is desired, eg. when drawing a fullscreen quad.
     * @param defines - Additional macros to be injected at the beginning of the shader. Expected format is `['#define XYZ']`, etc.
     */
    useProgram(name: string, programConfiguration?: ProgramConfiguration | null, forceSimpleProjection: boolean = false, defines: string[] = []): Program<any> {
        return this.programCache.getProgram({
            name,
            programConfiguration,
            projectionShaderVariant: forceSimpleProjection ? MERCATOR_SHADER_VARIANT : this.data.projectionShaderVariant,
            showOverdrawInspector: this.data.showOverdrawInspector,
            useTerrain: this.terrain !== null,
            defines
        });
    }

    colorModeForRenderPass(): Readonly<ColorMode> {
        const gl = this.context.gl;
        if (this.data.showOverdrawInspector) {
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;

            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        } else if (this.currentPass === 'opaque') {
            return ColorMode.unblended;
        } else {
            return ColorMode.alphaBlended;
        }
    }

    getDepthModeForSublayer(n: number, mask: DepthMaskType, func?: DepthFuncType | null): Readonly<DepthMode> {
        if (!this.opaquePassEnabledForLayer()) return DepthMode.disabled;
        const depth = 1 - ((1 + this.currentLayer) * NUM_SUBLAYERS + n) * DEPTH_EPSILON;
        return new DepthMode(func || this.context.gl.LEQUAL, mask, [depth, depth]);
    }

    getDepthModeFor3D(): Readonly<DepthMode> {
        return new DepthMode(this.context.gl.LEQUAL, DepthMode.ReadWrite, this.depthRangeFor3D);
    }

    /** Sets the depth range that 3D layers draw into, which lies below the depth values of every sublayer of the `layerCount` layers. */
    setDepthRangeFor3D(layerCount: number): void {
        this.depthRangeFor3D = [0, 1 - ((layerCount + 2) * NUM_SUBLAYERS * DEPTH_EPSILON)];
    }

    /**
     * Returns whether the current layer can be drawn in the opaque pass. The opaque pass and 3D layers both use the depth buffer,
     * so layers drawn above 3D layers use the painter's algorithm to appear above 3D features.
     */
    opaquePassEnabledForLayer(): boolean {
        return this.currentLayer < this.opaquePassCutoff;
    }
}
