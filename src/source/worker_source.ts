import type {RequestParameters} from '../util/ajax';
import type {RGBAImage, AlphaImage} from '../util/image';
import type {GlyphPositions} from '../render/glyph_atlas';
import type {ImageAtlas} from '../render/image_atlas';
import type {OverscaledTileID} from './tile_id';
import type {Bucket} from '../data/bucket';
import type {FeatureIndex} from '../data/feature_index';
import type {CollisionBoxArray} from '../data/array_types.g';
import type {DEMEncoding} from '../data/dem_data';
import type {StyleGlyph} from '../style/style_glyph';
import type {StyleImage} from '../style/style_image';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import {RemoveSourceParams as RemoveSourceParameters} from '../util/actor_messages';

export type TileParameters = {
    type: string;
    source: string;
    uid: string | number;
};

export type WorkerTileParameters = TileParameters & {
    tileID: OverscaledTileID;
    request?: RequestParameters;
    zoom: number;
    maxZoom?: number;
    tileSize: number;
    promoteId: PromoteIdSpecification;
    pixelRatio: number;
    showCollisionBoxes: boolean;
    collectResourceTiming?: boolean;
    returnDependencies?: boolean;
};

export type WorkerDEMTileParameters = TileParameters & {
    rawImageData: RGBAImage | ImageBitmap;
    encoding: DEMEncoding;
    redFactor: number;
    greenFactor: number;
    blueFactor: number;
    baseShift: number;
};

/**
 * @internal
 * The worker tile's result type
 */
export type WorkerTileResult = {
    buckets: Array<Bucket>;
    imageAtlas: ImageAtlas;
    glyphAtlasImage: AlphaImage;
    featureIndex: FeatureIndex;
    collisionBoxArray: CollisionBoxArray;
    rawTileData?: ArrayBuffer;
    resourceTiming?: Array<PerformanceResourceTiming>;
    // Only used for benchmarking:
    glyphMap?: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    } | null;
    iconMap?: {
        [_: string]: StyleImage;
    } | null;
    glyphPositions?: GlyphPositions | null;
};

// HM TODO: remove this type?
export type WorkerTileCallback = (error?: Error | null, result?: WorkerTileResult | null) => void;

/**
 * May be implemented by custom source types to provide code that can be run on
 * the WebWorkers. In addition to providing a custom
 * {@link WorkerSource#loadTile}, any other methods attached to a `WorkerSource`
 * implementation may also be targeted by the {@link Source} via
 * `dispatcher.getActor().send('source-type.methodname', params, callback)`.
 *
 * @see {@link Map#addSourceType}
 */
export interface WorkerSource {
    availableImages: Array<string>;
    // Disabled due to https://github.com/facebook/flow/issues/5208
    // constructor(actor: Actor, layerIndex: StyleLayerIndex): WorkerSource;

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering.  Should call the callback with:
     * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
     */
    loadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    /**
     * Re-parses a tile that has already been loaded.  Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    /**
     * Aborts loading a tile that is in progress.
     */
    abortTile(params: TileParameters): Promise<void>;
    /**
     * Removes this tile from any local caches.
     */
    removeTile(params: TileParameters): Promise<void>;
    /**
     * Tells the WorkerSource to abort in-progress tasks and release resources.
     * The foreground Source is responsible for ensuring that 'removeSource' is
     * the last message sent to the WorkerSource.
     */
    removeSource?: (params: RemoveSourceParameters) => Promise<void>;
}
