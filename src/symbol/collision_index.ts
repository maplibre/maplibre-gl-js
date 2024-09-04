import Point from '@mapbox/point-geometry';
import {clipLine} from './clip_line';
import {PathInterpolator} from './path_interpolator';

import * as intersectionTests from '../util/intersection_tests';
import {GridIndex} from './grid_index';
import {mat4, vec4} from 'gl-matrix';
import ONE_EM from '../symbol/one_em';

import * as projection from '../symbol/projection';

import type {Transform} from '../geo/transform';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {
    GlyphOffsetArray,
    SymbolLineVertexArray
} from '../data/array_types.g';
import type {OverlapMode} from '../style/style_layer/overlap_mode';
import {UnwrappedTileID} from '../source/tile_id';
import {SymbolProjectionContext} from '../symbol/projection';
import {Projection} from '../geo/projection/projection';
import {clamp, getAABB} from '../util/util';

// When a symbol crosses the edge that causes it to be included in
// collision detection, it will cause changes in the symbols around
// it. This constant specifies how many pixels to pad the edge of
// the viewport for collision detection so that the bulk of the changes
// occur offscreen. Making this constant greater increases label
// stability, but it's expensive.
export const viewportPadding = 100;

export type PlacedCircles = {
    circles: Array<number>;
    offscreen: boolean;
    collisionDetected: boolean;
};

export type PlacedBox = {
    box: Array<number>;
    placeable: boolean;
    offscreen: boolean;
};

export type FeatureKey = {
    bucketInstanceId: number;
    featureIndex: number;
    collisionGroupID: number;
    overlapMode: OverlapMode;
};

type ProjectedBox = {
    /**
     * The AABB in the format [minX, minY, maxX, maxY].
     */
    box: [number, number, number, number];
    allPointsOccluded: boolean;
};

/**
 * @internal
 * A collision index used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * There are two steps to insertion: first placeCollisionBox/Circles checks if
 * there's room for a symbol, then insertCollisionBox/Circles actually puts the
 * symbol in the index. The two step process allows paired symbols to be inserted
 * together even if they overlap.
 */
export class CollisionIndex {
    grid: GridIndex<FeatureKey>;
    ignoredGrid: GridIndex<FeatureKey>;
    transform: Transform;
    pitchFactor: number;
    screenRightBoundary: number;
    screenBottomBoundary: number;
    gridRightBoundary: number;
    gridBottomBoundary: number;
    mapProjection: Projection;

    // With perspectiveRatio the fontsize is calculated for tilted maps (near = bigger, far = smaller).
    // The cutoff defines a threshold to no longer render labels near the horizon.
    perspectiveRatioCutoff: number;

    constructor(
        transform: Transform,
        projection: Projection,
        grid = new GridIndex<FeatureKey>(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25),
        ignoredGrid = new GridIndex<FeatureKey>(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25)
    ) {
        this.transform = transform;
        this.mapProjection = projection;

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;
        this.pitchFactor = Math.cos(transform._pitch) * transform.cameraToCenterDistance;

        this.screenRightBoundary = transform.width + viewportPadding;
        this.screenBottomBoundary = transform.height + viewportPadding;
        this.gridRightBoundary = transform.width + 2 * viewportPadding;
        this.gridBottomBoundary = transform.height + 2 * viewportPadding;

        this.perspectiveRatioCutoff = 0.6;
    }

    placeCollisionBox(
        collisionBox: SingleCollisionBox,
        overlapMode: OverlapMode,
        textPixelRatio: number,
        posMatrix: mat4,
        unwrappedTileID: UnwrappedTileID,
        pitchWithMap: boolean,
        rotateWithMap: boolean,
        translation: [number, number],
        collisionGroupPredicate?: (key: FeatureKey) => boolean,
        getElevation?: (x: number, y: number) => number,
        shift?: Point
    ): PlacedBox {
        const x = collisionBox.anchorPointX + translation[0];
        const y = collisionBox.anchorPointY + translation[1];
        const projectedPoint = this.projectAndGetPerspectiveRatio(
            posMatrix,
            x,
            y,
            unwrappedTileID,
            getElevation
        );

        const tileToViewport = textPixelRatio * projectedPoint.perspectiveRatio;

        let projectedBox: ProjectedBox;

        if (!pitchWithMap && !rotateWithMap) {
            // Fast path for common symbols
            const pointX = projectedPoint.point.x + (shift ? shift.x * tileToViewport : 0);
            const pointY = projectedPoint.point.y + (shift ? shift.y * tileToViewport : 0);
            projectedBox = {
                allPointsOccluded: false,
                box: [
                    pointX + collisionBox.x1 * tileToViewport,
                    pointY + collisionBox.y1 * tileToViewport,
                    pointX + collisionBox.x2 * tileToViewport,
                    pointY + collisionBox.y2 * tileToViewport,
                ]
            };
        } else {
            projectedBox = this._projectCollisionBox(
                collisionBox,
                tileToViewport,
                posMatrix,
                unwrappedTileID,
                pitchWithMap,
                rotateWithMap,
                translation,
                projectedPoint,
                getElevation,
                shift
            );
        }

        const [tlX, tlY, brX, brY] = projectedBox.box;

        const projectionOccluded = this.mapProjection.useSpecialProjectionForSymbols ? (pitchWithMap ? projectedBox.allPointsOccluded : this.mapProjection.isOccluded(x, y, unwrappedTileID)) : false;

        if (projectionOccluded || projectedPoint.perspectiveRatio < this.perspectiveRatioCutoff || !this.isInsideGrid(tlX, tlY, brX, brY) ||
            (overlapMode !== 'always' && this.grid.hitTest(tlX, tlY, brX, brY, overlapMode, collisionGroupPredicate))) {
            return {
                box: [tlX, tlY, brX, brY],
                placeable: false,
                offscreen: false
            };
        }

        return {
            box: [tlX, tlY, brX, brY],
            placeable: true,
            offscreen: this.isOffscreen(tlX, tlY, brX, brY)
        };
    }

    placeCollisionCircles(
        overlapMode: OverlapMode,
        symbol: any,
        lineVertexArray: SymbolLineVertexArray,
        glyphOffsetArray: GlyphOffsetArray,
        fontSize: number,
        posMatrix: mat4,
        unwrappedTileID: UnwrappedTileID,
        labelPlaneMatrix: mat4,
        labelToScreenMatrix: mat4,
        showCollisionCircles: boolean,
        pitchWithMap: boolean,
        collisionGroupPredicate: (key: FeatureKey) => boolean,
        circlePixelDiameter: number,
        textPixelPadding: number,
        translation: [number, number],
        getElevation: (x: number, y: number) => number
    ): PlacedCircles {
        const placedCollisionCircles = [];

        const tileUnitAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const perspectiveRatio = this.getPerspectiveRatio(posMatrix, tileUnitAnchorPoint.x, tileUnitAnchorPoint.y, unwrappedTileID, getElevation);
        const labelPlaneFontSize = pitchWithMap ? fontSize / perspectiveRatio : fontSize * perspectiveRatio;
        const labelPlaneFontScale = labelPlaneFontSize / ONE_EM;

        const projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetX = symbol.lineOffsetX * labelPlaneFontScale;
        const lineOffsetY = symbol.lineOffsetY * labelPlaneFontScale;

        const projectionContext: SymbolProjectionContext = {
            getElevation,
            labelPlaneMatrix,
            lineVertexArray,
            pitchWithMap,
            projectionCache,
            projection: this.mapProjection,
            tileAnchorPoint: tileUnitAnchorPoint,
            unwrappedTileID,
            width: this.transform.width,
            height: this.transform.height,
            translation
        };

        const firstAndLastGlyph = projection.placeFirstAndLastGlyph(
            labelPlaneFontScale,
            glyphOffsetArray,
            lineOffsetX,
            lineOffsetY,
            /*flip*/ false,
            symbol,
            false,
            projectionContext);

        let collisionDetected = false;
        let inGrid = false;
        let entirelyOffscreen = true;

        if (firstAndLastGlyph) {
            const radius = circlePixelDiameter * 0.5 * perspectiveRatio + textPixelPadding;
            const screenPlaneMin = new Point(-viewportPadding, -viewportPadding);
            const screenPlaneMax = new Point(this.screenRightBoundary, this.screenBottomBoundary);
            const interpolator = new PathInterpolator();

            // Construct a projected path from projected line vertices. Anchor points are ignored and removed
            const first = firstAndLastGlyph.first;
            const last = firstAndLastGlyph.last;

            let projectedPath: Array<Point> = [];
            for (let i = first.path.length - 1; i >= 1; i--) {
                projectedPath.push(first.path[i]);
            }
            for (let i = 1; i < last.path.length; i++) {
                projectedPath.push(last.path[i]);
            }

            // Tolerate a slightly longer distance than one diameter between two adjacent circles
            const circleDist = radius * 2.5;

            // The path might need to be converted into screen space if a pitched map is used as the label space
            if (labelToScreenMatrix) {
                const screenSpacePath = this.projectPathToScreenSpace(projectedPath, projectionContext, labelToScreenMatrix);
                // Do not try to place collision circles if even one of the points is behind the camera.
                // This is a plausible scenario with big camera pitch angles
                if (screenSpacePath.some(point => point.signedDistanceFromCamera <= 0)) {
                    projectedPath = [];
                } else {
                    projectedPath = screenSpacePath.map(p => p.point);
                }
            }

            let segments = [];

            if (projectedPath.length > 0) {
                // Quickly check if the path is fully inside or outside of the padded collision region.
                // For overlapping paths we'll only create collision circles for the visible segments
                const minPoint = projectedPath[0].clone();
                const maxPoint = projectedPath[0].clone();

                for (let i = 1; i < projectedPath.length; i++) {
                    minPoint.x = Math.min(minPoint.x, projectedPath[i].x);
                    minPoint.y = Math.min(minPoint.y, projectedPath[i].y);
                    maxPoint.x = Math.max(maxPoint.x, projectedPath[i].x);
                    maxPoint.y = Math.max(maxPoint.y, projectedPath[i].y);
                }

                if (minPoint.x >= screenPlaneMin.x && maxPoint.x <= screenPlaneMax.x &&
                    minPoint.y >= screenPlaneMin.y && maxPoint.y <= screenPlaneMax.y) {
                    // Quad fully visible
                    segments = [projectedPath];
                } else if (maxPoint.x < screenPlaneMin.x || minPoint.x > screenPlaneMax.x ||
                    maxPoint.y < screenPlaneMin.y || minPoint.y > screenPlaneMax.y) {
                    // Not visible
                    segments = [];
                } else {
                    segments = clipLine([projectedPath], screenPlaneMin.x, screenPlaneMin.y, screenPlaneMax.x, screenPlaneMax.y);
                }
            }

            for (const seg of segments) {
                // interpolate positions for collision circles. Add a small padding to both ends of the segment
                interpolator.reset(seg, radius * 0.25);

                let numCircles = 0;

                if (interpolator.length <= 0.5 * radius) {
                    numCircles = 1;
                } else {
                    numCircles = Math.ceil(interpolator.paddedLength / circleDist) + 1;
                }

                for (let i = 0; i < numCircles; i++) {
                    const t = i / Math.max(numCircles - 1, 1);
                    const circlePosition = interpolator.lerp(t);

                    // add viewport padding to the position and perform initial collision check
                    const centerX = circlePosition.x + viewportPadding;
                    const centerY = circlePosition.y + viewportPadding;

                    placedCollisionCircles.push(centerX, centerY, radius, 0);

                    const x1 = centerX - radius;
                    const y1 = centerY - radius;
                    const x2 = centerX + radius;
                    const y2 = centerY + radius;

                    entirelyOffscreen = entirelyOffscreen && this.isOffscreen(x1, y1, x2, y2);
                    inGrid = inGrid || this.isInsideGrid(x1, y1, x2, y2);

                    if (overlapMode !== 'always' && this.grid.hitTestCircle(centerX, centerY, radius, overlapMode, collisionGroupPredicate)) {
                        // Don't early exit if we're showing the debug circles because we still want to calculate
                        // which circles are in use
                        collisionDetected = true;
                        if (!showCollisionCircles) {
                            return {
                                circles: [],
                                offscreen: false,
                                collisionDetected
                            };
                        }
                    }
                }
            }
        }

        return {
            circles: ((!showCollisionCircles && collisionDetected) || !inGrid || perspectiveRatio < this.perspectiveRatioCutoff) ? [] : placedCollisionCircles,
            offscreen: entirelyOffscreen,
            collisionDetected
        };
    }

    projectPathToScreenSpace(projectedPath: Array<Point>, projectionContext: SymbolProjectionContext, labelToScreenMatrix: mat4) {
        return projectedPath.map(p => projection.project(p.x, p.y, labelToScreenMatrix, projectionContext.getElevation));
    }

    /**
     * Because the geometries in the CollisionIndex are an approximation of the shape of
     * symbols on the map, we use the CollisionIndex to look up the symbol part of
     * `queryRenderedFeatures`.
     */
    queryRenderedSymbols(viewportQueryGeometry: Array<Point>) {
        if (viewportQueryGeometry.length === 0 || (this.grid.keysLength() === 0 && this.ignoredGrid.keysLength() === 0)) {
            return {};
        }

        const query = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const point of viewportQueryGeometry) {
            const gridPoint = new Point(point.x + viewportPadding, point.y + viewportPadding);
            minX = Math.min(minX, gridPoint.x);
            minY = Math.min(minY, gridPoint.y);
            maxX = Math.max(maxX, gridPoint.x);
            maxY = Math.max(maxY, gridPoint.y);
            query.push(gridPoint);
        }

        const features = this.grid.query(minX, minY, maxX, maxY)
            .concat(this.ignoredGrid.query(minX, minY, maxX, maxY));

        const seenFeatures = {};
        const result = {};

        for (const feature of features) {
            const featureKey = feature.key;
            // Skip already seen features.
            if (seenFeatures[featureKey.bucketInstanceId] === undefined) {
                seenFeatures[featureKey.bucketInstanceId] = {};
            }
            if (seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex]) {
                continue;
            }

            // Check if query intersects with the feature box
            // "Collision Circles" for line labels are treated as boxes here
            // Since there's no actual collision taking place, the circle vs. square
            // distinction doesn't matter as much, and box geometry is easier
            // to work with.
            const bbox = [
                new Point(feature.x1, feature.y1),
                new Point(feature.x2, feature.y1),
                new Point(feature.x2, feature.y2),
                new Point(feature.x1, feature.y2)
            ];
            if (!intersectionTests.polygonIntersectsPolygon(query, bbox)) {
                continue;
            }

            seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex] = true;
            if (result[featureKey.bucketInstanceId] === undefined) {
                result[featureKey.bucketInstanceId] = [];
            }
            result[featureKey.bucketInstanceId].push(featureKey.featureIndex);
        }

        return result;
    }

    insertCollisionBox(collisionBox: Array<number>, overlapMode: OverlapMode, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = {bucketInstanceId, featureIndex, collisionGroupID, overlapMode};
        grid.insert(key, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
    }

    insertCollisionCircles(collisionCircles: Array<number>, overlapMode: OverlapMode, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = {bucketInstanceId, featureIndex, collisionGroupID, overlapMode};
        for (let k = 0; k < collisionCircles.length; k += 4) {
            grid.insertCircle(key, collisionCircles[k], collisionCircles[k + 1], collisionCircles[k + 2]);
        }
    }

    projectAndGetPerspectiveRatio(posMatrix: mat4, x: number, y: number, _unwrappedTileID: UnwrappedTileID, getElevation?: (x: number, y: number) => number) {
        // The code here is duplicated from "projection.ts" for performance.
        // Code here is subject to change once globe is merged.
        let pos;
        if (getElevation) { // slow because of handle z-index
            pos = [x, y, getElevation(x, y), 1] as vec4;
            vec4.transformMat4(pos, pos, posMatrix);
        } else { // fast because of ignore z-index
            pos = [x, y, 0, 1] as vec4;
            projection.xyTransformMat4(pos, pos, posMatrix);
        }
        const w = pos[3];
        return {
            point: new Point(
                (((pos[0] / w + 1) / 2) * this.transform.width) + viewportPadding,
                (((-pos[1] / w + 1) / 2) * this.transform.height) + viewportPadding
            ),
            // See perspective ratio comment in symbol_sdf.vertex
            // We're doing collision detection in viewport space so we need
            // to scale down boxes in the distance
            perspectiveRatio: 0.5 + 0.5 * (this.transform.cameraToCenterDistance / w),
            isOccluded: false,
            signedDistanceFromCamera: w
        };
    }

    getPerspectiveRatio(posMatrix: mat4, x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation?: (x: number, y: number) => number): number {
        // We don't care about the actual projected point, just its W component.
        const projected = this.mapProjection.useSpecialProjectionForSymbols ?
            this.mapProjection.projectTileCoordinates(x, y, unwrappedTileID, getElevation) :
            projection.project(x, y, posMatrix, getElevation);
        return 0.5 + 0.5 * (this.transform.cameraToCenterDistance / projected.signedDistanceFromCamera);
    }

    isOffscreen(x1: number, y1: number, x2: number, y2: number) {
        return x2 < viewportPadding || x1 >= this.screenRightBoundary || y2 < viewportPadding || y1 > this.screenBottomBoundary;
    }

    isInsideGrid(x1: number, y1: number, x2: number, y2: number) {
        return x2 >= 0 && x1 < this.gridRightBoundary && y2 >= 0 && y1 < this.gridBottomBoundary;
    }

    /*
    * Returns a matrix for transforming collision shapes to viewport coordinate space.
    * Use this function to render e.g. collision circles on the screen.
    *   example transformation: clipPos = glCoordMatrix * viewportMatrix * circle_pos
    */
    getViewportMatrix() {
        const m = mat4.identity([] as any);
        mat4.translate(m, m, [-viewportPadding, -viewportPadding, 0.0]);
        return m;
    }

    /**
     * Applies all layout+paint properties of the given box in order to find as good approximation of its screen-space bounding box as possible.
     */
    private _projectCollisionBox(
        collisionBox: SingleCollisionBox,
        tileToViewport: number,
        posMatrix: mat4,
        unwrappedTileID: UnwrappedTileID,
        pitchWithMap: boolean,
        rotateWithMap: boolean,
        translation: [number, number],
        projectedPoint: {point: Point; perspectiveRatio: number; signedDistanceFromCamera: number},
        getElevation?: (x: number, y: number) => number,
        shift?: Point
    ): ProjectedBox {

        // These vectors are valid both for screen space viewport-rotation-aligned texts and for pitch-align: map texts that are map-rotation-aligned.
        let vecEast = new Point(1, 0);
        let vecSouth = new Point(0, 1);

        const translatedAnchor = new Point(collisionBox.anchorPointX + translation[0], collisionBox.anchorPointY + translation[1]);

        if (rotateWithMap && !pitchWithMap) {
            // Handles screen space texts that are always aligned east-west.
            const projectedEast = this.projectAndGetPerspectiveRatio(
                posMatrix,
                translatedAnchor.x + 1,
                translatedAnchor.y,
                unwrappedTileID,
                getElevation
            ).point;
            const toEast = projectedEast.sub(projectedPoint.point).unit();
            const angle = Math.atan(toEast.y / toEast.x) + (toEast.x < 0 ? Math.PI : 0);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            vecEast = new Point(cos, sin);
            vecSouth = new Point(-sin, cos);
        } else if (!rotateWithMap && pitchWithMap) {
            // Handles pitch-align: map texts that are always aligned with the viewport's X axis.
            const angle = -this.transform.angle;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            vecEast = new Point(cos, sin);
            vecSouth = new Point(-sin, cos);
        }

        // Configuration for screen space offsets
        let basePoint = projectedPoint.point;
        let distanceMultiplier = tileToViewport;

        if (pitchWithMap) {
            // Configuration for tile space (map-pitch-aligned) offsets
            basePoint = translatedAnchor;

            const zoomFraction = this.transform.zoom - Math.floor(this.transform.zoom);
            distanceMultiplier = Math.pow(2, -zoomFraction);
            distanceMultiplier *= this.mapProjection.getPitchedTextCorrection(this.transform, translatedAnchor, unwrappedTileID);

            // This next correction can't be applied when variable anchors are in use.
            if (!shift) {
                // Shader applies a perspective size correction, we need to apply the same correction.
                // For non-pitchWithMap texts, this is handled above by multiplying `textPixelRatio` with `projectedPoint.perspectiveRatio`,
                // which is equivalent to the non-pitchWithMap branch of the GLSL code.
                // Here, we compute and apply the pitchWithMap branch.
                // See the computation of `perspective_ratio` in the symbol vertex shaders for the GLSL code.
                const distanceRatio = projectedPoint.signedDistanceFromCamera / this.transform.cameraToCenterDistance;
                const perspectiveRatio = clamp(0.5 + 0.5 * distanceRatio, 0.0, 4.0); // Same clamp as what is used in the shader.
                distanceMultiplier *= perspectiveRatio;
            }
        }

        if (shift) {
            // Variable anchors are in use
            basePoint = basePoint.add(vecEast.mult(shift.x * distanceMultiplier)).add(vecSouth.mult(shift.y * distanceMultiplier));
        }

        const offsetXmin = collisionBox.x1 * distanceMultiplier;
        const offsetXmax = collisionBox.x2 * distanceMultiplier;
        const offsetXhalf = (offsetXmin + offsetXmax) / 2;
        const offsetYmin = collisionBox.y1 * distanceMultiplier;
        const offsetYmax = collisionBox.y2 * distanceMultiplier;
        const offsetYhalf = (offsetYmin + offsetYmax) / 2;

        // 0--1--2
        // |     |
        // 7     3
        // |     |
        // 6--5--4
        const offsetsArray: Array<{offsetX: number; offsetY: number}> = [
            {offsetX: offsetXmin,  offsetY: offsetYmin},
            {offsetX: offsetXhalf, offsetY: offsetYmin},
            {offsetX: offsetXmax,  offsetY: offsetYmin},
            {offsetX: offsetXmax,  offsetY: offsetYhalf},
            {offsetX: offsetXmax,  offsetY: offsetYmax},
            {offsetX: offsetXhalf, offsetY: offsetYmax},
            {offsetX: offsetXmin,  offsetY: offsetYmax},
            {offsetX: offsetXmin,  offsetY: offsetYhalf}
        ];

        let points: Array<Point> = [];

        for (const {offsetX, offsetY} of offsetsArray) {
            points.push(new Point(
                basePoint.x + vecEast.x * offsetX + vecSouth.x * offsetY,
                basePoint.y + vecEast.y * offsetX + vecSouth.y * offsetY
            ));
        }

        // Is any point of the collision shape visible on the globe (on beyond horizon)?
        let anyPointVisible = false;

        if (pitchWithMap) {
            const projected = points.map(p => this.projectAndGetPerspectiveRatio(posMatrix, p.x, p.y, unwrappedTileID, getElevation));

            // Is at least one of the projected points NOT behind the horizon?
            anyPointVisible = projected.some(p => !p.isOccluded);

            points = projected.map(p => p.point);
        } else {
            // Labels that are not pitchWithMap cannot ever hide behind the horizon.
            anyPointVisible = true;
        }

        return {
            box: getAABB(points),
            allPointsOccluded: !anyPointVisible
        };
    }
}
