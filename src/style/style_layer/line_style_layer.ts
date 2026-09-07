import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer.ts';
import {LineBucket} from '../../data/bucket/line_bucket.ts';
import {distToSegmentSquared, polygonIntersectsBufferedMultiLine, polygonIntersectsBufferedPoint} from '../../util/intersection_tests.ts';
import {getMaximumPaintValue, translateDistance, translate, offsetLine} from '../query_utils.ts';
import {interpolateWidthProfile} from '../../util/interpolate_widths.ts';
import Point from '@mapbox/point-geometry';
import properties, {type LineLayoutPropsPossiblyEvaluated, type LinePaintPropsPossiblyEvaluated} from './line_style_layer_properties.g.ts';
import {extend} from '../../util/util.ts';
import {EvaluationParameters} from '../evaluation_parameters.ts';
import {type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated, DataDrivenProperty, type PossiblyEvaluatedPropertyValue} from '../properties.ts';

import {isZoomExpression, Step, type Feature, type FeatureState, type StylePropertyExpression} from '@maplibre/maplibre-gl-style-spec';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Bucket, BucketParameters} from '../../data/bucket.ts';
import type {LineLayoutProps, LinePaintProps} from './line_style_layer_properties.g.ts';

export class LineFloorwidthProperty extends DataDrivenProperty<number> {
    useIntegerZoom: true;

    possiblyEvaluate(value: any, parameters: EvaluationParameters): PossiblyEvaluatedPropertyValue<number> {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            zoomHistory: parameters.zoomHistory,
            transition: parameters.transition
        });
        return super.possiblyEvaluate(value, parameters);
    }

    evaluate(value: any, globals: EvaluationParameters, feature: Feature, featureState: FeatureState): number {
        globals = extend({}, globals, {zoom: Math.floor(globals.zoom)});
        return super.evaluate(value, globals, feature, featureState);
    }
}

let lineFloorwidthProperty: LineFloorwidthProperty;

export const isLineStyleLayer = (layer: StyleLayer): layer is LineStyleLayer => layer.type === 'line';

export class LineStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LineLayoutProps>;
    layout: PossiblyEvaluated<LineLayoutProps, LineLayoutPropsPossiblyEvaluated>;

    gradientVersion: number;
    stepInterpolant: boolean;

    _transitionablePaint: Transitionable<LinePaintProps>;
    _transitioningPaint: Transitioning<LinePaintProps>;
    paint: PossiblyEvaluated<LinePaintProps, LinePaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
        this.gradientVersion = 0;
        if (!lineFloorwidthProperty) {
            lineFloorwidthProperty =
                new LineFloorwidthProperty(properties.paint.properties['line-width'].specification, 'line-floorwidth');
            lineFloorwidthProperty.useIntegerZoom = true;
        }
    }

    _handleSpecialPaintPropertyUpdate(name: string): void {
        if (name === 'line-gradient') {
            const expression = this.gradientExpression();
            if (isZoomExpression(expression)) {
                this.stepInterpolant = expression._styleExpression.expression instanceof Step;
            } else {
                this.stepInterpolant = false;
            }
            this.gradientVersion = (this.gradientVersion + 1) % Number.MAX_SAFE_INTEGER;
        }
    }

    gradientExpression(): StylePropertyExpression {
        return this._transitionablePaint._values['line-gradient'].value.expression;
    }

    recalculate(parameters: EvaluationParameters, availableImages: string[]): void {
        super.recalculate(parameters, availableImages);
        (this.paint._values as any)['line-floorwidth'] =
            lineFloorwidthProperty.possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }

    createBucket(parameters: BucketParameters<any>): LineBucket {
        return new LineBucket(parameters);
    }

    queryRadius(bucket: Bucket): number {
        const lineBucket: LineBucket = (bucket as any);
        const width = getMaxLineWidth(this, lineBucket);
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);
        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }

    queryIntersectsFeature({
        queryGeometry,
        feature,
        featureState,
        geometry,
        transform,
        pixelsToTileUnits}: QueryIntersectsFeatureParams
    ): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('line-translate'),
            this.paint.get('line-translate-anchor'),
            -transform.bearingInRadians, pixelsToTileUnits);

        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
        }

        const lineWidth = this.paint.get('line-width').evaluate(feature, featureState);
        const lineWidthStart = this.paint.get('line-width-start').evaluate(feature, featureState);
        const lineWidthEnd = this.paint.get('line-width-end').evaluate(feature, featureState);
        const lineGapWidth = this.paint.get('line-gap-width').evaluate(feature, featureState);
        const lineWidths = this.paint.get('line-widths').evaluate(feature, featureState);
        const lineWidthFactors = this.paint.get('line-width-factors').evaluate(feature, featureState);
        const hasVertexWidths = Array.isArray(lineWidths) && lineWidths.length > 0;
        const hasVertexFactors = Array.isArray(lineWidthFactors) && lineWidthFactors.length > 0;

        // No per-feature width variation: use the original constant-width path.
        if (!hasVertexFactors && !hasVertexWidths && lineWidthStart < 0 && lineWidthEnd < 0) {
            return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry,
                pixelsToTileUnits / 2 * getLineWidth(lineWidth, lineGapWidth));
        }

        // The width varies along each line (per-vertex `line-widths`, or linearly
        // between `line-width-start` and `line-width-end` with an unset side falling
        // back to `line-width`), exactly like the vertex shader renders it. The hit
        // test therefore uses a variable buffer radius: only the part of the line
        // that is actually drawn is clickable.
        const toHalfWidth = (w: number) => pixelsToTileUnits / 2 * getLineWidth(w, lineGapWidth);
        let localHalfWidth: (t: number, line?: Point[]) => number;
        if (hasVertexFactors) {
            const factors = lineWidthFactors.map(Number);
            localHalfWidth = (t, line) => toHalfWidth(lineWidth * (
                line?.length === factors.length ?
                    interpolateWidthProfile(factors, lineKnots(line), t) :
                    interpolateWidthProfile(factors, [], t)));
        } else if (hasVertexWidths) {
            const widths = lineWidths.map(Number);
            localHalfWidth = (t, line) => toHalfWidth(
                line?.length === widths.length ?
                    interpolateWidthProfile(widths, lineKnots(line), t) :
                    interpolateWidthProfile(widths, [], t));
        } else {
            localHalfWidth = (t) => toHalfWidth(taperWidthAt(t, lineWidth, lineWidthStart, lineWidthEnd));
        }
        return polygonIntersectsBufferedTaperedLine(translatedPolygon, geometry, localHalfWidth, pixelsToTileUnits);
    }

    isTileClipped(): boolean {
        return true;
    }
}

function getLineWidth(lineWidth: number, lineGapWidth: number): number {
    if (lineGapWidth > 0) {
        return lineGapWidth + 2 * lineWidth;
    } else {
        return lineWidth;
    }
}

/**
 * The width of a tapered line at the normalized position `t` (0 = line start,
 * 1 = line end), with the same fallback as the shader: an unset side
 * (default -1) uses the regular `line-width`.
 */
function taperWidthAt(t: number, lineWidth: number, widthStart: number, widthEnd: number): number {
    const start = widthStart >= 0 ? widthStart : lineWidth;
    const end = widthEnd >= 0 ? widthEnd : lineWidth;
    return start + (end - start) * t;
}

/**
 * The total length of a line, and the cumulative distance along it at each
 * vertex, used to compute the normalized taper position `t` for every point.
 */
function lineDistances(line: Point[]): {total: number; distances: number[]} {
    const distances: number[] = [0];
    let total = 0;
    for (let i = 1; i < line.length; i++) {
        total += line[i - 1].dist(line[i]);
        distances.push(total);
    }
    return {total, distances};
}

/**
 * Normalized cumulative distance (0..1) of every vertex of a line, matching the
 * per-vertex `line-widths` array so a width given at a vertex is reproduced
 * exactly there.
 */
function lineKnots(line: Point[]): number[] {
    const {total, distances} = lineDistances(line);
    return distances.map((d) => total > 0 ? d / total : 0);
}

/**
 * Whether a query point lies within the variable buffer radius of a line,
 * where the radius is `radiusAt(globalT, line)` with `globalT` the normalized
 * distance along the line (0..1). Matches how the tapered line is drawn.
 */
function pointIntersectsBufferedTaperedLine(p: Point, line: Point[], radiusAt: (t: number, line?: Point[]) => number): boolean {
    if (line.length === 1) {
        const r = radiusAt(0, line);
        return p.distSqr(line[0]) < r * r;
    }
    const {total, distances} = lineDistances(line);
    if (total === 0) {
        const r = radiusAt(0, line);
        return p.distSqr(line[0]) < r * r;
    }
    for (let i = 1; i < line.length; i++) {
        const v = line[i - 1];
        const w = line[i];
        const segmentLength = v.dist(w);
        // Normalized position of the projection of p onto this segment (0..1).
        let t = 0;
        const l2 = v.distSqr(w);
        if (l2 > 0) {
            const projected = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
            t = Math.max(0, Math.min(1, projected));
        }
        const r = radiusAt((distances[i - 1] + segmentLength * t) / total, line);
        if (distToSegmentSquared(p, v, w) < r * r) return true;
    }
    return false;
}

/**
 * Whether a query polygon intersects a line drawn with a variable buffer radius.
 * For a single-point query this is exact; for a polygon the line is densely
 * sampled (bounded) and each sample disc is tested against the polygon.
 */
function polygonIntersectsBufferedTaperedLine(polygon: Point[], multiLine: Point[][], radiusAt: (t: number, line?: Point[]) => number, minStep: number): boolean {
    if (polygon.length === 1) {
        for (const line of multiLine) {
            if (pointIntersectsBufferedTaperedLine(polygon[0], line, radiusAt)) return true;
        }
        return false;
    }

    for (const line of multiLine) {
        if (line.length === 1) {
            if (polygonIntersectsBufferedPoint(polygon, line[0], radiusAt(0, line))) return true;
            continue;
        }
        const {total, distances} = lineDistances(line);
        if (total === 0) {
            if (polygonIntersectsBufferedPoint(polygon, line[0], radiusAt(0, line))) return true;
            continue;
        }
        for (let i = 1; i < line.length; i++) {
            const v = line[i - 1];
            const w = line[i];
            const segmentLength = v.dist(w);
            // Sample often enough to follow both the line and the varying radius,
            // bounded so degenerate geometry cannot create a huge sample count.
            const maxR = Math.max(radiusAt(distances[i - 1] / total, line), radiusAt(distances[i] / total, line));
            const samples = Math.min(Math.max(1, Math.ceil(segmentLength / Math.max(minStep, maxR * 0.5))), 64);
            for (let j = 0; j <= samples; j++) {
                const t = j / samples;
                const point = new Point(v.x + (w.x - v.x) * t, v.y + (w.y - v.y) * t);
                const globalT = (distances[i - 1] + segmentLength * t) / total;
                if (polygonIntersectsBufferedPoint(polygon, point, radiusAt(globalT, line))) return true;
            }
        }
    }
    return false;
}

/**
 * The widest width a feature of this bucket can render at, including the tapered
 * start/end widths and the per-vertex `line-widths` (tracked by the bucket, since
 * data-driven arrays cannot be handled by the paint binder's max-value tracking).
 * Unset taper properties (default -1) are simply ignored.
 */
function getMaxLineWidth(layer: LineStyleLayer, bucket: LineBucket): number {
    const width = Math.max(
        getMaximumPaintValue('line-width', layer, bucket),
        getMaximumPaintValue('line-width-start', layer, bucket),
        getMaximumPaintValue('line-width-end', layer, bucket),
        bucket.maxVertexWidth || 0
    );
    return getLineWidth(width, getMaximumPaintValue('line-gap-width', layer, bucket));
}
