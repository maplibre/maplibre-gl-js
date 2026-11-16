import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
    fillExtrusionGroundOcclusionUniformValues,
    type FillExtrusionGroundOcclusionUniformsType,
} from '../program/fill_extrusion_program.ts';
import {updatePatternPositionsInProgram} from '../../render/update_pattern_positions_in_program.ts';
import {translatePosition} from '../../util/util.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import type {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';
import type {UniformValues} from '../uniform_binding.ts';
import type {DepthRangeType} from '../types.ts';

/** Shader defines that switch on wall ambient occlusion. */
const WALL_AMBIENT_OCCLUSION_DEFINES = ['#define WALL_AMBIENT_OCCLUSION'];

/** Uniform values of the ground occlusion, rewritten for every tile. */
const groundOcclusionUniformValues: UniformValues<FillExtrusionGroundOcclusionUniformsType> = {
    'u_ao_ground_intensity': 0,
    'u_ao_ground_radius': 0,
    'u_ao_depth_band': 0,
    'u_tile_units_per_meter': 0,
    'u_fill_translate': [0, 0]
};

export function drawFillExtrusion(tileManager: TileManager, layer: FillExtrusionStyleLayer, coords: OverscaledTileID[], frameRenderContext: FrameRenderContext): void {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    if (opacity === 0) {
        return;
    }

    if (frameRenderContext.currentPass === 'translucent') {
        drawGroundOcclusion(tileManager, layer, coords, frameRenderContext);

        const depthMode = new DepthMode(frameRenderContext.context.gl.LEQUAL, DepthMode.ReadWrite, frameRenderContext.depthRangeFor3D);

        if (opacity === 1 && !layer.paint.get('fill-extrusion-pattern').constantOr(1 as any)) {
            const colorMode = frameRenderContext.colorModeForRenderPass();
            drawExtrusionTiles(tileManager, layer, coords, depthMode, StencilMode.disabled, colorMode, frameRenderContext);

        } else {
            // Draw transparent buildings in two passes so that only the closest surface is drawn.
            // First draw all the extrusions into only the depth buffer. No colors are drawn.
            drawExtrusionTiles(tileManager, layer, coords, depthMode,
                StencilMode.disabled,
                ColorMode.disabled, frameRenderContext);

            // Then draw all the extrusions a second type, only coloring fragments if they have the
            // same depth value as the closest fragment in the previous pass. Use the stencil buffer
            // to prevent the second draw in cases where we have coincident polygons.
            drawExtrusionTiles(tileManager, layer, coords, depthMode,
                frameRenderContext.stencilModeFor3D(),
                frameRenderContext.colorModeForRenderPass(), frameRenderContext);
        }
    }
}

/** Translation of the ground occlusion, rewritten for every tile. */
const groundOcclusionTranslate: [number, number] = [0, 0];

/** `strongest` keeps the depth of the strongest strip, `darken` only tests against it. */
type GroundOcclusionDepthModes = {
    range: DepthRangeType;
    strongest: DepthMode;
    darken: DepthMode;
};

/** Kept until the depth range of 3D layers changes. */
let groundOcclusionDepthModes: GroundOcclusionDepthModes | undefined;

function depthModesForGroundOcclusion(gl: WebGLRenderingContextBase, range: DepthRangeType): GroundOcclusionDepthModes {
    const cached = groundOcclusionDepthModes;
    if (cached?.range[0] === range[0] && cached.range[1] === range[1]) return cached;

    const copy: DepthRangeType = [range[0], range[1]];
    groundOcclusionDepthModes = {
        range: copy,
        strongest: new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, copy),
        darken: new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, copy)
    };
    return groundOcclusionDepthModes;
}

/** The strips need vertex array objects of their own; sharing the extrusions' key rebuilds them on every draw. */
const groundOcclusionVertexArrayKeys = new WeakMap<FillExtrusionStyleLayer, string>();

/** Layers drawing ground occlusion beyond this many in a frame share the nearest depth band. */
const GROUND_OCCLUSION_DEPTH_BANDS = 4;

/**
 * Darkens the ground around the foot of the walls, by the nearest wall within reach.
 *
 * Each wall quad is drawn again, laid flat on the ground and stretched past convex corners. Where
 * strips overlap, a depth-only draw keeps the strongest and a stencilled colour draw applies it once.
 *
 * Each layer's strips take a band of depths nearer than the bands of the layers drawn before it, so
 * they pass over those layers' strips everywhere instead of tying with them, and darken on top.
 */
function drawGroundOcclusion(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    frameRenderContext: FrameRenderContext) {
    const intensity = layer.paint.get('fill-extrusion-ambient-occlusion-ground-intensity');
    const radius = layer.paint.get('fill-extrusion-ambient-occlusion-ground-radius');
    if (!(intensity > 0 && radius > 0)) return;

    groundOcclusionUniformValues['u_ao_depth_band'] = Math.max(GROUND_OCCLUSION_DEPTH_BANDS - 1 - frameRenderContext.groundOcclusionLayers++, 0);
    const depthModes = depthModesForGroundOcclusion(frameRenderContext.context.gl, frameRenderContext.depthRangeFor3D);
    drawGroundOcclusionTiles(tileManager, layer, coords, depthModes.strongest, StencilMode.disabled, ColorMode.disabled, frameRenderContext);
    drawGroundOcclusionTiles(tileManager, layer, coords, depthModes.darken, frameRenderContext.stencilModeFor3D(), frameRenderContext.colorModeForRenderPass(), frameRenderContext);
}

function drawGroundOcclusionTiles(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    frameRenderContext: FrameRenderContext) {
    const context = frameRenderContext.context;
    const transform = frameRenderContext.transform;
    const intensity = layer.paint.get('fill-extrusion-ambient-occlusion-ground-intensity');
    const radius = layer.paint.get('fill-extrusion-ambient-occlusion-ground-radius');
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const translate = layer.paint.get('fill-extrusion-translate');
    const translateAnchor = layer.paint.get('fill-extrusion-translate-anchor');

    let vertexArrayKey = groundOcclusionVertexArrayKeys.get(layer);
    if (vertexArrayKey === undefined) {
        vertexArrayKey = `${layer.id}$ground-occlusion`;
        groundOcclusionVertexArrayKeys.set(layer, vertexArrayKey);
    }

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = frameRenderContext.useProgram('fillExtrusionGroundOcclusion', programConfiguration);
        const tileTranslate = translatePosition(transform, tile, translate, translateAnchor, false, groundOcclusionTranslate);
        fillExtrusionGroundOcclusionUniformValues(groundOcclusionUniformValues, intensity, opacity, radius, tileTranslate, coord.canonical);

        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            groundOcclusionUniformValues, frameRenderContext.getTerrainDataForTile(coord), frameRenderContext.getProjectionDataForTile(coord),
            vertexArrayKey, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments, layer.paint, transform.zoom, programConfiguration);
    }
}

function drawExtrusionTiles(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    depthMode: DepthMode,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    frameRenderContext: FrameRenderContext) {
    const context = frameRenderContext.context;
    const gl = context.gl;
    const fillPropertyName = 'fill-extrusion-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const constantPattern = patternProperty.constantOr(null);
    const projectedCamera = frameRenderContext.projectedCamera;
    const aoWallIntensity = layer.paint.get('fill-extrusion-ambient-occlusion-wall-intensity');
    const aoWallRadius = layer.paint.get('fill-extrusion-ambient-occlusion-wall-radius');
    const defines = aoWallIntensity > 0 && aoWallRadius > 0 ? WALL_AMBIENT_OCCLUSION_DEFINES : undefined;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const terrainData = frameRenderContext.getTerrainDataForTile(coord);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = frameRenderContext.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration, false, defines);

        if (image) {
            context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        }

        const projectionData = frameRenderContext.getProjectionDataForTile(coord);
        updatePatternPositionsInProgram(programConfiguration, fillPropertyName, constantPattern, tile, layer);

        const translate = translatePosition(
            projectedCamera,
            tile,
            layer.paint.get('fill-extrusion-translate'),
            layer.paint.get('fill-extrusion-translate-anchor')
        );

        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const uniformValues = image ?
            fillExtrusionPatternUniformValues(projectedCamera, frameRenderContext.data.light, shouldUseVerticalGradient, opacity, translate, aoWallIntensity, aoWallRadius, coord, crossfade, tile) :
            fillExtrusionUniformValues(projectedCamera, frameRenderContext.data.light, shouldUseVerticalGradient, opacity, translate, aoWallIntensity, aoWallRadius);

        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, frameRenderContext.projectedCamera.zoom,
            programConfiguration, frameRenderContext.terrain && bucket.centroidVertexBuffer);
    }
}
