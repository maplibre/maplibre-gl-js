import {VectorTileSource} from '../source/vector_tile_source';
import {RasterTileSource} from '../source/raster_tile_source';
import {RasterDEMTileSource} from '../source/raster_dem_tile_source';
import {GeoJSONSource} from '../source/geojson_source';
import {VideoSource} from '../source/video_source';
import {ImageSource} from '../source/image_source';
import {CanvasSource} from '../source/canvas_source';

import type {SourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Dispatcher} from '../util/dispatcher';
import type {Event, Evented} from '../util/evented';
import type {Map} from '../ui/map';
import type {Tile} from './tile';
import type {OverscaledTileID, CanonicalTileID} from './tile_id';
import type {Callback} from '../types/callback';
import type {CanvasSourceSpecification} from '../source/canvas_source';

const registeredSources = {} as {[key:string]: SourceClass};

/**
 * The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`,
 * `video`, etc.) and all custom, third-party types.
 *
 * @event `data` - Fired with `{dataType: 'source', sourceDataType: 'metadata'}` to indicate that any necessary metadata
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
    minzoom: number;
    maxzoom: number;
    tileSize: number;
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
    hasTransition(): boolean;
    loaded(): boolean;
    fire(event: Event): unknown;
    readonly onAdd?: (map: Map) => void;
    readonly onRemove?: (map: Map) => void;
    loadTile(tile: Tile, callback: Callback<void>): void;
    readonly hasTile?: (tileID: OverscaledTileID) => boolean;
    readonly abortTile?: (tile: Tile, callback: Callback<void>) => void;
    readonly unloadTile?: (tile: Tile, callback: Callback<void>) => void;
    /**
     * @returns A plain (stringifiable) JS object representing the current state of the source.
     * Creating a source using the returned object as the `options` should result in a Source that is
     * equivalent to this one.
     */
    serialize(): any;
    readonly prepare?: () => void;
}

/**
 * A supporting type to the source definition
 */
type SourceStatics = {
    /*
     * An optional URL to a script which, when run by a Worker, registers a {@link WorkerSource}
     * implementation for this Source type by calling `self.registerWorkerSource(workerSource: WorkerSource)`.
     */
    workerSourceURL?: URL;
};

/**
 * A general definition of a {@link Source} class for factory usage
 */
export type SourceClass = {
    new (id: string, specification: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented): Source;
} & SourceStatics;

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

export const getSourceType = (name: string): SourceClass => {
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

export const setSourceType = (name: string, type: SourceClass) => {
    registeredSources[name] = type;
};

export interface Actor {
    send(type: string, data: any, callback: Callback<any>): void;
}
