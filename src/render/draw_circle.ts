import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type Program} from './program';
import {circleUniformValues} from './program/circle_program';
import {SegmentVector} from '../data/segment';
import {LumaModel} from './luma_model';
import {type OverscaledTileID} from '../tile/tile_id';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {CircleStyleLayer} from '../style/style_layer/circle_style_layer';
import type {CircleBucket} from '../data/bucket/circle_bucket';
import type {ProgramConfiguration} from '../data/program_configuration';
import type {VertexBuffer} from '../gl/vertex_buffer';
import type {IndexBuffer} from '../gl/index_buffer';
import type {UniformValues} from './uniform_binding';
import type {CircleUniformsType} from './program/circle_program';
import type {TerrainData} from '../render/terrain';
import {translatePosition} from '../util/util';
import type {ProjectionData} from '../geo/projection/projection_data';

// Drawable imports
import {DrawableBuilder} from './drawable/drawable_builder';
import {TileLayerGroup} from './drawable/tile_layer_group';
import {CircleLayerTweaker} from './drawable/tweakers/circle_layer_tweaker';

type TileRenderState = {
    programConfiguration: ProgramConfiguration;
    program: Program<any>;
    layoutVertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    uniformValues: UniformValues<CircleUniformsType>;
    terrainData: TerrainData;
    projectionData: ProjectionData;
};

type SegmentsTileRenderState = {
    segments: SegmentVector;
    sortKey: number;
    state: TileRenderState;
};

export function drawCircles(painter: Painter, tileManager: TileManager, layer: CircleStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;

    const {isRenderingToTexture} = renderOptions;
    const opacity = layer.paint.get('circle-opacity');
    const strokeWidth = layer.paint.get('circle-stroke-width');
    const strokeOpacity = layer.paint.get('circle-stroke-opacity');
    const sortFeaturesByKey = !layer.layout.get('circle-sort-key').isConstant();

    if (opacity.constantOr(1) === 0 && (strokeWidth.constantOr(1) === 0 || strokeOpacity.constantOr(1) === 0)) {
        return;
    }

    // Use drawable path if enabled
    if (painter.useDrawables && painter.useDrawables.has('circle')) {
        drawCirclesDrawable(painter, tileManager, layer, coords, renderOptions);
        return;
    }

    // Legacy path
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    // Turn off stencil testing to allow circles to be drawn across boundaries,
    // so that large circles are not clipped to tiles
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();

    const segmentsRenderStates: Array<SegmentsTileRenderState> = [];

    // Note: due to how the shader is written, this value only has effect when globe rendering is enabled and `circle-pitch-alignment` is set to 'map'.
    const radiusCorrectionFactor = transform.getCircleRadiusCorrection();

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        const tile = tileManager.getTile(coord);
        const bucket: CircleBucket<any> = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const styleTranslate = layer.paint.get('circle-translate');
        const styleTranslateAnchor = layer.paint.get('circle-translate-anchor');
        const translateForUniforms = translatePosition(transform, tile, styleTranslate, styleTranslateAnchor);

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('circle', programConfiguration);
        const layoutVertexBuffer = bucket.layoutVertexBuffer;
        const indexBuffer = bucket.indexBuffer;
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const uniformValues = circleUniformValues(painter, tile, layer, translateForUniforms, radiusCorrectionFactor);

        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});

        const state: TileRenderState = {
            programConfiguration,
            program,
            layoutVertexBuffer,
            indexBuffer,
            uniformValues,
            terrainData,
            projectionData
        };

        if (sortFeaturesByKey) {
            const oldSegments = bucket.segments.get();
            for (const segment of oldSegments) {
                segmentsRenderStates.push({
                    segments: new SegmentVector([segment]),
                    sortKey: (segment.sortKey as any as number),
                    state
                });
            }
        } else {
            segmentsRenderStates.push({
                segments: bucket.segments,
                sortKey: 0,
                state
            });
        }

    }

    if (sortFeaturesByKey) {
        segmentsRenderStates.sort((a, b) => a.sortKey - b.sortKey);
    }

    for (const segmentsState of segmentsRenderStates) {
        const {programConfiguration, program, layoutVertexBuffer, indexBuffer, uniformValues, terrainData, projectionData} = segmentsState.state;
        const segments = segmentsState.segments;

        const lumaModel = new LumaModel(
            painter.device,
            program,
            layoutVertexBuffer,
            indexBuffer,
            segments,
            programConfiguration
        );
        lumaModel.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues as any, terrainData as any, projectionData as any, layer.id,
            layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration,
            null, null, null, renderOptions);
    }
}

/**
 * Drawable-based rendering path for circles.
 * Creates drawables on demand, updates per-frame via tweaker, then draws.
 */
function drawCirclesDrawable(painter: Painter, tileManager: TileManager, layer: CircleStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
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
