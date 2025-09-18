import Point from '@mapbox/point-geometry';

import type {PossiblyEvaluatedPropertyValue} from './properties';
import type {StyleLayer} from '../style/style_layer';
import type {CircleBucket} from '../data/bucket/circle_bucket';
import type {LineBucket} from '../data/bucket/line_bucket';
import {polygonIntersectsBufferedPoint} from '../util/intersection_tests';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {UnwrappedTileID} from '../source/tile_id';

export function getMaximumPaintValue(
    property: string,
    layer: StyleLayer,
    bucket: CircleBucket<any> | LineBucket
): number {
    const value = ((layer.paint as any).get(property) as PossiblyEvaluatedPropertyValue<any>).value;
    if (value.kind === 'constant') {
        return value.value;
    } else {
        return bucket.programConfigurations.get(layer.id).getMaxValue(property);
    }
}

export function translateDistance(translate: [number, number]) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

/**
 * @internal
 * Translates a geometry by a certain pixels in tile coordinates
 * @param queryGeometry - The geometry to translate in tile coordinates
 * @param translate - The translation in pixels
 * @param translateAnchor - The anchor of the translation
 * @param bearing - The bearing of the map
 * @param pixelsToTileUnits - The scale factor from pixels to tile units
 * @returns the translated geometry in tile coordinates
 */
export function translate(queryGeometry: Array<Point>,
    translate: [number, number],
    translateAnchor: 'viewport' | 'map',
    bearing: number,
    pixelsToTileUnits: number): Point[] {
    if (!translate[0] && !translate[1]) {
        return queryGeometry;
    }
    const pt = Point.convert(translate)._mult(pixelsToTileUnits);

    if (translateAnchor === 'viewport') {
        pt._rotate(-bearing);
    }

    const translated: Point[] = [];
    for (let i = 0; i < queryGeometry.length; i++) {
        const point = queryGeometry[i];
        translated.push(point.sub(pt));
    }
    return translated;
}

export function offsetLine(rings: Array<Array<Point>>, offset: number) {
    const newRings: Array<Array<Point>> = [];
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        const ring = rings[ringIndex];
        const newRing: Array<Point> = [];
        for (let index = 0; index < ring.length; index++) {
            const a = ring[index - 1];
            const b = ring[index];
            const c = ring[index + 1];
            const aToB = index === 0 ? new Point(0, 0) : b.sub(a)._unit()._perp();
            const bToC = index === ring.length - 1 ? new Point(0, 0) : c.sub(b)._unit()._perp();
            const extrude = aToB._add(bToC)._unit();

            const cosHalfAngle = extrude.x * bToC.x + extrude.y * bToC.y;
            if (cosHalfAngle !== 0) {
                extrude._mult(1 / cosHalfAngle);
            }

            newRing.push(extrude._mult(offset)._add(b));
        }
        newRings.push(newRing);
    }
    return newRings;
}

type CircleIntersectionTestParams = {
    queryGeometry: Array<Point>;
    size: number;
    transform: IReadonlyTransform;
    unwrappedTileID: UnwrappedTileID;
    getElevation: undefined | ((x: number, y: number) => number);
    pitchAlignment?: 'map' | 'viewport';
    pitchScale?: 'map' | 'viewport';
};

function intersectionTestMapMap({queryGeometry, size}: CircleIntersectionTestParams, point: Point): boolean {
    return polygonIntersectsBufferedPoint(queryGeometry, point, size);
}

function intersectionTestMapViewport({queryGeometry, size, transform, unwrappedTileID, getElevation}: CircleIntersectionTestParams, point: Point): boolean {
    const w = transform.projectTileCoordinates(point.x, point.y, unwrappedTileID, getElevation).signedDistanceFromCamera;
    const adjustedSize = size * (w / transform.cameraToCenterDistance);
    return polygonIntersectsBufferedPoint(queryGeometry, point, adjustedSize);
}

function intersectionTestViewportMap({queryGeometry, size, transform, unwrappedTileID, getElevation}: CircleIntersectionTestParams, point: Point): boolean {
    const w = transform.projectTileCoordinates(point.x, point.y, unwrappedTileID, getElevation).signedDistanceFromCamera;
    const adjustedSize = size * (transform.cameraToCenterDistance / w);
    return polygonIntersectsBufferedPoint(queryGeometry, projectPoint(point, transform, unwrappedTileID, getElevation), adjustedSize);
}

function intersectionTestViewportViewport({queryGeometry, size, transform, unwrappedTileID, getElevation}: CircleIntersectionTestParams, point: Point): boolean {
    return polygonIntersectsBufferedPoint(queryGeometry, projectPoint(point, transform, unwrappedTileID, getElevation), size);
}

export function circleIntersection({
    queryGeometry,
    size,
    transform,
    unwrappedTileID,
    getElevation,
    pitchAlignment = 'map',
    pitchScale = 'map'
}: CircleIntersectionTestParams, geometry): boolean {
    const intersectionTest = pitchAlignment === 'map'
        ? (pitchScale === 'map' ? intersectionTestMapMap : intersectionTestMapViewport)
        : (pitchScale === 'map' ? intersectionTestViewportMap : intersectionTestViewportViewport);

    const param = {queryGeometry, size, transform, unwrappedTileID, getElevation} as CircleIntersectionTestParams;
    for (const ring of geometry) {
        for (const point of ring) {
            if (intersectionTest(param, point)) {
                return true;
            }
        }
    }
    return false;
}

function projectPoint(tilePoint: Point, transform: IReadonlyTransform, unwrappedTileID: UnwrappedTileID, getElevation: undefined | ((x: number, y: number) => number)): Point {
    // Convert `tilePoint` from tile coordinates to clip coordinates.
    const clipPoint = transform.projectTileCoordinates(tilePoint.x, tilePoint.y, unwrappedTileID, getElevation).point;
    // Convert `clipPoint` from clip coordinates into pixel/screen coordinates.
    const pixelPoint = new Point(
        (clipPoint.x * 0.5 + 0.5) * transform.width,
        (-clipPoint.y * 0.5 + 0.5) * transform.height
    );
    return pixelPoint;
}

export function projectQueryGeometry(queryGeometry: Array<Point>, transform: IReadonlyTransform, unwrappedTileID: UnwrappedTileID, getElevation: undefined | ((x: number, y: number) => number)) {
    return queryGeometry.map((p) => {
        return projectPoint(p, transform, unwrappedTileID, getElevation);
    });
}
