import {loadGeometry} from './load_geometry';
import type Point from '@mapbox/point-geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {Feature} from '@maplibre/maplibre-gl-style-spec';

type EvaluationFeature = Feature & { geometry: Array<Array<Point>> };
/**
 * Construct a new feature based on a VectorTileFeature for expression evaluation, the geometry of which
 * will be loaded based on necessity.
 * @param feature - the feature to evaluate
 * @param needGeometry - if set to true this will load the geometry
 */
export function toEvaluationFeature(feature: VectorTileFeature, needGeometry: boolean): EvaluationFeature {
    return {type: feature.type,
        id: feature.id,
        properties: feature.properties,
        geometry: needGeometry ? loadGeometry(feature) : []};
}
