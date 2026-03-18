/**
 * Measures ArrayBuffer memory retained by real MapLibre StructArrays
 * after simulated GPU upload. Uses actual tile data from PBF fixtures.
 *
 * Demonstrates that `delete array.arrayBuffer` (old behavior) does NOT
 * free memory because typed views retain the underlying ArrayBuffer,
 * while `freeBufferAfterUpload()` (new behavior) releases it.
 */
import {describe, test, expect, beforeAll} from 'vitest';
import {loadVectorTile, getFeaturesFromLayer, createPopulateOptions} from '../../test/unit/lib/tile';
import {FillBucket} from '../data/bucket/fill_bucket';
import {LineBucket} from '../data/bucket/line_bucket';
import {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import {LineStyleLayer} from '../style/style_layer/line_style_layer';
import {type BucketParameters} from '../data/bucket';
import {type EvaluationParameters} from '../style/evaluation_parameters';
import {type ZoomHistory} from '../style/zoom_history';
import {CanonicalTileID} from '../tile/tile_id';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

describe('StructArray memory after GPU upload', () => {
    let waterLayer: VectorTileLayerLike;
    let roadLayer: VectorTileLayerLike;
    const canonicalTileID = new CanonicalTileID(6, 18, 23);

    beforeAll(() => {
        const vt = loadVectorTile();
        waterLayer = vt.layers.water;
        roadLayer = vt.layers.road;
    });

    function createFillBucket(sourceLayer: VectorTileLayerLike): FillBucket {
        const layer = new FillStyleLayer({
            id: 'test-fill', type: 'fill', layout: {}, paint: {}
        } as LayerSpecification, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const bucket = new FillBucket({layers: [layer]} as BucketParameters<FillStyleLayer>);
        const features = getFeaturesFromLayer(sourceLayer);
        const options = createPopulateOptions([]);
        bucket.populate(features, options, canonicalTileID);
        return bucket;
    }

    function createLineBucket(sourceLayer: VectorTileLayerLike): LineBucket {
        const layer = new LineStyleLayer({
            id: 'test-line', type: 'line', layout: {}, paint: {}
        } as LayerSpecification, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const bucket = new LineBucket({layers: [layer]} as BucketParameters<LineStyleLayer>);
        const features = getFeaturesFromLayer(sourceLayer);
        const options = createPopulateOptions([]);
        bucket.populate(features, options, canonicalTileID);
        return bucket;
    }

    function getArrayBufferBytes(arr: any): number {
        if (!arr || !arr.arrayBuffer) return 0;
        return arr.arrayBuffer.byteLength;
    }

    function measureBucketArrays(bucket: FillBucket | LineBucket): {arrays: any[]; totalBytes: number} {
        const arrays: any[] = [];

        // Collect all StructArrays that would be uploaded as static buffers
        if ('layoutVertexArray' in bucket && bucket.layoutVertexArray) {
            arrays.push({name: 'layoutVertexArray', arr: bucket.layoutVertexArray});
        }
        if ('indexArray' in bucket && bucket.indexArray) {
            arrays.push({name: 'indexArray', arr: bucket.indexArray});
        }
        if ('indexArray2' in bucket && (bucket as any).indexArray2) {
            arrays.push({name: 'indexArray2', arr: (bucket as any).indexArray2});
        }

        let totalBytes = 0;
        for (const {arr} of arrays) {
            totalBytes += getArrayBufferBytes(arr);
        }
        return {arrays, totalBytes};
    }

    test('old behavior (delete arrayBuffer) retains memory via typed views', () => {
        const TILE_COUNT = 20;
        const buckets: (FillBucket | LineBucket)[] = [];

        for (let i = 0; i < TILE_COUNT; i++) {
            buckets.push(createFillBucket(waterLayer));
            if (roadLayer) buckets.push(createLineBucket(roadLayer));
        }

        // Measure total ArrayBuffer size across all buckets
        let totalBefore = 0;
        const allArrays: any[] = [];
        for (const bucket of buckets) {
            const {arrays, totalBytes} = measureBucketArrays(bucket);
            totalBefore += totalBytes;
            allArrays.push(...arrays);
        }

        console.log(`\n  Real tile data: ${buckets.length} buckets from ${TILE_COUNT} tiles`);
        console.log(`  Total ArrayBuffer memory before upload: ${(totalBefore / 1024).toFixed(0)} KB`);

        // Simulate OLD behavior: just delete arrayBuffer
        for (const {arr} of allArrays) {
            delete arr.arrayBuffer;
        }

        // Check: are views still referencing the original data?
        let viewsRetainingMemory = 0;
        for (const {arr} of allArrays) {
            if (arr.uint8 && arr.uint8.byteLength > 0) {
                viewsRetainingMemory++;
            }
        }

        console.log(`  After delete arrayBuffer: ${viewsRetainingMemory}/${allArrays.length} arrays still retain data via views`);

        // The typed views still hold the ArrayBuffers alive
        expect(viewsRetainingMemory).toBe(allArrays.length);
    });

    test('new behavior (freeBufferAfterUpload) releases all memory', () => {
        const TILE_COUNT = 20;
        const buckets: (FillBucket | LineBucket)[] = [];

        for (let i = 0; i < TILE_COUNT; i++) {
            buckets.push(createFillBucket(waterLayer));
            if (roadLayer) buckets.push(createLineBucket(roadLayer));
        }

        let totalBefore = 0;
        const allArrays: any[] = [];
        for (const bucket of buckets) {
            const {arrays, totalBytes} = measureBucketArrays(bucket);
            totalBefore += totalBytes;
            allArrays.push(...arrays);
        }

        console.log(`\n  Real tile data: ${buckets.length} buckets from ${TILE_COUNT} tiles`);
        console.log(`  Total ArrayBuffer memory before upload: ${(totalBefore / 1024).toFixed(0)} KB`);

        // Simulate NEW behavior
        for (const {arr} of allArrays) {
            arr.freeBufferAfterUpload();
        }

        // Check: views should now be empty
        let viewsRetainingMemory = 0;
        for (const {arr} of allArrays) {
            if (arr.uint8 && arr.uint8.byteLength > 0) {
                viewsRetainingMemory++;
            }
        }

        console.log(`  After freeBufferAfterUpload: ${viewsRetainingMemory}/${allArrays.length} arrays still retain data`);
        console.log(`  Memory released: ${(totalBefore / 1024).toFixed(0)} KB`);

        // All views should be empty
        expect(viewsRetainingMemory).toBe(0);
    });

    test('per-tile memory breakdown with real data', () => {
        const fillBucket = createFillBucket(waterLayer);
        const lineBucket = roadLayer ? createLineBucket(roadLayer) : null;

        console.log('\n  Per-tile memory breakdown (single tile, real PBF data):');

        const report = (label: string, arr: any) => {
            if (!arr?.arrayBuffer) return;
            const kb = arr.arrayBuffer.byteLength / 1024;
            const elements = arr.length;
            const bpe = arr.bytesPerElement;
            console.log(`    ${label}: ${elements} elements × ${bpe} bytes = ${kb.toFixed(1)} KB`);
        };

        console.log('  Fill bucket (water layer):');
        report('layoutVertexArray', fillBucket.layoutVertexArray);
        report('indexArray', fillBucket.indexArray);
        report('indexArray2', (fillBucket as any).indexArray2);

        if (lineBucket) {
            console.log('  Line bucket (road layer):');
            report('layoutVertexArray', lineBucket.layoutVertexArray);
            report('indexArray', lineBucket.indexArray);
        }

        // Just verify the test runs
        expect(fillBucket.layoutVertexArray.length).toBeGreaterThan(0);
    });
});
