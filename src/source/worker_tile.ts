import {FeatureIndex} from '../data/feature_index';
import {performSymbolLayout} from '../symbol/symbol_layout';
import {CollisionBoxArray} from '../data/array_types.g';
import {DictionaryCoder} from '../util/dictionary_coder';
import {SymbolBucket} from '../data/bucket/symbol_bucket';
import {LineBucket} from '../data/bucket/line_bucket';
import {FillBucket} from '../data/bucket/fill_bucket';
import {FillExtrusionBucket} from '../data/bucket/fill_extrusion_bucket';
import {warnOnce, mapObject} from '../util/util';
import {ImageAtlas} from '../render/image_atlas';
import {GlyphAtlas} from '../render/glyph_atlas';
import {EvaluationParameters} from '../style/evaluation_parameters';
import {OverscaledTileID} from '../tile/tile_id';

import type {Bucket, BucketParameters} from '../data/bucket';
import type {IActor} from '../util/actor';
import type {StyleLayer} from '../style/style_layer';
import type {StyleLayerIndex} from '../style/style_layer_index';
import type {
    WorkerTileParameters,
    WorkerTileResult,
} from '../source/worker_source';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTile} from '@mapbox/vector-tile';
import {type GetDashesResponse, MessageType, type GetGlyphsResponse, type GetImagesResponse} from '../util/actor_messages';
import type {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';
import {type FeatureTable} from '@maplibre/mlt';
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

    status: 'parsing' | 'done';
    data: VectorTile;
    collisionBoxArray: CollisionBoxArray;

    abort: AbortController;
    vectorTile: VectorTile;
    inFlightDependencies: AbortController[];
    private ColumnarSymbolBucket: Bucket;

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

    async parse(
        data: VectorTile,
        layerIndex: StyleLayerIndex,
        availableImages: Array<string>,
        actor: IActor,
        subdivisionGranularity?: SubdivisionGranularitySetting,
        _encoding?: string,
        featureTables?: FeatureTable[]
    ): Promise<WorkerTileResult> {
        this.status = 'parsing';
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();

        // Determine if MLT encoding is being used
        const isMltEncoding = _encoding === 'mlt' && featureTables !== undefined;

        // Source layer coder based on data type
        const sourceLayerCoder = isMltEncoding
            ? new DictionaryCoder(featureTables.map(ft => ft.name).sort())
            : new DictionaryCoder(Object.keys(data.layers).sort());

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
            subdivisionGranularity,
        };

        const layerFamilies = layerIndex.familiesBySource[this.source];

        for (const featureTableId in layerFamilies) {
            // Get source layer data
            let rawFeatureTable: FeatureTable | undefined; // Raw columnar data for ColumnarBuckets
            let vectorTileLayer: VectorTile['layers'][string]; // Wrapped MVT-like data for traditional buckets
            let sourceLayerIndex: number;

            if (isMltEncoding) {
                // For MLT: keep both raw FeatureTable and wrapped VectorTileLayer
                rawFeatureTable = featureTables.find(f => f.name === featureTableId);
                if (!rawFeatureTable) continue;

                // Also get the wrapped layer for traditional buckets
                vectorTileLayer = data.layers[featureTableId];
                if (!vectorTileLayer) continue;

                sourceLayerIndex = sourceLayerCoder.encode(featureTableId);
            } else {
                // For PBF: only VectorTileLayer exists
                vectorTileLayer = data.layers[featureTableId];
                if (!vectorTileLayer) continue;

                // Version check only for VectorTile
                if (vectorTileLayer.version === 1) {
                    warnOnce(`Vector tile source "${this.source}" layer "${featureTableId}" ` +
                        'does not use vector tile spec v2 and therefore may have some rendering errors.');
                }
                sourceLayerIndex = sourceLayerCoder.encode(featureTableId);
            }

            // Prepare features (for non-columnar buckets)
            const features = [];
            for (let index = 0; index < vectorTileLayer.length; index++) {
                const feature = vectorTileLayer.feature(index);
                const id = featureIndex.getId(feature, featureTableId);
                features.push({feature, id, index, sourceLayerIndex});
            }

            // Process layer families
            for (const family of layerFamilies[featureTableId]) {
                const layer = family[0];

                if (layer.source !== this.source) {
                    warnOnce(`layer.source = ${layer.source} does not equal this.source = ${this.source}`);
                }

                // Visibility check
                if (isMltEncoding) {
                    if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) continue;
                    if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
                    if (layer.visibility === 'none') continue;
                } else {
                    if (layer.isHidden(this.zoom, true)) continue;
                }

                recalculateLayers(family, this.zoom, availableImages);

                // Assemble bucket parameters
                const bucketParams: BucketParameters<any> = {
                    index: featureIndex.bucketLayerIDs.length,
                    layers: family,
                    zoom: this.zoom,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray,
                    sourceLayerIndex,
                    sourceID: this.source,
                    ...(isMltEncoding && {_encoding: 'mlt'}),
                    ...(!isMltEncoding && _encoding && {_encoding})
                };

                const bucket = layer.createBucket(bucketParams);

                // Some layer types (background, raster, etc.) don't have buckets
                if (!bucket) continue;

                buckets[layer.id] = bucket;

                // Choose populate method based on bucket capabilities
                // If bucket has populateColumnar AND we have raw MLT data, use it
                if (isMltEncoding && rawFeatureTable && 'populateColumnar' in bucket) {
                    bucket.populateColumnar(rawFeatureTable, options, this.tileID.canonical);
                } else {
                    // Traditional buckets or fallback for MLT
                    bucket.populate(features, options, this.tileID.canonical);
                }

                if (!isMltEncoding) {
                    featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
                }
            }
        }

        // Collect dependencies
        const stacks: {[_: string]: Array<number>} = mapObject(
            options.glyphDependencies,
            (glyphs) => Object.keys(glyphs).map(Number)
        );

        this.inFlightDependencies.forEach((request) => request?.abort());
        this.inFlightDependencies = [];

        // Load glyphs
        let getGlyphsPromise = Promise.resolve<GetGlyphsResponse>({});
        if (Object.keys(stacks).length) {
            const abortController = new AbortController();
            this.inFlightDependencies.push(abortController);
            getGlyphsPromise = actor.sendAsync({
                type: MessageType.getGlyphs,
                data: {stacks, source: this.source, tileID: this.tileID, type: 'glyphs'}
            }, abortController);
        }

        // Load icons
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

        // Load patterns
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

        // Load dashes (only for non-MLT)
        let getDashesPromise = Promise.resolve<GetDashesResponse>({} as GetDashesResponse);
        if (!isMltEncoding) {
            const dashes = options.dashDependencies;
            if (Object.keys(dashes).length) {
                const abortController = new AbortController();
                this.inFlightDependencies.push(abortController);
                getDashesPromise = actor.sendAsync({
                    type: MessageType.getDashes,
                    data: {dashes}
                }, abortController);
            }
        }

        // Resolve all promises
        const [glyphMap, iconMap, patternMap, dashPositions] = await Promise.all([
            getGlyphsPromise,
            getIconsPromise,
            getPatternsPromise,
            getDashesPromise
        ]);

        const glyphAtlas = new GlyphAtlas(glyphMap);
        const imageAtlas = new ImageAtlas(iconMap, patternMap);

        // Bucket post-processing
        for (const key in buckets) {
            const bucket = buckets[key];

            // Symbol buckets || bucket instanceof ColumnarSymbolBucket
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
                    ...(subdivisionGranularity && {subdivisionGranularity})
                } as any);
            }
            // Pattern buckets
            else if (bucket.hasDependencies &&
                (bucket instanceof FillBucket ||
                    bucket instanceof FillExtrusionBucket ||
                    bucket instanceof LineBucket)) {
                recalculateLayers(bucket.layers, this.zoom, availableImages);

                // Pass dashPositions only for non-MLT
                if (isMltEncoding) {
                    bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions);
                } else {
                    bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions, dashPositions);
                }
            }
        }

        this.status = 'done';

        return {
            buckets: Object.values(buckets).filter(b => !b.isEmpty()),
            featureIndex,
            collisionBoxArray: this.collisionBoxArray,
            glyphAtlasImage: glyphAtlas.image,
            imageAtlas,
            ...(!isMltEncoding && {dashPositions}),
            // Only for benchmarking:
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
