import Protobuf from 'pbf';
import VT from '@mapbox/vector-tile';

import {derefLayers as deref} from '@maplibre/maplibre-gl-style-spec';
import Style from '../../../src/style/style';
import Transform from '../../../src/geo/transform';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/request_manager';
import WorkerTile from '../../../src/source/worker_tile';
import StyleLayerIndex from '../../../src/style/style_layer_index';

import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {WorkerTileResult} from '../../../src/source/worker_source';
import type {OverscaledTileID} from '../../../src/source/tile_id';
import type {TileJSON} from '../../../src/types/tilejson';
import type Map from '../../../src/ui/map';

class StubMap extends Evented {
    style: Style;
    _requestManager: RequestManager;
    transform: Transform;

    constructor() {
        super();
        this._requestManager = new RequestManager();
        this.transform = new Transform();
    }

    getPixelRatio() {
        return devicePixelRatio;
    }

    setTerrain() {}
}

function createStyle(styleJSON: StyleSpecification): Promise<Style> {
    return new Promise((resolve, reject) => {
        const mapStub = new StubMap() as any as Map;
        const style = new Style(mapStub);
        mapStub.style = style;
        style.loadJSON(styleJSON);
        style
            .on('style.load', () => resolve(style))
            .on('error', reject);
    });
}

export default class TileParser {
    styleJSON: StyleSpecification;
    tileJSON: TileJSON;
    sourceID: string;
    layerIndex: StyleLayerIndex;
    icons: any;
    glyphs: any;
    style: Style;
    actor: {
        send: Function;
    };

    constructor(styleJSON: StyleSpecification, sourceID: string) {
        this.styleJSON = styleJSON;
        this.sourceID = sourceID;
        this.layerIndex = new StyleLayerIndex(deref(this.styleJSON.layers));
        this.glyphs = {};
        this.icons = {};
    }

    loadImages(params: any, callback: Function) {
        const key = JSON.stringify(params);
        if (this.icons[key]) {
            callback(null, this.icons[key]);
        } else {
            this.style.getImages('', params, (err, icons) => {
                this.icons[key] = icons;
                callback(err, icons);
            });
        }
    }

    loadGlyphs(params: any, callback: Function) {
        const key = JSON.stringify(params);
        if (this.glyphs[key]) {
            callback(null, this.glyphs[key]);
        } else {
            this.style.getGlyphs('', params, (err, glyphs) => {
                this.glyphs[key] = glyphs;
                callback(err, glyphs);
            });
        }
    }

    setup(): Promise<void> {
        const parser = this;
        this.actor = {
            send(action, params, callback) {
                setTimeout(() => {
                    if (action === 'getImages') {
                        parser.loadImages(params, callback);
                    } else if (action === 'getGlyphs') {
                        parser.loadGlyphs(params, callback);
                    } else throw new Error(`Invalid action ${action}`);
                }, 0);
            }
        };

        return Promise.all([
            createStyle(this.styleJSON),
            fetch((this.styleJSON.sources[this.sourceID] as any).url).then(response => response.json())
        ]).then(([style, tileJSON]) => {
            this.style = style;
            this.tileJSON = tileJSON;
        });
    }

    fetchTile(tileID: OverscaledTileID) {
        return fetch(tileID.canonical.url(this.tileJSON.tiles, devicePixelRatio))
            .then(response => response.arrayBuffer())
            .then(buffer => ({tileID, buffer}));
    }

    parseTile(
        tile: {
            tileID: OverscaledTileID;
            buffer: ArrayBuffer;
        },
        returnDependencies?: boolean
    ): Promise<WorkerTileResult> {
        const workerTile = new WorkerTile({
            tileID: tile.tileID,
            zoom: tile.tileID.overscaledZ,
            tileSize: 512,
            showCollisionBoxes: false,
            source: this.sourceID,
            uid: '0',
            maxZoom: 22,
            pixelRatio: 1,
            request: {url: ''},
            returnDependencies,
            promoteId: undefined
        });

        const vectorTile = new VT.VectorTile(new Protobuf(tile.buffer));

        return new Promise((resolve, reject) => {
            workerTile.parse(vectorTile, this.layerIndex, [], ((this.actor as any)), (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}
