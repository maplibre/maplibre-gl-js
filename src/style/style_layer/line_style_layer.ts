import Point from '@mapbox/point-geometry';

import StyleLayer from '../style_layer';
import LineBucket from '../../data/bucket/line_bucket';
import {polygonIntersectsBufferedMultiLine} from '../../util/intersection_tests';
import {getMaximumPaintValue, translateDistance, translate, offsetLine} from '../query_utils';
import properties, {LineLayoutPropsPossiblyEvaluated, LinePaintPropsPossiblyEvaluated} from './line_style_layer_properties.g';
import {extend} from '../../util/util';
import EvaluationParameters from '../evaluation_parameters';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated, DataDrivenProperty} from '../properties';

import Step from '../../style-spec/expression/definitions/step';
import type {FeatureState, ZoomConstantExpression} from '../../style-spec/expression';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {LineLayoutProps, LinePaintProps} from './line_style_layer_properties.g';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types.g';
import type {VectorTileFeature} from '@mapbox/vector-tile';

class LineFloorwidthProperty extends DataDrivenProperty<number> {
    useIntegerZoom: true;

    possiblyEvaluate(value, parameters) {
        parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
            now: parameters.now,
            fadeDuration: parameters.fadeDuration,
            zoomHistory: parameters.zoomHistory,
            transition: parameters.transition
        });
        return super.possiblyEvaluate(value, parameters);
    }

    evaluate(value, globals, feature, featureState) {
        globals = extend({}, globals, {zoom: Math.floor(globals.zoom)});
        return super.evaluate(value, globals, feature, featureState);
    }
}

const lineFloorwidthProperty = new LineFloorwidthProperty(properties.paint.properties['line-width'].specification);
lineFloorwidthProperty.useIntegerZoom = true;

class LineStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LineLayoutProps>;
    layout: PossiblyEvaluated<LineLayoutProps, LineLayoutPropsPossiblyEvaluated>;

    gradientVersion: number;
    stepInterpolant: boolean;

    _transitionablePaint: Transitionable<LinePaintProps>;
    _transitioningPaint: Transitioning<LinePaintProps>;
    paint: PossiblyEvaluated<LinePaintProps, LinePaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this.gradientVersion = 0;
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'line-gradient') {
            const expression: ZoomConstantExpression<'source'> = (this._transitionablePaint._values['line-gradient'].value.expression as any);
            this.stepInterpolant = expression._styleExpression.expression instanceof Step;
            this.gradientVersion = (this.gradientVersion + 1) % Number.MAX_SAFE_INTEGER;
        }
    }

    gradientExpression() {
        return this._transitionablePaint._values['line-gradient'].value.expression;
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        (this.paint._values as any)['line-floorwidth'] =
            lineFloorwidthProperty.possiblyEvaluate(this._transitioningPaint._values['line-width'].value, parameters);
    }

    createBucket(parameters: BucketParameters<any>) {
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

    queryIntersectsFeature(
        queryGeometry: Array<Point>,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
        pixelsToTileUnits: number
    ): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('line-translate'),
            this.paint.get('line-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        const halfWidth = pixelsToTileUnits / 2 * getLineWidth(
            this.paint.get('line-width').evaluate(feature, featureState),
            this.paint.get('line-gap-width').evaluate(feature, featureState));
        const lineOffset = this.paint.get('line-offset').evaluate(feature, featureState);
        if (lineOffset) {
            geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
        }

        return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
    }

    isTileClipped() {
        return true;
    }
}

export default LineStyleLayer;

function getLineWidth(lineWidth, lineGapWidth) {
    if (lineGapWidth > 0) {
        return lineGapWidth + 2 * lineWidth;
    } else {
        return lineWidth;
    }
}
