import type {StyleSpecification} from '../../../src/style-spec/types.g';
import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import TileParser from '../lib/tile_parser';
import {OverscaledTileID} from '../../../src/source/tile_id';

export default class Layout extends Benchmark {
    tiles: Array<{
        tileID: OverscaledTileID;
        buffer: ArrayBuffer;
    }>;
    parser: TileParser;
    style: string | StyleSpecification;
    tileIDs: Array<OverscaledTileID>;

    constructor(style: string | StyleSpecification, tileIDs?: Array<OverscaledTileID>) {
        super();
        this.style = style;
        this.tileIDs = tileIDs || [
            new OverscaledTileID(12, 0, 12, 655, 1583),
            new OverscaledTileID(8, 0, 8, 40, 98),
            new OverscaledTileID(4, 0, 4, 3, 6),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ];
    }

    async setup(): Promise<void> {
        const styleJSON = await fetchStyle(this.style);
        this.parser = new TileParser(styleJSON, 'openmaptiles');
        await this.parser.setup();
        this.tiles = await Promise.all(this.tileIDs.map(tileID => this.parser.fetchTile(tileID)));
        await Promise.all(this.tiles.map(tile => this.parser.parseTile(tile)));
    }

    async bench() {
        for (const tile of this.tiles) {
            await this.parser.parseTile(tile);
        }
    }
}
