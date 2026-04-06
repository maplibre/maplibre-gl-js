import Point from '@mapbox/point-geometry';
import {drawCollisionDebug} from './draw_collision_debug';
import {DrawableBuilder} from '../gfx/drawable_builder';
import {TileLayerGroup} from '../gfx/tile_layer_group';
import {UniformBlock} from '../gfx/uniform_block';
import {LayerTweaker} from '../gfx/layer_tweaker';

import {SegmentVector} from '../data/segment';
import {pixelsToTileUnits} from '../source/pixels_to_tile_units';
import {type EvaluatedZoomSize, evaluateSizeForFeature, evaluateSizeForZoom} from '../symbol/symbol_size';
import {mat4} from 'gl-matrix';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';

import {getAnchorAlignment, WritingMode} from '../symbol/shaping';
import ONE_EM from '../symbol/one_em';

import {
    type SymbolIconUniformsType,
    symbolIconUniformValues,
    symbolSDFUniformValues,
    symbolTextAndIconUniformValues
} from './program/symbol_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';

import type {Texture, TextureFilter} from '../render/texture';
import type {OverscaledTileID, UnwrappedTileID} from '../tile/tile_id';
import type {UniformValues} from './uniform_binding';
import type {SymbolSDFUniformsType} from '../render/program/symbol_program';
import type {CrossTileID, VariableOffset} from '../symbol/placement';
import type {SymbolBucket, SymbolBuffers} from '../data/bucket/symbol_bucket';
import type {TerrainData} from '../render/terrain';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {ColorMode} from '../gl/color_mode';
import type {Program} from './program';
import type {TextAnchor} from '../style/style_layer/variable_text_anchor';
import {getGlCoordMatrix, getPerspectiveRatio, getPitchedLabelPlaneMatrix, hideGlyphs, projectWithMatrix, projectTileCoordinatesToClipSpace, projectTileCoordinatesToLabelPlane, type SymbolProjectionContext, updateLineLabels} from '../symbol/projection';
import {translatePosition} from '../util/util';
import type {ProjectionData} from '../geo/projection/projection_data';

type SymbolTileRenderState = {
    segments: SegmentVector;
    sortKey: number;
    terrainData: TerrainData;
    state: {
        program: Program<any>;
        buffers: SymbolBuffers;
        uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>;
        projectionData: ProjectionData;
        atlasTexture: Texture;
        atlasTextureIcon: Texture | null;
        atlasInterpolation: TextureFilter;
        atlasInterpolationIcon: TextureFilter;
        isSDF: boolean;
        hasHalo: boolean;
    };
};

const identityMat4 = mat4.identity(new Float32Array(16));

export function drawSymbols(painter: Painter, tileManager: TileManager, layer: SymbolStyleLayer, coords: Array<OverscaledTileID>, variableOffsets: {
    [_ in CrossTileID]: VariableOffset;
}, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;

    // Use drawable path for WebGPU
    if (painter.useDrawables && painter.useDrawables.has('symbol')) {
        drawSymbolsDrawable(painter, tileManager, layer, coords, variableOffsets, renderOptions);
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    // Compute variable-offsets before painting since icons and text data positioning
    // depend on each other in this case.
    if (hasVariablePlacement) {
        updateVariableAnchors(coords, painter, layer, tileManager,
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            variableOffsets
        );
    }

    if (layer.paint.get('icon-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, tileManager, layer, coords, false,
            layer.paint.get('icon-translate'),
            layer.paint.get('icon-translate-anchor'),
            layer.layout.get('icon-rotation-alignment'),
            layer.layout.get('icon-pitch-alignment'),
            layer.layout.get('icon-keep-upright'),
            stencilMode, colorMode, isRenderingToTexture
        );
    }

    if (layer.paint.get('text-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, tileManager, layer, coords, true,
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.layout.get('text-keep-upright'),
            stencilMode, colorMode, isRenderingToTexture
        );
    }

    if (tileManager.map.showCollisionBoxes) {
        drawCollisionDebug(painter, tileManager, layer, coords, true);
        drawCollisionDebug(painter, tileManager, layer, coords, false);
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
    layer: SymbolStyleLayer, tileManager: TileManager,
    rotationAlignment: SymbolLayerSpecification['layout']['text-rotation-alignment'],
    pitchAlignment: SymbolLayerSpecification['layout']['text-pitch-alignment'],
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    variableOffsets: { [_ in CrossTileID]: VariableOffset }) {
    const transform = painter.transform;
    const terrain = painter.style.map.terrain;
    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket = tile.getBucket(layer) as SymbolBucket;
        if (!bucket || !bucket.text || !bucket.text.segments.get().length) continue;

        const sizeData = bucket.textSizeData;
        const size = evaluateSizeForZoom(sizeData, transform.zoom);

        const pixelToTileScale = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const pitchedLabelPlaneMatrix = getPitchedLabelPlaneMatrix(rotateWithMap, painter.transform, pixelToTileScale);
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' && bucket.hasIconData();

        if (size) {
            const tileScale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
            const getElevation = terrain ? (x: number, y: number) => terrain.getElevation(coord, x, y) : null;
            const translation = translatePosition(transform, tile, translate, translateAnchor);
            updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets,
                transform, pitchedLabelPlaneMatrix, tileScale, size, updateTextFitIcon, translation, coord.toUnwrapped(), getElevation);
        }
    }
}

function getShiftedAnchor(projectedAnchorPoint: Point, projectionContext: SymbolProjectionContext, rotateWithMap, shift: Point, transformAngle: number, pitchedTextShiftCorrection: number) {
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
        return projectWithMatrix(tileAnchorShifted.x, tileAnchorShifted.y, projectionContext.pitchedLabelPlaneMatrix, projectionContext.getElevation).point;
    } else {
        if (rotateWithMap) {
            // Compute the angle with which to rotate the anchor, so that it is aligned with
            // the map's actual east-west axis. Very similar to what is done in the shader.
            // Note that the label plane must be screen pixels here.
            const projectedAnchorRight = projectTileCoordinatesToLabelPlane(projectionContext.tileAnchorPoint.x + 1, projectionContext.tileAnchorPoint.y, projectionContext);
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
    variableOffsets: { [_ in CrossTileID]: VariableOffset },
    transform: IReadonlyTransform,
    pitchedLabelPlaneMatrix: mat4,
    tileScale: number,
    size: EvaluatedZoomSize,
    updateTextFitIcon: boolean,
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
            hideGlyphs(symbol.numGlyphs, dynamicTextLayoutVertexArray);
        } else {
            const tileAnchor = new Point(symbol.anchorX, symbol.anchorY);
            const projectionContext: SymbolProjectionContext = {
                getElevation,
                width: transform.width,
                height: transform.height,
                pitchedLabelPlaneMatrix,
                lineVertexArray: null,
                pitchWithMap,
                transform,
                projectionCache: null,
                tileAnchorPoint: tileAnchor,
                translation,
                unwrappedTileID
            };
            const projectedAnchor = pitchWithMap ?
                projectTileCoordinatesToClipSpace(tileAnchor.x, tileAnchor.y, projectionContext) :
                projectTileCoordinatesToLabelPlane(tileAnchor.x, tileAnchor.y, projectionContext);
            const perspectiveRatio = getPerspectiveRatio(transform.cameraToCenterDistance, projectedAnchor.signedDistanceFromCamera);
            let renderTextSize = evaluateSizeForFeature(bucket.textSizeData, size, symbol) * perspectiveRatio / ONE_EM;
            if (pitchWithMap) {
                // Go from size in pixels to equivalent size in tile units
                renderTextSize *= bucket.tilePixelRatio / tileScale;
            }

            const {width, height, anchor, textOffset, textBoxScale} = variableOffset;
            const shift = calculateVariableRenderShift(anchor, width, height, textOffset, textBoxScale, renderTextSize);

            const pitchedTextCorrection = transform.getPitchedTextCorrection(tileAnchor.x + translation[0], tileAnchor.y + translation[1], unwrappedTileID);
            const shiftedAnchor = getShiftedAnchor(projectedAnchor.point, projectionContext, rotateWithMap, shift, -transform.bearingInRadians, pitchedTextCorrection);

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
                hideGlyphs(placedIcon.numGlyphs, dynamicIconLayoutVertexArray);
            } else {
                const shift = placedTextShifts[i];
                if (!shift) {
                    hideGlyphs(placedIcon.numGlyphs, dynamicIconLayoutVertexArray);
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
    tileManager: TileManager,
    layer: SymbolStyleLayer,
    coords: Array<OverscaledTileID>,
    isText: boolean,
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    rotationAlignment: SymbolLayerSpecification['layout']['text-rotation-alignment'],
    pitchAlignment: SymbolLayerSpecification['layout']['text-pitch-alignment'],
    keepUpright: boolean,
    stencilMode: StencilMode,
    colorMode: Readonly<ColorMode>,
    isRenderingToTexture: boolean) {

    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';
    const alongLine = rotationAlignment !== 'viewport' && layer.layout.get('symbol-placement') !== 'point';
    // Line label rotation happens in `updateLineLabels`
    // Pitched point labels are automatically rotated by the pitchedLabelPlaneMatrix projection
    // Unpitched point labels need to have their rotation applied after projection
    const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

    const hasSortKey = !layer.layout.get('symbol-sort-key').isConstant();
    let sortFeaturesByKey = false;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);

    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    const tileRenderState: Array<SymbolTileRenderState> = [];

    const pitchedTextRescaling = transform.getCircleRadiusCorrection();

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket = tile.getBucket(layer) as SymbolBucket;
        if (!bucket) continue;
        const buffers = isText ? bucket.text : bucket.icon;

        if (!buffers || !buffers.segments.get().length || !buffers.hasVisibleVertices) continue;
        const programConfiguration = buffers.programConfigurations.get(layer.id);

        const isSDF = isText || bucket.sdfIcons;

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
        const transformed = pitchWithMap || transform.pitch !== 0;

        const program = painter.useProgram(getSymbolProgramName(isSDF, isText, bucket), programConfiguration);
        const size = evaluateSizeForZoom(sizeData, transform.zoom);
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

        // See the comment at the beginning of src/symbol/projection.ts for an overview of the symbol projection process
        const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const pitchedLabelPlaneMatrix = getPitchedLabelPlaneMatrix(rotateWithMap, painter.transform, s);
        const pitchedLabelPlaneMatrixInverse = mat4.create();
        mat4.invert(pitchedLabelPlaneMatrixInverse, pitchedLabelPlaneMatrix);
        const glCoordMatrixForShader = getGlCoordMatrix(pitchWithMap, rotateWithMap, painter.transform, s);

        const translation = translatePosition(transform, tile, translate, translateAnchor);
        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});

        const hasVariableAnchors = hasVariablePlacement && bucket.hasTextData();
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&
            hasVariableAnchors &&
            bucket.hasIconData();

        if (alongLine) {
            const getElevation = painter.style.map.terrain ? (x: number, y: number) => painter.style.map.terrain.getElevation(coord, x, y) : null;
            const rotateToLine = layer.layout.get('text-rotation-alignment') === 'map';
            updateLineLabels(bucket, painter, isText, pitchedLabelPlaneMatrix, pitchedLabelPlaneMatrixInverse, pitchWithMap, keepUpright, rotateToLine, coord.toUnwrapped(), transform.width, transform.height, translation, getElevation);
        }

        const shaderVariableAnchor = (isText && hasVariablePlacement) || updateTextFitIcon;

        // If the label plane matrix is used, it transforms either map-pitch-aligned pixels, or to screenspace pixels
        const combinedLabelPlaneMatrix = pitchWithMap ? pitchedLabelPlaneMatrix : painter.transform.clipSpaceToPixelsMatrix;
        // Label plane matrix is unused in the shader if variable anchors are used or the text is placed along a line
        const noLabelPlane = (alongLine || shaderVariableAnchor);
        const uLabelPlaneMatrix = noLabelPlane ? identityMat4 : combinedLabelPlaneMatrix;

        const hasHalo = isSDF && layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;

        let uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>;
        if (isSDF) {
            if (!bucket.iconsInText) {
                uniformValues = symbolSDFUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation, isText, texSize, true, pitchedTextRescaling);
            } else {
                uniformValues = symbolTextAndIconUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation, texSize, texSizeIcon, pitchedTextRescaling);
            }
        } else {
            uniformValues = symbolIconUniformValues(sizeData.kind,
                size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                uLabelPlaneMatrix, glCoordMatrixForShader, translation, isText, texSize, pitchedTextRescaling);
        }

        const state = {
            program,
            buffers,
            uniformValues,
            projectionData,
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
                drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, uniformValues, state.projectionData, segmentState.terrainData);
            }
            uniformValues['u_is_halo'] = 0;
        }
        drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, state.uniformValues, state.projectionData, segmentState.terrainData);
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
    projectionData: ProjectionData,
    terrainData: TerrainData) {
    const context = painter.context;
    const gl = context.gl;
    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
        uniformValues as any, terrainData as any, projectionData as any, layer.id, buffers.layoutVertexBuffer,
        buffers.indexBuffer, segments, layer.paint,
        painter.transform.zoom, buffers.programConfigurations.get(layer.id),
        buffers.dynamicLayoutVertexBuffer, buffers.opacityVertexBuffer);
}

/**
 * Symbol layer tweaker for WebGPU drawables.
 */
class SymbolLayerTweaker extends LayerTweaker {
    execute(drawables: any[], painter: Painter, layer: any, _coords: any[]): void {
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            // SymbolDrawableUBO: 256 bytes
            // matrix(64) + label_plane_matrix(64) + coord_matrix(64) +
            // texsize(8) + texsize_icon(8) + gamma_scale(4) + is_text(4) +
            // is_along_line(4) + is_size_zoom_constant(4) + is_size_feature_constant(4) +
            // size_t(4) + size(4) + rotate_symbol(4) + is_halo(4) + pad(12) = 256
            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(272);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // Set remaining fields from uniformValues
            if (drawable.uniformValues) {
                const uv = drawable.uniformValues as any;
                // Offsets must match SymbolDrawableUBO struct layout exactly:
                if (uv.u_label_plane_matrix) drawable.drawableUBO.setMat4(64, uv.u_label_plane_matrix);
                if (uv.u_coord_matrix) drawable.drawableUBO.setMat4(128, uv.u_coord_matrix);
                if (uv.u_texsize) drawable.drawableUBO.setVec2(192, uv.u_texsize[0], uv.u_texsize[1]);
                if (uv.u_texsize_icon) drawable.drawableUBO.setVec2(200, uv.u_texsize_icon[0], uv.u_texsize_icon[1]);
                drawable.drawableUBO.setFloat(208, uv.u_gamma_scale || 0);           // gamma_scale
                drawable.drawableUBO.setInt(212, uv.u_is_text ? 1 : 0);              // is_text
                drawable.drawableUBO.setInt(216, uv.u_is_along_line ? 1 : 0);        // is_along_line
                drawable.drawableUBO.setInt(220, uv.u_is_variable_anchor ? 1 : 0);   // is_variable_anchor
                drawable.drawableUBO.setInt(224, uv.u_is_size_zoom_constant ? 1 : 0); // is_size_zoom_constant
                drawable.drawableUBO.setInt(228, uv.u_is_size_feature_constant ? 1 : 0); // is_size_feature_constant
                drawable.drawableUBO.setFloat(232, uv.u_size_t || 0);                // size_t
                drawable.drawableUBO.setFloat(236, uv.u_size || 0);                  // size
                drawable.drawableUBO.setInt(240, uv.u_rotate_symbol ? 1 : 0);        // rotate_symbol
                drawable.drawableUBO.setInt(244, uv.u_pitch_with_map ? 1 : 0);       // pitch_with_map
                drawable.drawableUBO.setInt(248, uv.u_is_halo || 0);                 // is_halo
                // _t factors at 252-268 are 0 by default (uniform-driven)
            }

            // Props UBO for evaluated paint properties (update every frame for zoom-dependent values)
            if (!drawable.layerUBO) {
                drawable.layerUBO = new UniformBlock(48);
            }
            {
                const propsUBO = drawable.layerUBO;
                const paint = (layer as SymbolStyleLayer).paint;
                const isText = drawable.uniformValues?.u_is_text;

                const getColor = (prop: string) => {
                    const val = paint.get(prop as any);
                    if (val && typeof val === 'object' && 'r' in val) return val;
                    const c = val?.constantOr?.(undefined);
                    if (c && typeof c === 'object' && 'r' in c) return c;
                    if (val && typeof (val as any).evaluate === 'function') return (val as any).evaluate({zoom: painter.transform.zoom});
                    return null;
                };
                const getFloat = (prop: string) => {
                    const val = paint.get(prop as any);
                    if (typeof val === 'number') return val;
                    if (val === null || val === undefined) return null;
                    const c = val.constantOr(undefined);
                    if (c !== undefined) return c as number;
                    if (typeof (val as any).evaluate === 'function') return (val as any).evaluate({zoom: painter.transform.zoom});
                    return null;
                };

                const fillColor = getColor(isText ? 'text-color' : 'icon-color');
                if (fillColor) propsUBO.setVec4(0, fillColor.r, fillColor.g, fillColor.b, fillColor.a);

                const haloColor = getColor(isText ? 'text-halo-color' : 'icon-halo-color');
                if (haloColor) propsUBO.setVec4(16, haloColor.r, haloColor.g, haloColor.b, haloColor.a);


                const opacity = getFloat(isText ? 'text-opacity' : 'icon-opacity');
                if (opacity !== null) propsUBO.setFloat(32, opacity);

                const haloWidth = getFloat(isText ? 'text-halo-width' : 'icon-halo-width');
                if (haloWidth !== null) propsUBO.setFloat(36, haloWidth);

                const haloBlur = getFloat(isText ? 'text-halo-blur' : 'icon-halo-blur');
                if (haloBlur !== null) propsUBO.setFloat(40, haloBlur);
            }
        }
    }
}

/**
 * Reformat the 1-byte-stride opacity buffer into a 4-byte-stride Float32 buffer
 * that WebGPU can use as a vertex attribute.
 */
function getWebGPUOpacityBuffer(device: any, opacityArray: any): any {
    if (!device || !opacityArray) return null;
    // The opacityVertexArray stores one uint32 per 4 vertices (one glyph quad).
    // Each byte within the uint32 is the same packed opacity value.
    // GL reads with stride=1, so each byte maps to one vertex.
    // We need to expand to Float32 per vertex for WebGPU.
    const rawBuf = opacityArray.arrayBuffer;
    if (!rawBuf) return null;
    const src = new Uint8Array(rawBuf);
    // opacityArray.length = number of uint32 entries = numVertices / 4
    const numVertices = opacityArray.length * 4;
    if (numVertices === 0) return null;

    // Get or create cached Float32 buffer
    let cached = (opacityArray as any)._webgpuOpacityBuf;
    if (!cached || cached._numVertices !== numVertices) {
        const f32Data = new Float32Array(numVertices);
        cached = {
            itemSize: 4,
            attributes: [{name: 'a_fade_opacity', components: 1, type: 'Float32', offset: 0}],
            webgpuBuffer: null,
            _f32Data: f32Data,
            _numVertices: numVertices,
        };
        (opacityArray as any)._webgpuOpacityBuf = cached;
    }

    // Update float data from raw bytes (1 byte per vertex)
    const f32 = cached._f32Data;
    for (let i = 0; i < numVertices; i++) {
        f32[i] = src[i];
    }

    // Upload to GPU
    if (!cached.webgpuBuffer) {
        cached.webgpuBuffer = device.createBuffer({
            usage: 0x0020 | 0x0008, // VERTEX | COPY_DST
            data: new Uint8Array(f32.buffer),
        });
    } else {
        cached.webgpuBuffer.write(new Uint8Array(f32.buffer));
    }

    return cached;
}

function drawSymbolsDrawable(
    painter: Painter,
    tileManager: TileManager,
    layer: SymbolStyleLayer,
    coords: Array<OverscaledTileID>,
    variableOffsets: { [_ in CrossTileID]: VariableOffset },
    renderOptions: RenderOptions
) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);

    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    if (hasVariablePlacement) {
        updateVariableAnchors(coords, painter, layer, tileManager,
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            variableOffsets
        );
    }

    // Get or create tweaker and layer group
    let tweaker = painter.layerTweakers.get(layer.id) as SymbolLayerTweaker;
    if (!tweaker) {
        tweaker = new SymbolLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }
    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }
    (layerGroup as any)._drawablesByTile.clear();

    // Draw both text and icon passes
    for (const isText of [false, true]) {
        const opacityProp = isText ? 'text-opacity' : 'icon-opacity';
        if (layer.paint.get(opacityProp).constantOr(1) === 0) continue;

        const translate = layer.paint.get(isText ? 'text-translate' : 'icon-translate');
        const translateAnchor = layer.paint.get(isText ? 'text-translate-anchor' : 'icon-translate-anchor');
        const rotationAlignment = layer.layout.get(isText ? 'text-rotation-alignment' : 'icon-rotation-alignment');
        const pitchAlignment = layer.layout.get(isText ? 'text-pitch-alignment' : 'icon-pitch-alignment');
        const keepUpright = layer.layout.get(isText ? 'text-keep-upright' : 'icon-keep-upright');
        const rotateWithMap = rotationAlignment === 'map';
        const pitchWithMap = pitchAlignment === 'map';
        const alongLine = rotationAlignment !== 'viewport' && layer.layout.get('symbol-placement') !== 'point';
        const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;
        const pitchedTextRescaling = transform.getCircleRadiusCorrection();

        for (const coord of coords) {
            const tile = tileManager.getTile(coord);
            const bucket = tile.getBucket(layer) as SymbolBucket;
            if (!bucket) continue;
            const buffers = isText ? bucket.text : bucket.icon;
            if (!buffers || !buffers.segments.get().length || !buffers.hasVisibleVertices) continue;

            const programConfiguration = buffers.programConfigurations.get(layer.id);
            const isSDF = isText || bucket.sdfIcons;
            const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;

            const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
            const pitchedLabelPlaneMatrix = getPitchedLabelPlaneMatrix(rotateWithMap, painter.transform, s);
            const pitchedLabelPlaneMatrixInverse = mat4.create();
            mat4.invert(pitchedLabelPlaneMatrixInverse, pitchedLabelPlaneMatrix);
            const glCoordMatrixForShader = getGlCoordMatrix(pitchWithMap, rotateWithMap, painter.transform, s);

            const translation = translatePosition(transform, tile, translate, translateAnchor);
            const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});

            const hasVariableAnchors = hasVariablePlacement && bucket.hasTextData();
            const shaderVariableAnchor = (isText && hasVariablePlacement) || (layer.layout.get('icon-text-fit') !== 'none' && hasVariableAnchors && bucket.hasIconData());

            if (alongLine) {
                const getElevation = painter.style.map.terrain ? (x: number, y: number) => painter.style.map.terrain.getElevation(coord, x, y) : null;
                const rotateToLine = layer.layout.get('text-rotation-alignment') === 'map';
                updateLineLabels(bucket, painter, isText, pitchedLabelPlaneMatrix, pitchedLabelPlaneMatrixInverse, pitchWithMap, keepUpright, rotateToLine, coord.toUnwrapped(), transform.width, transform.height, translation, getElevation);
            }

            const combinedLabelPlaneMatrix = pitchWithMap ? pitchedLabelPlaneMatrix : painter.transform.clipSpaceToPixelsMatrix;
            const noLabelPlane = (alongLine || shaderVariableAnchor);
            const uLabelPlaneMatrix = noLabelPlane ? identityMat4 : combinedLabelPlaneMatrix;

            const size = evaluateSizeForZoom(sizeData, transform.zoom);

            let uniformValues: any;
            if (isSDF && !bucket.iconsInText) {
                uniformValues = symbolSDFUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation, isText,
                    isText ? tile.glyphAtlasTexture?.size || [0, 0] : tile.imageAtlasTexture?.size || [0, 0],
                    true, pitchedTextRescaling);
            } else if (isSDF) {
                uniformValues = symbolTextAndIconUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation,
                    tile.glyphAtlasTexture?.size || [0, 0], tile.imageAtlasTexture?.size || [0, 0], pitchedTextRescaling);
            } else {
                uniformValues = symbolIconUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation, isText,
                    tile.imageAtlasTexture?.size || [0, 0], pitchedTextRescaling);
            }

            const shaderName = isSDF ? (bucket.iconsInText ? 'symbolTextAndIcon' : 'symbolSDF') : 'symbolIcon';

            const builder = new DrawableBuilder()
                .setShader(shaderName)
                .setRenderPass('translucent')
                .setDepthMode(depthMode)
                .setStencilMode(stencilMode)
                .setColorMode(colorMode)
                .setCullFaceMode(CullFaceMode.backCCW)
                .setLayerTweaker(tweaker);

            // Add atlas texture
            const atlasTexture = isText ? tile.glyphAtlasTexture : tile.imageAtlasTexture;
            if (atlasTexture) {
                const img = atlasTexture.image as any;
                const isAlpha = atlasTexture.format === 6406; // gl.ALPHA
                const texEntry: any = {
                    name: 'glyph_texture',
                    textureUnit: 0,
                    texture: atlasTexture.texture || null,
                    filter: 9729 /* LINEAR */,
                    wrap: 33071 /* CLAMP_TO_EDGE */,
                    imageSource: (!isAlpha && img && (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap))) ? img : null,
                };
                // For raw data textures (glyph atlas = alpha, icon atlas = rgba)
                if (img?.data) {
                    texEntry.source = {
                        data: img.data,
                        width: img.width,
                        height: img.height,
                        bytesPerPixel: isAlpha ? 1 : 4,
                        format: isAlpha ? 'r8unorm' : 'rgba8unorm',
                    };
                }
                builder.addTexture(texEntry);
            }

            const drawable = builder.flush({
                tileID: coord,
                layer,
                program: null,
                programConfiguration,
                layoutVertexBuffer: buffers.layoutVertexBuffer,
                indexBuffer: buffers.indexBuffer,
                segments: buffers.segments,
                dynamicLayoutBuffer: buffers.dynamicLayoutVertexBuffer,
                dynamicLayoutBuffer2: getWebGPUOpacityBuffer(painter.device, isText ? bucket.text.opacityVertexArray : bucket.icon.opacityVertexArray),
                projectionData,
                terrainData: painter.style.map.terrain ? painter.style.map.terrain.getTerrainData(coord) : null,
                paintProperties: layer.paint,
                zoom: painter.transform.zoom,
            });
            drawable.uniformValues = uniformValues;

            // Draw halo pass first (for SDF text)
            const hasHalo = isSDF && layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;
            if (hasHalo) {
                uniformValues['u_is_halo'] = 1;
                drawable.uniformValues = {...uniformValues};
                layerGroup.addDrawable(coord, drawable);
            }

            // Draw fill pass
            uniformValues['u_is_halo'] = 0;
            const fillDrawable = builder.flush({
                tileID: coord,
                layer,
                program: null,
                programConfiguration,
                layoutVertexBuffer: buffers.layoutVertexBuffer,
                indexBuffer: buffers.indexBuffer,
                segments: buffers.segments,
                dynamicLayoutBuffer: buffers.dynamicLayoutVertexBuffer,
                dynamicLayoutBuffer2: getWebGPUOpacityBuffer(painter.device, isText ? bucket.text.opacityVertexArray : bucket.icon.opacityVertexArray),
                projectionData,
                terrainData: painter.style.map.terrain ? painter.style.map.terrain.getTerrainData(coord) : null,
                paintProperties: layer.paint,
                zoom: painter.transform.zoom,
            });
            fillDrawable.uniformValues = {...uniformValues};
            if (atlasTexture) {
                fillDrawable.textures = drawable.textures.slice();
            }
            layerGroup.addDrawable(coord, fillDrawable);
        }
    }

    // Run tweaker and draw
    const allDrawables = layerGroup.getAllDrawables();
    tweaker.execute(allDrawables, painter, layer, coords);
    for (const drawable of allDrawables) {
        drawable.draw(context, painter.device, painter, renderOptions.renderPass);
    }
}
