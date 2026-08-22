import {FeatureIndex} from '../data/feature_index.ts';
import {performSymbolLayout} from '../symbol/symbol_layout.ts';
import {CollisionBoxArray} from '../data/array_types.g.ts';
import {DictionaryCoder} from '../util/dictionary_coder.ts';
import {SymbolBucket} from '../data/bucket/symbol_bucket.ts';
import {LineBucket} from '../data/bucket/line_bucket.ts';
import {FillBucket} from '../data/bucket/fill_bucket.ts';
import {FillExtrusionBucket} from '../data/bucket/fill_extrusion_bucket.ts';
import {warnOnce, mapObject} from '../util/util.ts';
import {ImageAtlas} from '../render/image_atlas.ts';
import {GlyphAtlas} from '../render/glyph_atlas.ts';
import {EvaluationParameters} from '../style/evaluation_parameters.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';

import type {Bucket} from '../data/bucket.ts';
import type {IActor} from '../util/actor.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';
import type {
    WorkerTileParameters,
    WorkerTileResult,
} from './worker_source.ts';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTileLike} from '@maplibre/vt-pbf';
import {type GetDashesResponse, MessageType, type GetGlyphsResponse, type GetImagesResponse} from '../util/actor_messages.ts';
import type {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import type {StyleGlyph} from '../style/style_glyph.ts';

type GlyphPromise = Promise<StyleGlyph | undefined>;
type GlyphPromiseCache = Map<string, Map<number, GlyphPromise>>;

const glyphPromiseCaches = new WeakMap<IActor, GlyphPromiseCache>();

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        let active = true;
        const abort = () => {
            active = false;
            signal.removeEventListener('abort', abort);
        };
        signal.addEventListener('abort', abort, {once: true});
        promise.then((value) => {
            if (!active) return;
            signal.removeEventListener('abort', abort);
            resolve(value);
        }, (error) => {
            if (!active) return;
            signal.removeEventListener('abort', abort);
            reject(error);
        });
    });
}

function getGlyphs(actor: IActor, stacks: {[stack: string]: number[]}, source: string, tileID: OverscaledTileID, signal: AbortSignal): Promise<GetGlyphsResponse> {
    let cache = glyphPromiseCaches.get(actor);
    if (!cache) {
        cache = new Map();
        glyphPromiseCaches.set(actor, cache);
    }

    const missing: {[stack: string]: number[]} = {};
    const deferred: Array<{
        stack: string;
        id: number;
        key: string;
        promise: GlyphPromise;
        resolve: (glyph: StyleGlyph | undefined) => void;
        reject: (error: unknown) => void;
    }> = [];
    const requested: Array<{stack: string; id: number; promise: GlyphPromise}> = [];

    for (const stack in stacks) {
        const key = `${source}\0${stack}`;
        let stackCache = cache.get(key);
        if (!stackCache) {
            stackCache = new Map();
            cache.set(key, stackCache);
        }
        for (const id of stacks[stack]) {
            let promise = stackCache.get(id);
            if (!promise) {
                let resolve!: (glyph: StyleGlyph | undefined) => void;
                let reject!: (error: unknown) => void;
                promise = new Promise<StyleGlyph | undefined>((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                stackCache.set(id, promise);
                (missing[stack] ||= []).push(id);
                deferred.push({stack, id, key, promise, resolve, reject});
            }
            requested.push({stack, id, promise});
        }
    }

    if (deferred.length) {
        // Glyphs are shared by concurrently parsed tiles, so this request must
        // outlive cancellation of any individual tile.
        const abortController = new AbortController();
        actor.sendAsync({type: MessageType.getGlyphs, data: {stacks: missing, source, tileID, type: 'glyphs'}}, abortController)
            .then((response) => {
                for (const entry of deferred) entry.resolve(response[entry.stack]?.[entry.id]);
            }, (error: unknown) => {
                for (const entry of deferred) entry.reject(error);
            })
            .finally(() => {
                for (const entry of deferred) {
                    const stackCache = cache.get(entry.key);
                    if (stackCache?.get(entry.id) === entry.promise) stackCache.delete(entry.id);
                    if (stackCache?.size === 0) cache.delete(entry.key);
                }
            });
    }

    return abortable(Promise.all(requested.map(async ({stack, id, promise}) => ({stack, id, glyph: await promise}))), signal)
        .then((glyphs) => {
            const result: GetGlyphsResponse = {};
            for (const {stack, id, glyph} of glyphs) {
                if (!glyph) continue;
                (result[stack] ||= {})[id] = glyph;
            }
            return result;
        });
}

export class WorkerTile {
    tileID: OverscaledTileID;
    uid: string | number;
    zoom: number;
    pixelRatio: number;
    tileSize: number;
    source: string;
    promoteId: PromoteIdSpecification;
    overscaling: number;
    showCollisionBoxes: boolean;
    collectResourceTiming: boolean;
    returnDependencies: boolean;

    data: VectorTileLike;
    collisionBoxArray: CollisionBoxArray;

    abort: AbortController;
    vectorTile: VectorTileLike;
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

    async parse(data: VectorTileLike, layerIndex: StyleLayerIndex, availableImages: string[], actor: IActor, subdivisionGranularity: SubdivisionGranularitySetting): Promise<WorkerTileResult> {
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

        const featureIndex = new FeatureIndex(this.tileID, this.promoteId);
        featureIndex.bucketLayerIDs = [];

        const buckets: {[_: string]: Bucket} = {};

        const options = {
            featureIndex,
            iconDependencies: {},
            patternDependencies: {},
            glyphDependencies: {},
            dashDependencies: {},
            availableImages,
            subdivisionGranularity
        };

        const layerFamilies = layerIndex.familiesBySource[this.source];
        for (const sourceLayerId in layerFamilies) {
            const sourceLayer = data.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }

            if (sourceLayer.version === 1) {
                warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                    'does not use vector tile spec v2 and therefore may have some rendering errors.');
            }

            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                const id = featureIndex.getId(feature, sourceLayerId);
                features.push({feature, id, index, sourceLayerIndex});
            }

            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];

                if (layer.source !== this.source) {
                    warnOnce(`layer.source = ${layer.source} does not equal this.source = ${this.source}`);
                }
                if (layer.isHidden(this.zoom, true)) continue;
                recalculateLayers(family, this.zoom, availableImages);

                const bucket = buckets[layer.id] = layer.createBucket({
                    index: featureIndex.bucketLayerIDs.length,
                    layers: family,
                    zoom: this.zoom,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray,
                    sourceLayerIndex,
                    sourceID: this.source
                });

                bucket.populate(features, options, this.tileID.canonical);
                featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
            }
        }

        // options.glyphDependencies looks like: {"SomeFontName":{"10":true,"32":true}}
        // this line makes an object like: {"SomeFontName":[10,32]}
        const stacks: {[_: string]: number[]} = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));

        for (const request of this.inFlightDependencies) {
            request?.abort();
        }
        this.inFlightDependencies = [];

        let getGlyphsPromise = Promise.resolve<GetGlyphsResponse>({});
        if (Object.keys(stacks).length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getGlyphsPromise = getGlyphs(actor, stacks, this.source, this.tileID, abortController.signal);
        }

        const icons = Object.keys(options.iconDependencies);
        let getIconsPromise = Promise.resolve<GetImagesResponse>({});
        if (icons.length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getIconsPromise = actor.sendAsync({type: MessageType.getImages, data: {icons, source: this.source, tileID: this.tileID, type: 'icons'}}, abortController);
        }

        const patterns = Object.keys(options.patternDependencies);
        let getPatternsPromise = Promise.resolve<GetImagesResponse>({});
        if (patterns.length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getPatternsPromise = actor.sendAsync({type: MessageType.getImages, data: {icons: patterns, source: this.source, tileID: this.tileID, type: 'patterns'}}, abortController);
        }

        const dashes = options.dashDependencies;
        let getDashesPromise = Promise.resolve<GetDashesResponse>({} as GetDashesResponse);
        if (Object.keys(dashes).length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getDashesPromise = actor.sendAsync({type: MessageType.getDashes, data: {dashes}}, abortController);
        }

        const [glyphMap, iconMap, patternMap, dashPositions] = await Promise.all([getGlyphsPromise, getIconsPromise, getPatternsPromise, getDashesPromise]);

        const glyphAtlas = new GlyphAtlas(glyphMap);
        const imageAtlas = new ImageAtlas(iconMap, patternMap);

        for (const key in buckets) {
            const bucket = buckets[key];
            if (bucket instanceof SymbolBucket) {
                recalculateLayers(bucket.layers, this.zoom, availableImages);
                performSymbolLayout({
                    bucket,
                    glyphMap,
                    glyphPositions: glyphAtlas.positions,
                    imageMap: iconMap,
                    imagePositions: imageAtlas.iconPositions,
                    showCollisionBoxes: this.showCollisionBoxes,
                    canonical: this.tileID.canonical,
                    subdivisionGranularity: options.subdivisionGranularity
                });
            } else if (bucket.hasDependencies && (bucket instanceof FillBucket || bucket instanceof FillExtrusionBucket || bucket instanceof LineBucket)) {
                recalculateLayers(bucket.layers, this.zoom, availableImages);
                bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions, dashPositions);
            }
        }

        return {
            buckets: Object.values(buckets).filter(b => !b.isEmpty()),
            featureIndex,
            collisionBoxArray: this.collisionBoxArray,
            glyphAtlasImage: glyphAtlas.image,
            imageAtlas,
            dashPositions,
            // Only used for benchmarking:
            glyphMap: this.returnDependencies ? glyphMap : null,
            iconMap: this.returnDependencies ? iconMap : null,
            glyphPositions: this.returnDependencies ? glyphAtlas.positions : null
        };
    }
}

function recalculateLayers(layers: readonly StyleLayer[], zoom: number, availableImages: string[]) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new EvaluationParameters(zoom);
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}
