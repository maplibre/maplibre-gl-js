import {readdirSync, readFileSync} from 'fs';
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {derefLayers} from '@maplibre/maplibre-gl-style-spec';
import {WorkerTile} from '../../../src/source/worker_tile.ts';
import {StyleLayerIndex} from '../../../src/style/style_layer_index.ts';
import {parseGlyphPbf} from '../../../src/style/parse_glyph_pbf.ts';
import {LineAtlas} from '../../../src/render/line_atlas.ts';
import {OverscaledTileID} from '../../../src/tile/tile_id.ts';
import {SubdivisionGranularitySetting} from '../../../src/render/subdivision_granularity_settings.ts';
import {MessageType} from '../../../src/util/actor_messages.ts';

import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleGlyph} from '../../../src/style/style_glyph.ts';
import type {IActor} from '../../../src/util/actor.ts';
import type {ActorMessage, GetDashesResponse, GetGlyphsResponse} from '../../../src/util/actor_messages.ts';
import type {WorkerTileResult} from '../../../src/source/worker_source.ts';

type AnyActorMessage = {[K in MessageType]: ActorMessage<K>}[MessageType];

const assets = new URL('../../integration/assets/', import.meta.url);
const fallbackFontStack = 'Open Sans Semibold,Arial Unicode MS Bold';
const availableFontStacks = new Set(['Open Sans Bold,Arial Unicode MS Bold', fallbackFontStack]);

function loadGlyphs(stack: string): {[id: number]: StyleGlyph} {
    const directory = new URL(`glyphs/${availableFontStacks.has(stack) ? stack : fallbackFontStack}/`, assets);
    const glyphs: {[id: number]: StyleGlyph} = {};
    for (const file of readdirSync(directory).filter(name => name.endsWith('.pbf'))) {
        for (const glyph of parseGlyphPbf(readFileSync(new URL(file, directory)))) {
            glyphs[glyph.id] = glyph;
        }
    }
    return glyphs;
}

const glyphCache: {[stack: string]: {[id: number]: StyleGlyph}} = {};
const lineAtlas = new LineAtlas(256, 512);

const actor = {
    sendAsync(rawMessage) {
        const message = rawMessage as AnyActorMessage;
        if (message.type === MessageType.getGlyphs) {
            const {stacks} = message.data;
            const response: GetGlyphsResponse = {};
            for (const stack in stacks) {
                glyphCache[stack] ||= loadGlyphs(stack);
                response[stack] = {};
                for (const id of stacks[stack]) {
                    response[stack][id] = glyphCache[stack][id];
                }
            }
            return Promise.resolve(response);
        }
        if (message.type === MessageType.getDashes) {
            const {dashes} = message.data;
            const response: GetDashesResponse = {};
            for (const key in dashes) {
                response[key] = lineAtlas.getDash(dashes[key].dasharray, dashes[key].round);
            }
            return Promise.resolve(response);
        }
        return Promise.resolve({});
    }
} as IActor;

const styleJSON = JSON.parse(readFileSync(new URL('styles/bright-v9.json', assets), 'utf8')) as StyleSpecification;
const layerIndex = new StyleLayerIndex(derefLayers(styleJSON.layers));

export const fixtureTiles: Array<{tileID: OverscaledTileID; buffer: Buffer}> = [
    new OverscaledTileID(0, 0, 0, 0, 0),
    new OverscaledTileID(4, 0, 4, 4, 7),
    new OverscaledTileID(10, 0, 10, 175, 409),
    new OverscaledTileID(16, 0, 16, 11235, 26208)
].map(tileID => ({
    tileID,
    buffer: readFileSync(new URL(`tiles/streets-v7/${tileID.canonical.z}-${tileID.canonical.x}-${tileID.canonical.y}.mvt`, assets))
}));

export function parseTile(tile: {tileID: OverscaledTileID; buffer: Buffer}, returnDependencies: boolean): Promise<WorkerTileResult> {
    const workerTile = new WorkerTile({
        type: 'benchmark',
        tileID: tile.tileID,
        zoom: tile.tileID.overscaledZ,
        tileSize: 512,
        showCollisionBoxes: false,
        source: 'maplibre',
        uid: '0',
        maxZoom: 22,
        pixelRatio: 1,
        request: {url: ''},
        returnDependencies,
        promoteId: undefined,
        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
    });
    return workerTile.parse(new VectorTile(new PbfReader(tile.buffer)), layerIndex, [], actor, SubdivisionGranularitySetting.noSubdivision);
}
