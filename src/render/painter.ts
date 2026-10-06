import {now} from '../util/time_control.ts';
import {mat4} from 'gl-matrix';
import {EXTENT} from '../data/extent.ts';
import {SegmentVector} from '../data/segment.ts';
import {RasterBoundsArray, PosArray, TriangleIndexArray, LineStripIndexArray} from '../data/array_types.g.ts';
import rasterBoundsAttributes from '../data/raster_bounds_attributes.ts';
import posAttributes from '../data/pos_attributes.ts';
import {Context} from '../webgl/context.ts';
import {ProgramCache} from '../webgl/program_cache.ts';
import {StencilMode} from '../webgl/stencil_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {CullFaceMode} from '../webgl/cull_face_mode.ts';
import {Texture} from '../webgl/texture.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {selectDebugSource, webglDrawFunctions, type DrawFunctions} from '../webgl/draw/index.ts';
import {Mesh} from './mesh.ts';
import {FrameRenderContext, type FrameRenderData} from './frame_render_context.ts';
import {updateFrameUniformBuffer} from '../webgl/frame_uniform_buffer.ts';
import {releaseProjectionUniformBuffers} from '../webgl/projection_uniform_buffer.ts';
import {coveringTiles} from '../geo/projection/covering_tiles.ts';
import {isSymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {isCircleStyleLayer} from '../style/style_layer/circle_style_layer.ts';
import {isHeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer.ts';
import {isLineStyleLayer} from '../style/style_layer/line_style_layer.ts';
import {isFillStyleLayer} from '../style/style_layer/fill_style_layer.ts';
import {isFillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer.ts';
import {isHillshadeStyleLayer} from '../style/style_layer/hillshade_style_layer.ts';
import {isColorReliefStyleLayer} from '../style/style_layer/color_relief_style_layer.ts';
import {isRasterStyleLayer} from '../style/style_layer/raster_style_layer.ts';
import {isBackgroundStyleLayer} from '../style/style_layer/background_style_layer.ts';
import {isCustomStyleLayer} from '../style/style_layer/custom_style_layer.ts';

import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Style} from '../style/style.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {LineAtlas} from './line_atlas.ts';
import type {PatternAtlas} from './pattern_atlas.ts';
import type {VertexBuffer} from '../webgl/vertex_buffer.ts';
import type {IndexBuffer} from '../webgl/index_buffer.ts';
import type {IRenderToTexture} from './render_to_texture_interface.ts';
import type {Framebuffer} from '../webgl/framebuffer.ts';

/**
 * Holds the texture used to render a 2D tile so it can be draped over 3D
 * terrain. All RTTObjects share a single FBO owned by the Painter; the
 * texture is swapped in via `Painter.bindRTT` before each render pass.
 * Owned by a `Tile` while in use, recycled via `Painter.releaseRTT` when
 * the tile no longer needs it.
 */
export type RTTObject = {
    texture: Texture;
    size: number;
};

/**
 * @internal
 * Initialize a new painter object.
 */
export class Painter {
    drawFunctions: DrawFunctions;
    context: Context;
    renderToTexture: IRenderToTexture;
    _tileTextures: {
        [_: number]: Texture[];
    };
    /**
     * A pool of recyclable {@link RTTObject}s (textures only; the FBO is shared).
     */
    _rttObjectRecyclePool: RTTObject[];
    /**
     * Shared FBO used by all RTT render passes. The color attachment is
     * swapped to the target RTTObject's texture via {@link bindRTT}.
     * Created lazily on first use.
     */
    _rttSharedFbo: {
        fbo: Framebuffer;
        depthRenderbuffer: WebGLRenderbuffer;
        size: number;
    } | null;
    /**
     * Shared scratch FBO (color + depth-stencil) used by `{line,fill}-layer-opacity`.
     * The layer is rendered into this FBO, then composited into whatever framebuffer was previously bound
     * The canvas in the flat case, the per-terrain-tile RTT texture in the terrain case.
     * Resized in place to match the target dimensions.
     */
    layerOpacityFbo: Framebuffer | null;
    width: number;
    height: number;
    tileExtentBuffer: VertexBuffer;
    tileExtentSegments: SegmentVector;
    tileExtentMesh: Mesh;
    /** A quad covering the viewport in clip space, which the sky and the atmosphere are drawn on. */
    skyMesh: Mesh;

    debugBuffer: VertexBuffer;
    debugSegments: SegmentVector;
    rasterBoundsBuffer: VertexBuffer;
    rasterBoundsSegments: SegmentVector;
    viewportBuffer: VertexBuffer;
    viewportSegments: SegmentVector;
    quadTriangleIndexBuffer: IndexBuffer;
    tileBorderIndexBuffer: IndexBuffer;
    lineAtlas: LineAtlas;
    patternAtlas: PatternAtlas;
    programCache: ProgramCache;
    debugOverlayTexture: Texture;
    debugOverlayCanvas: HTMLCanvasElement;
    // this object stores the current camera-matrix and the last render time
    // of the terrain depth framebuffer.
    // every time the camera-matrix changes the depth framebuffer will be redrawn.
    terrainFacilitator: {depthDirty: boolean; matrix: mat4; renderTime: number};

    constructor(gl: WebGL2RenderingContext) {
        this.drawFunctions = webglDrawFunctions;
        this.context = new Context(gl);
        this.programCache = new ProgramCache(this.context);
        this.layerOpacityFbo = null;
        this._tileTextures = {};
        this._rttObjectRecyclePool = [];
        this._rttSharedFbo = null;
        this.terrainFacilitator = {depthDirty: true, matrix: mat4.identity(new Float64Array(16)), renderTime: 0};

        this.setup();
    }

    /*
     * Update the GL viewport, projection matrix, and transforms to compensate
     * for a new width and height value.
     *
     * The viewport is the canvas' backing store, so it rounds as {@link Map._resizeCanvas} does.
     */
    resize(width: number, height: number, pixelRatio: number): void {
        this.width = Math.round(width * pixelRatio);
        this.height = Math.round(height * pixelRatio);
        this.context.viewport.set([0, 0, this.width, this.height]);
    }

    setup(): void {
        const context = this.context;

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        this.tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(EXTENT, EXTENT);
        this.debugBuffer = context.createVertexBuffer(debugArray, posAttributes.members);
        this.debugSegments = SegmentVector.simpleSegment(0, 0, 4, 5);

        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
        this.rasterBoundsBuffer = context.createVertexBuffer(rasterBoundsArray, rasterBoundsAttributes.members);
        this.rasterBoundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const viewportArray = new PosArray();
        viewportArray.emplaceBack(0, 0);
        viewportArray.emplaceBack(1, 0);
        viewportArray.emplaceBack(0, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = context.createVertexBuffer(viewportArray, posAttributes.members);
        this.viewportSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const tileLineStripIndices = new LineStripIndexArray();
        tileLineStripIndices.emplaceBack(0);
        tileLineStripIndices.emplaceBack(1);
        tileLineStripIndices.emplaceBack(3);
        tileLineStripIndices.emplaceBack(2);
        tileLineStripIndices.emplaceBack(0);
        this.tileBorderIndexBuffer = context.createIndexBuffer(tileLineStripIndices);

        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(1, 0, 2);
        quadTriangleIndices.emplaceBack(1, 2, 3);
        this.quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);

        this.tileExtentMesh = new Mesh(this.tileExtentBuffer, this.quadTriangleIndexBuffer, this.tileExtentSegments);

        const skyArray = new PosArray();
        skyArray.emplaceBack(-1, -1);
        skyArray.emplaceBack(1, -1);
        skyArray.emplaceBack(1, 1);
        skyArray.emplaceBack(-1, 1);

        const skyIndices = new TriangleIndexArray();
        skyIndices.emplaceBack(0, 1, 2);
        skyIndices.emplaceBack(0, 2, 3);

        this.skyMesh = new Mesh(
            context.createVertexBuffer(skyArray, posAttributes.members),
            context.createIndexBuffer(skyIndices),
            SegmentVector.simpleSegment(0, 0, skyArray.length, skyIndices.length)
        );
    }

    /**
     * Fills the depth buffer with the geometry of all supplied tiles.
     * Does not change the color buffer or the stencil buffer.
     */
    _renderTilesDepthBuffer(frameRenderContext: FrameRenderContext): void {
        const context = this.context;
        const gl = context.gl;
        const transform = frameRenderContext.transform;

        const program = frameRenderContext.useProgram('depth');
        const depthMode = frameRenderContext.getDepthModeFor3D();
        const tileIDs = coveringTiles(transform, {tileSize: transform.tileSize});

        // tiles are usually supplied in ascending order of z, then y, then x
        for (const tileID of tileIDs) {
            const terrainData = frameRenderContext.getTerrainDataForTile(tileID);
            const mesh = frameRenderContext.getMeshFromTileID(tileID.canonical, true, true, 'raster');

            const projectionData = frameRenderContext.getProjectionDataForTile(tileID);

            program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
                ColorMode.disabled, CullFaceMode.backCCW, null,
                terrainData, projectionData, '$clipping', mesh.vertexBuffer,
                mesh.indexBuffer, mesh.segments);
        }
    }

    render(style: Style, transform: IReadonlyTransform, data: FrameRenderData): void {
        const frameRenderContext = new FrameRenderContext({
            transform,
            terrain: style.map.terrain ?? null,
            data,
            context: this.context,
            programCache: this.programCache,
            currentPass: 'offscreen',
            projection: style.projection
        });

        this.lineAtlas = style.lineAtlas;
        this.patternAtlas = style.patternAtlas;

        updateFrameUniformBuffer(this.context.frameUniformBuffer, transform, data);

        style.imageManager.beginFrame();
        releaseProjectionUniformBuffers(this.context);

        const layerIds = style._order;
        const tileManagers = style.tileManagers;

        const coordsAscending: {[_: string]: OverscaledTileID[]} = {};
        const coordsDescending: {[_: string]: OverscaledTileID[]} = {};
        const coordsDescendingSymbol: {[_: string]: OverscaledTileID[]} = {};

        for (const id in tileManagers) {
            const tileManager = tileManagers[id];
            if (tileManager.used) {
                tileManager.prepare(this.context);
            }

            coordsAscending[id] = tileManager.getVisibleCoordinates(false);
            coordsDescending[id] = coordsAscending[id].slice().reverse();
            coordsDescendingSymbol[id] = tileManager.getVisibleCoordinates(true).reverse();
        }

        frameRenderContext.opaquePassCutoff = Infinity;
        for (let i = 0; i < layerIds.length; i++) {
            const layerId = layerIds[i];
            if (style._layers[layerId].is3D()) {
                frameRenderContext.opaquePassCutoff = i;
                break;
            }
        }

        this.maybeDrawDepth(frameRenderContext);

        if (this.renderToTexture) {
            this.renderToTexture.prepareForRender(style, transform.zoom, data.moving);
            // this is disabled, because render-to-texture is rendering all layers from bottom to top.
            frameRenderContext.opaquePassCutoff = 0;
        }

        // Offscreen pass ===============================================
        // We first do all rendering that requires rendering to a separate
        // framebuffer, and then save those for rendering back to the map
        // later: in doing this we avoid doing expensive framebuffer restores.
        frameRenderContext.currentPass = 'offscreen';

        for (const layerId of layerIds) {
            const layer = style._layers[layerId];
            if (!layer.hasOffscreenPass() || layer.isHidden(transform.zoom)) continue;

            const coords = coordsDescending[layer.source];
            if (layer.type !== 'custom' && !coords.length) continue;

            this.renderLayer(this, tileManagers[layer.source], layer, coords, frameRenderContext);
        }

        // Rebind the main framebuffer now that all offscreen layers have been rendered:
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.bindFramebuffer.set(null);

        // Clear buffers in preparation for drawing to the main framebuffer
        this.context.clear({color: data.showOverdrawInspector ? Color.black : Color.transparent, depth: 1});
        frameRenderContext.clearStencil();

        // draw sky first to not overwrite symbols
        if (data.sky) this.drawFunctions.sky(this.skyMesh, frameRenderContext);

        frameRenderContext.setDepthRangeFor3D(style._order.length);

        // Opaque pass ===============================================
        // Draw opaque layers top-to-bottom first.
        if (!this.renderToTexture) {
            frameRenderContext.currentPass = 'opaque';

            for (frameRenderContext.currentLayer = layerIds.length - 1; frameRenderContext.currentLayer >= 0; frameRenderContext.currentLayer--) {
                const layer = style._layers[layerIds[frameRenderContext.currentLayer]];
                if (layer.isHidden(transform.zoom)) continue;
                const tileManager = tileManagers[layer.source];
                const coords = coordsAscending[layer.source];

                frameRenderContext.renderTileClippingMasks(layer, coords);
                this.renderLayer(this, tileManager, layer, coords, frameRenderContext);
            }
        }

        // Translucent pass ===============================================
        // Draw all other layers bottom-to-top.
        frameRenderContext.currentPass = 'translucent';

        let globeDepthRendered = false;

        for (frameRenderContext.currentLayer = 0; frameRenderContext.currentLayer < layerIds.length; frameRenderContext.currentLayer++) {
            const layer = style._layers[layerIds[frameRenderContext.currentLayer]];
            if (layer.isHidden(transform.zoom)) continue;
            const tileManager = tileManagers[layer.source];

            if (this.renderToTexture?.renderLayer(layer, style, frameRenderContext)) continue;

            if (!frameRenderContext.opaquePassEnabledForLayer() && !globeDepthRendered) {
                globeDepthRendered = true;
                // Render the globe sphere into the depth buffer - but only if globe is enabled and terrain is disabled.
                // There should be no need for explicitly writing tile depths when terrain is enabled.
                if (data.isRenderingGlobe && !frameRenderContext.terrain) {
                    this._renderTilesDepthBuffer(frameRenderContext);
                }
            }

            // For symbol layers in the translucent pass, we add extra tiles to the renderable set
            // for cross-tile symbol fading. Symbol layers don't use tile clipping, so no need to render
            // separate clipping masks
            const coords = (layer.type === 'symbol' ? coordsDescendingSymbol : coordsDescending)[layer.source];

            frameRenderContext.renderTileClippingMasks(layer, coordsAscending[layer.source]);
            this.renderLayer(this, tileManager, layer, coords, frameRenderContext);
        }

        // Render atmosphere, only for Globe projection
        if (data.isRenderingGlobe) {
            this.drawFunctions.atmosphere(this.skyMesh, frameRenderContext);
        }

        if (data.showTileBoundaries) {
            const selectedSource = selectDebugSource(style, transform.zoom);
            if (selectedSource) {
                this.drawFunctions.debug(this, selectedSource, selectedSource.getVisibleCoordinates(), frameRenderContext);
            }
        }

        if (data.showPadding) {
            this.drawFunctions.debugPadding(frameRenderContext);
        }

        // a frame at rest has reused every pooled drape it needs; the rest stay resident until freed here
        if (this.renderToTexture && !data.moving) this.clearRTTPool();

        // Set defaults for most GL values so that anyone using the state after the render
        // encounters more expected values.
        this.context.setDefault();
    }

    /**
     * Invalidates cached terrain depth so the next eligible depth pass redraws it.
     * DEM data can change the rendered surface while the camera and terrain tile set stay unchanged.
     * Repeated calls coalesce without rendering or scheduling a frame, even if terrain is not yet present.
     */
    markTerrainDepthDirty(): void {
        this.terrainFacilitator.depthDirty = true;
    }

    /**
     * Updates the depth framebuffer after explicit invalidation, camera movement, or tile reloading.
     */
    maybeDrawDepth(frameRenderContext: FrameRenderContext): void {
        if (!frameRenderContext.data.projectionShaderVariant || !frameRenderContext.terrain) {
            return;
        }
        const prevMatrix = this.terrainFacilitator.matrix;
        const currMatrix = frameRenderContext.transform.modelViewProjectionMatrix;

        // Update depth-framebuffer on camera movement, or tile reloading
        let doUpdate = this.terrainFacilitator.depthDirty;
        doUpdate ||= !mat4.equals(prevMatrix, currMatrix);
        doUpdate ||= frameRenderContext.terrain.tileManager.anyTilesAfterTime(this.terrainFacilitator.renderTime);

        if (!doUpdate) {
            return;
        }

        mat4.copy(prevMatrix, currMatrix);
        this.terrainFacilitator.renderTime = now();
        this.terrainFacilitator.depthDirty = false;
        this.drawFunctions.terrainDepth(this, frameRenderContext.terrain, frameRenderContext);
    }

    renderLayer(painter: Painter, tileManager: TileManager, layer: StyleLayer, coords: OverscaledTileID[], frameRenderContext: FrameRenderContext): void {
        if (layer.isHidden(frameRenderContext.transform.zoom)) return;
        if (layer.type !== 'background' && layer.type !== 'custom' && !(coords || []).length) return;

        const draw = this.drawFunctions;
        if (isSymbolStyleLayer(layer)) {
            draw.symbol(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isCircleStyleLayer(layer)) {
            draw.circle(tileManager, layer, coords, frameRenderContext);
        } else if (isHeatmapStyleLayer(layer)) {
            draw.heatmap(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isLineStyleLayer(layer)) {
            draw.line(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isFillStyleLayer(layer)) {
            draw.fill(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isFillExtrusionStyleLayer(layer)) {
            draw.fillExtrusion(tileManager, layer, coords, frameRenderContext);
        } else if (isHillshadeStyleLayer(layer)) {
            draw.hillshade(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isColorReliefStyleLayer(layer)) {
            draw.colorRelief(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isRasterStyleLayer(layer)) {
            draw.raster(tileManager, layer, coords, frameRenderContext);
        } else if (isBackgroundStyleLayer(layer)) {
            draw.background(painter, tileManager, layer, coords, frameRenderContext);
        } else if (isCustomStyleLayer(layer)) {
            draw.custom(painter, tileManager, layer, coords, frameRenderContext);
        }
    }

    static readonly MAX_TEXTURE_POOL_SIZE_PER_BUCKET = 50;

    saveTileTexture(texture: Texture): void {
        const textures = this._tileTextures[texture.size[0]];
        if (!textures) {
            this._tileTextures[texture.size[0]] = [texture];
        } else if (textures.length < Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET) {
            textures.push(texture);
        } else {
            texture.destroy();
        }
    }

    getTileTexture(size: number): Texture {
        const textures = this._tileTextures[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }

    acquireRTT(size: number): RTTObject {
        const gl = this.context.gl;
        const obj = this._rttObjectRecyclePool.pop();
        if (obj) {
            if (obj.size !== size) {
                obj.texture.update({width: size, height: size, data: null}, {premultiply: false, useMipmap: true});
                obj.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_LINEAR);
                if (this.context.extTextureFilterAnisotropic) {
                    gl.texParameterf(gl.TEXTURE_2D, this.context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.context.extTextureFilterAnisotropicMax);
                }
                obj.size = size;
            }
            return obj;
        }
        const texture = new Texture(this.context, {width: size, height: size, data: null}, gl.RGBA, {premultiply: false, useMipmap: true});
        texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_LINEAR);
        if (this.context.extTextureFilterAnisotropic) {
            gl.texParameterf(gl.TEXTURE_2D, this.context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.context.extTextureFilterAnisotropicMax);
        }
        return {texture, size};
    }

    /**
     * Binds the shared RTT FBO with the given RTTObject's texture attached
     * as color target. Creates / resizes the shared FBO and depth-stencil
     * renderbuffer lazily.
     */
    bindRTT(obj: RTTObject): void {
        const gl = this.context.gl;
        const size = obj.size;

        // Lazy-create the shared FBO + depth-stencil renderbuffer
        if (!this._rttSharedFbo) {
            const fbo = this.context.createFramebuffer(size, size, true, true);
            const depthRenderbuffer = this.context.createRenderbuffer(gl.DEPTH_STENCIL, size, size);
            fbo.depthAttachment.set(depthRenderbuffer);
            this._rttSharedFbo = {fbo, depthRenderbuffer, size};
        }

        // Resize the shared depth-stencil renderbuffer if needed
        if (this._rttSharedFbo.size !== size) {
            this.context.bindRenderbuffer.set(this._rttSharedFbo.depthRenderbuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, size, size);
            this.context.bindRenderbuffer.set(null);
            this._rttSharedFbo.fbo.width = size;
            this._rttSharedFbo.fbo.height = size;
            this._rttSharedFbo.size = size;
        }

        // Swap in the target texture and bind
        this._rttSharedFbo.fbo.colorAttachment.set(obj.texture.texture);
        this.context.bindFramebuffer.set(this._rttSharedFbo.fbo.framebuffer);
    }

    releaseRTT(obj: RTTObject): void {
        this._rttObjectRecyclePool.push(obj);
    }

    /**
     * Destroys the pooled {@link RTTObject}s, the drapes no tile holds. Called at the end of a frame at rest,
     * when they would otherwise stay resident until the next gesture reuses them.
     */
    clearRTTPool(): void {
        for (const obj of this._rttObjectRecyclePool) {
            obj.texture.destroy();
        }
        this._rttObjectRecyclePool.length = 0;
    }

    /**
     * Frees the pooled drapes and the shared render-to-texture FBO. Called when terrain is removed, after its tiles
     * released their drapes.
     */
    destroyRTTResources(): void {
        this.clearRTTPool();
        if (!this._rttSharedFbo) return;
        // Detach so Framebuffer.destroy() doesn't delete the texture/renderbuffer
        // that we already manage separately.
        this._rttSharedFbo.fbo.colorAttachment.set(null);
        this._rttSharedFbo.fbo.depthAttachment.set(null);
        const gl = this.context.gl;
        gl.deleteRenderbuffer(this._rttSharedFbo.depthRenderbuffer);
        gl.deleteFramebuffer(this._rttSharedFbo.fbo.framebuffer);
        this._rttSharedFbo = null;
    }

    /*
     * Set GL state shared by all layers.
     */
    setBaseState(): void {
        const gl = this.context.gl;
        this.context.cullFace.set(false);
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.blendEquation.set(gl.FUNC_ADD);
    }

    initDebugOverlayCanvas(): void {
        if (this.debugOverlayCanvas == null) {
            this.debugOverlayCanvas = document.createElement('canvas');
            this.debugOverlayCanvas.width = 512;
            this.debugOverlayCanvas.height = 512;
            const gl = this.context.gl;
            this.debugOverlayTexture = new Texture(this.context, this.debugOverlayCanvas, gl.RGBA);
        }
    }

    destroy(): void {
        if (this._tileTextures) {
            for (const size in this._tileTextures) {
                const textures = this._tileTextures[size];
                if (textures) {
                    for (const texture of textures) {
                        texture.destroy();
                    }
                }
            }
            this._tileTextures = {};
        }

        this.destroyRTTResources();

        this.layerOpacityFbo?.destroy();
        this.layerOpacityFbo = null;

        if (this.tileExtentBuffer) this.tileExtentBuffer.destroy();
        if (this.debugBuffer) this.debugBuffer.destroy();
        if (this.rasterBoundsBuffer) this.rasterBoundsBuffer.destroy();
        if (this.viewportBuffer) this.viewportBuffer.destroy();
        if (this.tileBorderIndexBuffer) this.tileBorderIndexBuffer.destroy();
        if (this.quadTriangleIndexBuffer) this.quadTriangleIndexBuffer.destroy();
        if (this.tileExtentMesh) this.tileExtentMesh.vertexBuffer?.destroy();
        if (this.tileExtentMesh) this.tileExtentMesh.indexBuffer?.destroy();
        this.skyMesh?.destroy();
        this.skyMesh = null;

        if (this.debugOverlayTexture) {
            this.debugOverlayTexture.destroy();
        }

        this.context.destroy();

        this.programCache.destroy();

        if (this.context) {
            this.context.setDefault();
        }
    }

    /*
     * Return true if drawing buffer size is != from requested size.
     * That means that we've reached GL limits somehow.
     * Note: drawing buffer size changes only when canvas size changes
     */
    overLimit(): boolean {
        const {drawingBufferWidth, drawingBufferHeight} = this.context.gl;
        return this.width !== drawingBufferWidth || this.height !== drawingBufferHeight;
    }
}
