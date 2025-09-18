import type Point from '@mapbox/point-geometry';
import {StyleLayer, type QueryIntersectsFeatureParams} from '../style_layer';

import {CircleBucket} from '../../data/bucket/circle_bucket';
import {circleIntersection, getMaximumPaintValue, projectQueryGeometry, translateDistance, translate} from '../query_utils';
import properties, {type CircleLayoutPropsPossiblyEvaluated, type CirclePaintPropsPossiblyEvaluated} from './circle_style_layer_properties.g';
import {type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated} from '../properties';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {CircleLayoutProps, CirclePaintProps} from './circle_style_layer_properties.g';

export const isCircleStyleLayer = (layer: StyleLayer): layer is CircleStyleLayer => layer.type === 'circle';

/**
 * A style layer that defines a circle
 */
export class CircleStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<CircleLayoutProps>;
    layout: PossiblyEvaluated<CircleLayoutProps, CircleLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<CirclePaintProps>;
    _transitioningPaint: Transitioning<CirclePaintProps>;
    paint: PossiblyEvaluated<CirclePaintProps, CirclePaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
    }

    createBucket(parameters: BucketParameters<any>) {
        return new CircleBucket(parameters);
    }

    queryRadius(bucket: Bucket): number {
        const circleBucket: CircleBucket<CircleStyleLayer> = (bucket as any);
        return getMaximumPaintValue('circle-radius', this, circleBucket) +
            getMaximumPaintValue('circle-stroke-width', this, circleBucket) +
            translateDistance(this.paint.get('circle-translate'));
    }

    queryIntersectsFeature({
        queryGeometry,
        feature,
        featureState,
        geometry,
        transform,
        pixelsToTileUnits,
        unwrappedTileID,
        getElevation}: QueryIntersectsFeatureParams
    ): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('circle-translate'),
            this.paint.get('circle-translate-anchor'),
            -transform.bearingInRadians, pixelsToTileUnits);
        const radius = this.paint.get('circle-radius').evaluate(feature, featureState);
        const stroke = this.paint.get('circle-stroke-width').evaluate(feature, featureState);
        const size  = radius + stroke;

        // For pitch-alignment: map, compare feature geometry to query geometry in the plane of the tile
        // Otherwise, compare geometry in the plane of the viewport
        // A circle with fixed scaling relative to the viewport gets larger in tile space as it moves into the distance
        // A circle with fixed scaling relative to the map gets smaller in viewport space as it moves into the distance

        const pitchScale = this.paint.get('circle-pitch-scale');
        const pitchAlignment = this.paint.get('circle-pitch-alignment');

        let transformedPolygon: Array<Point>;
        let transformedSize: number;
        if (pitchAlignment === 'map') {
            transformedPolygon = translatedPolygon;
            transformedSize = size * pixelsToTileUnits;
        } else {
            transformedPolygon = projectQueryGeometry(translatedPolygon, transform, unwrappedTileID, getElevation);
            transformedSize = size;
        }

        return circleIntersection({
            queryGeometry: transformedPolygon,
            size: transformedSize,
            transform,
            unwrappedTileID,
            getElevation,
            pitchAlignment,
            pitchScale
        }, geometry);
    }
}

