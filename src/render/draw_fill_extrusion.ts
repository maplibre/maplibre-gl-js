import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';
import {ColorMode} from '../gl/color_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
} from './program/fill_extrusion_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {FillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer';
import type {FillExtrusionBucket} from '../data/bucket/fill_extrusion_bucket';
import type {OverscaledTileID} from '../tile/tile_id';

import {updatePatternPositionsInProgram} from './update_pattern_positions_in_program';
import {translatePosition} from '../util/util';
import {LumaModel} from './luma_model';
import {DrawableBuilder} from './drawable/drawable_builder';
import {TileLayerGroup} from './drawable/tile_layer_group';
import {UniformBlock} from './drawable/uniform_block';
import {LayerTweaker} from './drawable/layer_tweaker';

export function drawFillExtrusion(painter: Painter, tileManager: TileManager, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    if (opacity === 0) {
        return;
    }

    // Use drawable path for WebGPU
    if (painter.useDrawables && painter.useDrawables.has('fill-extrusion')) {
        drawFillExtrusionDrawable(painter, tileManager, layer, coords, renderOptions);
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    if (painter.renderPass === 'translucent') {
        const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

        if (opacity === 1 && !layer.paint.get('fill-extrusion-pattern').constantOr(1 as any)) {
            const colorMode = painter.colorModeForRenderPass();
            drawExtrusionTiles(painter, tileManager, layer, coords, depthMode, StencilMode.disabled, colorMode, isRenderingToTexture);

        } else {
            // Draw transparent buildings in two passes so that only the closest surface is drawn.
            // First draw all the extrusions into only the depth buffer. No colors are drawn.
            drawExtrusionTiles(painter, tileManager, layer, coords, depthMode,
                StencilMode.disabled,
                ColorMode.disabled, isRenderingToTexture);

            // Then draw all the extrusions a second type, only coloring fragments if they have the
            // same depth value as the closest fragment in the previous pass. Use the stencil buffer
            // to prevent the second draw in cases where we have coincident polygons.
            drawExtrusionTiles(painter, tileManager, layer, coords, depthMode,
                painter.stencilModeFor3D(),
                painter.colorModeForRenderPass(), isRenderingToTexture);
        }
    }
}

function drawExtrusionTiles(
    painter: Painter,
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    depthMode: DepthMode,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    isRenderingToTexture: boolean) {
    const context = painter.context;
    const gl = context.gl;
    const fillPropertyName = 'fill-extrusion-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const constantPattern = patternProperty.constantOr(null);
    const transform = painter.transform;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        }

        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});
        updatePatternPositionsInProgram(programConfiguration, fillPropertyName, constantPattern, tile, layer);

        const translate = translatePosition(
            transform,
            tile,
            layer.paint.get('fill-extrusion-translate'),
            layer.paint.get('fill-extrusion-translate-anchor')
        );

        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const uniformValues = image ?
            fillExtrusionPatternUniformValues(painter, shouldUseVerticalGradient, opacity, translate, coord, crossfade, tile) :
            fillExtrusionUniformValues(painter, shouldUseVerticalGradient, opacity, translate);

        const lumaModel = new LumaModel(
            painter.device,
            program,
            bucket.layoutVertexBuffer,
            bucket.indexBuffer,
            bucket.segments
        );

        lumaModel.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues as any, terrainData as any, projectionData as any, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, painter.transform.zoom,
            programConfiguration, painter.style.map.terrain && bucket.centroidVertexBuffer);
    }
}

class FillExtrusionLayerTweaker extends LayerTweaker {
    execute(drawables: any[], painter: Painter, layer: any, _coords: any[]): void {
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            // FillExtrusionDrawableUBO: matrix(64) + lightpos_and_intensity(16) + lightcolor(16) +
            //   vertical_gradient(4) + opacity(4) + base_t(4) + height_t(4) + color_t(4) + pad(12) = 128
            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(128);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // Set lighting and opacity from uniformValues
            if (drawable.uniformValues) {
                const uv = drawable.uniformValues as any;
                if (uv.u_lightpos) drawable.drawableUBO.setVec4(64, uv.u_lightpos[0], uv.u_lightpos[1], uv.u_lightpos[2], uv.u_lightintensity || 0);
                if (uv.u_lightcolor) drawable.drawableUBO.setVec4(80, uv.u_lightcolor[0], uv.u_lightcolor[1], uv.u_lightcolor[2], 0);
                drawable.drawableUBO.setFloat(96, uv.u_vertical_gradient ? 1.0 : 0.0);
                drawable.drawableUBO.setFloat(100, uv.u_opacity || 1.0);
            }

            // Props UBO for evaluated properties
            if (!drawable.layerUBO) {
                const propsUBO = new UniformBlock(32);
                const paint = (layer as FillExtrusionStyleLayer).paint;
                const color = paint.get('fill-extrusion-color').constantOr(null);
                if (color) propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
                const base = paint.get('fill-extrusion-base').constantOr(null);
                if (base !== null) propsUBO.setFloat(16, base);
                const height = paint.get('fill-extrusion-height').constantOr(null);
                if (height !== null) propsUBO.setFloat(20, height);
                drawable.layerUBO = propsUBO;
            }
        }
    }
}

function drawFillExtrusionDrawable(painter: Painter, tileManager: TileManager, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const {isRenderingToTexture} = renderOptions;
    if (painter.renderPass !== 'translucent') return;

    const context = painter.context;
    const gl = context.gl;
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const pattern = layer.paint.get('fill-extrusion-pattern');
    const image = pattern && pattern.constantOr(1 as any);
    const transform = painter.transform;

    // Skip pattern variant for now
    if (image) return;

    const depthMode = new DepthMode(gl.LEQUAL || 515, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const colorMode = painter.colorModeForRenderPass();

    let tweaker = painter.layerTweakers.get(layer.id) as FillExtrusionLayerTweaker;
    if (!tweaker) {
        tweaker = new FillExtrusionLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    (layerGroup as any)._drawablesByTile.clear();

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});

        const translate = translatePosition(
            transform, tile,
            layer.paint.get('fill-extrusion-translate'),
            layer.paint.get('fill-extrusion-translate-anchor')
        );
        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const uniformValues = fillExtrusionUniformValues(painter, shouldUseVerticalGradient, opacity, translate);

        const isWebGPU = painter.device?.type === 'webgpu';
        const program = isWebGPU ? null : painter.useProgram('fillExtrusion', programConfiguration);

        const builder = new DrawableBuilder()
            .setShader('fillExtrusion')
            .setRenderPass('translucent')
            .setDepthMode(depthMode)
            .setStencilMode(StencilMode.disabled)
            .setColorMode(colorMode)
            .setCullFaceMode(CullFaceMode.backCCW)
            .setLayerTweaker(tweaker);

        const drawable = builder.flush({
            tileID: coord,
            layer,
            program,
            programConfiguration,
            layoutVertexBuffer: bucket.layoutVertexBuffer,
            indexBuffer: bucket.indexBuffer,
            segments: bucket.segments,
            projectionData,
            terrainData: terrainData || null,
            paintProperties: layer.paint,
            zoom: painter.transform.zoom,
        });
        drawable.uniformValues = uniformValues as any;
        layerGroup.addDrawable(coord, drawable);
    }

    const allDrawables = layerGroup.getAllDrawables();
    tweaker.execute(allDrawables, painter, layer, coords);

    for (const drawable of allDrawables) {
        drawable.draw(context, painter.device, painter, renderOptions.renderPass);
    }
}
