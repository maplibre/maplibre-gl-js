import type Point from '@mapbox/point-geometry';
import type {mat4, vec3, vec4} from 'gl-matrix';
import type {ProjectedCamera} from './projected_camera.ts';
import type {LngLat} from '../geo/lng_lat.ts';
import type {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import type {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import type {PointProjection} from '../symbol/projection.ts';
import type {Terrain} from '../render/terrain.ts';
import type {Frustum} from '../util/primitives/frustum.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

/**
 * @internal
 * What a projection computes from a {@link ProjectedCamera} it projected: where locations are on the screen and back,
 * the matrices and corrections the renderer draws with, and what the camera sees. Each projection implements it, see
 * `getCameraMath` in `camera_math_factory.ts`, which picks the one for a camera. The implementations hold nothing, so
 * every method is handed the camera; those that map between lng/lat and the world are handed the world mapping too.
 */
export interface CameraMath {
    /** The projection data the renderer draws a tile with. */
    getProjectionData(camera: ProjectedCamera, params: ProjectionDataParams): RendererProjectionData;

    /** The projection data a custom layer draws with. */
    getProjectionDataForCustomLayer(camera: ProjectedCamera, applyGlobeMatrix?: boolean): CustomLayerProjectionData;

    /**
     * A matrix that projects a tile straight to clip space, for the draw code that can use one, or undefined where the
     * projection needs the shaders' own projection.
     */
    getFastPathSimpleProjectionMatrix(camera: ProjectedCamera, tileID: OverscaledTileID): mat4;

    /** Projects a point in tile coordinates to the screen. */
    projectTileCoordinates(camera: ProjectedCamera, x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection;

    /** Scales the collision boxes of `text-pitch-alignment: 'map'` symbols for where their anchor lies. */
    getPitchedTextCorrection(camera: ProjectedCamera, textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number;

    /** How much larger the circles of the camera's projection are drawn than on mercator, at the center. */
    getCircleRadiusCorrection(camera: ProjectedCamera): number;

    /** How much the projection scales the map at the center relative to mercator, which line patterns use. */
    getPixelScale(camera: ProjectedCamera): number;

    /** The light direction in the space of the projection's 3D features. Mostly used for globe + fill-extrusion. */
    transformLightDirection(camera: ProjectedCamera, dir: vec3): vec3;

    /** The matrix the fog's depth is computed with for a tile. */
    calculateFogMatrix(camera: ProjectedCamera, unwrappedTileID: UnwrappedTileID): mat4;

    /** The copies of the world a tile is drawn in. */
    getVisibleUnwrappedCoordinates(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, tileID: CanonicalTileID): UnwrappedTileID[];

    /** The camera's view volume, which tile selection tests tiles against. */
    getCameraFrustum(camera: ProjectedCamera): Frustum;

    /** The plane that clips what is behind the globe, or null on mercator. */
    getClippingPlane(camera: ProjectedCamera): vec4 | null;

    /** How far a pitched view stretches the top of the screen. */
    maxPitchScaleFactor(camera: ProjectedCamera): number;

    /** The camera's altitude above sea level, in meters. */
    getCameraAltitude(camera: ProjectedCamera): number;

    /** The location right under the camera. */
    getCameraLngLat(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper): LngLat;

    /** The bounds of what the camera shows. */
    getBounds(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper): LngLatBounds;

    /**
     * Whether the camera cannot see a location. The planet hides it when the location, at its elevation, lies beyond the
     * globe's horizon plane, the plane the globe shaders clip an elevated vertex with. With `terrain`, the terrain hides
     * it when the ray from the camera to the location meets the rendered terrain surface, see
     * {@link CameraMath.screenTerrainPointToMercatorCoordinate}, before it reaches the location, and a location behind
     * the camera or beyond the far plane is hidden too. Terrain with no renderable tiles hides nothing.
     * @param lngLat - the location
     * @param terrain - the terrain that can hide the location; without it only the planet can
     * @param elevation - the location's elevation in meters; the terrain's elevation there when omitted, zero without
     * terrain. `Marker` raises its center with it
     */
    isLocationOccluded(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean;

    /** The screen point a location is drawn at, on the terrain's surface where terrain is given. */
    locationToScreenPoint(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, terrain?: Terrain): Point;

    /** The location drawn at a screen point, on the terrain's surface where terrain is given. */
    screenPointToLocation(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): LngLat;

    /** The location drawn at a screen point, on the plane at the given elevation. */
    screenPointToLocationAtElevation(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, elevation: number): LngLat;

    /** The mercator coordinate drawn at a screen point, on the terrain's surface where terrain is given. */
    screenPointToMercatorCoordinate(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): MercatorCoordinate;

    /**
     * The mercator coordinate where the ray through a screen point hits the rendered terrain surface, with z in meters,
     * or null where the terrain has no renderable tiles or the ray never meets it.
     */
    screenTerrainPointToMercatorCoordinate(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain: Terrain): MercatorCoordinate | null;

    /** Whether a screen point shows the map, rather than the sky or the space around the globe. */
    isPointOnMapSurface(camera: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): boolean;

    /** The normalized direction of the ray from the camera to a screen pixel, in unit-sphere space; only a globe has one. */
    getRayDirectionFromPixel(camera: ProjectedCamera, p: Point): vec3;

    /**
     * The geometry a query for features that may extrude up into the query area covers: every position on the screen
     * where the base of a visible extrusion could be, see `cameraPointQueryGeometry` in `projected_camera.ts`.
     */
    getCameraQueryGeometry(camera: ProjectedCamera, queryGeometry: Point[]): Point[];
}
