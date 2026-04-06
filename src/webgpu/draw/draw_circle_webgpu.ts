// WebGPU drawable path for circle layers.
// Extracted from src/render/draw_circle.ts

import {StencilMode} from '../../gl/stencil_mode';
import {DepthMode} from '../../gl/depth_mode';
import {CullFaceMode} from '../../gl/cull_face_mode';
import {circleUniformValues} from '../../render/program/circle_program';
import {SegmentVector} from '../../data/segment';
import {DrawableBuilder} from '../../gfx/drawable_builder';
import {TileLayerGroup} from '../../gfx/tile_layer_group';
import {CircleLayerTweaker} from '../../gfx/tweakers/circle_layer_tweaker';
import {translatePosition} from '../../util/util';

import type {Painter, RenderOptions} from '../../render/painter';
import type {TileManager} from '../../tile/tile_manager';
import type {CircleStyleLayer} from '../../style/style_layer/circle_style_layer';
import type {CircleBucket} from '../../data/bucket/circle_bucket';
import type {OverscaledTileID} from '../../tile/tile_id';

export function drawCirclesWebGPU(painter: Painter, tileManager: TileManager, layer: CircleStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const transform = painter.transform;
    const sortFeaturesByKey = !layer.layout.get('circle-sort-key').isConstant();

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();

    // Get or create tweaker for this layer
    let tweaker = painter.layerTweakers.get(layer.id) as CircleLayerTweaker;
    if (!tweaker) {
        tweaker = new CircleLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    // Get or create layer group
    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    const radiusCorrectionFactor = transform.getCircleRadiusCorrection();

    // Track which tiles are currently visible
    const visibleTileKeys = new Set<string>();

    // Ensure drawables exist for each tile
    const builder = new DrawableBuilder()
        .setShader('circle')
        .setRenderPass('translucent')
        .setDepthMode(depthMode)
        .setStencilMode(stencilMode)
        .setColorMode(colorMode)
        .setCullFaceMode(CullFaceMode.backCCW)
        .setLayerTweaker(tweaker);

    for (const coord of coords) {
        visibleTileKeys.add(coord.key.toString());

        const tile = tileManager.getTile(coord);
        const bucket: CircleBucket<any> = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        // Rebuild drawables for this tile (they're lightweight references to existing buffers)
        // Always rebuild because stencil/color modes can change per frame
        layerGroup.removeDrawablesForTile(coord);

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('circle', programConfiguration);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        const styleTranslate = layer.paint.get('circle-translate');
        const styleTranslateAnchor = layer.paint.get('circle-translate-anchor');
        const translateForUniforms = translatePosition(transform, tile, styleTranslate, styleTranslateAnchor);
        const uniformValues = circleUniformValues(painter, tile, layer, translateForUniforms, radiusCorrectionFactor);

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        if (sortFeaturesByKey) {
            const segments = bucket.segments.get();
            for (const segment of segments) {
                const drawable = builder.flush({
                    tileID: coord,
                    layer,
                    program,
                    programConfiguration,
                    layoutVertexBuffer: bucket.layoutVertexBuffer,
                    indexBuffer: bucket.indexBuffer,
                    segments: new SegmentVector([segment]),
                    projectionData,
                    terrainData: terrainData || null,
                    paintProperties: layer.paint,
                    zoom: painter.transform.zoom,
                });
                drawable.uniformValues = uniformValues as any;
                drawable.drawPriority = (segment.sortKey as any as number) || 0;
                layerGroup.addDrawable(coord, drawable);
            }
        } else {
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
    }

    // Remove drawables for tiles that are no longer visible
    layerGroup.removeDrawablesIf(d => d.tileID !== null && !visibleTileKeys.has(d.tileID.key.toString()));

    // Get all drawables and run the tweaker
    const allDrawables = layerGroup.getAllDrawables();

    // Sort by draw priority if sort keys are used
    if (sortFeaturesByKey) {
        allDrawables.sort((a, b) => a.drawPriority - b.drawPriority);
    }

    // Run tweaker to update per-frame UBOs
    tweaker.execute(allDrawables, painter, layer, coords);

    // Draw all drawables
    for (const drawable of allDrawables) {
        drawable.draw(context, painter.device, painter, renderOptions.renderPass);
    }
}
