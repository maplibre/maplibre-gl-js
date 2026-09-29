import {Color} from '@maplibre/maplibre-gl-style-spec';
import {TileManager} from '../tile/tile_manager.ts';
import {DepthMode} from '../webgl/depth_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {StencilMode} from '../webgl/stencil_mode.ts';
import {CullFaceMode} from '../webgl/cull_face_mode.ts';
import {shaders} from '../shaders/shaders.ts';
import {MercatorShaderDefine, MercatorShaderVariantKey} from '../geo/projection/mercator_projection.ts';

import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Terrain, TerrainData} from './terrain.ts';
import type {RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {CanonicalTileID, OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthRangeType, DepthMaskType, DepthFuncType} from '../webgl/types.ts';
import type {Context} from '../webgl/context.ts';
import type {Program} from '../webgl/program.ts';
import type {ProgramCache} from '../webgl/program_cache.ts';
import type {ProgramConfiguration} from '../data/program_configuration.ts';
import type {PreparedShader} from '../shaders/shaders.ts';
import type {Mesh} from './mesh.ts';
import type {StyleLayer} from '../style/style_layer.ts';

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
    /** Whether the projection subdivides tile meshes this frame. */
    readonly useSubdivision: boolean;
};

type FrameRenderContextOptions = {
    transform: IReadonlyTransform;
    terrain: Terrain | null;
    data: FrameRenderData;
    context: Context;
    programCache: ProgramCache;
    currentPass: RenderPass;
    /** Returns the mesh a tile's clipping mask is drawn with. */
    getStencilMesh: (tileID: CanonicalTileID, hasBorder: boolean) => Mesh;
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
    /** The source whose clipping masks are in the stencil buffer. */
    private currentStencilSource: string;
    private nextStencilID: number = 1;
    private tileClippingMaskIDs: Record<string, number> = {};
    private readonly getStencilMesh: (tileID: CanonicalTileID, hasBorder: boolean) => Mesh;

    constructor(options: FrameRenderContextOptions) {
        this.transform = options.transform;
        this.terrain = options.terrain;
        this.data = options.data;
        this.context = options.context;
        this.programCache = options.programCache;
        this.currentPass = options.currentPass;
        this.getStencilMesh = options.getStencilMesh;
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

    /**
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil(): void {
        this.nextStencilID = 1;
        this.currentStencilSource = undefined;
        this.context.clear({stencil: 0});
    }

    /** Makes the next tile-clipped layer draw its clipping masks again. */
    invalidateTileClippingMasks(): void {
        this.currentStencilSource = undefined;
    }

    /** Draws the clipping masks of a layer's tiles into the stencil buffer, unless its source's masks are already there. */
    renderTileClippingMasks(layer: StyleLayer, tileIDs: OverscaledTileID[]): void {
        if (this.currentStencilSource === layer.source || !layer.isTileClipped() || !tileIDs?.length) {
            return;
        }

        this.currentStencilSource = layer.source;

        if (this.nextStencilID + tileIDs.length > 256) {
            this.clearStencil();
        }

        const context = this.context;
        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);

        const stencilRefs: Record<string, number> = {};
        for (const tileID of tileIDs) {
            stencilRefs[tileID.key] = this.nextStencilID++;
        }

        if (this.data.useSubdivision) {
            this.renderTileMasks(stencilRefs, tileIDs, true);
        }
        this.renderTileMasks(stencilRefs, tileIDs, false);

        this.tileClippingMaskIDs = stencilRefs;
    }

    private renderTileMasks(tileStencilRefs: Record<string, number>, tileIDs: OverscaledTileID[], useBorders: boolean): void {
        const context = this.context;
        const gl = context.gl;
        const program = this.useProgram('clippingMask');

        for (const tileID of tileIDs) {
            const stencilRef = tileStencilRefs[tileID.key];
            const terrainData = this.getTerrainDataForTile(tileID);
            const mesh = this.getStencilMesh(tileID.canonical, useBorders);
            const projectionData = this.getProjectionDataForTile(tileID);

            program.draw(context, gl.TRIANGLES, DepthMode.disabled,
                new StencilMode({func: gl.ALWAYS, mask: 0}, stencilRef, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE),
                ColorMode.disabled, this.isRenderingToTexture ? CullFaceMode.disabled : CullFaceMode.backCCW, null,
                terrainData, projectionData, '$clipping', mesh.vertexBuffer,
                mesh.indexBuffer, mesh.segments);
        }
    }

    /** Returns a stencil mode that draws each pixel of a 3D layer only once. */
    stencilModeFor3D(): StencilMode {
        this.currentStencilSource = undefined;

        if (this.nextStencilID + 1 > 256) {
            this.clearStencil();
        }

        const id = this.nextStencilID++;
        const gl = this.context.gl;
        return new StencilMode({func: gl.NOTEQUAL, mask: 0xFF}, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    stencilModeForClipping(tileID: OverscaledTileID): StencilMode {
        const gl = this.context.gl;
        return new StencilMode({func: gl.EQUAL, mask: 0xFF}, this.tileClippingMaskIDs[tileID.key], 0x00, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    /**
     * Sort coordinates by Z as drawing tiles is done in Z-descending order.
     * All children with the same Z write the same stencil value.  Children
     * stencil values are greater than parent's.  This is used only for raster
     * and raster-dem tiles, which are already clipped to tile boundaries, to
     * mask area of tile overlapped by children tiles.
     * Stencil ref values continue the range used by the tile clipping masks.
     *
     * Attention: This function changes the next stencil ID even if the result of it
     * is not used, which might cause problems when rendering due to invalid stencil
     * values.
     * Returns [StencilMode for tile overscaleZ map, sortedCoords].
     */
    getStencilConfigForOverlapAndUpdateStencilID(tileIDs: OverscaledTileID[]): [Record<number, Readonly<StencilMode>>, OverscaledTileID[]] {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;
        if (stencilValues > 1) {
            this.currentStencilSource = undefined;
            if (this.nextStencilID + stencilValues > 256) {
                this.clearStencil();
            }
            const zToStencilMode: Record<number, Readonly<StencilMode>> = {};
            for (let i = 0; i < stencilValues; i++) {
                zToStencilMode[i + minTileZ] = new StencilMode({func: gl.GEQUAL, mask: 0xFF}, i + this.nextStencilID, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            this.nextStencilID += stencilValues;
            return [zToStencilMode, coords];
        }
        return [{[minTileZ]: StencilMode.disabled}, coords];
    }

    stencilConfigForOverlapTwoPass(tileIDs: OverscaledTileID[]): [
        Record<number, Readonly<StencilMode>>, // borderless tiles - high priority & high stencil values
        Record<number, Readonly<StencilMode>>, // tiles with border - low priority
        OverscaledTileID[]
    ] {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;

        this.clearStencil();

        if (stencilValues > 1) {
            const zToStencilModeHigh: Record<number, Readonly<StencilMode>> = {};
            const zToStencilModeLow: Record<number, Readonly<StencilMode>> = {};
            for (let i = 0; i < stencilValues; i++) {
                zToStencilModeHigh[i + minTileZ] = new StencilMode({func: gl.GREATER, mask: 0xFF}, stencilValues + 1 + i, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
                zToStencilModeLow[i + minTileZ] = new StencilMode({func: gl.GREATER, mask: 0xFF}, 1 + i, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            this.nextStencilID = stencilValues * 2 + 1;
            return [
                zToStencilModeHigh,
                zToStencilModeLow,
                coords
            ];
        } else {
            this.nextStencilID = 3;
            return [
                {[minTileZ]: new StencilMode({func: gl.GREATER, mask: 0xFF}, 2, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE)},
                {[minTileZ]: new StencilMode({func: gl.GREATER, mask: 0xFF}, 1, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE)},
                coords
            ];
        }
    }
}
