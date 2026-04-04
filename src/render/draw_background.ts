import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {
    backgroundUniformValues,
    backgroundPatternUniformValues
} from './program/background_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {BackgroundStyleLayer} from '../style/style_layer/background_style_layer';
import {type OverscaledTileID} from '../tile/tile_id';
import {coveringTiles} from '../geo/projection/covering_tiles';

// Drawable imports
import {DrawableBuilder} from './drawable/drawable_builder';
import {TileLayerGroup} from './drawable/tile_layer_group';
import {BackgroundLayerTweaker} from './drawable/tweakers/background_layer_tweaker';

export function drawBackground(painter: Painter, tileManager: TileManager, layer: BackgroundStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');

    if (opacity === 0) return;

    const image = layer.paint.get('background-pattern');

    // Use drawable path for solid-color backgrounds (both WebGL2 and WebGPU)
    if (painter.useDrawables && painter.useDrawables.has('background') && !image) {
        drawBackgroundDrawable(painter, layer, coords, renderOptions);
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const projection = painter.style.projection;
    const transform = painter.transform;
    const tileSize = transform.tileSize;

    if (painter.isPatternMissing(image)) return;

    const pass = (!image && color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer()) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.getDepthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram(image ? 'backgroundPattern' : 'background');
    const tileIDs = coords ? coords : coveringTiles(transform, {tileSize, terrain: painter.style.map.terrain});

    if (image) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.imageManager.bind(painter.context);
    }

    const crossfade = layer.getCrossfadeParameters();

    for (const tileID of tileIDs) {
        const projectionData = transform.getProjectionData({
            overscaledTileID: tileID,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        const uniformValues = image ?
            backgroundPatternUniformValues(opacity, painter, image, {tileID, tileSize}, crossfade) :
            backgroundUniformValues(opacity, color);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(tileID);

        // For globe rendering, background uses tile meshes *without* borders and no stencil clipping.
        // This works assuming the tileIDs list contains only tiles of the same zoom level.
        // This seems to always be the case for background layers, but I'm leaving this comment
        // here in case this assumption is false in the future.

        // In case background starts having tiny holes at tile boundaries, switch to meshes with borders
        // and also enable stencil clipping. Make sure to render a proper tile clipping mask into stencil
        // first though, as that doesn't seem to happen for background layers as of writing this.

        const mesh = projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues as any, terrainData as any, projectionData as any, layer.id,
            mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

function drawBackgroundDrawable(painter: Painter, layer: BackgroundStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const projection = painter.style.projection;

    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');
    const pass = (color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer()) ? 'opaque' : 'translucent';
    // When rendering to texture (terrain), draw regardless of pass since RTT skips the opaque pass
    if (painter.renderPass !== pass && !isRenderingToTexture) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.getDepthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();
    // Create WebGL program (null for WebGPU which uses WGSL shaders)
    const isWebGPU = painter.device?.type === 'webgpu';
    const program = isWebGPU ? null : painter.useProgram('background');

    const tileIDs = coords ? coords : coveringTiles(transform, {tileSize, terrain: painter.style.map.terrain});

    // Get or create tweaker
    let tweaker = painter.layerTweakers.get(layer.id) as BackgroundLayerTweaker;
    if (!tweaker) {
        tweaker = new BackgroundLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    // Get or create layer group
    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    const visibleTileKeys = new Set<string>();

    // Always rebuild drawables so paint property changes (e.g. setPaintProperty) take effect.
    (layerGroup as any)._drawablesByTile.clear();

    const builder = new DrawableBuilder()
        .setShader('background')
        .setRenderPass(pass)
        .setDepthMode(depthMode)
        .setStencilMode(stencilMode)
        .setColorMode(colorMode)
        .setCullFaceMode(CullFaceMode.backCCW)
        .setLayerTweaker(tweaker);

    for (const tileID of tileIDs) {
        visibleTileKeys.add(tileID.key.toString());

        const mesh = projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');
        const projectionData = transform.getProjectionData({
            overscaledTileID: tileID,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(tileID);

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
