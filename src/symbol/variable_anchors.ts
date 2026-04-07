// Shared variable anchor placement logic used by both WebGL and WebGPU symbol rendering.
// Extracted from draw_symbol.ts to avoid circular dependencies.

import Point from '@mapbox/point-geometry';
import {pixelsToTileUnits} from '../source/pixels_to_tile_units';
import {type EvaluatedZoomSize, evaluateSizeForFeature, evaluateSizeForZoom} from './symbol_size';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';
import {getAnchorAlignment, WritingMode} from './shaping';
import ONE_EM from './one_em';
import {getPerspectiveRatio, getPitchedLabelPlaneMatrix, hideGlyphs, projectWithMatrix, projectTileCoordinatesToClipSpace, projectTileCoordinatesToLabelPlane, type SymbolProjectionContext} from './projection';
import {translatePosition} from '../util/util';

import type {mat4} from 'gl-matrix';
import type {Painter} from '../render/painter';
import type {TileManager} from '../tile/tile_manager';
import type {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import type {OverscaledTileID, UnwrappedTileID} from '../tile/tile_id';
import type {CrossTileID, VariableOffset} from './placement';
import type {SymbolBucket} from '../data/bucket/symbol_bucket';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {TextAnchor} from '../style/style_layer/variable_text_anchor';

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

function getShiftedAnchor(projectedAnchorPoint: Point, projectionContext: SymbolProjectionContext, rotateWithMap: boolean, shift: Point, transformAngle: number, pitchedTextShiftCorrection: number) {
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

export function updateVariableAnchors(coords: Array<OverscaledTileID>,
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
