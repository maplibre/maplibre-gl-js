import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {getIntersectionDistance, Point3D, type FillExtrusionStyleLayer} from './fill_extrusion_style_layer.ts';
import {createStyleLayer} from '../create_style_layer.ts';
import {createVerticalPerspectiveTransform} from '../../geo/projection/vertical_perspective_transform.ts';
import {LngLat} from '../../geo/lng_lat.ts';
import {CanonicalTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import {EXTENT} from '../../data/extent.ts';

import type {EvaluationParameters} from '../evaluation_parameters.ts';
import type {VectorTileFeature} from '@mapbox/vector-tile';

describe('getIntersectionDistance', () => {
    const queryPoint = [new Point3D(100, 100)];
    const z = 3;
    const a = new Point3D(100, -90);
    const b = new Point3D(110, 110);
    const c = new Point3D(-110, 110);
    a.z = z;
    b.z = z;
    c.z = z;

    test('one point', () => {
        const projectedFace = [a, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(Infinity);
    });

    test('two points', () => {
        const projectedFace = [a, b, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(Infinity);
    });

    test('two points coincident', () => {
        const projectedFace = [a, a, a, b, b, b, b, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(Infinity);
    });

    test('three points', () => {
        const projectedFace = [a, b, c, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(z);
    });

    test('three points coincident points', () => {
        const projectedFace = [a, a, b, b, b, c, c, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(z);
    });
});

describe('FillExtrusionStyleLayer.queryIntersectsFeature on the globe', () => {
    test('does not hit an extrusion on the far side of the globe', () => {
        const layer = createStyleLayer({id: 'extrusion', type: 'fill-extrusion', source: 'source', paint: {'fill-extrusion-height': 1000}}, {}) as FillExtrusionStyleLayer;
        layer.recalculate({zoom: 2, zoomHistory: {}} as EvaluationParameters, []);

        const transform = createVerticalPerspectiveTransform();
        transform.resize(512, 512);
        transform.setZoom(2);
        transform.setCenter(new LngLat(0, 0));

        // In the world tile, the camera looks at the center, and the point opposite the camera is the middle of the right edge.
        const center = EXTENT / 2;
        const size = EXTENT / 64;
        const farSide = [[
            new Point(EXTENT - size, center - size),
            new Point(EXTENT + size, center - size),
            new Point(EXTENT + size, center + size),
            new Point(EXTENT - size, center + size),
            new Point(EXTENT - size, center - size)
        ]];

        expect(layer.queryIntersectsFeature({
            queryGeometry: [new Point(center, center)],
            feature: {} as VectorTileFeature,
            featureState: {},
            geometry: farSide,
            zoom: 2,
            transform,
            pixelsToTileUnits: 1,
            pixelPosMatrix: undefined,
            unwrappedTileID: new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0)),
            getElevation: undefined
        })).toBe(false);
    });
});
