import {beforeAll, describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {FillExtrusionBucket} from './fill_extrusion_bucket.ts';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {ZoomHistory} from '../../style/zoom_history.ts';
import type {BucketFeature, BucketParameters} from '../bucket.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

function createFillExtrusionBucket({id, layout, paint, globalState, availableImages}: CreateBucketParameters): FillExtrusionBucket {
    const layer = new FillExtrusionStyleLayer({
        id,
        type: 'fill-extrusion',
        layout,
        paint
    } as LayerSpecification, globalState);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters,
        availableImages);

    return new FillExtrusionBucket({layers: [layer]} as BucketParameters<FillExtrusionStyleLayer>);
}

function regularPolygon(sides: number): Point[] {
    const ring: Point[] = [];
    for (let i = 0; i <= sides; i++) {
        const angle = 2 * Math.PI * i / sides;
        ring.push(new Point(4096 + Math.round(1000 * Math.cos(angle)), 4096 + Math.round(1000 * Math.sin(angle))));
    }
    return ring;
}

function wallNormals(ring: Point[]): Array<{start: string; end: string}> {
    const bucket = createFillExtrusionBucket({id: 'test', paint: {'fill-extrusion-height': 10}});
    const feature = {id: 0, sourceLayerIndex: 0, index: 0, geometry: [ring], properties: {}, type: 3, patterns: {}} as BucketFeature;
    bucket.addFeature(feature, feature.geometry, 0, {x: 0, y: 0, z: 14} as any, {}, createPopulateOptions([]).subdivisionGranularity);

    const normalAt = (vertex: number) => {
        const v = bucket.layoutVertexArray.int16.subarray(vertex * 6 + 2, vertex * 6 + 4);
        return `${v[0] >> 1},${v[1]}`;
    };
    const walls = [];
    for (let wall = 0; wall < ring.length - 1; wall++) {
        walls.push({end: normalAt(wall * 4), start: normalAt(wall * 4 + 2)});
    }
    return walls;
}

describe('FillExtrusionBucket', () => {
    let sourceLayer: VectorTileLayerLike;
    beforeAll(() => {
        // Load fill extrusion features from fixture tile.
        sourceLayer = loadVectorTile().layers.water;
    });

    test('FillExtrusionBucket fill-pattern with global-state', () => {
        const availableImages = [];
        const bucket = createFillExtrusionBucket({id: 'test',
            paint: {'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]},
            globalState: {pattern: 'test-pattern'},
            availableImages
        });

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions(availableImages), undefined);

        expect(bucket.features.length).toBeGreaterThan(0);
        expect(bucket.features[0].patterns).toEqual({
            test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
        });
    });

    test('FillExtrusionBucket populates vertices with fill-extrusion-rounded-corner-distance layout property', () => {
        const bucketWithoutRounding = createFillExtrusionBucket({
            id: 'test-no-rounding',
            layout: {'fill-extrusion-rounded-corner-distance': 0},
            paint: {'fill-extrusion-height': 10}
        });
        const bucketWithRounding = createFillExtrusionBucket({
            id: 'test-rounding',
            layout: {'fill-extrusion-rounded-corner-distance': 5},
            paint: {'fill-extrusion-height': 10}
        });

        const features = getFeaturesFromLayer(sourceLayer);
        const populateOptions = createPopulateOptions([]);

        bucketWithoutRounding.populate(features, populateOptions, {x: 0, y: 0, z: 14} as any);
        bucketWithRounding.populate(features, populateOptions, {x: 0, y: 0, z: 14} as any);

        expect(bucketWithoutRounding.layoutVertexArray.length).toBeGreaterThan(0);
        expect(bucketWithRounding.layoutVertexArray.length).toBeGreaterThan(bucketWithoutRounding.layoutVertexArray.length);
    });

    test('walls meeting at a shallow angle share the vertex normal', () => {
        const walls = wallNormals(regularPolygon(12));

        for (let i = 0; i < walls.length; i++) {
            expect(walls[i].end).toBe(walls[(i + 1) % walls.length].start);
            expect(walls[i].end).not.toBe(walls[i].start);
        }
    });

    test('walls meeting at a right angle keep their own normal', () => {
        const walls = wallNormals(regularPolygon(4));

        for (let i = 0; i < walls.length; i++) {
            expect(walls[i].end).toBe(walls[i].start);
            expect(walls[i].end).not.toBe(walls[(i + 1) % walls.length].start);
        }
    });
});
