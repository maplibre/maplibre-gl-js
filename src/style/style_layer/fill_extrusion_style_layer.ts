import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer.ts';
import {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket.ts';
import {polygonIntersectsPolygon, polygonIntersectsMultiPolygon} from '../../util/intersection_tests.ts';
import {translateDistance, translate} from '../query_utils.ts';
import properties, {type FillExtrusionLayoutPropsPossiblyEvaluated, type FillExtrusionPaintPropsPossiblyEvaluated} from './fill_extrusion_style_layer_properties.g.ts';
import Point from '@mapbox/point-geometry';
import * as cameraMath from '../../geo/projection/camera_math.ts';

import type {Layout, Transitionable, Transitioning, PossiblyEvaluated} from '../properties.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {BucketParameters} from '../../data/bucket.ts';
import type {FillExtrusionLayoutProps, FillExtrusionPaintProps} from './fill_extrusion_style_layer_properties.g.ts';
import type {ProjectedCamera} from '../../geo/projected_camera.ts';
import type {UnwrappedTileID} from '../../tile/tile_id.ts';

export class Point3D extends Point {
    z: number;
}

export const isFillExtrusionStyleLayer = (layer: StyleLayer): layer is FillExtrusionStyleLayer => layer.type === 'fill-extrusion';

export class FillExtrusionStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<FillExtrusionLayoutProps>;
    layout: PossiblyEvaluated<FillExtrusionLayoutProps, FillExtrusionLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<FillExtrusionPaintProps>;
    _transitioningPaint: Transitioning<FillExtrusionPaintProps>;
    paint: PossiblyEvaluated<FillExtrusionPaintProps, FillExtrusionPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
    }

    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>): FillExtrusionBucket {
        return new FillExtrusionBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    is3D(): boolean {
        return true;
    }

    queryIntersectsFeature({
        queryGeometry,
        feature,
        featureState,
        geometry,
        projectedCamera,
        pixelsToTileUnits,
        unwrappedTileID}: QueryIntersectsFeatureParams
    ): boolean | number {

        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-extrusion-translate'),
            this.paint.get('fill-extrusion-translate-anchor'),
            -projectedCamera.bearingInRadians, pixelsToTileUnits);

        const height = this.paint.get('fill-extrusion-height').evaluate(feature, featureState);
        const base = this.paint.get('fill-extrusion-base').evaluate(feature, featureState);

        const projectedQueryGeometry = translatedPolygon.map(p => projectPoint(p, 0, projectedCamera, unwrappedTileID));
        const projectedBase = geometry.map(ring => ring.map(p => projectPoint(p, base, projectedCamera, unwrappedTileID)));
        const projectedTop = geometry.map(ring => ring.map(p => projectPoint(p, height, projectedCamera, unwrappedTileID)));
        return checkIntersection(projectedBase, projectedTop, projectedQueryGeometry);
    }
}

/**
 * Projects a point in tile coordinates at `elevation` to clip space, with the distance from the camera as its `z`.
 */
function projectPoint(point: Point, elevation: number, camera: ProjectedCamera, tileID: UnwrappedTileID): Point3D {
    const {point: projected, signedDistanceFromCamera} = cameraMath.projectTileCoordinates(camera, point.x, point.y, tileID, elevation);
    const result = projected as Point3D;
    result.z = signedDistanceFromCamera;
    return result;
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

export function getIntersectionDistance(projectedQueryGeometry: Point3D[], projectedFace: Point3D[]): number {

    if (projectedQueryGeometry.length === 1) {
        // For point queries calculate the z at which the point intersects the face
        // using barycentric coordinates.

        // Find the barycentric coordinates of the projected point within the first
        // triangle of the face, using only the xy plane. It doesn't matter if the
        // point is outside the first triangle because all the triangles in the face
        // are in the same plane.
        //
        // Check whether points are coincident and use other points if they are.
        let i = 0;
        const a = projectedFace[i++];
        let b;
        while (!b || a.equals(b)) {
            b = projectedFace[i++];
            if (!b) return Infinity;
        }

        // Loop until point `c` is not colinear with points `a` and `b`.
        for (; i < projectedFace.length; i++) {
            const c = projectedFace[i];

            const p = projectedQueryGeometry[0];

            const ab = b.sub(a);
            const ac = c.sub(a);
            const ap = p.sub(a);

            const dotABAB = dot(ab, ab);
            const dotABAC = dot(ab, ac);
            const dotACAC = dot(ac, ac);
            const dotAPAB = dot(ap, ab);
            const dotAPAC = dot(ap, ac);
            const denom = dotABAB * dotACAC - dotABAC * dotABAC;

            const v = (dotACAC * dotAPAB - dotABAC * dotAPAC) / denom;
            const w = (dotABAB * dotAPAC - dotABAC * dotAPAB) / denom;
            const u = 1 - v - w;

            // Use the barycentric weighting along with the original triangle z coordinates to get the point of intersection.
            const distance = a.z * u + b.z * v + c.z * w;

            if (isFinite(distance)) return distance;
        }

        return Infinity;

    } else {
        // The counts as closest is less clear when the query is a box. This
        // returns the distance to the nearest point on the face, whether it is
        // within the query or not. It could be more correct to return the
        // distance to the closest point within the query box but this would be
        // more complicated and expensive to calculate with little benefit.
        let closestDistance = Infinity;
        for (const p of projectedFace) {
            closestDistance = Math.min(closestDistance, p.z);
        }
        return closestDistance;
    }
}

function checkIntersection(projectedBase: Point3D[][], projectedTop: Point3D[][], projectedQueryGeometry: Point3D[]) {
    let closestDistance = Infinity;

    if (polygonIntersectsMultiPolygon(projectedQueryGeometry, projectedTop)) {
        closestDistance = getIntersectionDistance(projectedQueryGeometry, projectedTop[0]);
    }

    for (let r = 0; r < projectedTop.length; r++) {
        const ringTop = projectedTop[r];
        const ringBase = projectedBase[r];
        for (let p = 0; p < ringTop.length - 1; p++) {
            const topA = ringTop[p];
            const topB = ringTop[p + 1];
            const baseA = ringBase[p];
            const baseB = ringBase[p + 1];
            const face = [topA, topB, baseB, baseA, topA];
            if (polygonIntersectsPolygon(projectedQueryGeometry, face)) {
                closestDistance = Math.min(closestDistance, getIntersectionDistance(projectedQueryGeometry, face));
            }
        }
    }

    return closestDistance === Infinity ? false : closestDistance;
}
