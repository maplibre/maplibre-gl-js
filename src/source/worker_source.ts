import type {ExpiryData, RequestParameters} from '../util/ajax';
import type {RGBAImage, AlphaImage} from '../util/image';
import type {GlyphPositions} from '../render/glyph_atlas';
import type {ImageAtlas} from '../render/image_atlas';
import type {CanonicalTileID, OverscaledTileID} from '../tile/tile_id';
import type {Bucket} from '../data/bucket';
import type {FeatureIndex} from '../data/feature_index';
import type {CollisionBoxArray} from '../data/array_types.g';
import type {DEMEncoding} from '../data/dem_data';
import type {StyleGlyph} from '../style/style_glyph';
import type {StyleImage} from '../style/style_image';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {RemoveSourceParams} from '../util/actor_messages';
import type {IActor} from '../util/actor';
import type {StyleLayerIndex} from '../style/style_layer_index';
import type {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';
import type {DashEntry} from '../render/line_atlas';

/**
 * Parameters to identify a tile
 */
export type TileParameters = {
    type: string;
    source: string;
    uid: string | number;
};

/**
 * Parameters that are send when requesting to load a tile to the worker
 */
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
    subdivisionGranularity: SubdivisionGranularitySetting;
    encoding?: string;
    /**
     * Provide this property when the requested tile has a higher canonical Z than source maxzoom.
     * This allows the worker to know that it needs to overzoom from a source tile.
     */
    overzoomParameters?: OverzoomParameters;
};

/**
 * Parameters needed in order to load a tile that is overzoomed from a source tile
 */
export type OverzoomParameters = {
    maxZoomTileID: CanonicalTileID;
    overzoomRequest: RequestParameters;
};

/**
 * The parameters needed in order to load a DEM tile
 */
export type WorkerDEMTileParameters = TileParameters & {
    rawImageData: RGBAImage | ImageBitmap | ImageData;
    encoding: DEMEncoding;
    redFactor: number;
    greenFactor: number;
    blueFactor: number;
    baseShift: number;
};

/**
 * The worker tile's result type
 */
export type WorkerTileResult = ExpiryData & {
    buckets: Array<Bucket>;
    imageAtlas: ImageAtlas;
    dashPositions: Record<string, DashEntry>;
    glyphAtlasImage: AlphaImage;
    featureIndex: FeatureIndex;
    collisionBoxArray: CollisionBoxArray;
    rawTileData?: ArrayBuffer;
    encoding?: string;
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

/**
 * This is how the @see {@link WorkerSource} constructor should look like.
 */
export interface WorkerSourceConstructor {
    new (actor: IActor, layerIndex: StyleLayerIndex, availableImages: Array<string>): WorkerSource;
}

/**
 * `WorkerSource` should be implemented by custom source types to provide code that can be run on the WebWorkers.
 * Each of the methods has a relevant event that triggers it from the main thread with the relevant parameters.
 * @see {@link Map.addSourceType}
 */
export interface WorkerSource {
    availableImages: Array<string>;

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering.  Should call the callback with:
     * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
     */
    loadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    /**
     * Re-parses a tile that has already been loaded.  Yields the same data as
     * {@link WorkerSource.loadTile}.
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
    removeSource?: (params: RemoveSourceParams) => Promise<void>;
}
