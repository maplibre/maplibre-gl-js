import {Texture} from './texture';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';
import {ColorMode} from '../gl/color_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {Context} from '../gl/context';
import {Framebuffer} from '../gl/framebuffer';
import {Tile} from '../source/tile';
import {
    heatmapUniformValues,
    heatmapTextureUniformValues
} from './program/heatmap_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {HeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import type {HeatmapBucket} from '../data/bucket/heatmap_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }
    const context = painter.context;

    for (const coord of tileIDs) {
        const tile = sourceCache.getTile(coord);
        if (painter.renderPass === 'offscreen') {
            // Skip tiles that have uncovered parents to avoid flickering; we don't need
            // to use complex tile masking here because the change between zoom levels is subtle,
            // so it's fine to simply render the parent until all its 4 children are loaded
            if (sourceCache.hasRenderableParent(coord)) continue;
            prepareHeatmap(painter, tile, layer, coord);
        } else if (painter.renderPass === 'translucent') {
            renderTextureToMap(painter, tile, layer);
        }
    }
    context.viewport.set([0, 0, painter.width, painter.height]);
}

function prepareHeatmap(painter: Painter, tile: Tile, layer: HeatmapStyleLayer, coord: OverscaledTileID) {
    const context = painter.context;
    const gl = context.gl;

    const stencilMode = StencilMode.disabled;
    // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
    const colorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

    const bucket: HeatmapBucket = (tile.getBucket(layer) as any);
    if (!bucket) return;

    let fbo = tile.fbo;
    if (!fbo) {
        fbo = tile.fbo = createHeatmapFbo(context, tile.tileSize);
    }

    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, tile.tileSize, tile.tileSize]);

    context.clear({color: Color.transparent});

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram('heatmap', programConfiguration);
    const {zoom} = painter.transform;

    const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
    const terrainCoord = terrainData ? coord : null;
    program.draw(context, gl.TRIANGLES, DepthMode.disabled, stencilMode, colorMode, CullFaceMode.disabled,
        heatmapUniformValues(coord.posMatrix, tile, zoom, layer.paint.get('heatmap-intensity'), terrainCoord), terrainData,
        layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
        bucket.segments, layer.paint, painter.transform.zoom,
        programConfiguration);

}

function createHeatmapFbo(context: Context, tileSize: number): Framebuffer {
    const gl = context.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const numType = context.HALF_FLOAT;
    const internalFormat = context.RGBA16F ?? gl.RGBA;

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, tileSize, tileSize, 0, gl.RGBA, numType, null);

    const fbo = context.createFramebuffer(tileSize, tileSize, false, false);
    fbo.colorAttachment.set(texture);

    return fbo;
}

function getColorRampTexture(context: Context, layer: HeatmapStyleLayer): Texture {
    if (!layer.colorRampTexture) {
        layer.colorRampTexture = new Texture(context, layer.colorRamp, context.gl.RGBA);
    }
    return layer.colorRampTexture;
}

function renderTextureToMap(painter: Painter, tile: Tile, layer: HeatmapStyleLayer) {
    const context = painter.context;
    const gl = context.gl;

    context.setColorMode(painter.colorModeForRenderPass());

    const colorRampTexture = getColorRampTexture(context, layer);

    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const fbo = tile.fbo;
    if (!fbo) return;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    painter.useProgram('heatmapTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1), null,
        layer.id, painter.rasterBoundsBuffer, painter.quadTriangleIndexBuffer,
        painter.rasterBoundsSegments, layer.paint, painter.transform.zoom);

}

