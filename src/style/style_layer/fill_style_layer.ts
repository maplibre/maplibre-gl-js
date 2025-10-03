import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer';
import {FillBucket} from '../../data/bucket/fill_bucket';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests';
import {translateDistance, translate} from '../query_utils';
import properties, {type FillLayoutPropsPossiblyEvaluated, type FillPaintPropsPossiblyEvaluated} from './fill_style_layer_properties.g';

import type {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {BucketParameters} from '../../data/bucket';
import type {FillLayoutProps, FillPaintProps} from './fill_style_layer_properties.g';
import type {EvaluationParameters} from '../evaluation_parameters';

export const isFillStyleLayer = (layer: StyleLayer): layer is FillStyleLayer => layer.type === 'fill';

export class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<FillLayoutProps>;
    layout: PossiblyEvaluated<FillLayoutProps, FillLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<FillPaintProps>;
    _transitioningPaint: Transitioning<FillPaintProps>;
    paint: PossiblyEvaluated<FillPaintProps, FillPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
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

    queryIntersectsFeature({
        queryGeometry,
        geometry,
        transform,
        pixelsToTileUnits}: QueryIntersectsFeatureParams
    ): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-translate'),
            this.paint.get('fill-translate-anchor'),
            -transform.bearingInRadians, pixelsToTileUnits);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    isTileClipped() {
        return true;
    }
}
