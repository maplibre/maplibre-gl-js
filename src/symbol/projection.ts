import Point from '@mapbox/point-geometry';

import {mat4, vec4} from 'gl-matrix';
import * as symbolSize from './symbol_size';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';

import type {Painter} from '../render/painter';
import type {Transform} from '../geo/transform';
import type {SymbolBucket} from '../data/bucket/symbol_bucket';
import type {
    GlyphOffsetArray,
    SymbolLineVertexArray,
    SymbolDynamicLayoutArray
} from '../data/array_types.g';
import {WritingMode} from '../symbol/shaping';
import {findLineIntersection} from '../util/util';

export {updateLineLabels, hideGlyphs, getLabelPlaneMatrix, getGlCoordMatrix, project, getPerspectiveRatio, placeFirstAndLastGlyph, placeGlyphAlongLine, xyTransformMat4, projectVertexToViewport, findOffsetIntersectionPoint, transformToOffsetNormal};

/*
 * # Overview of coordinate spaces
 *
 * ## Tile coordinate spaces
 * Each label has an anchor. Some labels have corresponding line geometries.
 * The points for both anchors and lines are stored in tile units. Each tile has it's own
 * coordinate space going from (0, 0) at the top left to (EXTENT, EXTENT) at the bottom right.
 *
 * ## GL coordinate space
 * At the end of everything, the vertex shader needs to produce a position in GL coordinate space,
 * which is (-1, 1) at the top left and (1, -1) in the bottom right.
 *
 * ## Map pixel coordinate spaces
 * Each tile has a pixel coordinate space. It's just the tile units scaled so that one unit is
 * whatever counts as 1 pixel at the current zoom.
 * This space is used for pitch-alignment=map, rotation-alignment=map
 *
 * ## Rotated map pixel coordinate spaces
 * Like the above, but rotated so axis of the space are aligned with the viewport instead of the tile.
 * This space is used for pitch-alignment=map, rotation-alignment=viewport
 *
 * ## Viewport pixel coordinate space
 * (0, 0) is at the top left of the canvas and (pixelWidth, pixelHeight) is at the bottom right corner
 * of the canvas. This space is used for pitch-alignment=viewport
 *
 *
 * # Vertex projection
 * It goes roughly like this:
 * 1. project the anchor and line from tile units into the correct label coordinate space
 *      - map pixel space           pitch-alignment=map         rotation-alignment=map
 *      - rotated map pixel space   pitch-alignment=map         rotation-alignment=viewport
 *      - viewport pixel space      pitch-alignment=viewport    rotation-alignment=*
 * 2. if the label follows a line, find the point along the line that is the correct distance from the anchor.
 * 3. add the glyph's corner offset to the point from step 3
 * 4. convert from the label coordinate space to gl coordinates
 *
 * For horizontal labels we want to do step 1 in the shader for performance reasons (no cpu work).
 *      This is what `u_label_plane_matrix` is used for.
 * For labels aligned with lines we have to steps 1 and 2 on the cpu since we need access to the line geometry.
 *      This is what `updateLineLabels(...)` does.
 *      Since the conversion is handled on the cpu we just set `u_label_plane_matrix` to an identity matrix.
 *
 * Steps 3 and 4 are done in the shaders for all labels.
 */

/*
 * Returns a matrix for converting from tile units to the correct label coordinate space.
 */
function getLabelPlaneMatrix(posMatrix: mat4,
    pitchWithMap: boolean,
    rotateWithMap: boolean,
    transform: Transform,
    pixelsToTileUnits: number) {
    const m = mat4.create();
    if (pitchWithMap) {
        mat4.scale(m, m, [1 / pixelsToTileUnits, 1 / pixelsToTileUnits, 1]);
        if (!rotateWithMap) {
            mat4.rotateZ(m, m, transform.angle);
        }
    } else {
        mat4.multiply(m, transform.labelPlaneMatrix, posMatrix);
    }
    return m;
}

/*
 * Returns a matrix for converting from the correct label coordinate space to gl coords.
 */
function getGlCoordMatrix(posMatrix: mat4,
    pitchWithMap: boolean,
    rotateWithMap: boolean,
    transform: Transform,
    pixelsToTileUnits: number) {
    if (pitchWithMap) {
        const m = mat4.clone(posMatrix);
        mat4.scale(m, m, [pixelsToTileUnits, pixelsToTileUnits, 1]);
        if (!rotateWithMap) {
            mat4.rotateZ(m, m, -transform.angle);
        }
        return m;
    } else {
        return transform.glCoordMatrix;
    }
}

function project(point: Point, matrix: mat4, getElevation?: (x: number, y: number) => number) {
    let pos;
    if (getElevation) { // slow because of handle z-index
        pos = [point.x, point.y, getElevation(point.x, point.y), 1] as vec4;
        vec4.transformMat4(pos, pos, matrix);
    } else { // fast because of ignore z-index
        pos = [point.x, point.y, 0, 1] as vec4;
        xyTransformMat4(pos, pos, matrix);
    }
    const w = pos[3];
    return {
        point: new Point(pos[0] / w, pos[1] / w),
        signedDistanceFromCamera: w
    };
}

function getPerspectiveRatio(cameraToCenterDistance: number, signedDistanceFromCamera: number): number {
    return 0.5 + 0.5 * (cameraToCenterDistance / signedDistanceFromCamera);
}

function isVisible(anchorPos: vec4,
    clippingBuffer: [number, number]) {
    const x = anchorPos[0] / anchorPos[3];
    const y = anchorPos[1] / anchorPos[3];
    const inPaddedViewport = (
        x >= -clippingBuffer[0] &&
        x <= clippingBuffer[0] &&
        y >= -clippingBuffer[1] &&
        y <= clippingBuffer[1]);
    return inPaddedViewport;
}

/*
 *  Update the `dynamicLayoutVertexBuffer` for the buffer with the correct glyph positions for the current map view.
 *  This is only run on labels that are aligned with lines. Horizontal labels are handled entirely in the shader.
 */
function updateLineLabels(bucket: SymbolBucket,
    posMatrix: mat4,
    painter: Painter,
    isText: boolean,
    labelPlaneMatrix: mat4,
    glCoordMatrix: mat4,
    pitchWithMap: boolean,
    keepUpright: boolean,
    rotateToLine: boolean,
    getElevation: (x: number, y: number) => number) {

    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
    const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(sizeData, painter.transform.zoom);

    const clippingBuffer: [number, number] = [256 / painter.width * 2 + 1, 256 / painter.height * 2 + 1];

    const dynamicLayoutVertexArray = isText ?
        bucket.text.dynamicLayoutVertexArray :
        bucket.icon.dynamicLayoutVertexArray;
    dynamicLayoutVertexArray.clear();

    const lineVertexArray = bucket.lineVertexArray;
    const placedSymbols = isText ? bucket.text.placedSymbolArray : bucket.icon.placedSymbolArray;

    const aspectRatio = painter.transform.width / painter.transform.height;

    let useVertical = false;

    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);

        // Don't do calculations for vertical glyphs unless the previous symbol was horizontal
        // and we determined that vertical glyphs were necessary.
        // Also don't do calculations for symbols that are collided and fully faded out
        if (symbol.hidden || symbol.writingMode === WritingMode.vertical && !useVertical) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
            continue;
        }
        // Awkward... but we're counting on the paired "vertical" symbol coming immediately after its horizontal counterpart
        useVertical = false;

        let anchorPos;
        if (getElevation) {  // slow because of handle z-index
            anchorPos = [symbol.anchorX, symbol.anchorY, getElevation(symbol.anchorX, symbol.anchorY), 1] as vec4;
            vec4.transformMat4(anchorPos, anchorPos, posMatrix);
        } else {  // fast because of ignore z-index
            anchorPos = [symbol.anchorX, symbol.anchorY, 0, 1] as vec4;
            xyTransformMat4(anchorPos, anchorPos, posMatrix);
        }

        // Don't bother calculating the correct point for invisible labels.
        if (!isVisible(anchorPos, clippingBuffer)) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
            continue;
        }

        const cameraToAnchorDistance = anchorPos[3];
        const perspectiveRatio = getPerspectiveRatio(painter.transform.cameraToCenterDistance, cameraToAnchorDistance);

        const fontSize = symbolSize.evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol);
        const pitchScaledFontSize = pitchWithMap ? fontSize / perspectiveRatio : fontSize * perspectiveRatio;

        const tileAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const anchorPoint = project(tileAnchorPoint, labelPlaneMatrix, getElevation).point;
        const projectionCache = {projections: {}, offsets: {}};

        const placeUnflipped: any = placeGlyphsAlongLine(symbol, pitchScaledFontSize, false /*unflipped*/, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix,
            bucket.glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, anchorPoint, tileAnchorPoint, projectionCache, aspectRatio, rotateToLine, getElevation);

        useVertical = placeUnflipped.useVertical;

        if (placeUnflipped.notEnoughRoom || useVertical ||
            (placeUnflipped.needsFlipping &&
             (placeGlyphsAlongLine(symbol, pitchScaledFontSize, true /*flipped*/, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix,
                 bucket.glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, anchorPoint, tileAnchorPoint, projectionCache, aspectRatio, rotateToLine, getElevation) as any).notEnoughRoom)) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
        }
    }

    if (isText) {
        bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
    } else {
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
    }
}

type FirstAndLastGlyphPlacement = {
    first: PlacedGlyph;
    last: PlacedGlyph;
} | null;

/*
 * Place the first and last glyph of a line label, projected to the label plane.
 * This function is called both during collision detection (to determine the label's size)
 * and during line label rendering (to make sure the label fits on the line geometry with
 * the current camera position, which may differ from the position used during collision detection).
 *
 * Calling this function has the effect of populating the "projectionCache" with all projected
 * vertex locations the label will need, making future calls to placeGlyphAlongLine (for all the
 * intermediate glyphs) much cheaper.
 *
 * Returns null if the label can't fit on the geometry
 */
function placeFirstAndLastGlyph(fontScale: number, glyphOffsetArray: GlyphOffsetArray, lineOffsetX: number, lineOffsetY: number, flip: boolean, anchorPoint: Point, tileAnchorPoint: Point, symbol: any, lineVertexArray: SymbolLineVertexArray, labelPlaneMatrix: mat4, projectionCache: ProjectionCache, rotateToLine: boolean, getElevation: (x: number, y: number) => number): FirstAndLastGlyphPlacement {
    const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;
    const lineStartIndex = symbol.lineStartIndex;
    const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;

    const firstGlyphOffset = glyphOffsetArray.getoffsetX(symbol.glyphStartIndex);
    const lastGlyphOffset = glyphOffsetArray.getoffsetX(glyphEndIndex - 1);

    const firstPlacedGlyph = placeGlyphAlongLine(fontScale * firstGlyphOffset, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
        lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, rotateToLine, getElevation);
    if (!firstPlacedGlyph)
        return null;

    const lastPlacedGlyph = placeGlyphAlongLine(fontScale * lastGlyphOffset, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
        lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, rotateToLine, getElevation);
    if (!lastPlacedGlyph)
        return null;

    return {first: firstPlacedGlyph, last: lastPlacedGlyph};
}

function requiresOrientationChange(writingMode, firstPoint, lastPoint, aspectRatio) {
    if (writingMode === WritingMode.horizontal) {
        // On top of choosing whether to flip, choose whether to render this version of the glyphs or the alternate
        // vertical glyphs. We can't just filter out vertical glyphs in the horizontal range because the horizontal
        // and vertical versions can have slightly different projections which could lead to angles where both or
        // neither showed.
        const rise = Math.abs(lastPoint.y - firstPoint.y);
        const run = Math.abs(lastPoint.x - firstPoint.x) * aspectRatio;
        if (rise > run) {
            return {useVertical: true};
        }
    }

    if (writingMode === WritingMode.vertical ? firstPoint.y < lastPoint.y : firstPoint.x > lastPoint.x) {
        // Includes "horizontalOnly" case for labels without vertical glyphs
        return {needsFlipping: true};
    }

    return null;
}

/*
* Place first and last glyph along the line projected to label plane, and if they fit
* iterate through all the intermediate glyphs, calculating their label plane positions
* from the projected line.
*
* Finally, add resulting glyph position calculations to dynamicLayoutVertexArray for
* upload to the GPU
*/
function placeGlyphsAlongLine(symbol, fontSize, flip, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix, glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, anchorPoint, tileAnchorPoint, projectionCache, aspectRatio, rotateToLine, getElevation) {
    const fontScale = fontSize / 24;
    const lineOffsetX = symbol.lineOffsetX * fontScale;
    const lineOffsetY = symbol.lineOffsetY * fontScale;

    let placedGlyphs;
    if (symbol.numGlyphs > 1) {
        const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;
        const lineStartIndex = symbol.lineStartIndex;
        const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;

        // Place the first and the last glyph in the label first, so we can figure out
        // the overall orientation of the label and determine whether it needs to be flipped in keepUpright mode
        const firstAndLastGlyph = placeFirstAndLastGlyph(fontScale, glyphOffsetArray, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol, lineVertexArray, labelPlaneMatrix, projectionCache, rotateToLine, getElevation);
        if (!firstAndLastGlyph) {
            return {notEnoughRoom: true};
        }
        const firstPoint = project(firstAndLastGlyph.first.point, glCoordMatrix, getElevation).point;
        const lastPoint = project(firstAndLastGlyph.last.point, glCoordMatrix, getElevation).point;

        if (keepUpright && !flip) {
            const orientationChange = requiresOrientationChange(symbol.writingMode, firstPoint, lastPoint, aspectRatio);
            if (orientationChange) {
                return orientationChange;
            }
        }

        placedGlyphs = [firstAndLastGlyph.first];
        for (let glyphIndex = symbol.glyphStartIndex + 1; glyphIndex < glyphEndIndex - 1; glyphIndex++) {
            // Since first and last glyph fit on the line, we're sure that the rest of the glyphs can be placed
            placedGlyphs.push(placeGlyphAlongLine(fontScale * glyphOffsetArray.getoffsetX(glyphIndex), lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
                lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, rotateToLine, getElevation));
        }
        placedGlyphs.push(firstAndLastGlyph.last);
    } else {
        // Only a single glyph to place
        // So, determine whether to flip based on projected angle of the line segment it's on
        if (keepUpright && !flip) {
            const a = project(tileAnchorPoint, posMatrix, getElevation).point;
            const tileVertexIndex = (symbol.lineStartIndex + symbol.segment + 1);
            const tileSegmentEnd = new Point(lineVertexArray.getx(tileVertexIndex), lineVertexArray.gety(tileVertexIndex));
            const projectedVertex = project(tileSegmentEnd, posMatrix, getElevation);
            // We know the anchor will be in the viewport, but the end of the line segment may be
            // behind the plane of the camera, in which case we can use a point at any arbitrary (closer)
            // point on the segment.
            const b = (projectedVertex.signedDistanceFromCamera > 0) ?
                projectedVertex.point :
                projectTruncatedLineSegment(tileAnchorPoint, tileSegmentEnd, a, 1, posMatrix, getElevation);

            const orientationChange = requiresOrientationChange(symbol.writingMode, a, b, aspectRatio);
            if (orientationChange) {
                return orientationChange;
            }
        }
        const singleGlyph = placeGlyphAlongLine(fontScale * glyphOffsetArray.getoffsetX(symbol.glyphStartIndex), lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
            symbol.lineStartIndex, symbol.lineStartIndex + symbol.lineLength, lineVertexArray, labelPlaneMatrix, projectionCache, rotateToLine, getElevation);
        if (!singleGlyph)
            return {notEnoughRoom: true};

        placedGlyphs = [singleGlyph];
    }

    for (const glyph of placedGlyphs) {
        addDynamicAttributes(dynamicLayoutVertexArray, glyph.point, glyph.angle);
    }
    return {};
}

function projectTruncatedLineSegment(previousTilePoint: Point, currentTilePoint: Point, previousProjectedPoint: Point, minimumLength: number, projectionMatrix: mat4, getElevation: (x: number, y: number) => number) {
    // We are assuming "previousTilePoint" won't project to a point within one unit of the camera plane
    // If it did, that would mean our label extended all the way out from within the viewport to a (very distant)
    // point near the plane of the camera. We wouldn't be able to render the label anyway once it crossed the
    // plane of the camera.
    const projectedUnitVertex = project(previousTilePoint.add(previousTilePoint.sub(currentTilePoint)._unit()), projectionMatrix, getElevation).point;
    const projectedUnitSegment = previousProjectedPoint.sub(projectedUnitVertex);

    return previousProjectedPoint.add(projectedUnitSegment._mult(minimumLength / projectedUnitSegment.mag()));
}

type IndexToPointCache = { [lineIndex: number]: Point };

/**
 * We calculate label-plane projected points for line vertices as we place glyphs along the line
 * Since we will use the same vertices for potentially many glyphs, cache the results for this bucket
 * over the course of the render. Each vertex location also potentially has one offset equivalent
 * for us to hold onto. The vertex indices are per-symbol-bucket.
 */
type ProjectionCache = {
    /**
     * tile-unit vertices projected into label-plane units
     */
    projections: IndexToPointCache;
    /**
     * label-plane vertices which have been shifted to follow an offset line
     */
    offsets: IndexToPointCache;
};

/**
 * Arguments necessary to project a vertex to the label plane
 */
type ProjectionArgs = {
    /**
     * Used to cache results, save cost if projecting the same vertex multiple times
     */
    projectionCache: ProjectionCache;
    /**
     * The array of tile-unit vertices transferred from worker
     */
    lineVertexArray: SymbolLineVertexArray;
    /**
     * Label plane projection matrix
     */
    labelPlaneMatrix: mat4;
    /**
     * Function to get elevation at a point
     * @param x - the x coordinate
     * @param y - the y coordinate
    */
    getElevation: (x: number, y: number) => number;
    /**
     * Only for creating synthetic vertices if vertex would otherwise project behind plane of camera
     */
    tileAnchorPoint: Point;
    /**
     * Only for creating synthetic vertices if vertex would otherwise project behind plane of camera
     */
    distanceFromAnchor: number;
    /**
     * Only for creating synthetic vertices if vertex would otherwise project behind plane of camera
     */
    previousVertex: Point;
    /**
     * Only for creating synthetic vertices if vertex would otherwise project behind plane of camera
     */
    direction: number;
    /**
     * Only for creating synthetic vertices if vertex would otherwise project behind plane of camera
     */
    absOffsetX: number;
};

/**
 * Transform a vertex from tile coordinates to label plane coordinates
 * @param index - index of vertex to project
 * @param projectionArgs - necessary data to project a vertex
 * @returns the vertex projected to the label plane
 */
function projectVertexToViewport(index: number, projectionArgs: ProjectionArgs): Point {
    const {projectionCache, lineVertexArray, labelPlaneMatrix, tileAnchorPoint, distanceFromAnchor, getElevation, previousVertex, direction, absOffsetX} = projectionArgs;
    if (projectionCache.projections[index]) {
        return projectionCache.projections[index];
    }
    const currentVertex = new Point(lineVertexArray.getx(index), lineVertexArray.gety(index));
    const projection = project(currentVertex, labelPlaneMatrix, getElevation);
    if (projection.signedDistanceFromCamera > 0) {
        projectionCache.projections[index] = projection.point;
        return projection.point;
    }

    // The vertex is behind the plane of the camera, so we can't project it
    // Instead, we'll create a vertex along the line that's far enough to include the glyph
    const previousLineVertexIndex = index - direction;
    const previousTilePoint = distanceFromAnchor === 0 ?
        tileAnchorPoint :
        new Point(lineVertexArray.getx(previousLineVertexIndex), lineVertexArray.gety(previousLineVertexIndex));
    // Don't cache because the new vertex might not be far enough out for future glyphs on the same segment
    return projectTruncatedLineSegment(previousTilePoint, currentVertex, previousVertex, absOffsetX - distanceFromAnchor + 1, labelPlaneMatrix, getElevation);
}

/**
 * Calculate the normal vector for a line segment
 * @param segmentVector - will be mutated as a tiny optimization
 * @param offset - magnitude of resulting vector
 * @param direction - direction of line traversal
 * @returns a normal vector from the segment, with magnitude equal to offset amount
 */
function transformToOffsetNormal(segmentVector: Point, offset: number, direction: number): Point {
    return segmentVector._unit()._perp()._mult(offset * direction);
}

/**
 * Construct offset line segments for the current segment and the next segment, then extend/shrink
 * the segments until they intersect. If the segments are parallel, then they will touch with no modification.
 *
 * @param index - Index of the current vertex
 * @param prevToCurrentOffsetNormal - Normal vector of the line segment from the previous vertex to the current vertex
 * @param currentVertex - Current (non-offset) vertex projected to the label plane
 * @param lineStartIndex - Beginning index for the line this label is on
 * @param lineEndIndex - End index for the line this label is on
 * @param offsetPreviousVertex - The previous vertex projected to the label plane, and then offset along the previous segments normal
 * @param lineOffsetY - Magnitude of the offset
 * @param projectionArgs - Necessary data for tile-to-label-plane projection
 * @returns The point at which the current and next line segments intersect, once offset and extended/shrunk to their meeting point
 */
function findOffsetIntersectionPoint(index: number, prevToCurrentOffsetNormal: Point, currentVertex: Point, lineStartIndex: number, lineEndIndex: number, offsetPreviousVertex: Point, lineOffsetY: number, projectionArgs: ProjectionArgs) {
    const {projectionCache, direction} = projectionArgs;
    if (projectionCache.offsets[index]) {
        return projectionCache.offsets[index];
    }

    const offsetCurrentVertex = currentVertex.add(prevToCurrentOffsetNormal);

    if (index + direction < lineStartIndex || index + direction >= lineEndIndex) {
        // This is the end of the line, no intersection to calculate
        projectionCache.offsets[index] = offsetCurrentVertex;
        return offsetCurrentVertex;
    }
    // Offset the vertices for the next segment
    const nextVertex = projectVertexToViewport(index + direction, projectionArgs);
    const currentToNextOffsetNormal = transformToOffsetNormal(nextVertex.sub(currentVertex), lineOffsetY, direction);
    const offsetNextSegmentBegin = currentVertex.add(currentToNextOffsetNormal);
    const offsetNextSegmentEnd = nextVertex.add(currentToNextOffsetNormal);

    // find the intersection of these two lines
    // if the lines are parallel, offsetCurrent/offsetNextBegin will touch
    projectionCache.offsets[index] = findLineIntersection(offsetPreviousVertex, offsetCurrentVertex, offsetNextSegmentBegin, offsetNextSegmentEnd) || offsetCurrentVertex;

    return projectionCache.offsets[index];
}

/**
 * Placed Glyph type
 */
type PlacedGlyph = {
    /**
     * The point at which the glyph should be placed, in label plane coordinates
     */
    point: Point;
    /**
     * The angle at which the glyph should be placed
     */
    angle: number;
    /**
     * The label-plane path used to reach this glyph: used only for collision detection
     */
    path: Array<Point>;
};

/*
 * Place a single glyph along its line, projected into the label plane, by iterating outward
 * from the anchor point until the distance traversed in the label plane equals the glyph's
 * offsetX. Returns null if the glyph can't fit on the line geometry.
 */
function placeGlyphAlongLine(
    offsetX: number,
    lineOffsetX: number,
    lineOffsetY: number,
    flip: boolean,
    anchorPoint: Point,
    tileAnchorPoint: Point,
    anchorSegment: number,
    lineStartIndex: number,
    lineEndIndex: number,
    lineVertexArray: SymbolLineVertexArray,
    labelPlaneMatrix: mat4,
    projectionCache: ProjectionCache,
    rotateToLine: boolean,
    getElevation: (x: number, y: number) => number): PlacedGlyph | null {

    const combinedOffsetX = flip ?
        offsetX - lineOffsetX :
        offsetX + lineOffsetX;

    let direction = combinedOffsetX > 0 ? 1 : -1;

    let angle = 0;
    if (flip) {
        // The label needs to be flipped to keep text upright.
        // Iterate in the reverse direction.
        direction *= -1;
        angle = Math.PI;
    }

    if (direction < 0) angle += Math.PI;

    let currentIndex = direction > 0 ?
        lineStartIndex + anchorSegment :
        lineStartIndex + anchorSegment + 1;

    let currentVertex = anchorPoint;
    let previousVertex = anchorPoint;

    // offsetPrev and intersectionPoint are analogous to previousVertex and currentVertex
    // but if there's a line offset they are calculated in parallel as projection happens
    let offsetIntersectionPoint: Point;
    let offsetPreviousVertex: Point;

    let distanceFromAnchor = 0;
    let currentSegmentDistance = 0;
    const absOffsetX = Math.abs(combinedOffsetX);
    const pathVertices: Array<Point> = [];

    let currentLineSegment: Point;
    while (distanceFromAnchor + currentSegmentDistance <= absOffsetX) {
        currentIndex += direction;

        // offset does not fit on the projected line
        if (currentIndex < lineStartIndex || currentIndex >= lineEndIndex)
            return null;

        // accumulate values from last iteration
        distanceFromAnchor += currentSegmentDistance;
        previousVertex = currentVertex;
        offsetPreviousVertex = offsetIntersectionPoint;

        const projectionArgs: ProjectionArgs = {
            projectionCache,
            lineVertexArray,
            labelPlaneMatrix,
            tileAnchorPoint,
            distanceFromAnchor,
            getElevation,
            previousVertex,
            direction,
            absOffsetX
        };

        // find next vertex in viewport space
        currentVertex = projectVertexToViewport(currentIndex, projectionArgs);
        if (lineOffsetY === 0) {
            // Store vertices for collision detection and update current segment geometry
            pathVertices.push(previousVertex);
            currentLineSegment = currentVertex.sub(previousVertex);
        } else {
            // Calculate the offset for this section
            let prevToCurrentOffsetNormal;
            const prevToCurrent = currentVertex.sub(previousVertex);
            if (prevToCurrent.mag() === 0) {
                // We are starting with our anchor point directly on the vertex, so look one vertex ahead
                // to calculate a normal
                const nextVertex = projectVertexToViewport(currentIndex + direction, projectionArgs);
                prevToCurrentOffsetNormal = transformToOffsetNormal(nextVertex.sub(currentVertex), lineOffsetY, direction);
            } else {
                prevToCurrentOffsetNormal = transformToOffsetNormal(prevToCurrent, lineOffsetY, direction);
            }
            // Initialize offsetPrev on our first iteration, after that it will be pre-calculated
            if (!offsetPreviousVertex)
                offsetPreviousVertex = previousVertex.add(prevToCurrentOffsetNormal);

            offsetIntersectionPoint = findOffsetIntersectionPoint(currentIndex, prevToCurrentOffsetNormal, currentVertex, lineStartIndex, lineEndIndex, offsetPreviousVertex, lineOffsetY, projectionArgs);

            pathVertices.push(offsetPreviousVertex);
            currentLineSegment = offsetIntersectionPoint.sub(offsetPreviousVertex);
        }
        currentSegmentDistance = currentLineSegment.mag();
    }

    // The point is on the current segment. Interpolate to find it.
    const segmentInterpolationT = (absOffsetX - distanceFromAnchor) / currentSegmentDistance;
    const p = currentLineSegment._mult(segmentInterpolationT)._add(offsetPreviousVertex || previousVertex);

    const segmentAngle = angle + Math.atan2(currentVertex.y - previousVertex.y, currentVertex.x - previousVertex.x);

    pathVertices.push(p);

    return {
        point: p,
        angle: rotateToLine ? segmentAngle : 0.0,
        path: pathVertices
    };
}

const hiddenGlyphAttributes = new Float32Array([-Infinity, -Infinity, 0, -Infinity, -Infinity, 0, -Infinity, -Infinity, 0, -Infinity, -Infinity, 0]);

// Hide them by moving them offscreen. We still need to add them to the buffer
// because the dynamic buffer is paired with a static buffer that doesn't get updated.
function hideGlyphs(num: number, dynamicLayoutVertexArray: SymbolDynamicLayoutArray) {
    for (let i = 0; i < num; i++) {
        const offset = dynamicLayoutVertexArray.length;
        dynamicLayoutVertexArray.resize(offset + 4);
        // Since all hidden glyphs have the same attributes, we can build up the array faster with a single call to Float32Array.set
        // for each set of four vertices, instead of calling addDynamicAttributes for each vertex.
        dynamicLayoutVertexArray.float32.set(hiddenGlyphAttributes, offset * 3);
    }
}

// For line label layout, we're not using z output and our w input is always 1
// This custom matrix transformation ignores those components to make projection faster
function xyTransformMat4(out: vec4, a: vec4, m: mat4) {
    const x = a[0], y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    out[3] = m[3] * x + m[7] * y + m[15];
    return out;
}
