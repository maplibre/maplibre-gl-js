import {LngLat, LngLatLike} from './lng_lat';
import {LngLatBounds} from './lng_lat_bounds';
import {MercatorCoordinate} from './mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {mat4, mat2, vec3} from 'gl-matrix';
import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../source/tile_id';
import type {PaddingOptions} from './edge_insets';
import {Terrain} from '../render/terrain';
import {PointProjection} from '../symbol/projection';
import {MapProjectionEvent} from '../ui/events';
import type {ProjectionData} from './projection/projection_data';

export type CoveringZoomOptions = {
    /**
     * Whether to round or floor the target zoom level. If true, the value will be rounded to the closest integer. Otherwise the value will be floored.
     */
    roundZoom?: boolean;
    /**
     * Tile size, expressed in screen pixels.
     */
    tileSize: number;
};

export type CoveringTilesOptions = CoveringZoomOptions & {
    /**
     * Smallest allowed tile zoom.
     */
    minzoom?: number;
    /**
     * Largest allowed tile zoom.
     */
    maxzoom?: number;
    /**
     * `true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.
     * Fill this option when computing covering tiles for a source.
     * When true, any tile at `maxzoom` level that should be overscaled to a greater zoom will have
     * its zoom set to the overscaled greater zoom. When false, such tiles will have zoom set to `maxzoom`.
     */
    reparseOverscaled?: boolean;
    /**
     * When terrain is present, tile visibility will be computed in regards to the min and max elevations for each tile.
     */
    terrain?: Terrain;
};

export type TransformUpdateResult = {
    forcePlacementUpdate?: boolean;
    fireProjectionEvent?: MapProjectionEvent;
    forceSourceUpdate?: boolean;
};

export interface ITransformGetters {
    get tileSize(): number;

    get tileZoom(): number;

    /**
     * How many times "larger" the world is compared to zoom 0. Usually computed as `pow(2, zoom)`.
     * Relevant mostly for mercator projection.
     */
    get scale(): number;

    /**
     * How many units the current world has. Computed by multiplying {@link worldSize} by {@link tileSize}.
     * Relevant mostly for mercator projection.
     */
    get worldSize(): number;

    /**
     * Gets the transform's width in pixels. Use {@link ITransform.resize} to set the transform's size.
     */
    get width(): number;
    /**
     * Gets the transform's height in pixels. Use {@link ITransform.resize} to set the transform's size.
     */
    get height(): number;

    /**
     * Gets the transform's bearing in radians.
     */
    get angle(): number;

    get lngRange(): [number, number];
    get latRange(): [number, number];

    get minZoom(): number;
    get maxZoom(): number;
    get zoom(): number;
    get center(): LngLat;

    get minPitch(): number;
    get maxPitch(): number;
    /**
     * Pitch in degrees.
     */
    get pitch(): number;
    /**
     * Bearing in degrees.
     */
    get bearing(): number;
    /**
     * Vertical field of view in degrees.
     */
    get fov(): number;

    get elevation(): number;
    get minElevationForCurrentTile(): number;

    get padding(): PaddingOptions;
    get unmodified(): boolean;

    get renderWorldCopies(): boolean;
}

/**
 * @internal
 * All the functions that may mutate a transform.
 */
interface ITransformMutators {
    clone(): ITransform;

    apply(that: IReadonlyTransform): void;

    /**
     * Sets the transform's minimal allowed zoom level.
     * Automatically constrains the transform's zoom to the new range and recomputes internal matrices if needed.
     */
    setMinZoom(zoom: number): void;
    /**
     * Sets the transform's maximal allowed zoom level.
     * Automatically constrains the transform's zoom to the new range and recomputes internal matrices if needed.
     */
    setMaxZoom(zoom: number): void;
    /**
     * Sets the transform's minimal allowed pitch, in degrees.
     * Automatically constrains the transform's pitch to the new range and recomputes internal matrices if needed.
     */
    setMinPitch(pitch: number): void;
    /**
     * Sets the transform's maximal allowed pitch, in degrees.
     * Automatically constrains the transform's pitch to the new range and recomputes internal matrices if needed.
     */
    setMaxPitch(pitch: number): void;
    setRenderWorldCopies(renderWorldCopies: boolean): void;
    /**
     * Sets the transform's bearing, in degrees.
     * Recomputes internal matrices if needed.
     */
    setBearing(bearing: number): void;
    /**
     * Sets the transform's pitch, in degrees.
     * Recomputes internal matrices if needed.
     */
    setPitch(pitch: number): void;
    /**
     * Sets the transform's vertical field of view, in degrees.
     * Recomputes internal matrices if needed.
     */
    setFov(fov: number): void;
    /**
     * Sets the transform's zoom.
     * Automatically constrains the transform's center and zoom and recomputes internal matrices if needed.
     */
    setZoom(zoom: number): void;
    /**
     * Sets the transform's center.
     * Automatically constrains the transform's center and zoom and recomputes internal matrices if needed.
     */
    setCenter(center: LngLat): void;
    setElevation(elevation: number): void;
    setMinElevationForCurrentTile(elevation: number): void;
    setPadding(padding: PaddingOptions): void;

    /**
     * Sets the transform's width and height and recomputes internal matrices.
     */
    resize(width: number, height: number): void;
    /**
     * Helper method to update edge-insets in place
     *
     * @param start - the starting padding
     * @param target - the target padding
     * @param t - the step/weight
     */
    interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number): void;

    /**
     * This method works in combination with freezeElevation activated.
     * freezeElevation is enabled during map-panning because during this the camera should sit in constant height.
     * After panning finished, call this method to recalculate the zoom level for the current camera-height in current terrain.
     * @param terrain - the terrain
     */
    recalculateZoom(terrain: Terrain): void;

    /**
     * Set's the transform's center so that the given point on screen is at the given world coordinates.
     * @param lnglat - Desired world coordinates of the point.
     * @param point - The screen point that should lie at the given coordinates.
     */
    setLocationAtPoint(lnglat: LngLat, point: Point): void;

    /**
     * Sets or clears the map's geographical constraints.
     * @param bounds - A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds?: LngLatBounds | null): void;

    /**
     * @internal
     * Signals to the transform that a new frame is starting.
     * The transform might update some of its internal variables and animations based on this.
     */
    newFrameUpdate(): TransformUpdateResult;

    /**
     * @internal
     * Called before rendering to allow the transform implementation
     * to precompute data needed to render the given tiles.
     * Used in mercator transform to precompute tile matrices (posMatrix).
     * @param coords - Array of tile IDs that will be rendered.
     */
    precacheTiles(coords: Array<OverscaledTileID>): void;
}

/**
 * @internal
 * A variant of {@link ITransform} without any mutating functions.
 * Note that an instance of {@link IReadonlyTransform} may still be mutated
 * by code that has a reference to in under the {@link ITransform} type.
 */
export interface IReadonlyTransform extends ITransformGetters {
    /**
     * Distance from camera origin to view plane, in pixels.
     * Calculated using vertical fov and viewport height.
     * Center is considered to be in the middle of the viewport.
     */
    get cameraToCenterDistance(): number;
    get modelViewProjectionMatrix(): mat4;
    get projectionMatrix(): mat4;
    /**
     * Inverse of matrix from camera space to clip space.
     */
    get inverseProjectionMatrix(): mat4;
    get pixelsToClipSpaceMatrix(): mat4;
    get clipSpaceToPixelsMatrix(): mat4;
    get pixelsToGLUnits(): [number, number];
    get centerOffset(): Point;
    /**
     * Gets the transform's width and height in pixels (viewport size). Use {@link resize} to set the transform's size.
     */
    get size(): Point;
    get rotationMatrix(): mat2;
    /**
     * The center of the screen in pixels with the top-left corner being (0,0)
     * and +y axis pointing downwards. This accounts for padding.
     */
    get centerPoint(): Point;
    /**
     * @internal
     */
    get pixelsPerMeter(): number;
    /**
     * @internal
     * Returns the camera's position transformed to be in the same space as 3D features under this transform's projection. Mostly used for globe + fill-extrusion.
     */
    get cameraPosition(): vec3;

    get nearZ(): number;
    get farZ(): number;

    /**
     * Returns if the padding params match
     *
     * @param padding - the padding to check against
     * @returns true if they are equal, false otherwise
     */
    isPaddingEqual(padding: PaddingOptions): boolean;

    /**
     * Return what zoom level of a tile source would most closely cover the tiles displayed by this transform.
     * @param options - The options, most importantly the source's tile size.
     * @returns An integer zoom level at which all tiles will be visible.
     */
    coveringZoomLevel(options: CoveringZoomOptions): number;

    /**
     * @internal
     * Return any "wrapped" copies of a given tile coordinate that are visible
     * in the current view.
     */
    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): Array<UnwrappedTileID>;

    /**
     * Returns a list of tile coordinates that when rendered cover the entire screen at an optimal detail level.
     * Tiles are ordered by ascending distance from camera.
     * @param options - Additional options - min & max zoom, terrain presence, etc.
     * @returns Array of OverscaledTileID. All OverscaledTileID instances are newly created.
     */
    coveringTiles(options: CoveringTilesOptions): Array<OverscaledTileID>;

    /**
     * @internal
     * Given a LngLat location, return the screen point that corresponds to it.
     * @param lnglat - location
     * @param terrain - optional terrain
     * @returns screen point
     */
    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point;

    /**
     * @internal
     * Given a point on screen, return its LngLat location.
     * @param p - screen point
     * @param terrain - optional terrain
     * @returns lnglat location
     */
    screenPointToLocation(p: Point, terrain?: Terrain): LngLat;

    /**
     * @internal
     * Given a point on screen, return its mercator coordinate.
     * @param p - the point
     * @param terrain - optional terrain
     * @returns lnglat
     */
    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate;

    /**
     * @internal
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * @returns Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    getBounds(): LngLatBounds;

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns max bounds
     */
    getMaxBounds(): LngLatBounds | null;

    /**
     * @internal
     * Returns whether the specified screen point lies on the map.
     * May return false if, for example, the point is above the map's horizon, or if doesn't lie on the planet's surface if globe is enabled.
     * @param p - The point's coordinates.
     * @param terrain - Optional terrain.
     */
    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean;

    /**
     * Get center lngLat and zoom to ensure that longitude and latitude bounds are respected and regions beyond the map bounds are not displayed.
     */
    getConstrained(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number};

    maxPitchScaleFactor(): number;

    /**
     * The camera looks at the map from a 3D (lng, lat, altitude) location. Let's use `cameraLocation`
     * as the name for the location under the camera and on the surface of the earth (lng, lat, 0).
     * `cameraPoint` is the projected position of the `cameraLocation`.
     *
     * This point is useful to us because only fill-extrusions that are between `cameraPoint` and
     * the query point on the surface of the earth can extend and intersect the query.
     *
     * When the map is not pitched the `cameraPoint` is equivalent to the center of the map because
     * the camera is right above the center of the map.
     */
    getCameraPoint(): Point;

    /**
     * The altitude of the camera above the center of the map in meters.
     */
    getCameraAltitude(): number;

    getRayDirectionFromPixel(p: Point): vec3;

    /**
     * When the map is pitched, some of the 3D features that intersect a query will not intersect
     * the query at the surface of the earth. Instead the feature may be closer and only intersect
     * the query because it extrudes into the air.
     * @param queryGeometry - For point queries, the line from the query point to the "camera point",
     * for other geometries, the envelope of the query geometry and the "camera point"
     * @returns a geometry that includes all of the original query as well as all possible ares of the
     * screen where the *base* of a visible extrusion could be.
     *
     */
    getCameraQueryGeometry(queryGeometry: Array<Point>): Array<Point>;

    /**
     * Return the distance to the camera in clip space from a LngLat.
     * This can be compared to the value from the depth buffer (terrain.depthAtPoint)
     * to determine whether a point is occluded.
     * @param lngLat - the point
     * @param elevation - the point's elevation
     * @returns depth value in clip space (between 0 and 1)
     */
    lngLatToCameraDepth(lngLat: LngLat, elevation: number): number;

    /**
     * @internal
     * Calculate the fogMatrix that, given a tile coordinate, would be used to calculate fog on the map.
     * Currently only supported in mercator projection.
     * @param unwrappedTileID - the tile ID
     */
    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4;

    /**
     * @internal
     * True when an animation handled by the transform is in progress,
     * requiring MapLibre to keep rendering new frames.
     */
    isRenderingDirty(): boolean;

    /**
     * @internal
     * Generates a `ProjectionData` instance to be used while rendering the supplied tile.
     * @param overscaledTileID - The ID of the current tile.
     * @param aligned - Set to true if a pixel-aligned matrix should be used, if possible (mostly used for raster tiles under mercator projection).
     */
    getProjectionData(overscaledTileID: OverscaledTileID, aligned?: boolean, ignoreTerrainMatrix?: boolean): ProjectionData;

    /**
     * @internal
     * Returns whether the supplied location is occluded in this projection.
     * For example during globe rendering a location on the backfacing side of the globe is occluded.
     */
    isLocationOccluded(lngLat: LngLat): boolean;

    /**
     * @internal
     */
    getPixelScale(): number;

    /**
     * @internal
     * Allows the projection to adjust the radius of `circle-pitch-alignment: 'map'` circles and heatmap kernels based on the map's latitude.
     * Circle radius and heatmap kernel radius is multiplied by this value.
     */
    getCircleRadiusCorrection(): number;

    /**
     * @internal
     * Allows the projection to adjust the scale of `text-pitch-alignment: 'map'` symbols's collision boxes based on the map's center and the text anchor.
     * Only affects the collision boxes (and click areas), scaling of the rendered text is mostly handled in shaders.
     * @param transform - The map's transform, with only the `center` property, describing the map's longitude and latitude.
     * @param textAnchorX - Text anchor position inside the tile, X axis.
     * @param textAnchorY - Text anchor position inside the tile, Y axis.
     * @param tileID - The tile coordinates.
     */
    getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number;

    /**
     * @internal
     * Returns light direction transformed to be in the same space as 3D features under this projection. Mostly used for globe + fill-extrusion.
     * @param transform - Current map transform.
     * @param dir - The light direction.
     * @returns A new vector with the transformed light direction.
     */
    transformLightDirection(dir: vec3): vec3;

    /**
     * @internal
     * Projects a point in tile coordinates to clip space. Used in symbol rendering.
     */
    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number): PointProjection;

    /**
     * Returns a matrix that will place, rotate and scale a model to display at the given location and altitude
     * while also being projected by the custom layer matrix.
     * This function is intended to be called from custom layers.
     * @param location - Location of the model.
     * @param altitude - Altitude of the model. May be undefined.
     */
    getMatrixForModel(location: LngLatLike, altitude?: number): mat4;

    /**
     * Return projection data such that coordinates in mercator projection in range 0..1 will get projected to the map correctly.
     */
    getProjectionDataForCustomLayer(): ProjectionData;

    /**
     * Returns a tile-specific projection matrix. Used for symbol placement fast-path for mercator transform.
     */
    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 | undefined;
}

/**
 * @internal
 * The transform stores everything needed to project or otherwise transform points on a map,
 * including most of the map's view state - center, zoom, pitch, etc.
 * A transform is cloneable, which is used when a given map state must be retained for multiple frames, mostly during symbol placement.
 */
export interface ITransform extends IReadonlyTransform, ITransformMutators {}

