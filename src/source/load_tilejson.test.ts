import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import {fakeServer, type FakeServer} from 'nise';
import {loadTileJson} from './load_tilejson';
import {RequestManager} from '../util/request_manager';
import {ABORT_ERROR} from '../util/abort_error';

import {type RasterSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

describe('loadTileJson', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
    });

    const requestManager = new RequestManager();

    test('fetches and returns TileJSON', async () => {
        const options = {
            type: 'raster',
            url: 'http://example.com/test.json',
        } satisfies RasterSourceSpecification;

        const mockTileJSON = {
            tiles: ['http://example.com/tile/{z}/{x}/{y}.png'],
            minzoom: 0,
            maxzoom: 14,
            attribution: 'Test Attribution',
            bounds: [-180, -85, 180, 85],
            scheme: 'xyz',
            tileSize: 256,
        };

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(mockTileJSON));
        });

        const promise = loadTileJson(options, requestManager, new AbortController());
        server.respond();
        const result = await promise;

        expect(result).toEqual(mockTileJSON);
    });

    test('combines input and TileJSON', async () => {
        const options = {
            type: 'raster',
            url: 'http://example.com/test.json',
            minzoom: 5,
            tiles: ['http://example2.com/tile/{z}/{x}/{y}.png'],
        } satisfies RasterSourceSpecification;

        const mockTileJSON = {
            tiles: ['http://example.com/tile/{z}/{x}/{y}.png'],
            minzoom: 0,
            maxzoom: 14,
            attribution: 'Test Attribution',
            bounds: [-180, -85, 180, 85],
            scheme: 'xyz',
            tileSize: 256,
        };

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(mockTileJSON));
        });

        const promise = loadTileJson(options, requestManager, new AbortController());
        server.respond();
        const result = await promise;

        expect(result).toEqual({
            ...mockTileJSON,
            minzoom: options.minzoom,
            tiles: options.tiles,
        });
    });

    test('excludes non-TileJSON data', async () => {
        const options = {
            type: 'raster',
            url: 'http://example.com/test.json',
            someData1: 'value1',
        } as any;

        const mockTileJSON = {
            tiles: ['http://example.com/tile/{z}/{x}/{y}.png'],
            minzoom: 0,
            maxzoom: 14,
            attribution: 'Test Attribution',
            bounds: [-180, -85, 180, 85],
            scheme: 'xyz',
            tileSize: 256,
            someData2: 'value2',
        };

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(mockTileJSON));
        });

        const promise = loadTileJson(options, requestManager, new AbortController());
        server.respond();
        const result: any = await promise;

        expect(result.someData1).toBeUndefined();
        expect(result.someData2).toBeUndefined();
    });

    test('handles vector_layers in TileJSON', async () => {
        const options = {
            type: 'raster',
            url: 'http://example.com/test.json',
        } satisfies RasterSourceSpecification;

        const mockTileJSON = {
            tiles: ['http://example.com/tile/{z}/{x}/{y}.png'],
            minzoom: 0,
            maxzoom: 14,
            attribution: 'Test Attribution',
            bounds: [-180, -85, 180, 85],
            scheme: 'xyz',
            tileSize: 256,
            vector_layers: [{id: 'layer1'}, {id: 'layer2'}],
        };

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(mockTileJSON));
        });

        const promise = loadTileJson(options, requestManager, new AbortController());
        server.respond();
        const result = await promise;

        expect(result.vectorLayerIds).toEqual(['layer1', 'layer2']);
    });

    test('handles aborted request', async () => {
        const options = {
            type: 'raster',
            url: 'http://example.com/test.json',
        } satisfies RasterSourceSpecification;

        const mockTileJSON = {
            tiles: ['http://example.com/tile/{z}/{x}/{y}.png'],
            minzoom: 0,
            maxzoom: 14,
            attribution: 'Test Attribution',
            bounds: [-180, -85, 180, 85],
            scheme: 'xyz',
            tileSize: 256,
        };

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(mockTileJSON));
        });

        const abortController = new AbortController();
        const promise = loadTileJson(options, requestManager, abortController);
        abortController.abort();
        server.respond();

        await expect(promise).rejects.toThrow(expect.objectContaining({name: ABORT_ERROR}));
    });

    test('throws for AJAX errors', async () => {
        const options = {
            type: 'raster',
            url: 'http://example.com/test.json',
        } satisfies RasterSourceSpecification;

        server.respondWith(request => {
            request.respond(404, undefined, 'Not Found');
        });

        const promise = loadTileJson(options, requestManager, new AbortController());
        server.respond();

        await expect(promise).rejects.toThrow('AJAXError: Not Found (404): http://example.com/test.json');
    });
});
