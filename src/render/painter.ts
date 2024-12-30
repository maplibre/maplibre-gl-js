import {browser} from '../util/browser';
import {mat4} from 'gl-matrix';
import {SourceCache} from '../source/source_cache';
import {EXTENT} from '../data/extent';
import {SegmentVector} from '../data/segment';
import {RasterBoundsArray, PosArray, TriangleIndexArray, LineStripIndexArray} from '../data/array_types.g';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import posAttributes from '../data/pos_attributes';
import {type ProgramConfiguration} from '../data/program_configuration';
import {CrossTileSymbolIndex} from '../symbol/cross_tile_symbol_index';
import {shaders} from '../shaders/shaders';
import {Program} from './program';
import {programUniforms} from './program/program_uniforms';
import {Context} from '../gl/context';
import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';
import {ColorMode} from '../gl/color_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {Texture} from './texture';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {drawSymbols} from './draw_symbol';
import {drawCircles} from './draw_circle';
import {drawHeatmap} from './draw_heatmap';
import {drawLine} from './draw_line';
import {drawFill} from './draw_fill';
import {drawFillExtrusion} from './draw_fill_extrusion';
import {drawHillshade} from './draw_hillshade';
import {drawRaster} from './draw_raster';
import {drawBackground} from './draw_background';
import {drawDebug, drawDebugPadding, selectDebugSource} from './draw_debug';
import {drawCustom} from './draw_custom';
import {drawDepth, drawCoords} from './draw_terrain';
import {type OverscaledTileID} from '../source/tile_id';
import {drawSky, drawAtmosphere} from './draw_sky';
import {Mesh} from './mesh';
import {MercatorShaderDefine, MercatorShaderVariantKey} from '../geo/projection/mercator_projection';

import type {IReadonlyTransform} from '../geo/transform_interface';
import type {Style} from '../style/style';
import type {StyleLayer} from '../style/style_layer';
import type {CrossFaded} from '../style/properties';
import type {LineAtlas} from './line_atlas';
import type {ImageManager} from './image_manager';
import type {GlyphManager} from './glyph_manager';
import type {VertexBuffer} from '../gl/vertex_buffer';
import type {IndexBuffer} from '../gl/index_buffer';
import type {DepthRangeType, DepthMaskType, DepthFuncType} from '../gl/types';
import type {ResolvedImage} from '@maplibre/maplibre-gl-style-spec';
import type {RenderToTexture} from './render_to_texture';
import type {ProjectionData} from '../geo/projection/projection_data';
import {coveringTiles} from '../geo/projection/covering_tiles';
import {isSymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {isCircleStyleLayer} from '../style/style_layer/circle_style_layer';
import {isHeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import {isLineStyleLayer} from '../style/style_layer/line_style_layer';
import {isFillStyleLayer} from '../style/style_layer/fill_style_layer';
import {isFillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer';
import {isHillshadeStyleLayer} from '../style/style_layer/hillshade_style_layer';
import {isRasterStyleLayer} from '../style/style_layer/raster_style_layer';
import {isBackgroundStyleLayer} from '../style/style_layer/background_style_layer';
import {isCustomStyleLayer} from '../style/style_layer/custom_style_layer';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

type PainterOptions = {
    showOverdrawInspector: boolean;
    showTileBoundaries: boolean;
    showPadding: boolean;
    rotating: boolean;
    zooming: boolean;
    moving: boolean;
    fadeDuration: number;
};

export type RenderOptions = {
    isRenderingToTexture: boolean;
    isRenderingGlobe: boolean;
};

/**
 * @internal
 * Initialize a new painter object.
 */
export class Painter {
    context: Context;
    transform: IReadonlyTransform;
    renderToTexture: RenderToTexture;
    _tileTextures: {
        [_: number]: Array<Texture>;
    };
    numSublayers: number;
    depthEpsilon: number;
    emptyProgramConfiguration: ProgramConfiguration;
    width: number;
    height: number;
    pixelRatio: number;
    tileExtentBuffer: VertexBuffer;
    tileExtentSegments: SegmentVector;
    tileExtentMesh: Mesh;

    debugBuffer: VertexBuffer;
    debugSegments: SegmentVector;
    rasterBoundsBuffer: VertexBuffer;
    rasterBoundsSegments: SegmentVector;
    rasterBoundsBufferPosOnly: VertexBuffer;
    rasterBoundsSegmentsPosOnly: SegmentVector;
    viewportBuffer: VertexBuffer;
    viewportSegments: SegmentVector;
    quadTriangleIndexBuffer: IndexBuffer;
    tileBorderIndexBuffer: IndexBuffer;
    _tileClippingMaskIDs: {[_: string]: number};
    stencilClearMode: StencilMode;
    style: Style;
    options: PainterOptions;
    lineAtlas: LineAtlas;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    depthRangeFor3D: DepthRangeType;
    opaquePassCutoff: number;
    renderPass: RenderPass;
    currentLayer: number;
    currentStencilSource: string;
    nextStencilID: number;
    id: string;
    _showOverdrawInspector: boolean;
    cache: {[_: string]: Program<any>};
    crossTileSymbolIndex: CrossTileSymbolIndex;
    symbolFadeChange: number;
    debugOverlayTexture: Texture;
    debugOverlayCanvas: HTMLCanvasElement;
    // this object stores the current camera-matrix and the last render time
    // of the terrain-facilitators. e.g. depth & coords framebuffers
    // every time the camera-matrix changes the terrain-facilitators will be redrawn.
    terrainFacilitator: {dirty: boolean; matrix: mat4; renderTime: number};

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, transform: IReadonlyTransform) {
        this.context = new Context(gl);
        this.transform = transform;
        this._tileTextures = {};
        this.terrainFacilitator = {dirty: true, matrix: mat4.identity(new Float64Array(16) as any), renderTime: 0};

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.crossTileSymbolIndex = new CrossTileSymbolIndex();
    }

    /*
     * Update the GL viewport, projection matrix, and transforms to compensate
     * for a new width and height value.
     */
    resize(width: number, height: number, pixelRatio: number) {
        this.width = Math.floor(width * pixelRatio);
        this.height = Math.floor(height * pixelRatio);
        this.pixelRatio = pixelRatio;
        this.context.viewport.set([0, 0, this.width, this.height]);

        if (this.style) {
            for (const layerId of this.style._order) {
                this.style._layers[layerId].resize();
            }
        }
    }

    setup() {
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

        const rasterBoundsArrayPosOnly = new PosArray();
        rasterBoundsArrayPosOnly.emplaceBack(0, 0);
        rasterBoundsArrayPosOnly.emplaceBack(EXTENT, 0);
        rasterBoundsArrayPosOnly.emplaceBack(0, EXTENT);
        rasterBoundsArrayPosOnly.emplaceBack(EXTENT, EXTENT);
        this.rasterBoundsBufferPosOnly = context.createVertexBuffer(rasterBoundsArrayPosOnly, posAttributes.members);
        this.rasterBoundsSegmentsPosOnly = SegmentVector.simpleSegment(0, 0, 4, 5);

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

        const gl = this.context.gl;
        this.stencilClearMode = new StencilMode({func: gl.ALWAYS, mask: 0}, 0x0, 0xFF, gl.ZERO, gl.ZERO, gl.ZERO);

        this.tileExtentMesh = new Mesh(this.tileExtentBuffer, this.quadTriangleIndexBuffer, this.tileExtentSegments);
    }

    /*
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil() {
        const context = this.context;
        const gl = context.gl;

        this.nextStencilID = 1;
        this.currentStencilSource = undefined;

        // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
        // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
        // effectively clearing the stencil buffer: once an upstream patch lands, remove
        // this function in favor of context.clear({ stencil: 0x0 })

        const matrix = mat4.create();
        mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
        mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);

        const projectionData: ProjectionData = {
            mainMatrix: matrix,
            tileMercatorCoords: [0, 0, 1, 1],
            clippingPlane: [0, 0, 0, 0],
            projectionTransition: 0.0,
            fallbackMatrix: matrix,
        };

        // Note: we force a simple mercator projection for the shader, since we want to draw a fullscreen quad.
        this.useProgram('clippingMask', null, true).draw(context, gl.TRIANGLES,
            DepthMode.disabled, this.stencilClearMode, ColorMode.disabled, CullFaceMode.disabled,
            null, null, projectionData,
            '$clipping', this.viewportBuffer,
            this.quadTriangleIndexBuffer, this.viewportSegments);
    }

    _renderTileClippingMasks(layer: StyleLayer, tileIDs: Array<OverscaledTileID>, renderToTexture: boolean) {
        if (this.currentStencilSource === layer.source || !layer.isTileClipped() || !tileIDs || !tileIDs.length) {
            return;
        }

        this.currentStencilSource = layer.source;

        if (this.nextStencilID + tileIDs.length > 256) {
            // we'll run out of fresh IDs so we need to clear and start from scratch
            this.clearStencil();
        }

        const context = this.context;
        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);

        const stencilRefs = {};

        // Set stencil ref values for all tiles
        for (const tileID of tileIDs) {
            stencilRefs[tileID.key] = this.nextStencilID++;
        }

        // A two-pass approach is needed. See comment in draw_raster.ts for more details.
        // However, we use a simpler approach because we don't care about overdraw here.

        // First pass - draw tiles with borders and with GL_ALWAYS
        this._renderTileMasks(stencilRefs, tileIDs, renderToTexture, true);
        // Second pass - draw borderless tiles with GL_ALWAYS
        this._renderTileMasks(stencilRefs, tileIDs, renderToTexture, false);

        this._tileClippingMaskIDs = stencilRefs;
    }

    _renderTileMasks(tileStencilRefs: {[_: string]: number}, tileIDs: Array<OverscaledTileID>, renderToTexture: boolean, useBorders: boolean) {
        const context = this.context;
        const gl = context.gl;
        const projection = this.style.projection;
        const transform = this.transform;

        const program = this.useProgram('clippingMask');

        // tiles are usually supplied in ascending order of z, then y, then x
        for (const tileID of tileIDs) {
            const stencilRef = tileStencilRefs[tileID.key];
            const terrainData = this.style.map.terrain && this.style.map.terrain.getTerrainData(tileID);

            const mesh = projection.getMeshFromTileID(this.context, tileID.canonical, useBorders, true, 'stencil');

            const projectionData = transform.getProjectionData({overscaledTileID: tileID, applyGlobeMatrix: true, applyTerrainMatrix: true});

            program.draw(context, gl.TRIANGLES, DepthMode.disabled,
                // Tests will always pass, and ref value will be written to stencil buffer.
                new StencilMode({func: gl.ALWAYS, mask: 0}, stencilRef, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE),
                ColorMode.disabled, renderToTexture ? CullFaceMode.disabled : CullFaceMode.backCCW, null,
                terrainData, projectionData, '$clipping', mesh.vertexBuffer,
                mesh.indexBuffer, mesh.segments);
        }
    }

    /**
     * Fills the depth buffer with the geometry of all supplied tiles.
     * Does not change the color buffer or the stencil buffer.
     */
    _renderTilesDepthBuffer() {
        const context = this.context;
        const gl = context.gl;
        const projection = this.style.projection;
        const transform = this.transform;

        const program = this.useProgram('depth');
        const depthMode = this.getDepthModeFor3D();
        const tileIDs = coveringTiles(transform, {tileSize: transform.tileSize});

        // tiles are usually supplied in ascending order of z, then y, then x
        for (const tileID of tileIDs) {
            const terrainData = this.style.map.terrain && this.style.map.terrain.getTerrainData(tileID);
            const mesh = projection.getMeshFromTileID(this.context, tileID.canonical, true, true, 'raster');

            const projectionData = transform.getProjectionData({overscaledTileID: tileID, applyGlobeMatrix: true, applyTerrainMatrix: true});

            program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
                ColorMode.disabled, CullFaceMode.backCCW, null,
                terrainData, projectionData, '$clipping', mesh.vertexBuffer,
                mesh.indexBuffer, mesh.segments);
        }
    }

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
        return new StencilMode({func: gl.EQUAL, mask: 0xFF}, this._tileClippingMaskIDs[tileID.key], 0x00, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    /*
     * Sort coordinates by Z as drawing tiles is done in Z-descending order.
     * All children with the same Z write the same stencil value.  Children
     * stencil values are greater than parent's.  This is used only for raster
     * and raster-dem tiles, which are already clipped to tile boundaries, to
     * mask area of tile overlapped by children tiles.
     * Stencil ref values continue range used in _tileClippingMaskIDs.
     *
     * Attention: This function changes this.nextStencilID even if the result of it
     * is not used, which might cause problems when rendering due to invalid stencil
     * values.
     * Returns [StencilMode for tile overscaleZ map, sortedCoords].
     */
    getStencilConfigForOverlapAndUpdateStencilID(tileIDs: Array<OverscaledTileID>): [{
        [_: number]: Readonly<StencilMode>;
    }, Array<OverscaledTileID>] {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;
        if (stencilValues > 1) {
            this.currentStencilSource = undefined;
            if (this.nextStencilID + stencilValues > 256) {
                this.clearStencil();
            }
            const zToStencilMode = {};
            for (let i = 0; i < stencilValues; i++) {
                zToStencilMode[i + minTileZ] = new StencilMode({func: gl.GEQUAL, mask: 0xFF}, i + this.nextStencilID, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            this.nextStencilID += stencilValues;
            return [zToStencilMode, coords];
        }
        return [{[minTileZ]: StencilMode.disabled}, coords];
    }

    stencilConfigForOverlapTwoPass(tileIDs: Array<OverscaledTileID>): [
        { [_: number]: Readonly<StencilMode> }, // borderless tiles - high priority & high stencil values
        { [_: number]: Readonly<StencilMode> }, // tiles with border - low priority
        Array<OverscaledTileID>
    ] {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;

        this.clearStencil();

        if (stencilValues > 1) {
            const zToStencilModeHigh = {};
            const zToStencilModeLow = {};
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

    colorModeForRenderPass(): Readonly<ColorMode> {
        const gl = this.context.gl;
        if (this._showOverdrawInspector) {
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;

            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        } else if (this.renderPass === 'opaque') {
            return ColorMode.unblended;
        } else {
            return ColorMode.alphaBlended;
        }
    }

    getDepthModeForSublayer(n: number, mask: DepthMaskType, func?: DepthFuncType | null): Readonly<DepthMode> {
        if (!this.opaquePassEnabledForLayer()) return DepthMode.disabled;
        const depth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
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
    opaquePassEnabledForLayer() {
        return this.currentLayer < this.opaquePassCutoff;
    }

    render(style: Style, options: PainterOptions) {
        this.style = style;
        this.options = options;

        this.lineAtlas = style.lineAtlas;
        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;

        this.symbolFadeChange = style.placement.symbolFadeChange(browser.now());

        this.imageManager.beginFrame();

        const layerIds = this.style._order;
        const sourceCaches = this.style.sourceCaches;

        const coordsAscending: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsDescending: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsDescendingSymbol: {[_: string]: Array<OverscaledTileID>} = {};
        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: style.projection?.transitionState > 0};

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);
            }

            coordsAscending[id] = sourceCache.getVisibleCoordinates(false);
            coordsDescending[id] = coordsAscending[id].slice().reverse();
            coordsDescendingSymbol[id] = sourceCache.getVisibleCoordinates(true).reverse();
        }

        this.opaquePassCutoff = Infinity;
        for (let i = 0; i < layerIds.length; i++) {
            const layerId = layerIds[i];
            if (this.style._layers[layerId].is3D()) {
                this.opaquePassCutoff = i;
                break;
            }
        }

        this.maybeDrawDepthAndCoords(false);

        if (this.renderToTexture) {
            this.renderToTexture.prepareForRender(this.style, this.transform.zoom);
            // this is disabled, because render-to-texture is rendering all layers from bottom to top.
            this.opaquePassCutoff = 0;
        }

        // Offscreen pass ===============================================
        // We first do all rendering that requires rendering to a separate
        // framebuffer, and then save those for rendering back to the map
        // later: in doing this we avoid doing expensive framebuffer restores.
        this.renderPass = 'offscreen';

        for (const layerId of layerIds) {
            const layer = this.style._layers[layerId];
            if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom)) continue;

            const coords = coordsDescending[layer.source];
            if (layer.type !== 'custom' && !coords.length) continue;

            this.renderLayer(this, sourceCaches[layer.source], layer, coords, renderOptions);
        }

        // Execute offscreen GPU tasks of the projection manager
        this.style.projection?.updateGPUdependent({
            context: this.context,
            useProgram: (name: string) => this.useProgram(name)
        });

        // Rebind the main framebuffer now that all offscreen layers have been rendered:
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.bindFramebuffer.set(null);

        // Clear buffers in preparation for drawing to the main framebuffer
        this.context.clear({color: options.showOverdrawInspector ? Color.black : Color.transparent, depth: 1});
        this.clearStencil();

        // draw sky first to not overwrite symbols
        if (this.style.sky) drawSky(this, this.style.sky);

        this._showOverdrawInspector = options.showOverdrawInspector;
        this.depthRangeFor3D = [0, 1 - ((style._order.length + 2) * this.numSublayers * this.depthEpsilon)];

        // Opaque pass ===============================================
        // Draw opaque layers top-to-bottom first.
        if (!this.renderToTexture) {
            this.renderPass = 'opaque';

            for (this.currentLayer = layerIds.length - 1; this.currentLayer >= 0; this.currentLayer--) {
                const layer = this.style._layers[layerIds[this.currentLayer]];
                const sourceCache = sourceCaches[layer.source];
                const coords = coordsAscending[layer.source];

                this._renderTileClippingMasks(layer, coords, false);
                this.renderLayer(this, sourceCache, layer, coords, renderOptions);
            }
        }

        // Translucent pass ===============================================
        // Draw all other layers bottom-to-top.
        this.renderPass = 'translucent';

        let globeDepthRendered = false;

        for (this.currentLayer = 0; this.currentLayer < layerIds.length; this.currentLayer++) {
            const layer = this.style._layers[layerIds[this.currentLayer]];
            const sourceCache = sourceCaches[layer.source];

            if (this.renderToTexture && this.renderToTexture.renderLayer(layer, renderOptions)) continue;

            if (!this.opaquePassEnabledForLayer() && !globeDepthRendered) {
                globeDepthRendered = true;
                // Render the globe sphere into the depth buffer - but only if globe is enabled and terrain is disabled.
                // There should be no need for explicitly writing tile depths when terrain is enabled.
                if (renderOptions.isRenderingGlobe && !this.style.map.terrain) {
                    this._renderTilesDepthBuffer();
                }
            }

            // For symbol layers in the translucent pass, we add extra tiles to the renderable set
            // for cross-tile symbol fading. Symbol layers don't use tile clipping, so no need to render
            // separate clipping masks
            const coords = (layer.type === 'symbol' ? coordsDescendingSymbol : coordsDescending)[layer.source];

            this._renderTileClippingMasks(layer, coordsAscending[layer.source], false);
            this.renderLayer(this, sourceCache, layer, coords, renderOptions);
        }

        // Render atmosphere, only for Globe projection
        if (renderOptions.isRenderingGlobe) {
            drawAtmosphere(this, this.style.sky, this.style.light);
        }

        if (this.options.showTileBoundaries) {
            const selectedSource = selectDebugSource(this.style, this.transform.zoom);
            if (selectedSource) {
                drawDebug(this, selectedSource, selectedSource.getVisibleCoordinates());
            }
        }

        if (this.options.showPadding) {
            drawDebugPadding(this);
        }

        // Set defaults for most GL values so that anyone using the state after the render
        // encounters more expected values.
        this.context.setDefault();
    }

    /**
     * Update the depth and coords framebuffers, if the contents of those frame buffers is out of date.
     * If requireExact is false, then the contents of those frame buffers is not updated if it is close
     * to accurate (that is, the camera has not moved much since it was updated last).
     */
    maybeDrawDepthAndCoords(requireExact: boolean) {
        if (!this.style || !this.style.map || !this.style.map.terrain) {
            return;
        }
        const prevMatrix = this.terrainFacilitator.matrix;
        const currMatrix = this.transform.modelViewProjectionMatrix;

        // Update coords/depth-framebuffer on camera movement, or tile reloading
        let doUpdate = this.terrainFacilitator.dirty;
        doUpdate ||= requireExact ? !mat4.exactEquals(prevMatrix, currMatrix) : !mat4.equals(prevMatrix, currMatrix);
        doUpdate ||= this.style.map.terrain.sourceCache.anyTilesAfterTime(this.terrainFacilitator.renderTime);

        if (!doUpdate) {
            return;
        }

        mat4.copy(prevMatrix, currMatrix);
        this.terrainFacilitator.renderTime = Date.now();
        this.terrainFacilitator.dirty = false;
        drawDepth(this, this.style.map.terrain);
        drawCoords(this, this.style.map.terrain);
    }

    renderLayer(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && layer.type !== 'custom' && !(coords || []).length) return;
        this.id = layer.id;

        if (isSymbolStyleLayer(layer)) {
            drawSymbols(painter, sourceCache, layer, coords, this.style.placement.variableOffsets, renderOptions);
        } else if (isCircleStyleLayer(layer)) {
            drawCircles(painter, sourceCache, layer, coords, renderOptions);
        } else if (isHeatmapStyleLayer(layer)) {
            drawHeatmap(painter, sourceCache, layer, coords, renderOptions);
        } else if (isLineStyleLayer(layer)) {
            drawLine(painter, sourceCache, layer, coords, renderOptions);
        } else if (isFillStyleLayer(layer)) {
            drawFill(painter, sourceCache, layer, coords, renderOptions);
        } else if (isFillExtrusionStyleLayer(layer)) {
            drawFillExtrusion(painter, sourceCache, layer, coords, renderOptions);
        } else if (isHillshadeStyleLayer(layer)) {
            drawHillshade(painter, sourceCache, layer, coords, renderOptions);
        } else if (isRasterStyleLayer(layer)) {
            drawRaster(painter, sourceCache, layer, coords, renderOptions);
        } else if (isBackgroundStyleLayer(layer)) {
            drawBackground(painter, sourceCache, layer, coords, renderOptions);
        } else if (isCustomStyleLayer(layer)) {
            drawCustom(painter, sourceCache, layer, renderOptions);
        }
    }

    saveTileTexture(texture: Texture) {
        const textures = this._tileTextures[texture.size[0]];
        if (!textures) {
            this._tileTextures[texture.size[0]] = [texture];
        } else {
            textures.push(texture);
        }
    }

    getTileTexture(size: number) {
        const textures = this._tileTextures[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }

    /**
     * Checks whether a pattern image is needed, and if it is, whether it is not loaded.
     *
     * @returns true if a needed image is missing and rendering needs to be skipped.
     */
    isPatternMissing(image?: CrossFaded<ResolvedImage> | null): boolean {
        if (!image) return false;
        if (!image.from || !image.to) return true;
        const imagePosA = this.imageManager.getPattern(image.from.toString());
        const imagePosB = this.imageManager.getPattern(image.to.toString());
        return !imagePosA || !imagePosB;
    }

    /**
     * Finds the required shader and its variant (base/terrain/globe, etc.) and binds it, compiling a new shader if required.
     * @param name - Name of the desired shader.
     * @param programConfiguration - Configuration of shader's inputs.
     * @param defines - Additional macros to be injected at the beginning of the shader. Expected format is `['#define XYZ']`, etc.
     * @param forceSimpleProjection - Whether to force the use of a shader variant with simple mercator projection vertex shader.
     * False by default. Use true when drawing with a simple projection matrix is desired, eg. when drawing a fullscreen quad.
     * @returns
     */
    useProgram(name: string, programConfiguration?: ProgramConfiguration | null, forceSimpleProjection: boolean = false): Program<any> {
        this.cache = this.cache || {};
        const useTerrain = !!this.style.map.terrain;

        const projection = this.style.projection;

        const projectionPrelude = forceSimpleProjection ? shaders.projectionMercator : projection.shaderPreludeCode;
        const projectionDefine = forceSimpleProjection ? MercatorShaderDefine : projection.shaderDefine;
        const projectionKey = `/${forceSimpleProjection ? MercatorShaderVariantKey : projection.shaderVariantName}`;

        const configurationKey = (programConfiguration ? programConfiguration.cacheKey : '');
        const overdrawKey = (this._showOverdrawInspector ? '/overdraw' : '');
        const terrainKey = (useTerrain ? '/terrain' : '');

        const key = name + configurationKey + projectionKey + overdrawKey + terrainKey;

        if (!this.cache[key]) {
            this.cache[key] = new Program(
                this.context,
                shaders[name],
                programConfiguration,
                programUniforms[name],
                this._showOverdrawInspector,
                useTerrain,
                projectionPrelude,
                projectionDefine
            );
        }
        return this.cache[key];
    }

    /*
     * Reset some GL state to default values to avoid hard-to-debug bugs
     * in custom layers.
     */
    setCustomLayerDefaults() {
        // Prevent custom layers from unintentionally modify the last VAO used.
        // All other state is state is restored on it's own, but for VAOs it's
        // simpler to unbind so that we don't have to track the state of VAOs.
        this.context.unbindVAO();

        // The default values for this state is meaningful and often expected.
        // Leaving this state dirty could cause a lot of confusion for users.
        this.context.cullFace.setDefault();
        this.context.activeTexture.setDefault();
        this.context.pixelStoreUnpack.setDefault();
        this.context.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.context.pixelStoreUnpackFlipY.setDefault();
    }

    /*
     * Set GL state that is shared by all layers.
     */
    setBaseState() {
        const gl = this.context.gl;
        this.context.cullFace.set(false);
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.blendEquation.set(gl.FUNC_ADD);
    }

    initDebugOverlayCanvas() {
        if (this.debugOverlayCanvas == null) {
            this.debugOverlayCanvas = document.createElement('canvas');
            this.debugOverlayCanvas.width = 512;
            this.debugOverlayCanvas.height = 512;
            const gl = this.context.gl;
            this.debugOverlayTexture = new Texture(this.context, this.debugOverlayCanvas, gl.RGBA);
        }
    }

    destroy() {
        if (this.debugOverlayTexture) {
            this.debugOverlayTexture.destroy();
        }
    }

    /*
     * Return true if drawing buffer size is != from requested size.
     * That means that we've reached GL limits somehow.
     * Note: drawing buffer size changes only when canvas size changes
     */
    overLimit() {
        const {drawingBufferWidth, drawingBufferHeight} = this.context.gl;
        return this.width !== drawingBufferWidth || this.height !== drawingBufferHeight;
    }
}
