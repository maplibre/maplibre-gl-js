import {VectorTileSource} from '../source/vector_tile_source';
import {RasterTileSource} from '../source/raster_tile_source';
import {RasterDEMTileSource} from '../source/raster_dem_tile_source';
import {GeoJSONSource} from '../source/geojson_source';
import {VideoSource} from '../source/video_source';
import {ImageSource} from '../source/image_source';
import {CanvasSource} from '../source/canvas_source';
import {Dispatcher} from '../util/dispatcher';

import type {SourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Event, Evented} from '../util/evented';
import type {Map} from '../ui/map';
import type {Tile} from './tile';
import type {OverscaledTileID, CanonicalTileID} from './tile_id';
import type {CanvasSourceSpecification} from '../source/canvas_source';

const registeredSources = {} as {[key:string]: SourceClass};

/**
 * The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`,
 * `video`, etc.) and all custom, third-party types.
 *
 * **Event** `data` - Fired with `{dataType: 'source', sourceDataType: 'metadata'}` to indicate that any necessary metadata
 * has been loaded so that it's okay to call `loadTile`; and with `{dataType: 'source', sourceDataType: 'content'}`
 * to indicate that the source data has changed, so that any current caches should be flushed.
 *
 * @group Sources
 */
export interface Source {
    readonly type: string;
    /**
     * The id for the source. Must not be used by any existing source.
     */
    id: string;
    /**
     * The minimum zoom level for the source.
     */
    minzoom: number;
    /**
     * The maximum zoom level for the source.
     */
    maxzoom: number;
    /**
     * The tile size for the source.
     */
    tileSize: number;
    /**
     * The attribution for the source.
     */
    attribution?: string;
    /**
     * `true` if zoom levels are rounded to the nearest integer in the source data, `false` if they are floor-ed to the nearest integer.
     */
    roundZoom?: boolean;
    /**
     * `false` if tiles can be drawn outside their boundaries, `true` if they cannot.
     */
    isTileClipped?: boolean;
    tileID?: CanonicalTileID;
    /**
     * `true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.
     */
    reparseOverscaled?: boolean;
    vectorLayerIds?: Array<string>;
    /**
     * True if the source has transition, false otherwise.
     */
    hasTransition(): boolean;
    /**
     * True if the source is loaded, false otherwise.
     */
    loaded(): boolean;
    /**
     * An ability to fire an event to all the listeners, see {@link Evented}
     * @param event - The event to fire
     */
    fire(event: Event): unknown;
    /**
     * This method is called when the source is added to the map.
     * @param map - The map instance
     */
    onAdd?(map: Map): void;
    /**
     * This method is called when the source is removed from the map.
     * @param map - The map instance
     */
    onRemove?(map: Map): void;
    /**
     * This method does the heavy lifting of loading a tile.
     * In most cases it will defer the work to the relevant worker source.
     * @param tile - The tile to load
     */
    loadTile(tile: Tile): Promise<void>;
    /**
     * True is the tile is part of the source, false otherwise.
     * @param tileID - The tile ID
     */
    hasTile?(tileID: OverscaledTileID): boolean;
    /**
     * Allows to abort a tile loading.
     * @param tile - The tile to abort
     */
    abortTile?(tile: Tile): Promise<void>;
    /**
     * Allows to unload a tile.
     * @param tile - The tile to unload
     */
    unloadTile?(tile: Tile): Promise<void>;
    /**
     * @returns A plain (stringifiable) JS object representing the current state of the source.
     * Creating a source using the returned object as the `options` should result in a Source that is
     * equivalent to this one.
     */
    serialize(): any;
    /**
     * Allows to execute a prepare step before the source is used.
     */
    prepare?(): void;
}

/**
 * A general definition of a {@link Source} class for factory usage
 */
export type SourceClass = {
    new (id: string, specification: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented): Source;
}

/**
 * Creates a tiled data source instance given an options object.
 *
 * @param id - The id for the source. Must not be used by any existing source.
 * @param specification - Source options, specific to the source type (except for `options.type`, which is always required).
 * @param source - A source definition object compliant with
 * [`maplibre-gl-style-spec`](https://maplibre.org/maplibre-style-spec/#sources) or, for a third-party source type,
  * with that type's requirements.
 * @param dispatcher - A {@link Dispatcher} instance, which can be used to send messages to the workers.
 * @returns a newly created source
 */
export const create = (id: string, specification: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented): Source => {

    const Class = getSourceType(specification.type);
    const source = new Class(id, specification, dispatcher, eventedParent);

    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }

    return source;
};

const getSourceType = (name: string): SourceClass => {
    switch (name) {
        case 'geojson':
            return GeoJSONSource;
        case 'image':
            return ImageSource;
        case 'raster':
            return RasterTileSource;
        case 'raster-dem':
            return RasterDEMTileSource;
        case 'vector':
            return VectorTileSource;
        case 'video':
            return VideoSource;
        case 'canvas':
            return CanvasSource;
    }
    return registeredSources[name];
};

const setSourceType = (name: string, type: SourceClass) => {
    registeredSources[name] = type;
};

/**
 * Adds a custom source type, making it available for use with {@link Map#addSource}.
 * @param name - The name of the source type; source definition objects use this name in the `{type: ...}` field.
 * @param SourceType - A {@link SourceClass} - which is a constructor for the `Source` interface.
 * @returns a promise that is resolved when the source type is ready or rejected with an error.
 */
export const addSourceType = async (name: string, SourceType: SourceClass): Promise<void> => {
    if (getSourceType(name)) {
        throw new Error(`A source type called "${name}" already exists.`);
    }
    setSourceType(name, SourceType);
};
