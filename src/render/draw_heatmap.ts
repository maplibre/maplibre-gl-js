import {Texture} from './texture';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';
import {ColorMode} from '../gl/color_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type Context} from '../gl/context';
import {type Framebuffer} from '../gl/framebuffer';
import {type Tile} from '../source/tile';
import {
    heatmapUniformValues,
    heatmapTextureUniformValues
} from './program/heatmap_program';
import {HEATMAP_FULL_RENDER_FBO_KEY} from '../style/style_layer/heatmap_style_layer';

import type {Painter, RenderOptions} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {HeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import type {HeatmapBucket} from '../data/bucket/heatmap_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }
    const context = painter.context;
    const {isRenderingToTexture, isRenderingGlobe} = renderOptions;

    if (painter.style.map.terrain) {
        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            // Skip tiles that have uncovered parents to avoid flickering; we don't need
            // to use complex tile masking here because the change between zoom levels is subtle,
            // so it's fine to simply render the parent until all its 4 children are loaded
            if (sourceCache.hasRenderableParent(coord)) continue;
            if (painter.renderPass === 'offscreen') {
                prepareHeatmapTerrain(painter, tile, layer, coord, isRenderingGlobe);
            } else if (painter.renderPass === 'translucent') {
                renderHeatmapTerrain(painter, layer, coord, isRenderingToTexture, isRenderingGlobe);
            }
        }
        context.viewport.set([0, 0, painter.width, painter.height]);
    } else {
        if (painter.renderPass === 'offscreen') {
            prepareHeatmapFlat(painter, sourceCache, layer, tileIDs);
        } else if (painter.renderPass === 'translucent') {
            renderHeatmapFlat(painter, layer);
        }

    }
}

function prepareHeatmapFlat(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, coords: Array<OverscaledTileID>) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    // Allow kernels to be drawn across boundaries, so that
    // large kernels are not clipped to tiles
    const stencilMode = StencilMode.disabled;
    // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
    const colorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

    bindFramebuffer(context, painter, layer);

    context.clear({color: Color.transparent});

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        // Skip tiles that have uncovered parents to avoid flickering; we don't need
        // to use complex tile masking here because the change between zoom levels is subtle,
        // so it's fine to simply render the parent until all its 4 children are loaded
        if (sourceCache.hasRenderableParent(coord)) continue;

        const tile = sourceCache.getTile(coord);
        const bucket: HeatmapBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('heatmap', programConfiguration);

        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: true, applyTerrainMatrix: false});

        const radiusCorrectionFactor = transform.getCircleRadiusCorrection();

        program.draw(context, gl.TRIANGLES, DepthMode.disabled, stencilMode, colorMode, CullFaceMode.backCCW,
            heatmapUniformValues(tile, transform.zoom, layer.paint.get('heatmap-intensity'), radiusCorrectionFactor),
            null, projectionData,
            layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, transform.zoom,
            programConfiguration);
    }

    context.viewport.set([0, 0, painter.width, painter.height]);
}

function renderHeatmapFlat(painter: Painter, layer: HeatmapStyleLayer) {
    const context = painter.context;
    const gl = context.gl;

    context.setColorMode(painter.colorModeForRenderPass());

    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const fbo = layer.heatmapFbos.get(HEATMAP_FULL_RENDER_FBO_KEY);
    if (!fbo) return;
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    const colorRampTexture = getColorRampTexture(context, layer);
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    painter.useProgram('heatmapTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

function prepareHeatmapTerrain(painter: Painter, tile: Tile, layer: HeatmapStyleLayer, coord: OverscaledTileID, isRenderingGlobe: boolean) {
    const context = painter.context;
    const gl = context.gl;

    const stencilMode = StencilMode.disabled;
    // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
    const colorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

    const bucket: HeatmapBucket = (tile.getBucket(layer) as any);
    if (!bucket) return;

    const tileKey = coord.key;
    let fbo = layer.heatmapFbos.get(tileKey);
    if (!fbo) {
        fbo = createHeatmapFbo(context, tile.tileSize, tile.tileSize);
        layer.heatmapFbos.set(tileKey, fbo);
    }

    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, tile.tileSize, tile.tileSize]);

    context.clear({color: Color.transparent});

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram('heatmap', programConfiguration, !isRenderingGlobe);

    const projectionData = painter.transform.getProjectionData({overscaledTileID: tile.tileID, applyGlobeMatrix: true, applyTerrainMatrix: true});

    const terrainData = painter.style.map.terrain.getTerrainData(coord);
    program.draw(context, gl.TRIANGLES, DepthMode.disabled, stencilMode, colorMode, CullFaceMode.disabled,
        heatmapUniformValues(tile, painter.transform.zoom, layer.paint.get('heatmap-intensity'), 1.0), terrainData, projectionData,
        layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
        bucket.segments, layer.paint, painter.transform.zoom,
        programConfiguration);
}

function renderHeatmapTerrain(painter: Painter, layer: HeatmapStyleLayer, coord: OverscaledTileID, isRenderingToTexture: boolean, isRenderingGlobe: boolean) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    context.setColorMode(painter.colorModeForRenderPass());

    const colorRampTexture = getColorRampTexture(context, layer);

    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const tileKey = coord.key;
    const fbo = layer.heatmapFbos.get(tileKey);
    if (!fbo) return;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    const projectionData = transform.getProjectionData({overscaledTileID: coord, applyTerrainMatrix: isRenderingGlobe, applyGlobeMatrix: !isRenderingToTexture});

    painter.useProgram('heatmapTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1), null, projectionData,
        layer.id, painter.rasterBoundsBuffer, painter.quadTriangleIndexBuffer,
        painter.rasterBoundsSegments, layer.paint, transform.zoom);

    // destroy the FBO after rendering
    fbo.destroy();
    layer.heatmapFbos.delete(tileKey);
}

function bindFramebuffer(context: Context, painter: Painter, layer: HeatmapStyleLayer) {
    const gl = context.gl;
    context.activeTexture.set(gl.TEXTURE1);

    // Use a 4x downscaled screen texture for better performance
    context.viewport.set([0, 0, painter.width / 4, painter.height / 4]);

    let fbo = layer.heatmapFbos.get(HEATMAP_FULL_RENDER_FBO_KEY);

    if (!fbo) {
        fbo = createHeatmapFbo(context, painter.width / 4, painter.height / 4);
        layer.heatmapFbos.set(HEATMAP_FULL_RENDER_FBO_KEY, fbo);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
        context.bindFramebuffer.set(fbo.framebuffer);
    }
}

function createHeatmapFbo(context: Context, width: number, height: number): Framebuffer {
    const gl = context.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Use the higher precision half-float texture where available (producing much smoother looking heatmaps);
    // Otherwise, fall back to a low precision texture
    const numType = context.HALF_FLOAT ?? gl.UNSIGNED_BYTE;
    const internalFormat = context.RGBA16F ?? gl.RGBA;

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, numType, null);

    const fbo = context.createFramebuffer(width, height, false, false);
    fbo.colorAttachment.set(texture);

    return fbo;
}

function getColorRampTexture(context: Context, layer: HeatmapStyleLayer): Texture {
    if (!layer.colorRampTexture) {
        layer.colorRampTexture = new Texture(context, layer.colorRamp, context.gl.RGBA);
    }
    return layer.colorRampTexture;
}
