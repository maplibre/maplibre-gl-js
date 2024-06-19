import {StyleLayer} from '../style_layer.ts';

import {FillBucket} from '../../data/bucket/fill_bucket.ts';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests.ts';
import {translateDistance, translate} from '../query_utils.ts';
import properties, {FillLayoutPropsPossiblyEvaluated, FillPaintPropsPossiblyEvaluated} from './fill_style_layer_properties.g.ts';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties.ts';

import type {FeatureState, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {BucketParameters} from '../../data/bucket.ts';
import type Point from '@mapbox/point-geometry';
import type {FillLayoutProps, FillPaintProps} from './fill_style_layer_properties.g.ts';
import type {EvaluationParameters} from '../evaluation_parameters.ts';
import type {Transform} from '../../geo/transform.ts';
import type {VectorTileFeature} from '@mapbox/vector-tile';

export class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<FillLayoutProps>;
    layout: PossiblyEvaluated<FillLayoutProps, FillLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<FillPaintProps>;
    _transitioningPaint: Transitioning<FillPaintProps>;
    paint: PossiblyEvaluated<FillPaintProps, FillPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        const outlineColor = this.paint._values['fill-outline-color'];
        if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
            this.paint._values['fill-outline-color'] = this.paint._values['fill-color'];
        }
    }

    createBucket(parameters: BucketParameters<any>) {
        return new FillBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-translate'));
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
            this.paint.get('fill-translate'),
            this.paint.get('fill-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    isTileClipped() {
        return true;
    }
}
