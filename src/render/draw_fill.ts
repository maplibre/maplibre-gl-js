import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {ColorMode} from '../gl/color_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from './program/fill_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import type {FillBucket} from '../data/bucket/fill_bucket';
import type {OverscaledTileID} from '../source/tile_id';
import {updatePatternPositionsInProgram} from './update_pattern_positions_in_program';
import {StencilMode} from '../gl/stencil_mode';
import {translatePosition} from '../util/util';

export function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');

    if (opacity.constantOr(1) === 0) {
        return;
    }

    const colorMode = painter.colorModeForRenderPass();

    const pattern = layer.paint.get('fill-pattern');
    const pass = painter.opaquePassEnabledForLayer() &&
        (!pattern.constantOr(1 as any) &&
            color.constantOr(Color.transparent).a === 1 &&
            opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

    // Draw fill
    if (painter.renderPass === pass) {
        const depthMode = painter.depthModeForSublayer(
            1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
        drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, false);
    }

    // Draw stroke
    if (painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {

        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        const depthMode = painter.depthModeForSublayer(
            layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, true);
    }
}

function drawFillTiles(
    painter: Painter,
    sourceCache: SourceCache,
    layer: FillStyleLayer,
    coords: Array<OverscaledTileID>,
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    isOutline: boolean) {
    const gl = painter.context.gl;
    const fillPropertyName = 'fill-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty && patternProperty.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();
    let drawMode, programName, uniformValues, indexBuffer, segments;

    const transform = painter.transform;

    const propertyFillTranslate = layer.paint.get('fill-translate');
    const propertyFillTranslateAnchor = layer.paint.get('fill-translate-anchor');

    if (!isOutline) {
        programName = image ? 'fillPattern' : 'fill';
        drawMode = gl.TRIANGLES;
    } else {
        programName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
        drawMode = gl.LINES;
    }

    const constantPattern = patternProperty.constantOr(null);

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: FillBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram(programName, programConfiguration);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        }

        updatePatternPositionsInProgram(programConfiguration, fillPropertyName, constantPattern, tile, layer);

        const projectionData = transform.getProjectionData(coord);

        const translateForUniforms = translatePosition(transform, tile, propertyFillTranslate, propertyFillTranslateAnchor);

        if (!isOutline) {
            indexBuffer = bucket.indexBuffer;
            segments = bucket.segments;
            uniformValues = image ? fillPatternUniformValues(painter, crossfade, tile, translateForUniforms) : fillUniformValues(translateForUniforms);
        } else {
            indexBuffer = bucket.indexBuffer2;
            segments = bucket.segments2;
            const drawingBufferSize = [gl.drawingBufferWidth, gl.drawingBufferHeight] as [number, number];
            uniformValues = (programName === 'fillOutlinePattern' && image) ?
                fillOutlinePatternUniformValues(painter, crossfade, tile, drawingBufferSize, translateForUniforms) :
                fillOutlineUniformValues(drawingBufferSize, translateForUniforms);
        }

        // Stencil is not really needed for anything unless we are drawing transparent things.
        //
        // For translucent layers, we must draw any pixel of a given layer at most once,
        // otherwise we might get artifacts from the transparent geometry being drawn twice over itself,
        // which can happen due to tiles having a slight overlapping border into neighboring tiles.
        // Hence we use stencil tile masks for any translucent pass, including for fill.
        //
        // Globe rendering relies on these tile borders to hide tile seams, since under globe projection
        // tiles are not squares, but slightly curved squares. At high zoom levels, the tile stencil mask
        // is approximated by a square, but if the tile contains fine geometry, it might still get projected
        // into a curved shape, causing a mismatch with the stencil mask, which is very visible
        // if the tile border is small.
        //
        // The simples workaround for this is to just disable stencil masking for opaque fill layers,
        // since the fine geometry will always line up perfectly with the geometry in its neighboring tiles,
        // even if the border is small. Disabling stencil ensures the neighboring geometry isn't clipped.
        //
        // This doesn't seem to be an issue for transparent fill layers (or they don't get used enough to be noticeable),
        // which is a good thing, since there is no easy solution for this problem for transparency, other than
        // greatly increasing subdivision granularity for both fill layers and stencil masks, at least at tile edges.
        const stencil = (painter.renderPass === 'translucent') ? painter.stencilModeForClipping(coord) : StencilMode.disabled;

        program.draw(painter.context, drawMode, depthMode,
            stencil, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, projectionData,
            layer.id, bucket.layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}
