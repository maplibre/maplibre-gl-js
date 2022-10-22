import Color from '../style-spec/util/color';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import ColorMode from '../gl/color_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from './program/fill_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type {OverscaledTileID} from '../source/tile_id';
import type {CrossFaded} from '../style/properties';
import type ResolvedImage from '../style-spec/expression/types/resolved_image';
import type Tile from '../source/tile';
import type ProgramConfiguration from '../data/program_configuration';

function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
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

        findPatternPositions(fillPropertyName, constantPattern, tile, layer, programConfiguration);

        const terrainCoord = terrainData ? coord : null;
        const posMatrix = terrainCoord ? terrainCoord.posMatrix : coord.posMatrix;
        const tileMatrix = painter.translatePosMatrix(posMatrix, tile,
            layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

        if (!isOutline) {
            indexBuffer = bucket.indexBuffer;
            segments = bucket.segments;
            uniformValues = image ?
                fillPatternUniformValues(tileMatrix, painter, crossfade, tile) :
                fillUniformValues(tileMatrix);
        } else {
            indexBuffer = bucket.indexBuffer2;
            segments = bucket.segments2;
            const drawingBufferSize = [gl.drawingBufferWidth, gl.drawingBufferHeight] as [number, number];
            uniformValues = (programName === 'fillOutlinePattern' && image) ?
                fillOutlinePatternUniformValues(tileMatrix, painter, crossfade, tile, drawingBufferSize) :
                fillOutlineUniformValues(tileMatrix, drawingBufferSize);
        }

        program.draw(painter.context, drawMode, depthMode,
            painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues, terrainData,
            layer.id, bucket.layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}

/**
 * Simple helper function shared by draw_fill and draw_fill_extrusions to correctly find images from tile.imageAtlas.
 * For transtionable properties, especially 'fill-pattern' and 'fill-extrusion-pattern', at certain frames
 * tile.imageAtlas has been updated by worker to holds the new pattern only, but code here is still looking for previous images,
 * causing a few corrupted frames in which setConstantPatternPositions method is not called and pixelRatio is always the
 * default of 1, instead of actual values set by original map.addImage
 *
 * @param propertyName - 'fill-pattern' or 'fill-extrusion-pattern' property key
 * @param constantPattern - either 'fill-pattern' or 'fill-extrusion-pattern' property value
 * @param tile - current tile being drawn
 * @param layer - current layer being rendered
 * @param programConfiguration - to be used to set patttern poistion and device pixel ratio.
 */
function findPatternPositions(
    propertyName: 'fill-pattern' | 'fill-extrusion-pattern',
    constantPattern: CrossFaded<ResolvedImage>,
    tile: Tile,
    layer: FillStyleLayer | FillExtrusionStyleLayer,
    programConfiguration: ProgramConfiguration): void {

    if (constantPattern && tile.imageAtlas) {
        const patternPositions = tile.imageAtlas.patternPositions;
        let posTo = patternPositions[constantPattern.to.toString()];
        let posFrom = patternPositions[constantPattern.from.toString()];

        // try again in case patternPositions has been updated by worker
        if (!posTo || !posFrom) {
            const transitioned = layer.getPaintProperty(propertyName) as string;
            posTo = patternPositions[transitioned];
            posFrom = patternPositions[transitioned];
        }

        if (posTo && posFrom) {
            programConfiguration.setConstantPatternPositions(posTo, posFrom);
        }
    }
}

export {drawFill as fill};
export {findPatternPositions};
