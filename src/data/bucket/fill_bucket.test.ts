import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Point from '../../util/point';
import FillBucket from './fill_bucket';
import FillStyleLayer from '../../style/style_layer/fill_style_layer';
import {BucketFeature} from '../bucket';
import EvaluationParameters from '../../style/evaluation_parameters';
import type {CollisionBoxArray} from '../array_types';

jest.mock('../../data/segment');

const maplibreRootDirname = 'import_meta_url'; // replaced in babel.config.cjs

// Load a fill feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(maplibreRootDirname, '/test/fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.water.feature(0);

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

function createPolygon(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(
            new Point(
                (2048 + 256 * Math.cos(i / numPoints * 2 * Math.PI)),
                (2048 + 256 * Math.sin(i / numPoints * 2 * Math.PI))
            ));
    }
    return points;
}

describe('FillBucket', () => {
    test('addFeature', () => {
        const layer = new FillStyleLayer({
            id: 'test',
            type: 'fill',
            source: '', layout: {}
        });
        const evaluationParameters : EvaluationParameters = {zoom: 0, zoomHistory: {}} as EvaluationParameters;
        const availableImages: Array<string> = [''];
        layer.recalculate(evaluationParameters, availableImages);

        const bucket = new FillBucket({layers: [layer], index: 0, zoom : 0, pixelRatio:0, overscaling: 0, collisionBoxArray: [] as unknown as CollisionBoxArray,  sourceLayerIndex: 0, sourceID: ''});
        expect(bucket.layoutVertexArray.length).toBe(0);

        bucket.addFeature({} as BucketFeature, [[
            new Point(0, 0),
            new Point(10, 10)
        ]], undefined, undefined, undefined);
        expect(bucket.layoutVertexArray.length).toBe(2);

        bucket.addFeature({} as BucketFeature, [[
            new Point(0, 0),
            new Point(10, 10),
            new Point(10, 20),
        ]], undefined, undefined, undefined);
        expect(bucket.layoutVertexArray.length).toBe(5);

        bucket.addFeature(feature, feature.loadGeometry(), undefined, undefined, undefined);
        expect(bucket.layoutVertexArray.length).toBe(411);
    });
});

describe('FillBucket segmentation', () => {
    test('addFeature', () => {
        const layer = new FillStyleLayer({
            id: 'test',
            type: 'fill',
            source: '',
            layout: {},
            paint: {'fill-color': ['to-color', ['get', 'foo'], '#000']}
        });
        const evaluationParameters : EvaluationParameters = {zoom: 0, zoomHistory: {}} as EvaluationParameters;
        const availableImages: Array<string> = [''];
        layer.recalculate(evaluationParameters, availableImages);

        const bucket = new FillBucket({layers: [layer], index: 0, zoom : 0, pixelRatio:0, overscaling: 0, collisionBoxArray: [] as unknown as CollisionBoxArray,  sourceLayerIndex: 0, sourceID: ''});

        // first add an initial, small feature to make sure the next one starts at
        // a non-zero offset
        bucket.addFeature({} as BucketFeature, [createPolygon(10)], undefined, undefined, undefined);

        // add a feature that will break across the group boundary
        bucket.addFeature({} as BucketFeature, [
            createPolygon(128),
            createPolygon(128)
        ], undefined, undefined, undefined);

        // Each polygon must fit entirely within a segment, so we expect the
        // first segment to include the first feature and the first polygon
        // of the second feature, and the second segment to include the
        // second polygon of the second feature.
        expect(bucket.layoutVertexArray.length).toBe(266);
        expect(bucket.segments.get()[0]).toEqual({
            vertexOffset: 0,
            vertexLength: 138,
            primitiveOffset: 0,
            primitiveLength: 134
        });
        expect(bucket.segments.get()[1]).toEqual({
            vertexOffset: 138,
            vertexLength: 128,
            primitiveOffset: 134,
            primitiveLength: 126
        });
    });
});
