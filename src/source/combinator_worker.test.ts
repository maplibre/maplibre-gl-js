import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {fromVectorTileJs, type VectorTileFeatureLike, type VectorTileLayerLike} from '@maplibre/vt-pbf';
import {type FakeServer, fakeServer} from 'nise';
import {DifferenceWorkerSource} from './difference_worker_source.ts';
import {GeoJSONLayersWorkerSource} from './geojson_layers_worker_source.ts';
import {UnionWorkerSource} from './union_worker_source.ts';
import {StyleLayerIndex} from '../style/style_layer_index.ts';
import {CanonicalTileID, OverscaledTileID} from '../tile/tile_id.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {EXTENT} from '../data/extent.ts';
import {createFakeActor} from '../util/test/util.ts';

import type {WorkerTileWithData} from './worker_source.ts';
import type {VectorTileData} from './combinable_worker_source.ts';
import type {CombinatorDefinition, CombinatorLeafParameters, CombinatorTileParameters} from './combinator_worker.ts';

const tracksUrl = 'http://localhost:2900/tracks/0/0/0.pbf';

describe('combinator worker sources', () => {
    test('geojson-layers gives each member of its data a layer of its own', async () => {
        const source = new GeoJSONLayersWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'geojson-layers', source: 'overlay', definition: geojsonLayers({
            tracks: [lineFeature(1), lineFeature(2)],
            stations: [lineFeature(3)],
        })});

        const tile = source.loadVectorTile(tileParameters([]));

        expect(Object.keys(tile.vectorTile.layers).sort()).toEqual(['stations', 'tracks']);
        expect(ids(layerOf(tile, 'tracks'))).toEqual([1, 2]);
        expect(ids(layerOf(tile, 'stations'))).toEqual([3]);
    });

    test('union holds each layer of all its operands', async () => {
        const source = new UnionWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'union', source: 'overlay', definition: {type: 'union', sources: [
            {type: 'vector', leaf: 0},
            geojsonLayers({tracks: [lineFeature(4)], stations: [lineFeature(5)]}),
        ]}});

        const tile = source.loadVectorTile(tileParameters([{request: {url: tracksUrl}}], [tracksTile()]));

        expect(ids(layerOf(tile, 'tracks'))).toEqual([1, 2, 3, 4]);
        expect(ids(layerOf(tile, 'stations'))).toEqual([5]);
    });

    test('difference subtracts features by id, whether or not the feature subtracting one reaches the tile', async () => {
        const source = new DifferenceWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'difference', source: 'overlay', definition: {
            type: 'difference',
            source: {type: 'vector', leaf: 0},
            subtract: geojsonLayers({tracks: [
                {type: 'Feature', id: 2, properties: {}, geometry: null},
                {type: 'Feature', id: 3, properties: {}, geometry: {type: 'Point', coordinates: [170, 80]}},
            ]}),
        }});

        const tile = source.loadVectorTile(tileParameters([{request: {url: tracksUrl}}], [tracksTile()]));

        expect(ids(layerOf(tile, 'tracks'))).toEqual([1]);
    });

    test('difference matches features by a key expression of their layer', async () => {
        const source = new DifferenceWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'difference', source: 'overlay', definition: {
            type: 'difference',
            source: {type: 'vector', leaf: 0},
            subtract: geojsonLayers({tracks: [{type: 'Feature', id: 10, properties: {}, geometry: null}]}),
            key: {tracks: ['get', 'way']},
        }});

        const tile = source.loadVectorTile(tileParameters([{request: {url: tracksUrl}}], [tracksTile()]));

        expect(ids(layerOf(tile, 'tracks'))).toEqual([3]);
    });

    test('a union with data from only one operand passes that operand\'s tile on as it is', async () => {
        const source = new UnionWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'union', source: 'overlay', definition: {type: 'union', sources: [
            {type: 'vector', leaf: 0},
            geojsonLayers({tracks: [{type: 'Feature', id: 4, properties: {}, geometry: null}]}),
        ]}});

        const tile = source.loadVectorTile(tileParameters([{request: {url: tracksUrl}}], [tracksTile()]));

        expect(tile.rawData).toEqual(tracksTile());
    });

    test('a difference that subtracts nothing from a tile passes it on as it is', async () => {
        const source = new DifferenceWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'difference', source: 'overlay', definition: {
            type: 'difference',
            source: {type: 'vector', leaf: 0},
            subtract: geojsonLayers({tracks: [{type: 'Feature', id: 99, properties: {}, geometry: null}]}),
        }});

        const tile = source.loadVectorTile(tileParameters([{request: {url: tracksUrl}}], [tracksTile()]));

        expect(tile.rawData).toEqual(tracksTile());
    });

    test('difference cannot subtract a source whose features are not all at hand', async () => {
        const source = new DifferenceWorkerSource(createFakeActor(), new StyleLayerIndex(), []);

        await expect(source.setDefinition({type: 'difference', source: 'overlay', definition: {
            type: 'difference',
            source: geojsonLayers({tracks: [lineFeature(1)]}),
            subtract: {type: 'vector', leaf: 0},
        }})).rejects.toThrow('sources.overlay.subtract');
    });

    test('difference subtracts a union of sources it can subtract, but not a union with any other', async () => {
        const source = new DifferenceWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'difference', source: 'overlay', definition: {
            type: 'difference',
            source: {type: 'vector', leaf: 0},
            subtract: {type: 'union', sources: [
                geojsonLayers({tracks: [{type: 'Feature', id: 1, properties: {}, geometry: null}]}),
                geojsonLayers({tracks: [{type: 'Feature', id: 3, properties: {}, geometry: null}]}),
            ]},
        }});

        const tile = source.loadVectorTile(tileParameters([{request: {url: tracksUrl}}], [tracksTile()]));

        expect(ids(layerOf(tile, 'tracks'))).toEqual([2]);
        await expect(source.setDefinition({type: 'difference', source: 'overlay', definition: {
            type: 'difference',
            source: geojsonLayers({tracks: [lineFeature(1)]}),
            subtract: {type: 'union', sources: [geojsonLayers({tracks: []}), {type: 'vector', leaf: 0}]},
        }})).rejects.toThrow('sources.overlay.subtract');
    });

    test('a vector operand beyond its maxzoom gives the part of its tile at the maxzoom that the tile covers', async () => {
        const layerIndex = new StyleLayerIndex([{id: 'tracks', type: 'line', source: 'overlay', 'source-layer': 'tracks'}]);
        const source = new UnionWorkerSource(createFakeActor(), layerIndex, []);
        await source.setDefinition({type: 'union', source: 'overlay', definition: {type: 'union', sources: [{type: 'vector', leaf: 0}]}});

        const tile = source.loadVectorTile({
            ...tileParameters([{request: {url: tracksUrl}, overzoomParameters: {maxZoomTileID: new CanonicalTileID(0, 0, 0), overzoomRequest: {url: tracksUrl}}}], [tracksTile()]),
            tileID: new OverscaledTileID(1, 0, 1, 0, 0),
        });

        expect(ids(layerOf(tile, 'tracks'))).toEqual([1, 2, 3]);
        expect(tile.rawData).toBeUndefined();
    });

    test('a vector operand without data at the zoom contributes nothing', async () => {
        const source = new UnionWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.setDefinition({type: 'union', source: 'overlay', definition: {type: 'union', sources: [{type: 'vector', leaf: 0}]}});

        const tile = source.loadVectorTile(tileParameters([null], [null]));

        expect(tile).toBeNull();
    });

    describe('loadTile', () => {
        let server: FakeServer;

        beforeEach(() => {
            global.fetch = null;
            server = fakeServer.create();
            server.respondImmediately = true;
            server.respondWith(tracksUrl, request => request.respond(200, {'Content-Type': 'application/x-protobuf'}, tracksTile() as any));
        });

        afterEach(() => {
            server.restore();
        });

        test('fetches the vector operands\' tiles, and parses the combined tile, returning it encoded at one extent', async () => {
            const layerIndex = new StyleLayerIndex([{id: 'tracks', type: 'line', source: 'overlay', 'source-layer': 'tracks'}]);
            const source = new UnionWorkerSource(createFakeActor(), layerIndex, []);
            await source.setDefinition({type: 'union', source: 'overlay', definition: {type: 'union', sources: [
                {type: 'vector', leaf: 0},
                geojsonLayers({tracks: [lineFeature(4)]}),
            ]}});

            const result = await source.loadTile(tileParameters([{request: {url: tracksUrl}}])) as WorkerTileWithData;

            expect(result.buckets.map(bucket => bucket.layerIds)).toEqual([['tracks']]);
            const tracks = new VectorTile(new PbfReader(result.rawTileData)).layers.tracks;
            expect(tracks).toHaveLength(4);
            expect(tracks.extent).toBe(EXTENT);
            expect(tracks.feature(0).loadGeometry()).toEqual([[new Point(0, 0), new Point(EXTENT / 2, EXTENT / 2)]]);
        });
    });
});

/**
 * A vector tile with a `tracks` layer of three features, ids 1 to 3, the first two of way 10 and
 * the third of way 11, at an extent of 4096.
 */
function tracksTile(): ArrayBuffer {
    const features: VectorTileFeatureLike[] = [[1, 10], [2, 10], [3, 11]].map(([id, way]) => ({
        type: 2,
        id,
        properties: {way},
        extent: 4096,
        loadGeometry: () => [[new Point(0, 0), new Point(2048, 2048)]],
    }));
    const tracks: VectorTileLayerLike = {version: 2, name: 'tracks', extent: 4096, length: features.length, feature: i => features[i]};
    const encoded = fromVectorTileJs({layers: {tracks}});
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

function geojsonLayers(features: Record<string, GeoJSON.Feature[]>): CombinatorDefinition {
    const data: Record<string, GeoJSON.FeatureCollection> = {};
    for (const [name, layerFeatures] of Object.entries(features)) {
        data[name] = {type: 'FeatureCollection', features: layerFeatures};
    }
    return {type: 'geojson-layers', data, geojsonVtOptions: {extent: EXTENT, maxZoom: 14}};
}

function lineFeature(id: number): GeoJSON.Feature {
    return {type: 'Feature', id, properties: {}, geometry: {type: 'LineString', coordinates: [[-10, 10], [10, -10]]}};
}

/**
 * Parameters to load a tile, with the data of its `vector` operands' tiles as if fetched.
 */
function tileParameters(leaves: CombinatorLeafParameters[], leafData?: Array<ArrayBuffer | null>): CombinatorTileParameters {
    return {
        type: 'union',
        source: 'overlay',
        uid: 0,
        tileID: new OverscaledTileID(0, 0, 0, 0, 0),
        zoom: 0,
        maxZoom: 14,
        tileSize: 512,
        promoteId: null,
        pixelRatio: 1,
        showCollisionBoxes: false,
        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        leaves,
        leafData,
    };
}

function ids(layer: VectorTileLayerLike): number[] {
    return Array.from({length: layer.length}, (_, i) => layer.feature(i).id);
}

function layerOf(tileData: VectorTileData, name: string): VectorTileLayerLike {
    return tileData.vectorTile.layers[name];
}
