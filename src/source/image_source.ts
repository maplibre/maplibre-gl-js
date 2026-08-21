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
    bilinearImageWarp,
    type RasterImageWarp
} from '../webgl/program/raster_program.ts';
import {mat2} from 'gl-matrix';
import {createTileMeshWithBuffers} from '../util/create_tile_mesh.ts';

import type {Context} from '../webgl/context.ts';
import type {Mesh} from '../render/mesh.ts';

/**
 * How many grid cells per axis the mesh of a subdivided quad has. Within a cell the bilinear warp
 * is still approximated by one mapping per triangle, so the error falls off with the cell size.
 */
const SUBDIVIDED_QUAD_GRANULARITY = 16;

/**
 * How much a warp may foreshorten the image, as the ratio between the largest and the smallest
 * homogeneous denominator over the quad, while staying purely projective. Ordinary oblique imagery
 * stays well below it.
 */
const PROJECTIVE_FORESHORTENING = 4;

/**
 * The foreshortening at which a warp is taken to be purely bilinear.
 *
 * The denominator vanishes on the warp's vanishing line, and that line touches the quad exactly when
 * the quad degenerates into a triangle, so foreshortening grows without bound as a corner approaches
 * the diagonal between its neighbours. Left alone, such a quad keeps a valid but wildly lopsided
 * warp, squeezing nearly the whole image into a sliver along one edge and magnifying a handful of
 * texels over the rest of the quad.
 */
const BILINEAR_FORESHORTENING = 512;

/**
 * Four geographical coordinates,
 * represented as arrays of longitude and latitude numbers, which define the corners of the image.
 * The coordinates start at the top left corner of the image and proceed in clockwise order.
 * They do not have to represent a rectangle.
 */
export type Coordinates = [[number, number], [number, number], [number, number], [number, number]];

/**
 * @experimental
 * How an {@link ImageSource} warps its image onto its four coordinates, for the cases where the
 * coordinates do not form a rectangle.
 *
 * - `perspective` maps the image as the perspective view of a plane, which is what georeferenced
 *   photography and any other image of a flat scene wants: straight lines in the image stay
 *   straight, and the image foreshortens towards its more distant edge.
 * - `flat` interpolates the image between the four coordinates bilinearly, pinning it like a rubber
 *   sheet, which is what an image being reshaped by hand wants: every corner moves the image only
 *   near itself, and the result is stable no matter how far a corner is dragged. Straight lines in
 *   the image only stay straight while they run parallel to its edges, and there is no
 *   foreshortening, in the same sense as the CSS `transform-style: flat`.
 * - `auto`, the default, is `perspective` while the coordinates plausibly describe a perspective
 *   view, and blends continuously towards `flat` as they stop doing so, which they do as a corner
 *   approaches the diagonal between its two neighbours.
 *
 * Coordinates with no perspective view at all - a concave, self-crossing or collinear quad - are
 * always warped flat, whichever of these is set.
 */
export type ImageSourceWarp = 'auto' | 'perspective' | 'flat';

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
    imageWarp: RasterImageWarp = bilinearImageWarp;
    flippedWindingOrder: boolean = false;
    _loaded: boolean;
    _abortController: AbortController;
    private _warp: ImageSourceWarp = 'auto';
    private _imageDirty: boolean = false;
    /**
     * Whether the image has to be warped over a subdivided mesh instead of a pair of triangles,
     * because {@link imageWarp} is not the affine mapping that a parallelogram gets.
     */
    private _subdividedQuad: boolean = false;
    private _subdividedMesh: Mesh | null = null;

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

    /**
     * @internal
     * The mesh the image is drawn with, or null to use the tile mesh of the current projection.
     *
     * The raster vertex shader evaluates {@link imageWarp} per vertex, so a pair of triangles only
     * samples it at the four corners. That is enough for the affine mapping of a parallelogram, and
     * for a purely projective mapping, whose straight lines survive linear interpolation across the
     * diagonal. Anything in between is neither, and would be textured as two independently warped
     * halves with a visible seam along that diagonal, so it needs the warp evaluated per grid cell.
     *
     * A projection that subdivides its own tile meshes already does this, so it keeps them.
     */
    getMesh(context: Context, projectionSubdividesTiles: boolean): Mesh | null {
        if (!this._subdividedQuad || projectionSubdividesTiles) {
            return null;
        }
        this._subdividedMesh ??= createTileMeshWithBuffers(context, {granularity: SUBDIVIDED_QUAD_GRANULARITY});
        return this._subdividedMesh;
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
        this._subdividedMesh?.destroy();
        this._subdividedMesh = null;
        this.image = null;
        this.tiles = {};
    }

    /**
     * @experimental
     * Sets how the image is warped onto its coordinates and re-renders the map.
     *
     * This only has an effect while the coordinates do not form a rectangle, and it is not part of
     * the style specification, so it does not survive `map.setStyle`.
     *
     * @param warp - The warp to use, see {@link ImageSourceWarp}.
     *
     * @example
     * ```ts
     * // Keep the image pinned to its corners while the user drags them around.
     * map.getSource('some id').setWarp('flat');
     * ```
     */
    setWarp(warp: ImageSourceWarp): this {
        if (this._warp === warp) {
            return this;
        }
        this._warp = warp;
        if (this.tileCoords) {
            this.setCoordinates(this.coordinates);
        }
        return this;
    }

    /**
     * @experimental
     * Returns how the image is warped onto its coordinates.
     *
     * @returns The warp in use, see {@link ImageSourceWarp}.
     */
    getWarp(): ImageSourceWarp {
        return this._warp;
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
        this.imageWarp = calculateImageWarp(this.tileCoords, this._warp);
        // A purely projective warp survives a pair of triangles, because its straight lines are
        // straight in both, and so does any warp of a parallelogram, which is affine either way.
        // Anything else is textured as two independently warped halves without a subdivided mesh.
        this._subdividedQuad = this.imageWarp[2] > 0 && !isParallelogram(this.tileCoords);
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

/**
 * How the image is warped onto its coordinates, given the corners in tile space and what the user
 * asked for. The projective warp is the perspective view of a plane, so it is the one a photograph
 * wants; the bilinear warp is a rubber sheet pinned at the corners, and is the only one left once
 * the corners stop describing a perspective view at all.
 *
 * Based on Paul S. Heckbert, "Fundamentals of Texture Mapping and Image
 * Warping", UCB/CSD-89-516, 1989, section 2.2.3 and appendix A.2.
 *
 * @see https://www2.eecs.berkeley.edu/Pubs/TechRpts/1989/5504.html
 * @see https://www.cs.cmu.edu/~ph/texfund/texfund.pdf
 */
function calculateImageWarp(cornerCoords: Point[], warp: ImageSourceWarp): RasterImageWarp {
    // A parallelogram is warped affinely either way, and skipping the math keeps the common case of
    // a rectangle free of the signed zeroes that dividing an exactly zero numerator produces.
    if (warp === 'flat' || isParallelogram(cornerCoords)) {
        return bilinearImageWarp;
    }

    const [topLeft, topRight, bottomRight, bottomLeft] = cornerCoords;
    const sumX = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
    const sumY = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
    const basis: mat2 = [
        topRight.x - bottomRight.x, topRight.y - bottomRight.y,
        bottomLeft.x - bottomRight.x, bottomLeft.y - bottomRight.y
    ];
    const [rightX, rightY, downX, downY] = basis;
    const determinant = mat2.determinant(basis);
    const perspectiveX = (sumX * downY - downX * sumY) / determinant;
    const perspectiveY = (rightX * sumY - sumX * rightY) / determinant;

    // The homogeneous denominator at the four corners of the unit square, normalized to one at the
    // top left. Its spread is how much the warp foreshortens the image, and it stays finite and
    // positive over the whole quad exactly while the quad is a perspective view of the image, so
    // this one comparison also rejects a collinear, concave or self-crossing quad. A degenerate
    // determinant reaches it as an infinite or not-a-number spread.
    const denominators = [1, 1 + perspectiveX, 1 + perspectiveX + perspectiveY, 1 + perspectiveY];
    const foreshortening = Math.max(...denominators) / Math.min(...denominators);
    const blend = warp === 'perspective' ? 0 : bilinearBlend(foreshortening);
    if (!(foreshortening >= 1 && foreshortening <= BILINEAR_FORESHORTENING) || blend >= 1) {
        return bilinearImageWarp;
    }

    return [perspectiveX, perspectiveY, blend];
}

/**
 * How far a warp of the given foreshortening is blended towards the bilinear one, ramping from
 * purely projective at {@link PROJECTIVE_FORESHORTENING} to purely bilinear at
 * {@link BILINEAR_FORESHORTENING}. Blending rather than switching keeps the image continuous as the
 * quad is reshaped: the two warps only agree for a parallelogram, and diverge by roughly a tenth of
 * the quad per unit of foreshortening, so a switch would visibly displace the image.
 */
function bilinearBlend(foreshortening: number): number {
    const ramp = (1 - PROJECTIVE_FORESHORTENING / foreshortening) /
        (1 - PROJECTIVE_FORESHORTENING / BILINEAR_FORESHORTENING);
    return Math.max(0, ramp);
}

function isParallelogram(cornerCoords: Point[]): boolean {
    const [topLeft, topRight, bottomRight, bottomLeft] = cornerCoords;
    return topLeft.x + bottomRight.x === topRight.x + bottomLeft.x &&
        topLeft.y + bottomRight.y === topRight.y + bottomLeft.y;
}
