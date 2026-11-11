import Point from '@mapbox/point-geometry';
import {lerp} from '../../util/util.ts';
import {Bounds} from '../bounds.ts';
import * as mercatorMath from './mercator_camera_math.ts';
import * as verticalPerspectiveMath from './vertical_perspective_camera_math.ts';
import {deriveCameraMetrics} from '../projected_camera.ts';
import {renderedProjection} from './camera_projection.ts';

import type {mat4, vec3} from 'gl-matrix';
import type {CameraMetrics, ProjectedCamera, MercatorProjectedCamera, VerticalPerspectiveProjectedCamera} from '../projected_camera.ts';
import type {CameraState} from '../camera_state.ts';
import type {WorldCoordinateHelper} from '../camera_types.ts';
import type {CameraProjection} from './camera_projection.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';
import type {LngLat} from '../lng_lat.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import type {PointProjection} from '../../symbol/projection.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {Frustum} from '../../util/primitives/frustum.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';

/** The {@link CameraMetrics} derived from each camera state, for each world mapping it was derived in. */
const metricsCache = new WeakMap<CameraState, WeakMap<WorldCoordinateHelper, CameraMetrics>>();

/** The {@link ProjectedCamera} derived from each camera state, for each projection it was derived in. */
const projectedCameraCache = new WeakMap<CameraState, WeakMap<CameraProjection, ProjectedCamera>>();

/**
 * @internal
 * The values every projection derives from a camera state, see {@link deriveCameraMetrics}, kept for as long as the
 * state, which is never written to.
 */
export function getCameraMetrics(state: CameraState, worldCoordinateHelper: WorldCoordinateHelper): CameraMetrics {
    let byHelper = metricsCache.get(state);
    if (!byHelper) metricsCache.set(state, byHelper = new WeakMap());
    let camera = byHelper.get(worldCoordinateHelper);
    if (!camera) byHelper.set(worldCoordinateHelper, camera = deriveCameraMetrics(state, worldCoordinateHelper));
    return camera;
}

/**
 * @internal
 * The {@link ProjectedCamera} of a camera state in a projection: what the camera is drawn and queried with. It is derived
 * once per state and projection, both of which are never written to, and kept for as long as the state.
 */
export function projectCamera(state: CameraState, projection: CameraProjection): ProjectedCamera {
    let byProjection = projectedCameraCache.get(state);
    if (!byProjection) projectedCameraCache.set(state, byProjection = new WeakMap());
    let camera = byProjection.get(projection);
    if (!camera) byProjection.set(projection, camera = deriveUncached(state, projection));
    return camera;
}

function deriveUncached(state: CameraState, projection: CameraProjection): ProjectedCamera {
    const metrics = getCameraMetrics(state, projection.worldCoordinateHelper);
    if (projection.kind === 'mercator') return mercatorMath.projectMercatorCamera(metrics, projection);
    if (projection.kind === 'vertical-perspective') return verticalPerspectiveMath.projectVerticalPerspectiveCamera(metrics);
    // While the globe renders, mercator draws at the vertical perspective's depths, which keeps the two render paths
    // at the same depth across the transition.
    const verticalPerspective = verticalPerspectiveMath.projectVerticalPerspectiveCamera(metrics);
    const globeRendering = projection.globeness > 0;
    const nearFarZ = globeRendering && state.width && state.height ? {nearZ: verticalPerspective.nearZ, farZ: verticalPerspective.farZ} : state.nearFarZOverride;
    const mercator = mercatorMath.projectMercatorCamera(metrics, projection.mercator, nearFarZ);
    const rendered = globeRendering ? verticalPerspective : mercator;
    return {
        ...metrics,
        projection: 'globe',
        globeness: projection.globeness,
        mercator,
        verticalPerspective,
        nearZ: rendered.nearZ,
        farZ: rendered.farZ,
        projectionMatrix: rendered.projectionMatrix,
        modelViewProjectionMatrix: rendered.modelViewProjectionMatrix,
        inverseProjectionMatrix: rendered.inverseProjectionMatrix,
        cameraPosition: rendered.cameraPosition,
        clippingPlane: rendered.clippingPlane,
    };
}

/**
 * The camera as the projection it is drawn with projects it: as it is, or for the globe as the vertical perspective
 * projects it while the globe renders and as mercator does once it has turned into mercator.
 */
function renderedCamera(camera: ProjectedCamera): MercatorProjectedCamera | VerticalPerspectiveProjectedCamera {
    if (camera.projection !== 'globe') return camera;
    return camera.globeness > 0 ? camera.verticalPerspective : camera.mercator;
}

/**
 * Calls the mercator or the vertical perspective version of a function that maps between lng/lat and the world, for
 * the projection the camera is drawn with; mercator gets the world mapping of that projection.
 */
function byProjectionInWorld<A extends unknown[], R>(
    camera: ProjectedCamera,
    projection: CameraProjection,
    mercator: (camera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, ...args: A) => R,
    verticalPerspective: (camera: VerticalPerspectiveProjectedCamera, ...args: A) => R,
    ...args: A
): R {
    const rendered = renderedCamera(camera);
    return rendered.projection === 'mercator' ?
        mercator(rendered, renderedProjection(projection).worldCoordinateHelper, ...args) :
        verticalPerspective(rendered, ...args);
}

/** Calls the mercator or the vertical perspective version of a function, for the projection the camera is drawn with. */
function byProjection<A extends unknown[], R>(
    camera: ProjectedCamera,
    mercator: (camera: MercatorProjectedCamera, ...args: A) => R,
    verticalPerspective: (camera: VerticalPerspectiveProjectedCamera, ...args: A) => R,
    ...args: A
): R {
    const rendered = renderedCamera(camera);
    return rendered.projection === 'mercator' ? mercator(rendered, ...args) : verticalPerspective(rendered, ...args);
}

/**
 * Whether the camera draws the globe rather than mercator, which a globe does until it has turned into mercator at
 * high zoom levels.
 */
export function isGlobeRendering(camera: ProjectedCamera): boolean {
    return renderedCamera(camera).projection === 'vertical-perspective';
}

/** How far the camera's projection is between mercator, at 0, and the vertical perspective of the globe, at 1. */
export function getProjectionTransition(camera: ProjectedCamera): number {
    switch (camera.projection) {
        case 'mercator': return 0;
        case 'vertical-perspective': return 1;
        case 'globe': return camera.globeness;
    }
}

export function getProjectionData(camera: ProjectedCamera, params: ProjectionDataParams): RendererProjectionData {
    if (camera.projection !== 'globe') return byProjection(camera, mercatorMath.getProjectionData, verticalPerspectiveMath.getProjectionData, params);
    const mercatorProjectionData = mercatorMath.getProjectionData(camera.mercator, params);
    const verticalPerspectiveProjectionData = verticalPerspectiveMath.getProjectionData(camera.verticalPerspective, params);
    return {
        mainMatrix: isGlobeRendering(camera) ? verticalPerspectiveProjectionData.mainMatrix : mercatorProjectionData.mainMatrix,
        clippingPlane: verticalPerspectiveProjectionData.clippingPlane,
        tileMercatorCoords: verticalPerspectiveProjectionData.tileMercatorCoords,
        projectionTransition: params.applyGlobeMatrix ? camera.globeness : 0,
        fallbackMatrix: mercatorProjectionData.fallbackMatrix,
        clipAntimeridian: verticalPerspectiveProjectionData.clipAntimeridian,
    };
}

export function getProjectionDataForCustomLayer(camera: ProjectedCamera, applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
    if (camera.projection !== 'globe') return byProjection(camera, mercatorMath.getProjectionDataForCustomLayer, verticalPerspectiveMath.getProjectionDataForCustomLayer, applyGlobeMatrix);
    const mercatorData = mercatorMath.getProjectionDataForCustomLayer(camera.mercator, applyGlobeMatrix);
    if (!isGlobeRendering(camera)) return mercatorData;
    const globeData = verticalPerspectiveMath.getProjectionDataForCustomLayer(camera.verticalPerspective, applyGlobeMatrix);
    globeData.fallbackMatrix = mercatorData.mainMatrix;
    globeData.projectionTransition = camera.globeness;
    return globeData;
}

/**
 * A matrix that projects a tile straight to clip space, for the draw code that can use one, or undefined where the
 * projection needs the shaders' own projection.
 */
export function getFastPathSimpleProjectionMatrix(camera: ProjectedCamera, tileID: OverscaledTileID): mat4 {
    return byProjection(camera, mercatorMath.getFastPathSimpleProjectionMatrix, verticalPerspectiveMath.getFastPathSimpleProjectionMatrix, tileID);
}

export function projectTileCoordinates(camera: ProjectedCamera, x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
    return byProjection(camera, mercatorMath.projectTileCoordinates, verticalPerspectiveMath.projectTileCoordinates, x, y, unwrappedTileID, elevation);
}

/** Scales the collision boxes of `text-pitch-alignment: 'map'` symbols for where their anchor lies. */
export function getPitchedTextCorrection(camera: ProjectedCamera, textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
    if (camera.projection !== 'globe') return byProjection(camera, mercatorMath.getPitchedTextCorrection, verticalPerspectiveMath.getPitchedTextCorrection, textAnchorX, textAnchorY, tileID);
    return lerp(
        mercatorMath.getPitchedTextCorrection(camera.mercator, textAnchorX, textAnchorY, tileID),
        verticalPerspectiveMath.getPitchedTextCorrection(camera.verticalPerspective, textAnchorX, textAnchorY, tileID),
        camera.globeness);
}

/** How much larger the circles of the camera's projection are drawn than on mercator, at the center. */
export function getCircleRadiusCorrection(camera: ProjectedCamera): number {
    return byProjection(camera, mercatorMath.getCircleRadiusCorrection, verticalPerspectiveMath.getCircleRadiusCorrection);
}

/** How much the projection scales the map at the center relative to mercator, which line patterns use. */
export function getPixelScale(camera: ProjectedCamera): number {
    if (camera.projection !== 'globe') return byProjection(camera, mercatorMath.getPixelScale, verticalPerspectiveMath.getPixelScale);
    return lerp(mercatorMath.getPixelScale(camera.mercator), verticalPerspectiveMath.getPixelScale(camera.verticalPerspective), camera.globeness);
}

/** The light direction in the space of the projection's 3D features. Mostly used for globe + fill-extrusion. */
export function transformLightDirection(camera: ProjectedCamera, dir: vec3): vec3 {
    return byProjection(camera, mercatorMath.transformLightDirection, verticalPerspectiveMath.transformLightDirection, dir);
}

export function calculateFogMatrix(camera: ProjectedCamera, unwrappedTileID: UnwrappedTileID): mat4 {
    return byProjection(camera, mercatorMath.calculateFogMatrix, verticalPerspectiveMath.calculateFogMatrix, unwrappedTileID);
}

/** The copies of the world a tile is drawn in. */
export function getVisibleUnwrappedCoordinates(camera: ProjectedCamera, projection: CameraProjection, tileID: CanonicalTileID): UnwrappedTileID[] {
    return byProjectionInWorld(camera, projection, mercatorMath.getVisibleUnwrappedCoordinates, verticalPerspectiveMath.getVisibleUnwrappedCoordinates, tileID);
}

export function getCameraFrustum(camera: ProjectedCamera): Frustum {
    return byProjection(camera, mercatorMath.getCameraFrustum, verticalPerspectiveMath.getCameraFrustum);
}

/** The plane that clips what is behind the globe, or null on mercator. */
export function getClippingPlane(camera: ProjectedCamera): ProjectedCamera['clippingPlane'] {
    return renderedCamera(camera).clippingPlane;
}

/** The details of the tile grid of the projection a camera is drawn with, which tile selection reads. */
export function getCoveringTilesDetailsProvider(projection: CameraProjection): CoveringTilesDetailsProvider {
    return renderedProjection(projection).coveringTilesDetailsProvider;
}

/** How far a pitched view stretches the top of the screen, from the mercator pixel matrix on a globe too. */
export function maxPitchScaleFactor(camera: ProjectedCamera): number {
    if (camera.projection === 'globe') return mercatorMath.maxPitchScaleFactor(camera.mercator);
    return byProjection(camera, mercatorMath.maxPitchScaleFactor, verticalPerspectiveMath.maxPitchScaleFactor);
}

export function getCameraAltitude(camera: ProjectedCamera): number {
    return byProjection(camera, mercatorMath.getCameraAltitude, verticalPerspectiveMath.getCameraAltitude);
}

export function getCameraLngLat(camera: ProjectedCamera, projection: CameraProjection): LngLat {
    return byProjectionInWorld(camera, projection, mercatorMath.getCameraLngLat, verticalPerspectiveMath.getCameraLngLat);
}

export function getBounds(camera: ProjectedCamera, projection: CameraProjection): LngLatBounds {
    return byProjectionInWorld(camera, projection, mercatorMath.getBounds, verticalPerspectiveMath.getBounds);
}

/**
 * Whether the camera cannot see a location. The planet hides it when the location, at its elevation, lies beyond the
 * globe's horizon plane, the plane the globe shaders clip an elevated vertex with. With `terrain`, the terrain hides
 * it when the ray from the camera to the location meets the rendered terrain surface, see
 * {@link screenTerrainPointToMercatorCoordinate}, before it reaches the location, and a location behind the camera or
 * beyond the far plane is hidden too. Terrain with no renderable tiles hides nothing.
 * @param lngLat - the location
 * @param terrain - the terrain that can hide the location; without it only the planet can
 * @param elevation - the location's elevation in meters; the terrain's elevation there when omitted, zero without
 * terrain. `Marker` raises its center with it
 */
export function isLocationOccluded(camera: ProjectedCamera, projection: CameraProjection, lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
    return byProjectionInWorld(camera, projection, mercatorMath.isLocationOccluded, verticalPerspectiveMath.isLocationOccluded, lngLat, terrain, elevation);
}

export function locationToScreenPoint(camera: ProjectedCamera, projection: CameraProjection, lnglat: LngLat, terrain?: Terrain): Point {
    return byProjectionInWorld(camera, projection, mercatorMath.locationToScreenPoint, verticalPerspectiveMath.locationToScreenPoint, lnglat, terrain);
}

export function screenPointToLocation(camera: ProjectedCamera, projection: CameraProjection, p: Point, terrain?: Terrain): LngLat {
    return byProjectionInWorld(camera, projection, mercatorMath.screenPointToLocation, verticalPerspectiveMath.screenPointToLocation, p, terrain);
}

export function screenPointToLocationAtElevation(camera: ProjectedCamera, projection: CameraProjection, p: Point, elevation: number): LngLat {
    return byProjectionInWorld(camera, projection, mercatorMath.screenPointToLocationAtElevation, verticalPerspectiveMath.screenPointToLocationAtElevation, p, elevation);
}

export function screenPointToMercatorCoordinate(camera: ProjectedCamera, projection: CameraProjection, p: Point, terrain?: Terrain): MercatorCoordinate {
    return byProjectionInWorld(camera, projection, mercatorMath.screenPointToMercatorCoordinate, verticalPerspectiveMath.screenPointToMercatorCoordinate, p, terrain);
}

/**
 * The mercator coordinate where the ray through a screen point hits the rendered terrain surface, with z in meters,
 * or null where the terrain has no renderable tiles or the ray never meets it.
 */
export function screenTerrainPointToMercatorCoordinate(camera: ProjectedCamera, projection: CameraProjection, p: Point, terrain: Terrain): MercatorCoordinate | null {
    return byProjectionInWorld(camera, projection, mercatorMath.screenTerrainPointToMercatorCoordinate, verticalPerspectiveMath.screenTerrainPointToMercatorCoordinate, p, terrain);
}

export function isPointOnMapSurface(camera: ProjectedCamera, projection: CameraProjection, p: Point, terrain?: Terrain): boolean {
    return byProjectionInWorld(camera, projection, mercatorMath.isPointOnMapSurface, verticalPerspectiveMath.isPointOnMapSurface, p, terrain);
}

/**
 * The normalized direction of the ray from the camera to a screen pixel, in unit-sphere space. Only the globe camera
 * controls ask for it, so a globe answers from its vertical perspective whatever it renders.
 */
export function getRayDirectionFromPixel(camera: ProjectedCamera, p: Point): vec3 {
    if (camera.projection === 'mercator') throw new Error('Not implemented.');
    return verticalPerspectiveMath.getRayDirectionFromPixel(camera.projection === 'globe' ? camera.verticalPerspective : camera, p);
}

/**
 * The point on the screen right under the camera: the center point moved down by the pitch and turned by the roll.
 */
export function getCameraPoint(camera: ProjectedCamera): Point {
    const offset = Math.tan(camera.pitchInRadians) * (camera.cameraToCenterDistance || 1);
    return camera.centerPoint.add(new Point(offset * Math.sin(camera.rollInRadians), offset * Math.cos(camera.rollInRadians)));
}

/**
 * The geometry a query for features that may extrude up into the query area covers: the query geometry and the
 * camera point, see {@link getCameraPoint}.
 * @param queryGeometry - For point queries, the line from the query point to the "camera point",
 * for other geometries, the envelope of the query geometry and the "camera point"
 * @returns a geometry that includes all of the original query as well as all possible ares of the
 * screen where the *base* of a visible extrusion could be.
 */
export function getCameraQueryGeometry(camera: ProjectedCamera, queryGeometry: Point[]): Point[] {
    const cameraPoint = getCameraPoint(camera);
    if (queryGeometry.length === 1) {
        return [queryGeometry[0], cameraPoint];
    }
    const {minX, minY, maxX, maxY} = Bounds.fromPoints(queryGeometry).extend(cameraPoint);
    return [
        new Point(minX, minY),
        new Point(maxX, minY),
        new Point(maxX, maxY),
        new Point(minX, maxY),
        new Point(minX, minY)
    ];
}
