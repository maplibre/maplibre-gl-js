import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';

import {derefLayers} from '@maplibre/maplibre-gl-style-spec';
import {Style} from '../../../src/style/style.ts';
import {type IReadonlyTransform} from '../../../src/geo/transform_interface.ts';
import {Evented} from '../../../src/util/evented.ts';
import {RequestManager} from '../../../src/util/request_manager.ts';
import {WorkerTile} from '../../../src/source/worker_tile.ts';
import {StyleLayerIndex} from '../../../src/style/style_layer_index.ts';

import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {WorkerTileResult} from '../../../src/source/worker_source.ts';
import type {OverscaledTileID} from '../../../src/tile/tile_id.ts';
import type {TileJSON} from '../../../src/util/util.ts';
import type {Map} from '../../../src/ui/map.ts';
import type {IActor} from '../../../src/util/actor.ts';
import {SubdivisionGranularitySetting} from '../../../src/render/subdivision_granularity_settings.ts';
import {MessageType, type GetImagesParameters, type GetImagesResponse, type GetGlyphsParameters, type GetGlyphsResponse, type GetDashesParameters, type GetDashesResponse} from '../../../src/util/actor_messages.ts';
import {MercatorTransform} from '../../../src/geo/projection/mercator_transform.ts';

class StubMap extends Evented {
    style: Style;
    _requestManager: RequestManager;
    transform: IReadonlyTransform;

    constructor() {
        super();
        this._requestManager = new RequestManager();
        this.transform = new MercatorTransform();
    }

    getPixelRatio() {
        return devicePixelRatio;
    }

    setTerrain() {}

    _getMapId() {
        return 1;
    }

    migrateProjection() {}
}

function createStyle(styleJSON: StyleSpecification): Promise<Style> {
    return new Promise((resolve, reject) => {
        const mapStub = new StubMap() as any as Map;
        const style = new Style(mapStub);
        mapStub.style = style;
        style.loadJSON(styleJSON);
        style.on('style.load', () => resolve(style));
        style.on('error', reject);
    });
}

export default class TileParser {
    styleJSON: StyleSpecification;
    tileJSON: TileJSON;
    sourceID: string;
    layerIndex: StyleLayerIndex;
    icons: Record<string, GetImagesResponse>;
    glyphs: Record<string, GetGlyphsResponse>;
    dashes: Record<string, GetDashesResponse>;
    style: Style;
    actor: IActor;

    constructor(styleJSON: StyleSpecification, sourceID: string) {
        this.styleJSON = styleJSON;
        this.sourceID = sourceID;
        this.layerIndex = new StyleLayerIndex(derefLayers(this.styleJSON.layers));
        this.glyphs = {};
        this.icons = {};
    }

    async loadImages(params: GetImagesParameters): Promise<GetImagesResponse> {
        const key = JSON.stringify(params);
        if (!this.icons[key]) {
            this.icons[key] = await this.style.getImages('', params);
        }
        return this.icons[key];
    }

    async loadGlyphs(params: GetGlyphsParameters): Promise<GetGlyphsResponse> {
        const key = JSON.stringify(params);
        if (!this.glyphs[key]) {
            this.glyphs[key] = await this.style.getGlyphs('', params);
        }
        return this.glyphs[key];
    }

    async loadDashes(params: GetDashesParameters): Promise<GetDashesResponse> {
        const key = JSON.stringify(params);
        if (!this.dashes[key]) {
            this.dashes[key] = await this.style.getDashes('', params);
        }
        return this.dashes[key];
    }

    setup(): Promise<void> {
        const parser = this;
        this.actor = {
            sendAsync(message) {
                if (message.type === MessageType.getImages) {
                    return parser.loadImages(message.data);
                }
                if (message.type === MessageType.getGlyphs) {
                    return parser.loadGlyphs(message.data);
                }
                if (message.type === MessageType.getDashes) {
                    return parser.loadDashes(message.data);
                }
                throw new Error(`Invalid action ${message.type}`);
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

    fetchTile(tileID: OverscaledTileID): Promise<{
        tileID: OverscaledTileID;
        buffer: ArrayBuffer;
    }> {
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
            type: 'benchmark',
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
            promoteId: undefined,
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
        });

        const vectorTile = new VectorTile(new Protobuf(tile.buffer));

        return workerTile.parse(vectorTile, this.layerIndex, [], this.actor, SubdivisionGranularitySetting.noSubdivision);
    }
}
