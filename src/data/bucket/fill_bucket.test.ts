import {test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import {SegmentVector} from '../segment';
import {FillBucket} from './fill_bucket';
import {FillStyleLayer} from '../../style/style_layer/fill_style_layer';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters';
import {type ZoomHistory} from '../../style/zoom_history';
import {type BucketFeature, type BucketParameters} from '../bucket';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {CanonicalTileID} from '../../source/tile_id';

// Load a fill feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.resolve(__dirname, '../../../test/unit/assets/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.water.feature(0);

const canonicalTileID = new CanonicalTileID(20, 1, 1);

function createPolygon(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(2048 + 256 * Math.cos(i / numPoints * 2 * Math.PI), 2048 + 256 * Math.sin(i / numPoints * 2 * Math.PI)));
    }
    return points;
}

test('FillBucket', () => {
    expect(() => {
        const layer = new FillStyleLayer({id: 'test', type: 'fill', layout: {}} as LayerSpecification);
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, undefined);

        const bucket = new FillBucket({layers: [layer]} as BucketParameters<FillStyleLayer>);

        bucket.addFeature({} as BucketFeature, [[
            new Point(0, 0),
            new Point(10, 10)
        ]], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

        bucket.addFeature({} as BucketFeature, [[
            new Point(0, 0),
            new Point(10, 10),
            new Point(10, 20)
        ]], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

        bucket.addFeature(feature as any, feature.loadGeometry(), undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);
    }).not.toThrow();
});

test('FillBucket segmentation', () => {
    // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    Object.defineProperty(SegmentVector, 'MAX_VERTEX_ARRAY_LENGTH', {value: 256});

    const layer = new FillStyleLayer({
        id: 'test',
        type: 'fill',
        layout: {},
        source: 'source',
        paint: {
            'fill-color': ['to-color', ['get', 'foo'], '#000']
        }
    } as LayerSpecification);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, undefined);

    const bucket = new FillBucket({layers: [layer]} as BucketParameters<FillStyleLayer>);

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature({} as BucketFeature, [createPolygon(10)], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

    // add a feature that will break across the group boundary
    bucket.addFeature({} as BucketFeature, [
        createPolygon(128),
        createPolygon(128)
    ], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    expect(bucket.layoutVertexArray).toHaveLength(266);
    expect(bucket.segments.get()[0]).toEqual({
        vertexOffset: 0,
        vertexLength: 138,
        vaos: {},
        primitiveOffset: 0,
        primitiveLength: 134
    });
    expect(bucket.segments.get()[1]).toEqual({
        vertexOffset: 138,
        vertexLength: 128,
        vaos: {},
        primitiveOffset: 134,
        primitiveLength: 126
    });

});
