// WebGPU drawable path for background layers.
// Extracted from src/render/draw_background.ts

import {StencilMode} from '../../webgl/stencil_mode.ts';
import {DepthMode} from '../../webgl/depth_mode.ts';
import {CullFaceMode} from '../../webgl/cull_face_mode.ts';
import {backgroundUniformValues} from '../../webgl/program/background_program.ts';
import {DrawableBuilder} from '../../gfx/drawable_builder.ts';
import {TileLayerGroup} from '../../gfx/tile_layer_group.ts';
import {BackgroundLayerTweaker} from '../../gfx/tweakers/background_layer_tweaker.ts';
import {coveringTiles} from '../../geo/projection/covering_tiles.ts';

import type {Painter, RenderOptions} from '../../render/painter.ts';
import type {BackgroundStyleLayer} from '../../style/style_layer/background_style_layer.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

export function drawBackgroundWebGPU(painter: Painter, layer: BackgroundStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions): void {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const projection = painter.style.projection;

    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');
    const image = layer.paint.get('background-pattern');
    const hasPattern = !!image;
    const isWebGPU = painter.device?.type === 'webgpu';

    // Pattern backgrounds always render in translucent pass
    const pass = hasPattern ? 'translucent' :
        ((color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer()) ? 'opaque' : 'translucent');
    if (painter.renderPass !== pass && !isRenderingToTexture) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.getDepthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();
    const shaderName = hasPattern ? 'backgroundPattern' : 'background';
    const program = isWebGPU ? null : painter.useProgram(shaderName);

    const tileIDs = coords ? coords : coveringTiles(transform, {tileSize, terrain: painter.style.map.terrain});

    let tweaker = painter.layerTweakers.get(layer.id) as BackgroundLayerTweaker;
    if (!tweaker) {
        tweaker = new BackgroundLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    const visibleTileKeys = new Set<string>();
    (layerGroup as any)._drawablesByTile.clear();

    const builder = new DrawableBuilder()
        .setShader(shaderName)
        .setRenderPass(pass)
        .setDepthMode(depthMode)
        .setStencilMode(stencilMode)
        .setColorMode(colorMode)
        .setCullFaceMode(CullFaceMode.backCCW)
        .setLayerTweaker(tweaker);

    if (hasPattern && isWebGPU) {
        painter.patternAtlas.bind(context);
        const atlasImage = (painter.patternAtlas as any).atlasImage;
        const atlasTexture = (painter.patternAtlas as any).atlasTexture;
        if (atlasImage?.data && atlasImage.width > 0 && atlasImage.height > 0) {
            builder.addTexture({
                name: 'pattern_texture',
                textureUnit: 0,
                texture: atlasTexture?.texture || null,
                filter: gl.LINEAR,
                wrap: gl.CLAMP_TO_EDGE,
                source: {
                    data: atlasImage.data,
                    width: atlasImage.width,
                    height: atlasImage.height,
                    bytesPerPixel: 4,
                    format: 'rgba8unorm',
                },
            } as any);
        }
    }

    for (const tileID of tileIDs) {
        visibleTileKeys.add(tileID.key.toString());

        const mesh = projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');
        const projectionData = transform.getProjectionData({
            overscaledTileID: tileID,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });
        const terrainData = painter.style.map.terrain?.getTerrainData(tileID);

        const drawable = builder.flush({
            tileID,
            layer,
            program,
            programConfiguration: null,
            layoutVertexBuffer: mesh.vertexBuffer,
            indexBuffer: mesh.indexBuffer,
            segments: mesh.segments,
            projectionData,
            terrainData: terrainData || null,
        });

        const uniformValues = backgroundUniformValues(opacity, color);
        drawable.uniformValues = uniformValues as any;
        layerGroup.addDrawable(tileID, drawable);
    }

    layerGroup.removeDrawablesIf(d => d.tileID !== null && !visibleTileKeys.has(d.tileID.key.toString()));

    const allDrawables = layerGroup.getAllDrawables();
    tweaker.execute(allDrawables, painter, layer, tileIDs);

    for (const drawable of allDrawables) {
        drawable.draw(context, painter.device, painter, renderOptions.renderPass);
    }
}
