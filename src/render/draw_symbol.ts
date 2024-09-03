import Point from '@mapbox/point-geometry';
import {drawCollisionDebug} from './draw_collision_debug';

import {SegmentVector} from '../data/segment';
import {pixelsToTileUnits} from '../source/pixels_to_tile_units';
import * as symbolProjection from '../symbol/projection';
import {EvaluatedZoomSize, evaluateSizeForFeature, evaluateSizeForZoom} from '../symbol/symbol_size';
import {mat4} from 'gl-matrix';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';

import {getAnchorAlignment, WritingMode} from '../symbol/shaping';
import ONE_EM from '../symbol/one_em';

import {
    SymbolIconUniformsType,
    symbolIconUniformValues,
    symbolSDFUniformValues,
    symbolTextAndIconUniformValues
} from './program/symbol_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';

import type {Texture, TextureFilter} from '../render/texture';
import type {OverscaledTileID, UnwrappedTileID} from '../source/tile_id';
import type {UniformValues} from './uniform_binding';
import type {SymbolSDFUniformsType} from '../render/program/symbol_program';
import type {CrossTileID, VariableOffset} from '../symbol/placement';
import type {SymbolBucket, SymbolBuffers} from '../data/bucket/symbol_bucket';
import type {TerrainData} from '../render/terrain';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Transform} from '../geo/transform';
import type {ColorMode} from '../gl/color_mode';
import type {Program} from './program';
import type {TextAnchor} from '../style/style_layer/variable_text_anchor';
import {createProjection, Projection} from '../geo/projection/projection';

type SymbolTileRenderState = {
    segments: SegmentVector;
    sortKey: number;
    terrainData: TerrainData;
    state: {
        program: Program<any>;
        buffers: SymbolBuffers;
        uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>;
        atlasTexture: Texture;
        atlasTextureIcon: Texture | null;
        atlasInterpolation: TextureFilter;
        atlasInterpolationIcon: TextureFilter;
        isSDF: boolean;
        hasHalo: boolean;
    };
};

const identityMat4 = mat4.identity(new Float32Array(16));

export function drawSymbols(painter: Painter, sourceCache: SourceCache, layer: SymbolStyleLayer, coords: Array<OverscaledTileID>, variableOffsets: {
    [_ in CrossTileID]: VariableOffset;
}) {
    if (painter.renderPass !== 'translucent') return;

    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    //Compute variable-offsets before painting since icons and text data positioning
    //depend on each other in this case.
    if (hasVariablePlacement) {
        updateVariableAnchors(coords, painter, layer, sourceCache,
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            variableOffsets
        );
    }

    if (layer.paint.get('icon-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, sourceCache, layer, coords, false,
            layer.paint.get('icon-translate'),
            layer.paint.get('icon-translate-anchor'),
            layer.layout.get('icon-rotation-alignment'),
            layer.layout.get('icon-pitch-alignment'),
            layer.layout.get('icon-keep-upright'),
            stencilMode, colorMode
        );
    }

    if (layer.paint.get('text-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, sourceCache, layer, coords, true,
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.layout.get('text-keep-upright'),
            stencilMode, colorMode
        );
    }

    if (sourceCache.map.showCollisionBoxes) {
        drawCollisionDebug(painter, sourceCache, layer, coords, true);
        drawCollisionDebug(painter, sourceCache, layer, coords, false);
    }
}

function calculateVariableRenderShift(
    anchor: TextAnchor,
    width: number,
    height: number,
    textOffset: [number, number],
    textBoxScale: number,
    renderTextSize: number): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    return new Point(
        (shiftX / textBoxScale + textOffset[0]) * renderTextSize,
        (shiftY / textBoxScale + textOffset[1]) * renderTextSize
    );
}

function updateVariableAnchors(coords: Array<OverscaledTileID>,
    painter: Painter,
    layer:SymbolStyleLayer, sourceCache: SourceCache,
    rotationAlignment: SymbolLayerSpecification['layout']['text-rotation-alignment'],
    pitchAlignment: SymbolLayerSpecification['layout']['text-pitch-alignment'],
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    variableOffsets: {[_ in CrossTileID]: VariableOffset}) {
    const transform = painter.transform;
    const projection = createProjection();
    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer) as SymbolBucket;
        if (!bucket || !bucket.text || !bucket.text.segments.get().length) continue;

        const sizeData = bucket.textSizeData;
        const size = evaluateSizeForZoom(sizeData, transform.zoom);

        const pixelToTileScale = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, pixelToTileScale);
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' && bucket.hasIconData();

        if (size) {
            const tileScale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
            const getElevation = painter.style.map.terrain ? (x: number, y: number) => painter.style.map.terrain.getElevation(coord, x, y) : null;
            const translation = projection.translatePosition(transform, tile, translate, translateAnchor);
            updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets,
                transform, labelPlaneMatrix, coord.posMatrix, tileScale, size, updateTextFitIcon, projection, translation, coord.toUnwrapped(), getElevation);
        }
    }
}

function getShiftedAnchor(projectedAnchorPoint: Point, projectionContext: symbolProjection.SymbolProjectionContext, rotateWithMap, shift: Point, transformAngle: number, pitchedTextShiftCorrection: number) {
    // Usual case is that we take the projected anchor and add the pixel-based shift
    // calculated earlier. In the (somewhat weird) case of pitch-aligned text, we add an equivalent
    // tile-unit based shift to the anchor before projecting to the label plane.
    const translatedAnchor = projectionContext.tileAnchorPoint.add(new Point(projectionContext.translation[0], projectionContext.translation[1]));
    if (projectionContext.pitchWithMap) {
        let adjustedShift = shift.mult(pitchedTextShiftCorrection);
        if (!rotateWithMap) {
            adjustedShift = adjustedShift.rotate(-transformAngle);
        }
        const tileAnchorShifted = translatedAnchor.add(adjustedShift);
        return symbolProjection.project(tileAnchorShifted.x, tileAnchorShifted.y, projectionContext.labelPlaneMatrix, projectionContext.getElevation).point;
    } else {
        if (rotateWithMap) {
            // Compute the angle with which to rotate the anchor, so that it is aligned with
            // the map's actual east-west axis. Very similar to what is done in the shader.
            const projectedAnchorRight = symbolProjection.projectTileCoordinatesToViewport(projectionContext.tileAnchorPoint.x + 1, projectionContext.tileAnchorPoint.y, projectionContext);
            const east = projectedAnchorRight.point.sub(projectedAnchorPoint);
            const angle = Math.atan(east.y / east.x) + (east.x < 0 ? Math.PI : 0);
            return projectedAnchorPoint.add(shift.rotate(angle));
        } else {
            return projectedAnchorPoint.add(shift);
        }
    }
}

function updateVariableAnchorsForBucket(
    bucket: SymbolBucket,
    rotateWithMap: boolean,
    pitchWithMap: boolean,
    variableOffsets: {[_ in CrossTileID]: VariableOffset},
    transform: Transform,
    labelPlaneMatrix: mat4,
    posMatrix: mat4,
    tileScale: number,
    size: EvaluatedZoomSize,
    updateTextFitIcon: boolean,
    projection: Projection,
    translation: [number, number],
    unwrappedTileID: UnwrappedTileID,
    getElevation: (x: number, y: number) => number) {
    const placedSymbols = bucket.text.placedSymbolArray;
    const dynamicTextLayoutVertexArray = bucket.text.dynamicLayoutVertexArray;
    const dynamicIconLayoutVertexArray = bucket.icon.dynamicLayoutVertexArray;
    const placedTextShifts = {};

    dynamicTextLayoutVertexArray.clear();
    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);
        const skipOrientation = bucket.allowVerticalPlacement && !symbol.placedOrientation;
        const variableOffset = (!symbol.hidden && symbol.crossTileID && !skipOrientation) ? variableOffsets[symbol.crossTileID] : null;

        if (!variableOffset) {
            // These symbols are from a justification that is not being used, or a label that wasn't placed
            // so we don't need to do the extra math to figure out what incremental shift to apply.
            symbolProjection.hideGlyphs(symbol.numGlyphs, dynamicTextLayoutVertexArray);
        } else  {
            const tileAnchor = new Point(symbol.anchorX, symbol.anchorY);
            const projectionContext = {
                getElevation,
                width: transform.width,
                height: transform.height,
                labelPlaneMatrix,
                lineVertexArray: null,
                pitchWithMap,
                projection,
                projectionCache: null,
                tileAnchorPoint: tileAnchor,
                translation,
                unwrappedTileID
            };
            const projectedAnchor = pitchWithMap ?
                symbolProjection.project(tileAnchor.x, tileAnchor.y, posMatrix, getElevation) :
                symbolProjection.projectTileCoordinatesToViewport(tileAnchor.x, tileAnchor.y, projectionContext);
            const perspectiveRatio = symbolProjection.getPerspectiveRatio(transform.cameraToCenterDistance, projectedAnchor.signedDistanceFromCamera);
            let renderTextSize = evaluateSizeForFeature(bucket.textSizeData, size, symbol) * perspectiveRatio / ONE_EM;
            if (pitchWithMap) {
                // Go from size in pixels to equivalent size in tile units
                renderTextSize *= bucket.tilePixelRatio / tileScale;
            }

            const {width, height, anchor, textOffset, textBoxScale} = variableOffset;
            const shift = calculateVariableRenderShift(anchor, width, height, textOffset, textBoxScale, renderTextSize);

            const pitchedTextCorrection = projection.getPitchedTextCorrection(transform, tileAnchor.add(new Point(translation[0], translation[1])), unwrappedTileID);
            const shiftedAnchor = getShiftedAnchor(projectedAnchor.point, projectionContext, rotateWithMap, shift, transform.angle, pitchedTextCorrection);

            const angle = (bucket.allowVerticalPlacement && symbol.placedOrientation === WritingMode.vertical) ? Math.PI / 2 : 0;
            for (let g = 0; g < symbol.numGlyphs; g++) {
                addDynamicAttributes(dynamicTextLayoutVertexArray, shiftedAnchor, angle);
            }
            //Only offset horizontal text icons
            if (updateTextFitIcon && symbol.associatedIconIndex >= 0) {
                placedTextShifts[symbol.associatedIconIndex] = {shiftedAnchor, angle};
            }
        }
    }

    if (updateTextFitIcon) {
        dynamicIconLayoutVertexArray.clear();
        const placedIcons = bucket.icon.placedSymbolArray;
        for (let i = 0; i < placedIcons.length; i++) {
            const placedIcon = placedIcons.get(i);
            if (placedIcon.hidden) {
                symbolProjection.hideGlyphs(placedIcon.numGlyphs, dynamicIconLayoutVertexArray);
            } else {
                const shift = placedTextShifts[i];
                if (!shift) {
                    symbolProjection.hideGlyphs(placedIcon.numGlyphs, dynamicIconLayoutVertexArray);
                } else {
                    for (let g = 0; g < placedIcon.numGlyphs; g++) {
                        addDynamicAttributes(dynamicIconLayoutVertexArray, shift.shiftedAnchor, shift.angle);
                    }
                }
            }
        }
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicIconLayoutVertexArray);
    }
    bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicTextLayoutVertexArray);
}

function getSymbolProgramName(isSDF: boolean, isText: boolean, bucket: SymbolBucket) {
    if (bucket.iconsInText && isText) {
        return 'symbolTextAndIcon';
    } else if (isSDF) {
        return 'symbolSDF';
    } else {
        return 'symbolIcon';
    }
}

function drawLayerSymbols(
    painter: Painter,
    sourceCache: SourceCache,
    layer: SymbolStyleLayer,
    coords: Array<OverscaledTileID>,
    isText: boolean,
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    rotationAlignment: SymbolLayerSpecification['layout']['text-rotation-alignment'],
    pitchAlignment: SymbolLayerSpecification['layout']['text-pitch-alignment'],
    keepUpright: boolean,
    stencilMode: StencilMode,
    colorMode: Readonly<ColorMode>) {

    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const projection = createProjection();

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';
    const alongLine = rotationAlignment !== 'viewport' && layer.layout.get('symbol-placement') !== 'point';
    // Line label rotation happens in `updateLineLabels`
    // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
    // Unpitched point labels need to have their rotation applied after projection
    const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

    const isViewportLine = !pitchWithMap && alongLine;

    const hasSortKey = !layer.layout.get('symbol-sort-key').isConstant();
    let sortFeaturesByKey = false;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);

    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    const tileRenderState: Array<SymbolTileRenderState> = [];

    const pitchedTextRescaling = projection.getCircleRadiusCorrection(tr);

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer) as SymbolBucket;
        if (!bucket) continue;
        const buffers = isText ? bucket.text : bucket.icon;

        if (!buffers || !buffers.segments.get().length || !buffers.hasVisibleVertices) continue;
        const programConfiguration = buffers.programConfigurations.get(layer.id);

        const isSDF = isText || bucket.sdfIcons;

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
        const transformed = pitchWithMap || tr.pitch !== 0;

        const program = painter.useProgram(getSymbolProgramName(isSDF, isText, bucket), programConfiguration);
        const size = evaluateSizeForZoom(sizeData, tr.zoom);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        let texSize: [number, number];
        let texSizeIcon: [number, number] = [0, 0];
        let atlasTexture: Texture;
        let atlasInterpolation: TextureFilter;
        let atlasTextureIcon = null;
        let atlasInterpolationIcon: TextureFilter;
        if (isText) {
            atlasTexture = tile.glyphAtlasTexture;
            atlasInterpolation = gl.LINEAR;
            texSize = tile.glyphAtlasTexture.size;
            if (bucket.iconsInText) {
                texSizeIcon = tile.imageAtlasTexture.size;
                atlasTextureIcon = tile.imageAtlasTexture;
                const zoomDependentSize = sizeData.kind === 'composite' || sizeData.kind === 'camera';
                atlasInterpolationIcon = transformed || painter.options.rotating || painter.options.zooming || zoomDependentSize ? gl.LINEAR : gl.NEAREST;
            }
        } else {
            const iconScaled = layer.layout.get('icon-size').constantOr(0) !== 1 || bucket.iconsNeedLinear;
            atlasTexture = tile.imageAtlasTexture;
            atlasInterpolation = isSDF || painter.options.rotating || painter.options.zooming || iconScaled || transformed ?
                gl.LINEAR :
                gl.NEAREST;
            texSize = tile.imageAtlasTexture.size;
        }

        const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const baseMatrix = isViewportLine ? coord.posMatrix : identityMat4;
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(baseMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        const glCoordMatrixForShader = symbolProjection.getGlCoordMatrix(baseMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        const glCoordMatrixForSymbolPlacement = symbolProjection.getGlCoordMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);

        const translation = projection.translatePosition(painter.transform, tile, translate, translateAnchor);

        const hasVariableAnchors = hasVariablePlacement && bucket.hasTextData();
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&
            hasVariableAnchors &&
            bucket.hasIconData();

        if (alongLine) {
            const getElevation = painter.style.map.terrain ? (x: number, y: number) => painter.style.map.terrain.getElevation(coord, x, y) : null;
            const rotateToLine = layer.layout.get('text-rotation-alignment') === 'map';
            symbolProjection.updateLineLabels(bucket, coord.posMatrix, painter, isText, labelPlaneMatrix, glCoordMatrixForSymbolPlacement, pitchWithMap, keepUpright, rotateToLine, projection, coord.toUnwrapped(), tr.width, tr.height, translation, getElevation);
        }

        const matrix = coord.posMatrix; // formerly also incorporated translate and translate-anchor
        const shaderVariableAnchor = (isText && hasVariablePlacement) || updateTextFitIcon;
        const noLabelPlane = (alongLine || shaderVariableAnchor);
        const uLabelPlaneMatrix = noLabelPlane ? identityMat4 : labelPlaneMatrix;
        const uglCoordMatrix = glCoordMatrixForShader; // formerly also incorporated translate and translate-anchor

        const hasHalo = isSDF && layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;

        let uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>;
        if (isSDF) {
            if (!bucket.iconsInText) {
                uniformValues = symbolSDFUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter, matrix,
                    uLabelPlaneMatrix, uglCoordMatrix, translation, isText, texSize, true, pitchedTextRescaling);
            } else {
                uniformValues = symbolTextAndIconUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter, matrix,
                    uLabelPlaneMatrix, uglCoordMatrix, translation, texSize, texSizeIcon, pitchedTextRescaling);
            }
        } else {
            uniformValues = symbolIconUniformValues(sizeData.kind,
                size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter, matrix,
                uLabelPlaneMatrix, uglCoordMatrix, translation, isText, texSize, pitchedTextRescaling);
        }

        const state = {
            program,
            buffers,
            uniformValues,
            atlasTexture,
            atlasTextureIcon,
            atlasInterpolation,
            atlasInterpolationIcon,
            isSDF,
            hasHalo
        };

        if (hasSortKey && bucket.canOverlap) {
            sortFeaturesByKey = true;
            const oldSegments = buffers.segments.get();
            for (const segment of oldSegments) {
                tileRenderState.push({
                    segments: new SegmentVector([segment]),
                    sortKey: segment.sortKey,
                    state,
                    terrainData
                });
            }
        } else {
            tileRenderState.push({
                segments: buffers.segments,
                sortKey: 0,
                state,
                terrainData
            });
        }
    }

    if (sortFeaturesByKey) {
        tileRenderState.sort((a, b) => a.sortKey - b.sortKey);
    }

    for (const segmentState of tileRenderState) {
        const state = segmentState.state;

        context.activeTexture.set(gl.TEXTURE0);
        state.atlasTexture.bind(state.atlasInterpolation, gl.CLAMP_TO_EDGE);
        if (state.atlasTextureIcon) {
            context.activeTexture.set(gl.TEXTURE1);
            if (state.atlasTextureIcon) {
                state.atlasTextureIcon.bind(state.atlasInterpolationIcon, gl.CLAMP_TO_EDGE);
            }
        }

        if (state.isSDF) {
            const uniformValues = state.uniformValues;
            if (state.hasHalo) {
                uniformValues['u_is_halo'] = 1;
                drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, uniformValues, segmentState.terrainData);
            }
            uniformValues['u_is_halo'] = 0;
        }
        drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, state.uniformValues, segmentState.terrainData);
    }
}

function drawSymbolElements(
    buffers: SymbolBuffers,
    segments: SegmentVector,
    layer: SymbolStyleLayer,
    painter: Painter,
    program: Program<any>,
    depthMode: Readonly<DepthMode>,
    stencilMode: StencilMode,
    colorMode: Readonly<ColorMode>,
    uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>,
    terrainData: TerrainData) {
    const context = painter.context;
    const gl = context.gl;
    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        uniformValues, terrainData, layer.id, buffers.layoutVertexBuffer,
        buffers.indexBuffer, segments, layer.paint,
        painter.transform.zoom, buffers.programConfigurations.get(layer.id),
        buffers.dynamicLayoutVertexBuffer, buffers.opacityVertexBuffer);
}
