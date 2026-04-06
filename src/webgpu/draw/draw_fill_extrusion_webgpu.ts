// WebGPU drawable path for fill-extrusion layers.
// Extracted from src/render/draw_fill_extrusion.ts

import {DepthMode} from '../../gl/depth_mode';
import {StencilMode} from '../../gl/stencil_mode';
import {CullFaceMode} from '../../gl/cull_face_mode';
import {fillExtrusionUniformValues} from '../../render/program/fill_extrusion_program';
import {DrawableBuilder} from '../../gfx/drawable_builder';
import {TileLayerGroup} from '../../gfx/tile_layer_group';
import {UniformBlock} from '../../gfx/uniform_block';
import {LayerTweaker} from '../../gfx/layer_tweaker';
import {translatePosition} from '../../util/util';

import type {Painter, RenderOptions} from '../../render/painter';
import type {TileManager} from '../../tile/tile_manager';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import type {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket';
import type {OverscaledTileID} from '../../tile/tile_id';

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

export function drawFillExtrusionWebGPU(painter: Painter, tileManager: TileManager, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
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
