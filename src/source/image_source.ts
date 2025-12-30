import {CanonicalTileID} from '../tile/tile_id';
import {Event, ErrorEvent, Evented} from '../util/evented';
import {ImageRequest} from '../util/image_request';
import {ResourceType} from '../util/request_manager';
import {Texture} from '../render/texture';
import {MercatorCoordinate} from '../geo/mercator_coordinate';

import type {Source} from './source';
import type {CanvasSourceSpecification} from './canvas_source';
import type {Map} from '../ui/map';
import type {Dispatcher} from '../util/dispatcher';
import type {Tile} from '../tile/tile';
import type {
    ImageSourceSpecification,
    VideoSourceSpecification
} from '@maplibre/maplibre-gl-style-spec';
import type Point from '@mapbox/point-geometry';
import {MAX_TILE_ZOOM} from '../util/util';
import {Bounds} from '../geo/bounds';
import {isAbortError} from '../util/abort_error';

/**
 * Four geographical coordinates,
 * represented as arrays of longitude and latitude numbers, which define the corners of the image.
 * The coordinates start at the top left corner of the image and proceed in clockwise order.
 * They do not have to represent a rectangle.
 */
export type Coordinates = [[number, number], [number, number], [number, number], [number, number]];

/**
 * The options object for the {@link ImageSource.updateImage} method
 */
export type UpdateImageOptions = {
    /**
     * Required image URL.
     */
    url: string;
    /**
     * The image coordinates
     */
    coordinates?: Coordinates;
};

export type CanonicalTileRange = {
    minTileY: number;
    maxTileY: number;

    /**
     * Image can exceed the boundary of a single "world" (tile 0/0/0),
     * so we need to know the tile range for wrapping.
     */
    minTileXWrapped: number;
    maxTileXWrapped: number;
    minWrap: number;
    maxWrap: number;
};

/**
 * A data source containing an image.
 * (See the [Style Specification](https://maplibre.org/maplibre-style-spec/#sources-image) for detailed documentation of options.)
 *
 * @group Sources
 *
 * @example
 * ```ts
 * // add to map
 * map.addSource('some id', {
 *    type: 'image',
 *    url: 'https://www.maplibre.org/images/foo.png',
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ]
 * });
 *
 * // update coordinates
 * let mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * // update url and coordinates simultaneously
 * mySource.updateImage({
 *    url: 'https://www.maplibre.org/images/bar.png',
 *    coordinates: [
 *        [-76.54335737228394, 39.18579907229748],
 *        [-76.52803659439087, 39.1838364847587],
 *        [-76.5295386314392, 39.17683392507606],
 *        [-76.54520273208618, 39.17876344106642]
 *    ]
 * })
 *
 * map.removeSource('some id');  // remove
 * ```
 */
export class ImageSource extends Evented implements Source {
    type: string;
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    url: string;
    /**
     * This object is used to store the range of terrain tiles that overlap with this tile.
     * It is relevant for image tiles, as the image exceeds single tile boundaries.
     */
    terrainTileRanges: {[zoom: string]: CanonicalTileRange};

    coordinates: Coordinates;
    tiles: {[_: string]: Tile};
    options: any;
    dispatcher: Dispatcher;
    map: Map;
    texture: Texture | null;
    image: HTMLImageElement | ImageBitmap;
    tileID: CanonicalTileID;
    tileCoords: Array<Point>;
    flippedWindingOrder: boolean = false;
    _loaded: boolean;
    _request: AbortController;

    /** @internal */
    constructor(id: string, options: ImageSourceSpecification | VideoSourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.coordinates = options.coordinates;

        this.type = 'image';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.tiles = {};
        this._loaded = false;

        this.setEventedParent(eventedParent);

        this.options = options;
    }

    async load(newCoordinates?: Coordinates): Promise<void> {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));

        this.url = this.options.url;

        this._request = new AbortController();
        try {
            const image = await ImageRequest.getImage(this.map._requestManager.transformRequest(this.url, ResourceType.Image), this._request);
            this._request = null;
            this._loaded = true;

            if (image && image.data) {
                this.image = image.data;
                if (newCoordinates) {
                    this.coordinates = newCoordinates;
                }
                this._finishLoading();
            }
        } catch (err) {
            this._request = null;
            this._loaded = true;
            if (!isAbortError(err)) {
                this.fire(new ErrorEvent(err));
            }
        }
    }

    loaded(): boolean {
        return this._loaded;
    }

    /**
     * Updates the image URL and, optionally, the coordinates. To avoid having the image flash after changing,
     * set the `raster-fade-duration` paint property on the raster layer to 0.
     *
     * @param options - The options object.
     */
    updateImage(options: UpdateImageOptions): this {
        if (!options.url) {
            return this;
        }

        if (this._request) {
            this._request.abort();
            this._request = null;
        }

        this.options.url = options.url;
        this.load(options.coordinates).finally(() => { this.texture = null; });
        return this;
    }

    _finishLoading() {
        if (this.map) {
            this.setCoordinates(this.coordinates);
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        }
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    onRemove() {
        if (this._request) {
            this._request.abort();
            this._request = null;
        }
    }

    /**
     * Sets the image's coordinates and re-renders the map.
     *
     * @param coordinates - Four geographical coordinates,
     * represented as arrays of longitude and latitude numbers, which define the corners of the image.
     * The coordinates start at the top left corner of the image and proceed in clockwise order.
     * They do not have to represent a rectangle.
     */
    setCoordinates(coordinates: Coordinates): this {
        this.coordinates = coordinates;

        // Calculate which mercator tile is suitable for rendering the video in
        // and create a buffer with the corner coordinates. These coordinates
        // may be outside the tile, because raster tiles aren't clipped when rendering.

        // transform the geo coordinates into (zoom 0) tile space coordinates
        const cornerCoords = coordinates.map(MercatorCoordinate.fromLngLat);

        // Compute the coordinates of the tile we'll use to hold this image's
        // render data
        this.tileID = getCoordinatesCenterTileID(cornerCoords);

        // Compute tiles overlapping with the image. We need to know for which
        // terrain tiles we have to render the image.
        this.terrainTileRanges = this._getOverlappingTileRanges(cornerCoords);

        // Constrain min/max zoom to our tile's zoom level in order to force
        // TileManager to request this tile (no matter what the map's zoom
        // level)
        this.minzoom = this.maxzoom = this.tileID.z;

        // Transform the corner coordinates into the coordinate space of our
        // tile.
        this.tileCoords = cornerCoords.map((coord) => this.tileID.getTilePoint(coord)._round());
        this.flippedWindingOrder = hasWrongWindingOrder(this.tileCoords);

        this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
        return this;
    }

    prepare() {
        if (Object.keys(this.tiles).length === 0 || !this.image) {
            return;
        }

        const context = this.map.painter.context;
        const gl = context.gl;

        if (!this.texture) {
            this.texture = new Texture(context, this.image, gl.RGBA);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }

        let newTilesLoaded = false;
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
                newTilesLoaded = true;
            }
        }

        if (newTilesLoaded) {
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'idle', sourceId: this.id}));
        }
    }

    async loadTile(tile: Tile): Promise<void> {
        // We have a single tile -- whose coordinates are this.tileID -- that
        // covers the image we want to render.  If that's the one being
        // requested, set it up with the image; otherwise, mark the tile as
        // `errored` to indicate that we have no data for it.
        // If the world wraps, we may have multiple "wrapped" copies of the
        // single tile.
        if (this.tileID && this.tileID.equals(tile.tileID.canonical)) {
            this.tiles[String(tile.tileID.wrap)] = tile;
            tile.buckets = {};
        } else {
            tile.state = 'errored';
        }
    }

    serialize(): ImageSourceSpecification | VideoSourceSpecification | CanvasSourceSpecification {
        return {
            type: 'image',
            url: this.options.url,
            coordinates: this.coordinates
        };
    }

    hasTransition() {
        return false;
    }

    /**
     * Given a list of coordinates, determine overlapping tile ranges for all zoom levels.
     *
     * @returns Overlapping tile ranges for all zoom levels.
     * @internal
     */
    private _getOverlappingTileRanges(
        coords: Array<MercatorCoordinate>
    ): {[zoom: string]: CanonicalTileRange} {
        const {minX, minY, maxX, maxY} = Bounds.fromPoints(coords);

        const ranges: {[zoom: string]: CanonicalTileRange} = {};

        for (let z = 0; z <= MAX_TILE_ZOOM; z++) {
            const tilesAtZoom = Math.pow(2, z);
            const minTileX = Math.floor(minX * tilesAtZoom);
            const minTileY = Math.floor(minY * tilesAtZoom);
            const maxTileX = Math.floor(maxX * tilesAtZoom);
            const maxTileY = Math.floor(maxY * tilesAtZoom);

            const minTileXWrapped = ((minTileX % tilesAtZoom) + tilesAtZoom) % tilesAtZoom;
            const maxTileXWrapped = maxTileX % tilesAtZoom;
            const minWrap = Math.floor(minTileX / tilesAtZoom);
            const maxWrap = Math.floor(maxTileX / tilesAtZoom);

            ranges[z] = {
                minWrap,
                maxWrap,
                minTileXWrapped,
                maxTileXWrapped,
                minTileY,
                maxTileY
            };
        }

        return ranges;
    }
}

/**
 * Given a list of coordinates, get their center as a coordinate.
 *
 * @returns centerpoint
 * @internal
 */
export function getCoordinatesCenterTileID(coords: Array<MercatorCoordinate>) {
    const bounds = Bounds.fromPoints(coords);

    const dx = bounds.width();
    const dy = bounds.height();
    const dMax = Math.max(dx, dy);
    const zoom = Math.max(0, Math.floor(-Math.log(dMax) / Math.LN2));
    const tilesAtZoom = Math.pow(2, zoom);

    return new CanonicalTileID(
        zoom,
        Math.floor((bounds.minX + bounds.maxX) / 2 * tilesAtZoom),
        Math.floor((bounds.minY + bounds.maxY) / 2 * tilesAtZoom));
}

function hasWrongWindingOrder(coords: Array<Point>) {
    const e0x = coords[1].x - coords[0].x;
    const e0y = coords[1].y - coords[0].y;
    const e1x = coords[2].x - coords[0].x;
    const e1y = coords[2].y - coords[0].y;

    const crossProduct = e0x * e1y - e0y * e1x;

    return crossProduct < 0;
}
