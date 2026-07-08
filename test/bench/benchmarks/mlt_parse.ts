import Benchmark from '../lib/benchmark.ts';
import TileParser from '../lib/tile_parser.ts';
import {OverscaledTileID} from '../../../src/tile/tile_id.ts';
import type {LayerSpecification, StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

type MLTParseOptions = {
    /**
     * Tile directory under `test/integration/assets/tiles`. `mlt` ships a
     * pre-baked triangle mesh; `mlt-untessellated` does not, forcing MapLibre to
     * re-tessellate with earcut. Parsing both isolates the tessellation cost.
     */
    tilesDir: 'mlt' | 'mlt-untessellated';
    tileID: OverscaledTileID;
    /** Layers rendered on top of the shared MLT source. */
    layers: LayerSpecification[];
};

/**
 * Isolates the worker-side cost of turning an MLT tile into renderable geometry.
 * It drives {@link TileParser} (i.e. `WorkerTile.parse`) — the same entry point
 * the vector-tile worker uses — so it covers decode + `loadGeometry` + bucket
 * population + tessellation, but none of the map init, upload or render overhead
 * that swamps the tessellation delta in an end-to-end map load.
 */
export default class MLTParse extends Benchmark {
    parser: TileParser;
    tile: {tileID: OverscaledTileID; buffer: ArrayBuffer};
    options: MLTParseOptions;

    constructor(options: MLTParseOptions) {
        super();
        this.options = options;
    }

    async setup(): Promise<void> {
        const style: StyleSpecification = {
            version: 8,
            sources: {
                openmaptiles: {
                    type: 'vector',
                    // `encoding` selects the MLT decoder in TileParser / the worker source.
                    encoding: 'mlt',
                    maxzoom: 14,
                    tiles: [`/test/integration/assets/tiles/${this.options.tilesDir}/{z}/{x}/{y}.mlt`]
                } as any
            },
            layers: this.options.layers
        };

        this.parser = new TileParser(style, 'openmaptiles');
        await this.parser.setup();
        this.tile = await this.parser.fetchTile(this.options.tileID);
        // Warm up: run one parse so the benchmarked loop measures steady state.
        await this.parser.parseTile(this.tile);
    }

    async bench(): Promise<void> {
        await this.parser.parseTile(this.tile);
    }
}
