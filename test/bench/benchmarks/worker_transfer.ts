import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import TileParser from '../lib/tile_parser';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {serialize, deserialize} from '../../../src/util/web_worker_transfer';

export default class WorkerTransfer extends Benchmark {
    parser: TileParser;
    payloadTiles: Array<any>;
    payloadJSON: Array<any>;
    worker: Worker;
    style: string | StyleSpecification;

    constructor(style: string | StyleSpecification) {
        super();
        this.style = style;
    }

    async setup(): Promise<void> {
        const src = `
        onmessage = (e) => {
            postMessage(e.data);
        };
        `;
        const url = window.URL.createObjectURL(new Blob([src], {type: 'text/javascript'}));
        this.worker = new Worker(url);

        const tileIDs = [
            new OverscaledTileID(8, 0, 8, 73, 97),
            new OverscaledTileID(11, 0, 11, 585, 783),
            new OverscaledTileID(11, 0, 11, 596, 775),
            new OverscaledTileID(13, 0, 13, 2412, 3079)
        ];

        const styleJSON = await fetchStyle(this.style);
        this.parser = new TileParser(styleJSON, 'openmaptiles');
        await this.parser.setup();
        const tiles = await Promise.all(tileIDs.map(tileID => this.parser.fetchTile(tileID)));
        const tileResults = await Promise.all(tiles.map(tile => this.parser.parseTile(tile)));
        const payload = tileResults
            .concat(Object.values(this.parser.icons))
            .concat(Object.values(this.parser.glyphs)).map((obj) => serialize(obj, []));
        this.payloadJSON = payload.map(barePayload);
        this.payloadTiles = payload.slice(0, tileResults.length);
    }

    sendPayload(obj: any): Promise<void> {
        return new Promise((resolve) => {
            this.worker.onmessage = () => resolve();
            this.worker.postMessage(obj);
        });
    }

    async bench(): Promise<void> {
        // benchmark sending raw JSON payload
        for (const obj of this.payloadJSON) {
            await this.sendPayload(obj);
        }

        // benchmark deserializing full tile payload because it happens on the main thread
        for (const obj of this.payloadTiles) {
            deserialize(obj);
        }
    }

    teardown(): void | Promise<void> {
        this.worker.terminate();
    }
}

function barePayload(obj) {
    // strip all transferable from a worker payload, because we can't transfer them repeatedly in the bench:
    // as soon as it's transferred once, it's no longer available on the main thread
    return JSON.parse(JSON.stringify(obj, (key, value) => ArrayBuffer.isView(value) ? {} : value) || '{}');
}
