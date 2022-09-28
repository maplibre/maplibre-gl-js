import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import segment from '../segment';
import LineBucket from './line_bucket';
import LineStyleLayer from '../../style/style_layer/line_style_layer';
import {LayerSpecification} from '../../style-spec/types.g';
import EvaluationParameters from '../../style/evaluation_parameters';
import {BucketFeature, BucketParameters} from '../bucket';

// Load a line feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.resolve(__dirname, '../../../test/unit/assets/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.road.feature(0);

function createLine(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}

describe('LineBucket', () => {
    test('LineBucket', () => {
        expect(() => {
            const layer = new LineStyleLayer({id: 'test', type: 'line'} as LayerSpecification);
            layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

            const bucket = new LineBucket({layers: [layer]} as BucketParameters<LineStyleLayer>);

            const line = {
                type: 2,
                properties: {}
            } as BucketFeature;

            const polygon = {
                type: 3,
                properties: {}
            } as BucketFeature;

            bucket.addLine([
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20)
            ], line, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20)
            ], polygon, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20),
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20),
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined);

            bucket.addFeature(feature as any, feature.loadGeometry(), undefined, undefined, undefined);
        }).not.toThrow();
    });

    test('LineBucket segmentation', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
        // breaking across array groups without tests taking a _long_ time.
        segment.MAX_VERTEX_ARRAY_LENGTH = 256;

        const layer = new LineStyleLayer({id: 'test', type: 'line'} as LayerSpecification);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        const bucket = new LineBucket({layers: [layer]} as BucketParameters<LineStyleLayer>);

        // first add an initial, small feature to make sure the next one starts at
        // a non-zero offset
        bucket.addFeature({} as BucketFeature, [createLine(10)], undefined, undefined, undefined);

        // add a feature that will break across the group boundary
        bucket.addFeature({} as BucketFeature, [createLine(128)], undefined, undefined, undefined);

        // Each polygon must fit entirely within a segment, so we expect the
        // first segment to include the first feature and the first polygon
        // of the second feature, and the second segment to include the
        // second polygon of the second feature.
        expect(bucket.layoutVertexArray).toHaveLength(276);
        expect(bucket.segments.get()).toEqual([{
            vertexOffset: 0,
            vertexLength: 20,
            primitiveOffset: 0,
            primitiveLength: 18
        }, {
            vertexOffset: 20,
            vertexLength: 256,
            primitiveOffset: 18,
            primitiveLength: 254
        }]);

        expect(console.warn).toHaveBeenCalledTimes(1);

    });
});
