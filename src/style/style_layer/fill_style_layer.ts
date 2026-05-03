import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer.ts';
import {FillBucket} from '../../data/bucket/fill_bucket.ts';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests.ts';
import {translateDistance, translate} from '../query_utils.ts';
import properties, {type FillLayoutPropsPossiblyEvaluated, type FillPaintPropsPossiblyEvaluated} from './fill_style_layer_properties.g.ts';

import type {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {BucketParameters} from '../../data/bucket.ts';
import type {FillLayoutProps, FillPaintProps} from './fill_style_layer_properties.g.ts';
import type {EvaluationParameters} from '../evaluation_parameters.ts';
import type {Framebuffer} from '../../webgl/framebuffer.ts';

export const isFillStyleLayer = (layer: StyleLayer): layer is FillStyleLayer => layer.type === 'fill';

export class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<FillLayoutProps>;
    layout: PossiblyEvaluated<FillLayoutProps, FillLayoutPropsPossiblyEvaluated>;

    fillFbo: Framebuffer | null;

    _transitionablePaint: Transitionable<FillPaintProps>;
    _transitioningPaint: Transitioning<FillPaintProps>;
    paint: PossiblyEvaluated<FillPaintProps, FillPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
        this.fillFbo = null;
    }

    recalculate(parameters: EvaluationParameters, availableImages: string[]) {
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

    hasOffscreenPass() {
        const layerOpacity = this.paint.get('layer-opacity' as any) as number;
        return layerOpacity > 0 && layerOpacity < 1 && !this.isHidden();
    }

    onRemove = () => {
        this.resize();
    };

    resize() {
        this.fillFbo?.destroy();
        this.fillFbo = null;
    }
}
