import {CanonicalTileID} from '../tile/tile_id.ts';
import {ErrorEvent, Evented} from '../util/evented.ts';
import {MapSourceDataEvent, type SourceEventType} from '../ui/events.ts';
import {ImageRequest} from '../util/image_request.ts';
import {ResourceType} from '../util/request_manager.ts';
import {Texture} from '../webgl/texture.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';

import type {Source} from './source.ts';
import type {CanvasSourceSpecification} from './canvas_source.ts';
import type {Map} from '../ui/map.ts';
import type {Dispatcher} from '../util/dispatcher.ts';
import type {Tile} from '../tile/tile.ts';
import type {
    ImageSourceSpecification,
    VideoSourceSpecification
} from '@maplibre/maplibre-gl-style-spec';
import type Point from '@mapbox/point-geometry';
import {ensureError, MAX_TILE_ZOOM} from '../util/util.ts';
import {Bounds} from '../geo/bounds.ts';
import {isAbortError} from '../util/abort_error.ts';
import {
    identityPerspectiveTransform,
    type RasterPerspectiveTransform
} from '../webgl/program/raster_program.ts';
import {mat2, vec3} from 'gl-matrix';

/**
 * Four geographical coordinates,
 * represented as arrays of longitude and latitude numbers, which define the corners of the image.
 * The coordinates start at the top left corner of the image and proceed in clockwise order.
 * They do not have to represent a rectangle.
 */
export type Coordinates = [[number, number], [number, number], [number, number], [number, number]];

/**
 * An already-decoded image that can be handed to an {@link ImageSource} directly,
 * without a network request.
 */
export type ImageSourceImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData;

/**
 * The options object for the {@link ImageSource.updateImage} method.
 *
 * Provide exactly one of `url` (to load an image over the network) or `image`
 * (an already-decoded image to display directly, without a network request).
 */
export type UpdateImageOptions = {
    /**
     * The image coordinates
     */
    coordinates?: Coordinates;
} & ({
    /**
     * The image URL to load.
     */
    url: string;
} | {
    /**
     * An already-decoded image (`HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap` or `ImageData`)
     * to display directly, without a network request.
     */
    image: ImageSourceImage;
});

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
 * // update with an already-decoded image (no network request)
 * const bitmap = await createImageBitmap(myCanvas);
 * mySource.updateImage({image: bitmap});
 *
 * map.removeSource('some id');  // remove
 * ```
 */
export class ImageSource extends Evented<SourceEventType> implements Source {
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
    image: ImageSourceImage;
    tileID: CanonicalTileID;
    tileCoords: Point[];
    perspectiveTransform: RasterPerspectiveTransform = identityPerspectiveTransform;
    flippedWindingOrder: boolean = false;
    _loaded: boolean;
    _abortController: AbortController;
    private _imageDirty: boolean = false;

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
        this.fire(new MapSourceDataEvent('dataloading'));

        this.url = this.options.url;

        this._abortController = new AbortController();
        try {
            const image = await ImageRequest.transformAndGetImage(this.map._requestManager, this.url, ResourceType.Image, this._abortController);
            this._abortController = null;
            this._loaded = true;

            if (image?.data) {
                this._setImage(image.data);
                if (newCoordinates) {
                    this.coordinates = newCoordinates;
                }
                this._finishLoading();
            }
        } catch (err) {
            // In case of abort error, the aborter may have started a new request so we don't want to clear its abort controller.
            if (isAbortError(err)) return;
            this._abortController = null;
            this._loaded = true;
            this.fire(new ErrorEvent(ensureError(err)));
        }
    }

    loaded(): boolean {
        return this._loaded;
    }

    /**
     * Updates the image and, optionally, the coordinates. To avoid having the image flash after changing,
     * set the `raster-fade-duration` paint property on the raster layer to 0.
     *
     * Provide exactly one of `url` (to fetch a new image over the network) or `image` (an
     * already-decoded `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap` or `ImageData` to
     * display directly, without a network request).
     *
     * @param options - The options object.
     */
    updateImage(options: UpdateImageOptions): this {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        if ('image' in options) {
            // Use the already-decoded image directly, skipping the network request.
            this._loaded = true;
            this._setImage(options.image);
            if (options.coordinates) {
                this.coordinates = options.coordinates;
            }
            this._finishLoading();
            return this;
        }

        if (!options.url) {
            return this;
        }

        this.options.url = options.url;
        this.load(options.coordinates);
        return this;
    }

    /** Loaded tiles hold `this.texture`, so the wrapper has to outlive the images in it. */
    private _setImage(image: ImageSourceImage): void {
        this.image = image;
        this._imageDirty = true;
    }

    /** Teardown only: dropping the reference alone leaves the allocation to the GC. */
    private _disposeTexture(): void {
        this.texture?.destroy();
        this.texture = null;
    }

    _finishLoading(): void {
        if (this.map) {
            this.setCoordinates(this.coordinates);
            this.fire(new MapSourceDataEvent('data', {sourceDataType: 'metadata'}));
        }
    }

    onAdd(map: Map): void {
        this.map = map;
        this.load();
    }

    onRemove(): void {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        this._disposeTexture();
        this.image = null;
        this.tiles = {};
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
        this.perspectiveTransform = calculateRasterPerspectiveTransform(this.tileCoords);
        this.flippedWindingOrder = hasWrongWindingOrder(this.tileCoords);

        this.fire(new MapSourceDataEvent('data', {sourceDataType: 'content'}));
        return this;
    }

    prepare(): void {
        if (Object.keys(this.tiles).length === 0 || !this.image) {
            return;
        }

        const context = this.map.painter.context;
        const gl = context.gl;

        if (!this.texture) {
            this.texture = new Texture(context, this.image, gl.RGBA);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        } else if (this._imageDirty) {
            this.texture.update(this.image);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
        this._imageDirty = false;

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
            this.fire(new MapSourceDataEvent('data', {sourceDataType: 'idle', sourceId: this.id}));
        }
    }

    async loadTile(tile: Tile): Promise<void> {
        // We have a single tile -- whose coordinates are this.tileID -- that
        // covers the image we want to render.  If that's the one being
        // requested, set it up with the image; otherwise, mark the tile as
        // `errored` to indicate that we have no data for it.
        // If the world wraps, we may have multiple "wrapped" copies of the
        // single tile.
        if (this.tileID?.equals(tile.tileID.canonical)) {
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
        coords: MercatorCoordinate[]
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
export function getCoordinatesCenterTileID(coords: MercatorCoordinate[]): CanonicalTileID {
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

function hasWrongWindingOrder(coords: Point[]) {
    const e0x = coords[1].x - coords[0].x;
    const e0y = coords[1].y - coords[0].y;
    const e1x = coords[2].x - coords[0].x;
    const e1y = coords[2].y - coords[0].y;

    const crossProduct = e0x * e1y - e0y * e1x;

    return crossProduct < 0;
}

const perspectiveEpsilon = Number.EPSILON;
// Allows for accumulated rounding error in the three-term homogeneous dot products.
const perspectiveErrorFactor = 8;

/**
 * Calculates the inverse-homography denominator used to sample non-affine
 * image-source texture coordinates. Image source tile coordinates are rounded
 * to integers before this runs, so singularity checks use exact zero or
 * Number.EPSILON scaled to the corner denominators.
 *
 * Based on Paul S. Heckbert, "Fundamentals of Texture Mapping and Image
 * Warping", UCB/CSD-89-516, 1989, section 2.2.3 and appendix A.2.
 *
 * @see https://www2.eecs.berkeley.edu/Pubs/TechRpts/1989/5504.html
 * @see https://www.cs.cmu.edu/~ph/texfund/texfund.pdf
 */
function calculateRasterPerspectiveTransform(cornerCoords: Point[]): RasterPerspectiveTransform {
    if (isParallelogram(cornerCoords)) {
        return identityPerspectiveTransform;
    }

    const [topLeft, topRight, bottomRight, bottomLeft] = cornerCoords;
    const sx = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
    const sy = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
    const dx1 = topRight.x - bottomRight.x;
    const dy1 = topRight.y - bottomRight.y;
    const dx2 = bottomLeft.x - bottomRight.x;
    const dy2 = bottomLeft.y - bottomRight.y;
    const basis: mat2 = [dx1, dy1, dx2, dy2];
    const determinant = mat2.determinant(basis);

    if (Math.abs(determinant) < perspectiveEpsilon) {
        return identityPerspectiveTransform;
    }

    const perspectiveX = (sx * dy2 - dx2 * sy) / determinant;
    const perspectiveY = (dx1 * sy - sx * dy1) / determinant;

    // A finite image of the unit square has positive homogeneous denominators
    // at all four corners after normalizing the top-left denominator to one.
    const forwardDenominators = [1, 1 + perspectiveX, 1 + perspectiveX + perspectiveY, 1 + perspectiveY];
    const forwardDenominatorScale = Math.max(...forwardDenominators.map(value => Math.abs(value)));
    const hasInvalidForwardDenominator = forwardDenominators.some(value =>
        !Number.isFinite(value) || value <= perspectiveErrorFactor * perspectiveEpsilon * forwardDenominatorScale);
    if (!Number.isFinite(forwardDenominatorScale) || forwardDenominatorScale === 0 || hasInvalidForwardDenominator) {
        return identityPerspectiveTransform;
    }

    const a = topRight.x - topLeft.x + perspectiveX * topRight.x;
    const b = bottomLeft.x - topLeft.x + perspectiveY * bottomLeft.x;
    const d = topRight.y - topLeft.y + perspectiveX * topRight.y;
    const e = bottomLeft.y - topLeft.y + perspectiveY * bottomLeft.y;
    const inverseDenominator: RasterPerspectiveTransform = [0, 0, 0];
    vec3.cross(inverseDenominator, [a, d, perspectiveX], [b, e, perspectiveY]);
    const normalizationScale = Math.max(...inverseDenominator.map(value => Math.abs(value)));
    const cornerDenominators = cornerCoords.map(({x, y}) =>
        vec3.dot(inverseDenominator, [x, y, 1]));
    const cornerDenominatorErrors = cornerCoords.map(({x, y}) =>
        perspectiveErrorFactor * perspectiveEpsilon * (
            Math.abs(inverseDenominator[0] * x) +
            Math.abs(inverseDenominator[1] * y) +
            Math.abs(inverseDenominator[2])));
    const denominatorScale = Math.max(...cornerDenominators.map(value => Math.abs(value)));
    const denominatorSign = Math.sign(cornerDenominators[0]);

    // The denominator is affine within each rendered triangle. Reject a
    // transform that reaches or crosses zero anywhere inside the quad.
    const hasInvalidDenominator = cornerDenominators.some((value, index) =>
        !Number.isFinite(value) ||
        Math.abs(value) <= Math.max(perspectiveEpsilon * denominatorScale, cornerDenominatorErrors[index]) ||
        Math.sign(value) !== denominatorSign);
    if (!Number.isFinite(normalizationScale) || normalizationScale === 0 || !Number.isFinite(denominatorScale) ||
        denominatorScale === 0 || hasInvalidDenominator) {
        return identityPerspectiveTransform;
    }

    // The denominator is homogeneous, so normalize by its largest coefficient
    // instead of assuming that its constant coefficient is nonzero.
    const transform = inverseDenominator.map(value => value / normalizationScale) as RasterPerspectiveTransform;
    return transform.every(Number.isFinite) ? transform : identityPerspectiveTransform;
}

function isParallelogram(cornerCoords: Point[]) {
    const [tl, tr, br, bl] = cornerCoords;
    return Math.abs(tl.x + br.x - tr.x - bl.x) < perspectiveEpsilon &&
        Math.abs(tl.y + br.y - tr.y - bl.y) < perspectiveEpsilon;
}
