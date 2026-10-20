import {describe, test, expect, vi} from 'vitest';
import {MercatorProjection} from '../geo/projection/mercator_projection.ts';
import {create, type Source} from './source.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RequestManager} from '../util/request_manager.ts';
import {getWrapDispatcher, waitForMetadataEvent} from '../util/test/util.ts';
import {type ActorMessage, MessageType} from '../util/actor_messages.ts';

import type {Map} from '../ui/map.ts';
import type {Tile} from '../tile/tile.ts';
import type {Evented} from '../util/evented.ts';
import type {CombinatorSourceSpecification} from './combinator.ts';
import type {CombinatorTileParameters} from './combinator_worker.ts';

describe('combinator sources', () => {
    test('takes its zoom range from its vector operands and gives its worker its definition', async () => {
        const messages: Array<ActorMessage<MessageType>> = [];
        const source = createSource({
            type: 'union',
            sources: [
                {type: 'vector', tiles: ['http://example.com/a/{z}/{x}/{y}.pbf'], minzoom: 2, maxzoom: 14},
                {type: 'vector', tiles: ['http://example.com/b/{z}/{x}/{y}.pbf'], minzoom: 4, maxzoom: 16},
                {type: 'geojson-layers', data: {tracks: {type: 'FeatureCollection', features: []}}},
            ],
        }, messages);

        await waitForMetadataEvent(source);

        expect(source.minzoom).toBe(2);
        expect(source.maxzoom).toBe(16);
        const {data} = messages.find(message => message.type === MessageType.setCombinatorDefinition) as ActorMessage<MessageType.setCombinatorDefinition>;
        expect(data).toEqual({
            type: 'union',
            source: 'id',
            definition: {type: 'union', sources: [
                {type: 'vector', leaf: 0, encoding: undefined},
                {type: 'vector', leaf: 1, encoding: undefined},
                {type: 'geojson-layers', data: {tracks: {type: 'FeatureCollection', features: []}}, geojsonVtOptions: expect.objectContaining({maxZoom: 16})},
            ]},
        });
    });

    test('loads each vector operand\'s tile, overzoomed beyond its maxzoom and not below its minzoom', async () => {
        const messages: Array<ActorMessage<MessageType>> = [];
        const source = createSource({
            type: 'difference',
            source: {
                type: 'union',
                sources: [
                    {type: 'vector', tiles: ['http://example.com/a/{z}/{x}/{y}.pbf'], maxzoom: 14},
                    {type: 'vector', tiles: ['http://example.com/b/{z}/{x}/{y}.pbf'], minzoom: 16, maxzoom: 18},
                ],
            },
            subtract: {type: 'geojson-layers', data: {}},
        }, messages);
        await waitForMetadataEvent(source);

        await source.loadTile(createTile(new OverscaledTileID(15, 0, 15, 10, 20)));

        const {data} = messages.find(message => message.type === MessageType.loadTile) as ActorMessage<MessageType.loadTile>;
        const [a, b] = (data as CombinatorTileParameters).leaves;
        expect(a.request.url).toBe('http://example.com/a/14/5/10.pbf');
        expect(a.overzoomParameters.maxZoomTileID).toEqual({z: 14, x: 5, y: 10, key: expect.anything()});
        expect(b).toBeNull();
    });

    test('rejects an operand that cannot be combined', () => {
        expect(() => createSource({type: 'union', sources: [{type: 'raster', tiles: []} as any]}, [])).toThrow('cannot be combined');
    });
});

function createSource(options: CombinatorSourceSpecification, messages: Array<ActorMessage<MessageType>>): Source & Evented {
    const dispatcher = getWrapDispatcher()({
        sendAsync(message: ActorMessage<MessageType>) {
            messages.push(message);
            return Promise.resolve({});
        },
    });
    const source = create('id', options, dispatcher, undefined) as Source & Evented;
    source.onAdd({
        _requestManager: new RequestManager(),
        style: {projection: new MercatorProjection()},
        getPixelRatio() { return 1; },
    } as any as Map);
    return source;
}

function createTile(tileID: OverscaledTileID): Tile {
    return {
        uid: 0,
        tileID,
        loadVectorData: vi.fn(),
        unloadVectorData: vi.fn(),
    } as any as Tile;
}
