import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer.ts';
import {LineBucket} from '../../data/bucket/line_bucket.ts';
import {polygonIntersectsBufferedMultiLine} from '../../util/intersection_tests.ts';
import {getMaximumPaintValue, translateDistance, translate, offsetLine} from '../query_utils.ts';
import properties, {type LineLayoutPropsPossiblyEvaluated, type LinePaintPropsPossiblyEvaluated} from './line_style_layer_properties.g.ts';
import {EvaluationParameters} from '../evaluation_parameters.ts';
import {type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated, DataDrivenProperty, type PossiblyEvaluatedPropertyValue} from '../properties.ts';
import {isZoomExpression, Step, type Feature, type FeatureState, type StylePropertyExpression} from '@maplibre/maplibre-gl-style-spec';

import type {AllPaintProperties, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleSetterOptions} from '../style.ts';
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
        globals = new EvaluationParameters(Math.floor(globals.zoom), globals);
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

    /** What {@link offsetsLine} returned when `line-offset` was last set. */
    _offsetsLine: boolean;

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

    /**
     * Whether `line-offset` moves the line at any zoom or for any feature.
     *
     * A tile is drawn at zoom levels other than its own, so an offset that depends on zoom counts if it is non-zero
     * at any zoom. Between its stops it interpolates between their values, and past them it keeps the value of the
     * nearest one, so it is non-zero somewhere only if it is non-zero at one of its stops.
     */
    offsetsLine(): boolean {
        const offset = this._transitionablePaint._values['line-offset'].value.expression;
        if (offset.kind === 'constant') return offset.evaluate({zoom: 0}) !== 0;
        if (offset.kind === 'camera') return offset.zoomStops.some(zoom => offset.evaluate({zoom}) !== 0);
        return true;
    }

    /**
     * Also asks for the layer's tiles to be laid out again when `line-offset` starts to move a dashed line, because
     * a tile laid out without an offset leaves out the offset distances that space its dashes evenly.
     *
     * The global state an offset reads has already changed by the time a change to it gets here, so whether the line
     * was offset before is the value {@link _offsetsLine} kept from the last call.
     */
    setPaintProperty<K extends keyof AllPaintProperties>(name: K, value: AllPaintProperties[K], options: StyleSetterOptions = {}): boolean {
        const requiresRelayout = super.setPaintProperty(name, value, options);
        if (name !== 'line-offset') return requiresRelayout;

        const offsetLineBefore = this._offsetsLine;
        this._offsetsLine = this.offsetsLine();
        return requiresRelayout || (!offsetLineBefore && this._offsetsLine && this.getPaintProperty('line-dasharray') !== undefined);
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
        const width = getLineWidth(
            getMaximumPaintValue('line-width', this, lineBucket),
            getMaximumPaintValue('line-gap-width', this, lineBucket));
        const offset = getMaximumPaintValue('line-offset', this, lineBucket);
        return width / 2 + Math.abs(offset) + translateDistance(this.paint.get('line-translate'));
    }

    queryIntersectsFeature({
        queryGeometry,
        feature,
        featureState,
        geometry,
        projectedCamera,
        pixelsToTileUnits}: QueryIntersectsFeatureParams
    ): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('line-translate'),
            this.paint.get('line-translate-anchor'),
            -projectedCamera.bearingInRadians, pixelsToTileUnits);
        const halfWidth = pixelsToTileUnits / 2 * getLineWidth(
            this.paint.get('line-width').evaluate(feature, featureState),
            this.paint.get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
        }

        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
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
