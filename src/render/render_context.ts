import {Color} from '@maplibre/maplibre-gl-style-spec';
import {TileManager} from '../tile/tile_manager.ts';
import {DepthMode} from '../webgl/depth_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {Program} from '../webgl/program.ts';
import {programUniforms} from '../webgl/program/program_uniforms.ts';
import {shaders} from '../shaders/shaders.ts';
import {MercatorShaderDefine, MercatorShaderVariantKey} from '../geo/projection/mercator_projection.ts';

import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Projection} from '../geo/projection/projection.ts';
import type {Terrain, TerrainData} from './terrain.ts';
import type {RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthRangeType, DepthMaskType, DepthFuncType} from '../webgl/types.ts';
import type {Context} from '../webgl/context.ts';
import type {ProgramConfiguration} from '../data/program_configuration.ts';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

type RenderContextOptions = {
    transform: IReadonlyTransform;
    projection: Projection | undefined;
    terrain: Terrain | null;
    context: Context;
    programs: Record<string, Program<any>>;
    showOverdrawInspector: boolean;
};

/** Distinct z-planes within each layer that can be drawn to, implemented with the WebGL depth buffer. */
export const NUM_SUBLAYERS: number = TileManager.maxOverzooming + TileManager.maxUnderzooming + 1;

/** Depth distance between two neighboring sublayers. */
export const DEPTH_EPSILON: number = 1 / Math.pow(2, 16);

/**
 * @internal
 * Shared draw state, created per render and updated as rendering proceeds.
 * Corresponds to part of MapLibre Native's `PaintParameters`.
 */
export class RenderContext {
    currentPass: RenderPass = 'offscreen';
    currentLayer: number = 0;
    opaquePassCutoff: number = Infinity;
    depthRangeFor3D: DepthRangeType = [0, 1];
    isRenderingToTexture: boolean = false;
    readonly transform: IReadonlyTransform;
    readonly projection: Projection | undefined;
    readonly terrain: Terrain | null;
    readonly context: Context;
    readonly programs: Record<string, Program<any>>;
    readonly showOverdrawInspector: boolean;
    readonly projectionTransition: number;
    readonly isRenderingGlobe: boolean;

    constructor(options: RenderContextOptions) {
        this.transform = options.transform;
        this.projection = options.projection;
        this.terrain = options.terrain;
        this.context = options.context;
        this.programs = options.programs;
        this.showOverdrawInspector = options.showOverdrawInspector;
        this.projectionTransition = options.projection?.transitionState ?? 0;
        this.isRenderingGlobe = this.projectionTransition > 0;
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
     * @param defines - Additional macros to be injected at the beginning of the shader. Expected format is `['#define XYZ']`, etc.
     * False by default. Use true when drawing with a simple projection matrix is desired, eg. when drawing a fullscreen quad.
     * @returns
     */
    useProgram(name: string, programConfiguration?: ProgramConfiguration | null, forceSimpleProjection: boolean = false, defines: string[] = []): Program<any> {
        const useTerrain = this.terrain !== null;

        const projectionPrelude = forceSimpleProjection ? shaders.projectionMercator : this.projection.shaderPreludeCode;
        const projectionDefine = forceSimpleProjection ? MercatorShaderDefine : this.projection.shaderDefine;
        const projectionKey = `/${forceSimpleProjection ? MercatorShaderVariantKey : this.projection.shaderVariantName}`;

        const configurationKey = (programConfiguration ? programConfiguration.cacheKey : '');
        const overdrawKey = (this.showOverdrawInspector ? '/overdraw' : '');
        const terrainKey = (useTerrain ? '/terrain' : '');
        const definesKey = (defines ? `/${defines.join('/')}` : '');

        const key = name + configurationKey + projectionKey + overdrawKey + terrainKey + definesKey;

        this.programs[key] ||= new Program(
            this.context,
            shaders[name],
            programConfiguration,
            programUniforms[name],
            this.showOverdrawInspector,
            useTerrain,
            projectionPrelude,
            projectionDefine,
            defines
        );
        return this.programs[key];
    }

    colorModeForRenderPass(): Readonly<ColorMode> {
        const gl = this.context.gl;
        if (this.showOverdrawInspector) {
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

    /*
     * The opaque pass and 3D layers both use the depth buffer.
     * Layers drawn above 3D layers need to be drawn using the
     * painter's algorithm so that they appear above 3D features.
     * This returns true for layers that can be drawn using the
     * opaque pass.
     */
    opaquePassEnabledForLayer(): boolean {
        return this.currentLayer < this.opaquePassCutoff;
    }
}
