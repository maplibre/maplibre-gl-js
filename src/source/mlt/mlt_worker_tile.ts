import {FeatureIndex} from '../../data/feature_index';
import {performSymbolLayout} from '../../symbol/symbol_layout';
import {CollisionBoxArray} from '../../data/array_types.g';
import {DictionaryCoder} from '../../util/dictionary_coder';
import {LineBucket} from '../../data/bucket/line_bucket';
import {FillBucket} from '../../data/bucket/fill_bucket';
import {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket';
import {warnOnce, mapObject} from '../../util/util';
import {ImageAtlas} from '../../render/image_atlas';
import {GlyphAtlas} from '../../render/glyph_atlas';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import {OverscaledTileID} from '../tile_id';
import type {IActor} from '../../util/actor';
import type {StyleLayer} from '../../style/style_layer';
import type {StyleLayerIndex} from '../../style/style_layer_index';
import type {
    WorkerTileParameters,
    WorkerTileResult,
} from '../worker_source';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import {MessageType, type GetGlyphsResponse, type GetImagesResponse} from '../../util/actor_messages';
import {FeatureTable}  from "@maplibre/mlt";
import {ColumnarSymbolBucket} from "../../data/bucket/mlt/columnar_symbol_bucket";
import {Bucket, BucketParameters} from "../../data/bucket";

export class MltWorkerTile {
    tileID: OverscaledTileID;
    uid: string | number;
    encoding: string;
    zoom: number;
    pixelRatio: number;
    tileSize: number;
    source: string;
    promoteId: PromoteIdSpecification;
    overscaling: number;
    showCollisionBoxes: boolean;
    collectResourceTiming: boolean;
    returnDependencies: boolean;

    status: 'parsing' | 'done';
    data: FeatureTable[];
    collisionBoxArray: CollisionBoxArray;

    abort: AbortController;
    vectorTile: FeatureTable[];
    inFlightDependencies: AbortController[];

    constructor(params: WorkerTileParameters) {
        this.tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.overscaling = this.tileID.overscaleFactor();
        this.showCollisionBoxes = params.showCollisionBoxes;
        this.collectResourceTiming = !!params.collectResourceTiming;
        this.returnDependencies = !!params.returnDependencies;
        this.promoteId = params.promoteId;
        this.inFlightDependencies = [];
    }

    async parse(featureTables: FeatureTable[], layerIndex: StyleLayerIndex, availableImages: Array<string>, actor: IActor): Promise<WorkerTileResult> {
        this.status = 'parsing';
        this.data = featureTables;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(featureTables.keys()).sort());

        const featureIndex = new FeatureIndex(this.tileID, this.promoteId);
        featureIndex.bucketLayerIDs = [];

        const buckets: { [_: string]: Bucket } = {};

        const options = {
            featureIndex,
            iconDependencies: {},
            patternDependencies: {},
            glyphDependencies: {},
            dashDependencies: {},
            availableImages,
        };

        const layerFamilies = layerIndex.familiesBySource[this.source];
        for (const featureTableId in layerFamilies) {
            const featureTable = featureTables.find(f => f.name === featureTableId);
            if (!featureTable) {
                continue;
            }

            //const sourceLayerIndex = sourceLayerCoder.encode(featureTableId);
            for (const family of layerFamilies[featureTableId]) {
                const layer = family[0];
                if (layer.source !== this.source) {
                    warnOnce(`layer.source = ${layer.source} does not equal this.source = ${this.source}`);
                }
                if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) continue;
                if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
                if (layer.visibility === 'none') continue;

                recalculateLayers(family, this.zoom, availableImages);
                const params : BucketParameters<any> = {
                    index: featureIndex.bucketLayerIDs.length,
                    encoding: 'mlt',
                    layers: family,
                    zoom: this.zoom,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray,
                    sourceID: this.source,
                    sourceLayerIndex: this.source.indexOf(layer.id)
                }
                let bucket = buckets[layer.id] = layer.createBucket(params);
                bucket.populateColumnar(featureTable, options, this.tileID.canonical);
            }
        }
        const stacks: {
            [_: string]: Array<number>
        } = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
        this.inFlightDependencies.forEach((request) => request?.abort());
        this.inFlightDependencies = [];
        let getGlyphsPromise = Promise.resolve<GetGlyphsResponse>({});
        if (Object.keys(stacks).length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getGlyphsPromise = actor.sendAsync({
                type: MessageType.getGlyphs,
                data: {stacks, source: this.source, tileID: this.tileID, type: 'glyphs'}
            }, abortController);
        }
        const icons = Object.keys(options.iconDependencies);

        let getIconsPromise = Promise.resolve<GetImagesResponse>({});
        if (icons.length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getIconsPromise = actor.sendAsync({
                type: MessageType.getImages,
                data: {icons, source: this.source, tileID: this.tileID, type: 'icons'}
            }, abortController);
        }

        const patterns = Object.keys(options.patternDependencies);
        let getPatternsPromise = Promise.resolve<GetImagesResponse>({});
        if (patterns.length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getPatternsPromise = actor.sendAsync({
                type: MessageType.getImages,
                data: {icons: patterns, source: this.source, tileID: this.tileID, type: 'patterns'}
            }, abortController);
        }

        const [glyphMap, iconMap, patternMap] = await Promise.all([getGlyphsPromise, getIconsPromise, getPatternsPromise]);
        const glyphAtlas = new GlyphAtlas(glyphMap);
        const imageAtlas = new ImageAtlas(iconMap, patternMap);

        for (const key in buckets) {
            const bucket = buckets[key];
            if (bucket instanceof ColumnarSymbolBucket) {
                recalculateLayers(bucket.layers, this.zoom, availableImages);
                performSymbolLayout({
                    bucket: bucket,
                    glyphMap,
                    glyphPositions: glyphAtlas.positions,
                    imageMap: iconMap,
                    imagePositions: imageAtlas.iconPositions,
                    showCollisionBoxes: this.showCollisionBoxes,
                    canonical: this.tileID.canonical
                } as any);
            } else if (bucket.hasDependencies &&
                (bucket instanceof LineBucket ||
                    bucket instanceof FillBucket ||
                    bucket instanceof FillExtrusionBucket)) {
                recalculateLayers(bucket.layers, this.zoom, availableImages);
                bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions);
            }
        }
        this.status = 'done';
        return {
            buckets: Object.values(buckets).filter(b => !b.isEmpty()),
            featureIndex,
            collisionBoxArray: this.collisionBoxArray,
            glyphAtlasImage: glyphAtlas.image,
            imageAtlas,
            // Only used for benchmarking:
            glyphMap: this.returnDependencies ? glyphMap : null,
            iconMap: this.returnDependencies ? iconMap : null,
            glyphPositions: this.returnDependencies ? glyphAtlas.positions : null
        } as any;
    }

}

function recalculateLayers(layers: ReadonlyArray<StyleLayer>, zoom: number, availableImages: Array<string>) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new EvaluationParameters(zoom);
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}
