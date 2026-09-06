import {readFileSync} from 'fs';
import {bench} from 'vitest';
import {derefLayers} from '@maplibre/maplibre-gl-style-spec';
import {WorkerTile} from './worker_tile.ts';
import {MLTVectorTile} from './vector_tile_mlt.ts';
import {StyleLayerIndex} from '../style/style_layer_index.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {IActor} from '../util/actor.ts';

/**
 * Isolates the worker-side cost of turning an MLT tile into renderable geometry:
 * decode + `loadGeometry` + bucket population + tessellation. Each fixture is
 * benchmarked against a `mlt` tile (ships a pre-baked triangle mesh) and a
 * `mlt-untessellated` one (forces MapLibre to re-tessellate with earcut), so the
 * pair isolates the tessellation cost.
 */

const assets = new URL('../../test/integration/assets/tiles/', import.meta.url);
const noopActor = {sendAsync: () => Promise.resolve({})} as IActor;

const fillLayers: LayerSpecification[] = [
    {id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: {'fill-color': '#008000'}}
];
const fillExtrusionLayers: LayerSpecification[] = [
    {id: 'background', type: 'background', paint: {'background-color': '#ffffff'}},
    {id: 'building', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', paint: {'fill-extrusion-color': '#c86432', 'fill-extrusion-height': 20}}
];
const fillTileID = new OverscaledTileID(5, 0, 5, 22, 12);
const buildingTileID = new OverscaledTileID(14, 0, 14, 8716, 5685);

type MltFixture = {
    name: string;
    tilesDir: 'mlt' | 'mlt-untessellated';
    tileID: OverscaledTileID;
    layers: LayerSpecification[];
};

const fixtures: MltFixture[] = [
    {name: 'MLTFillTessellated', tilesDir: 'mlt', tileID: fillTileID, layers: fillLayers},
    {name: 'MLTFillUntessellated', tilesDir: 'mlt-untessellated', tileID: fillTileID, layers: fillLayers},
    {name: 'MLTFillExtrusionTessellated', tilesDir: 'mlt', tileID: buildingTileID, layers: fillExtrusionLayers},
    {name: 'MLTFillExtrusionUntessellated', tilesDir: 'mlt-untessellated', tileID: buildingTileID, layers: fillExtrusionLayers},
];

function parseFixture(fixture: MltFixture): () => Promise<unknown> {
    const {z, x, y} = fixture.tileID.canonical;
    const file = readFileSync(new URL(`${fixture.tilesDir}/${z}/${x}/${y}.mlt`, assets));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const layerIndex = new StyleLayerIndex(derefLayers(fixture.layers));

    return () => {
        const workerTile = new WorkerTile({
            type: 'benchmark',
            tileID: fixture.tileID,
            zoom: fixture.tileID.overscaledZ,
            tileSize: 512,
            showCollisionBoxes: false,
            source: 'openmaptiles',
            uid: '0',
            maxZoom: 22,
            pixelRatio: 1,
            request: {url: ''},
            returnDependencies: false,
            promoteId: undefined,
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
        });
        const vectorTile = new MLTVectorTile(buffer);
        return workerTile.parse(vectorTile, layerIndex, [], noopActor, SubdivisionGranularitySetting.noSubdivision);
    };
}

for (const fixture of fixtures) {
    const parse = parseFixture(fixture);
    await parse();

    bench(fixture.name, async () => {
        await parse();
    });
}
