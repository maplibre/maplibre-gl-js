import {StencilMode} from '../stencil_mode.ts';
import {DepthMode} from '../depth_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units.ts';
import {UniformBlock, type Std140Field} from '../../gfx/uniform_block.ts';
import {Drawable} from '../../gfx/drawable.ts';

import type {Painter, RenderOptions} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {BackgroundStyleLayer} from '../../style/style_layer/background_style_layer.ts';
import {type OverscaledTileID} from '../../tile/tile_id.ts';
import {coveringTiles} from '../../geo/projection/covering_tiles.ts';
import type {Color, ResolvedImage} from '@maplibre/maplibre-gl-style-spec';
import type {CrossFaded} from '../../style/properties.ts';

const PLAIN_LAYER_UBO_LAYOUT: readonly Std140Field[] = [
    {name: 'u_color',   type: 'vec4'},
    {name: 'u_opacity', type: 'float'},
];

const PATTERN_LAYER_UBO_LAYOUT: readonly Std140Field[] = [
    {name: 'u_pattern_tl_a',   type: 'vec2'},
    {name: 'u_pattern_br_a',   type: 'vec2'},
    {name: 'u_pattern_tl_b',   type: 'vec2'},
    {name: 'u_pattern_br_b',   type: 'vec2'},
    {name: 'u_texsize',        type: 'vec2'},
    {name: 'u_pattern_size_a', type: 'vec2'},
    {name: 'u_pattern_size_b', type: 'vec2'},
    {name: 'u_mix',            type: 'float'},
    {name: 'u_scale_a',        type: 'float'},
    {name: 'u_scale_b',        type: 'float'},
    {name: 'u_opacity',        type: 'float'},
];

const PATTERN_DRAWABLE_UBO_LAYOUT: readonly Std140Field[] = [
    {name: 'u_pixel_coord_upper',    type: 'vec2'},
    {name: 'u_pixel_coord_lower',    type: 'vec2'},
    {name: 'u_tile_units_to_pixels', type: 'float'},
];

function getOrCreateLayerUBO(painter: Painter, layerID: string, shaderName: string, layout: readonly Std140Field[]): UniformBlock {
    const key = `${layerID}:${shaderName}`;
    let block = painter.layerUBOs.get(key);
    if (!block) {
        block = new UniformBlock(painter.context.gl, layout);
        painter.layerUBOs.set(key, block);
    }
    return block;
}

export function drawBackground(painter: Painter, tileManager: TileManager, layer: BackgroundStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions): void {
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');

    if (opacity === 0) return;

    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const projection = painter.style.projection;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const image = layer.paint.get('background-pattern');

    if (painter.isPatternMissing(image)) return;

    const pass = (!image && color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer()) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.getDepthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();
    const shaderName = image ? 'backgroundPattern' : 'background';
    const tileIDs = coords ? coords : coveringTiles(transform, {tileSize, terrain: painter.style.map.terrain});

    // Populate and upload the per-layer UBO once per frame.
    const layerUBO = image ?
        buildPatternLayerUBO(painter, layer, image, opacity) :
        buildPlainLayerUBO(painter, layer, color, opacity);
    layerUBO.upload();

    // Pattern variant draws sample TEXTURE0 - bind the image atlas once for the layer.
    if (image) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.imageManager.bind(painter.context);
    }

    for (const tileID of tileIDs) {
        const projectionData = transform.getProjectionData({
            overscaledTileID: tileID,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        const terrainData = painter.style.map.terrain?.getTerrainData(tileID);
        const mesh = projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');

        const drawableUBO = image ? buildPatternDrawableUBO(painter, {tileID, tileSize}) : null;

        const drawable = new Drawable({
            shaderName,
            layerID: layer.id,
            depthMode,
            stencilMode,
            colorMode,
            cullFaceMode: CullFaceMode.backCCW,
            layoutVertexBuffer: mesh.vertexBuffer,
            indexBuffer: mesh.indexBuffer,
            segments: mesh.segments,
            programConfiguration: null,
            layerUBO,
            drawableUBO,
            textures: [],
            terrainData: terrainData ?? null,
            projectionData,
        });

        drawable.draw(painter);
    }
}

function buildPlainLayerUBO(painter: Painter, layer: BackgroundStyleLayer, color: Color, opacity: number): UniformBlock {
    const block = getOrCreateLayerUBO(painter, layer.id, 'background', PLAIN_LAYER_UBO_LAYOUT);
    block.write('u_color', [color.r, color.g, color.b, color.a]);
    block.write('u_opacity', opacity);
    return block;
}

function buildPatternLayerUBO(painter: Painter, layer: BackgroundStyleLayer, image: CrossFaded<ResolvedImage>, opacity: number): UniformBlock {
    const block = getOrCreateLayerUBO(painter, layer.id, 'backgroundPattern', PATTERN_LAYER_UBO_LAYOUT);
    const crossfade = layer.getCrossfadeParameters();
    const imagePosA = painter.imageManager.getPattern(image.from.toString());
    const imagePosB = painter.imageManager.getPattern(image.to.toString());
    const {width, height} = painter.imageManager.getPixelSize();

    block.write('u_pattern_tl_a',   imagePosA.tl);
    block.write('u_pattern_br_a',   imagePosA.br);
    block.write('u_pattern_tl_b',   imagePosB.tl);
    block.write('u_pattern_br_b',   imagePosB.br);
    block.write('u_texsize',        [width, height]);
    block.write('u_pattern_size_a', imagePosA.displaySize);
    block.write('u_pattern_size_b', imagePosB.displaySize);
    block.write('u_mix',            crossfade.t);
    block.write('u_scale_a',        crossfade.fromScale);
    block.write('u_scale_b',        crossfade.toScale);
    block.write('u_opacity',        opacity);
    return block;
}

function buildPatternDrawableUBO(painter: Painter, tile: {tileID: OverscaledTileID; tileSize: number}): UniformBlock {
    const block = new UniformBlock(painter.context.gl, PATTERN_DRAWABLE_UBO_LAYOUT);
    const transform = painter.transform;
    const numTiles = Math.pow(2, tile.tileID.overscaledZ);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, transform.tileZoom) / numTiles;
    const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

    // Split the pixel coord into two pairs of 16 bit numbers; glsl guarantees only 16 bits of precision.
    block.write('u_pixel_coord_upper',    [pixelX >> 16, pixelY >> 16]);
    block.write('u_pixel_coord_lower',    [pixelX & 0xFFFF, pixelY & 0xFFFF]);
    block.write('u_tile_units_to_pixels', 1 / pixelsToTileUnits(tile, 1, transform.tileZoom));

    block.attachBuffer(painter.drawableUBOPool.acquire(block.byteLength));
    block.upload();
    return block;
}
