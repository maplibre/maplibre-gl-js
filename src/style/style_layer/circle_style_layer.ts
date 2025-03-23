import {StyleLayer, type QueryIntersectsFeatureParams} from '../style_layer';

import Point from '@mapbox/point-geometry';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Bucket, BucketParameters} from '../../data/bucket';
import {CircleBucket} from '../../data/bucket/circle_bucket';
import type {IReadonlyTransform} from '../../geo/transform_interface';
import type {UnwrappedTileID} from '../../source/tile_id';
import {polygonIntersectsBufferedPoint} from '../../util/intersection_tests';
import {type Layout, type PossiblyEvaluated, type Transitionable, type Transitioning} from '../properties';
import {getMaximumPaintValue, translate, translateDistance} from '../query_utils';
import type {CircleLayoutProps, CirclePaintProps} from './circle_style_layer_properties.g';
import properties, {type CircleLayoutPropsPossiblyEvaluated, type CirclePaintPropsPossiblyEvaluated} from './circle_style_layer_properties.g';

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

    constructor(layer: LayerSpecification) {
        super(layer, properties);
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
        unwrappedTileID}: QueryIntersectsFeatureParams
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
        const alignWithMap = this.paint.get('circle-pitch-alignment') === 'map';
        const transformedPolygon = alignWithMap ? translatedPolygon : projectQueryGeometry(translatedPolygon, transform, unwrappedTileID);
        const transformedSize = alignWithMap ? size * pixelsToTileUnits : size;

        for (const ring of geometry) {
            for (const point of ring) {

                const transformedPoint = alignWithMap ? point : projectPoint(point, transform, unwrappedTileID);

                let adjustedSize = transformedSize;
                const projected = transform.projectTileCoordinates(point.x, point.y, unwrappedTileID, () => 0);
                const distance = projected.signedDistanceFromCamera;

                if (this.paint.get('circle-pitch-scale') === 'viewport' && this.paint.get('circle-pitch-alignment') === 'map') {
                    adjustedSize *= distance / transform.cameraToCenterDistance;
                } else if (this.paint.get('circle-pitch-scale') === 'map' && this.paint.get('circle-pitch-alignment') === 'viewport') {
                    adjustedSize *= transform.cameraToCenterDistance / distance;
                }

                if (polygonIntersectsBufferedPoint(transformedPolygon, transformedPoint, adjustedSize)) return true;
            }
        }

        return false;
    }
}

function projectPoint(point: Point, transform: IReadonlyTransform, unwrappedTileID: UnwrappedTileID): Point {
    const projection = transform.projectTileCoordinates(point.x, point.y, unwrappedTileID, () => 0);
    return new Point(
        (projection.point.x * 0.5 + 0.5) * transform.width,
        (-projection.point.y * 0.5 + 0.5) * transform.height
    );
}

function projectQueryGeometry(queryGeometry: Array<Point>, transform: IReadonlyTransform, unwrappedTileID: UnwrappedTileID) {
    return queryGeometry.map((p) => {
        return projectPoint(p, transform, unwrappedTileID);
    });
}
