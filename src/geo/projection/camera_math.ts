import Point from '@mapbox/point-geometry';
import {lerp} from '../../util/util.ts';
import {Bounds} from '../bounds.ts';
import * as mercatorMath from './mercator_camera_math.ts';
import * as verticalPerspectiveMath from './vertical_perspective_camera_math.ts';
import {createCameraMetrics} from '../projected_camera.ts';
import {renderedProjection} from './camera_projection.ts';

import type {mat4, vec3} from 'gl-matrix';
import type {CameraMetrics, ProjectedCamera, MercatorProjectedCamera, VerticalPerspectiveProjectedCamera} from '../projected_camera.ts';
import type {CameraViewState} from '../camera_view_state.ts';
import type {WorldCoordinateHelper} from '../camera_types.ts';
import type {CameraProjection} from './camera_projection.ts';
import type {LngLat} from '../lng_lat.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import type {PointProjection} from '../../symbol/projection.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {Frustum} from '../../util/primitives/frustum.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';

/** The {@link CameraMetrics} derived from each {@link CameraViewState}, for each world mapping it was derived in. */
const metricsCache = new WeakMap<CameraViewState, WeakMap<WorldCoordinateHelper, CameraMetrics>>();

/** The {@link ProjectedCamera} derived from each {@link CameraViewState}, for each projection it was derived in. */
const projectedCameraCache = new WeakMap<CameraViewState, WeakMap<CameraProjection, ProjectedCamera>>();

/**
 * @internal
 * The values every projection derives from a camera view state, see {@link createCameraMetrics}, kept for as long as the
 * state, which is never written to.
 */
export function getCameraMetrics(view: CameraViewState, worldCoordinateHelper: WorldCoordinateHelper): CameraMetrics {
    let byHelper = metricsCache.get(view);
    if (!byHelper) metricsCache.set(view, byHelper = new WeakMap());
    let camera = byHelper.get(worldCoordinateHelper);
    if (!camera) byHelper.set(worldCoordinateHelper, camera = createCameraMetrics(view, worldCoordinateHelper));
    return camera;
}

/**
 * @internal
 * The {@link ProjectedCamera} of a camera view state in a projection: what the camera is drawn and queried with. It is derived
 * once per state and projection, both of which are never written to, and kept for as long as the state.
 */
export function projectCamera(view: CameraViewState, projection: CameraProjection): ProjectedCamera {
    let forRenderedProjection = projectedCameraCache.get(view);
    if (!forRenderedProjection) projectedCameraCache.set(view, forRenderedProjection = new WeakMap());
    let projectedCamera = forRenderedProjection.get(projection);
    if (!projectedCamera) forRenderedProjection.set(projection, projectedCamera = createProjectedCamera(view, projection));
    return projectedCamera;
}

function createProjectedCamera(view: CameraViewState, projection: CameraProjection): ProjectedCamera {
    const metrics = getCameraMetrics(view, projection.worldCoordinateHelper);
    if (projection.kind === 'mercator') return mercatorMath.createMercatorProjectedCamera(metrics, projection);
    if (projection.kind === 'vertical-perspective') return verticalPerspectiveMath.createVerticalPerspectiveProjectedCamera(metrics);
    // While the globe renders, mercator draws at the vertical perspective's depths, which keeps the two render paths
    // at the same depth across the transition.
    const verticalPerspective = verticalPerspectiveMath.createVerticalPerspectiveProjectedCamera(metrics);
    const globeRendering = projection.globeness > 0;
    const nearFarZ = globeRendering && view.width && view.height ? {nearZ: verticalPerspective.nearZ, farZ: verticalPerspective.farZ} : view.nearFarZOverride;
    const mercator = mercatorMath.createMercatorProjectedCamera(metrics, projection.mercator, nearFarZ);
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
 * @internal
 * The camera as the projection it is drawn with projects it: as it is, or for the globe as the vertical perspective
 * projects it while the globe renders and as mercator does once it has turned into mercator.
 */
export function renderedProjectedCamera(projectedCamera: ProjectedCamera): MercatorProjectedCamera | VerticalPerspectiveProjectedCamera {
    if (projectedCamera.projection !== 'globe') return projectedCamera;
    return projectedCamera.globeness > 0 ? projectedCamera.verticalPerspective : projectedCamera.mercator;
}

/**
 * Calls the mercator or the vertical perspective version of a function that maps between lng/lat and the world, for
 * the projection the camera is drawn with; mercator gets the world mapping of that projection.
 */
function forRenderedProjectionWithWorldMapping<A extends unknown[], R>(
    projectedCamera: ProjectedCamera,
    projection: CameraProjection,
    mercator: (projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, ...args: A) => R,
    verticalPerspective: (projectedCamera: VerticalPerspectiveProjectedCamera, ...args: A) => R,
    ...args: A
): R {
    const rendered = renderedProjectedCamera(projectedCamera);
    return rendered.projection === 'mercator' ?
        mercator(rendered, renderedProjection(projection).worldCoordinateHelper, ...args) :
        verticalPerspective(rendered, ...args);
}

/** Calls the mercator or the vertical perspective version of a function, for the projection the camera is drawn with. */
function forRenderedProjection<A extends unknown[], R>(
    projectedCamera: ProjectedCamera,
    mercator: (projectedCamera: MercatorProjectedCamera, ...args: A) => R,
    verticalPerspective: (projectedCamera: VerticalPerspectiveProjectedCamera, ...args: A) => R,
    ...args: A
): R {
    const rendered = renderedProjectedCamera(projectedCamera);
    return rendered.projection === 'mercator' ? mercator(rendered, ...args) : verticalPerspective(rendered, ...args);
}

/**
 * Whether the camera draws the globe rather than mercator, which a globe does until it has turned into mercator at
 * high zoom levels.
 */
export function isGlobeRendering(projectedCamera: ProjectedCamera): boolean {
    return renderedProjectedCamera(projectedCamera).projection === 'vertical-perspective';
}

/** How far the camera's projection is between mercator, at 0, and the vertical perspective of the globe, at 1. */
export function getProjectionTransition(projectedCamera: ProjectedCamera): number {
    switch (projectedCamera.projection) {
        case 'mercator': return 0;
        case 'vertical-perspective': return 1;
        case 'globe': return projectedCamera.globeness;
    }
}

export function getProjectionData(projectedCamera: ProjectedCamera, params: ProjectionDataParams): RendererProjectionData {
    if (projectedCamera.projection !== 'globe') return forRenderedProjection(projectedCamera, mercatorMath.getProjectionData, verticalPerspectiveMath.getProjectionData, params);
    const mercatorProjectionData = mercatorMath.getProjectionData(projectedCamera.mercator, params);
    const verticalPerspectiveProjectionData = verticalPerspectiveMath.getProjectionData(projectedCamera.verticalPerspective, params);
    return {
        mainMatrix: isGlobeRendering(projectedCamera) ? verticalPerspectiveProjectionData.mainMatrix : mercatorProjectionData.mainMatrix,
        clippingPlane: verticalPerspectiveProjectionData.clippingPlane,
        tileMercatorCoords: verticalPerspectiveProjectionData.tileMercatorCoords,
        projectionTransition: params.applyGlobeMatrix ? projectedCamera.globeness : 0,
        fallbackMatrix: mercatorProjectionData.fallbackMatrix,
        clipAntimeridian: verticalPerspectiveProjectionData.clipAntimeridian,
    };
}

export function getProjectionDataForCustomLayer(projectedCamera: ProjectedCamera, applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
    if (projectedCamera.projection !== 'globe') return forRenderedProjection(projectedCamera, mercatorMath.getProjectionDataForCustomLayer, verticalPerspectiveMath.getProjectionDataForCustomLayer, applyGlobeMatrix);
    const mercatorData = mercatorMath.getProjectionDataForCustomLayer(projectedCamera.mercator, applyGlobeMatrix);
    if (!isGlobeRendering(projectedCamera)) return mercatorData;
    const globeData = verticalPerspectiveMath.getProjectionDataForCustomLayer(projectedCamera.verticalPerspective, applyGlobeMatrix);
    globeData.fallbackMatrix = mercatorData.mainMatrix;
    globeData.projectionTransition = projectedCamera.globeness;
    return globeData;
}

/**
 * A matrix that projects a tile straight to clip space, for the draw code that can use one, or undefined where the
 * projection needs the shaders' own projection.
 */
export function getFastPathSimpleProjectionMatrix(projectedCamera: ProjectedCamera, tileID: OverscaledTileID): mat4 {
    return forRenderedProjection(projectedCamera, mercatorMath.getFastPathSimpleProjectionMatrix, verticalPerspectiveMath.getFastPathSimpleProjectionMatrix, tileID);
}

export function projectTileCoordinates(projectedCamera: ProjectedCamera, x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
    return forRenderedProjection(projectedCamera, mercatorMath.projectTileCoordinates, verticalPerspectiveMath.projectTileCoordinates, x, y, unwrappedTileID, elevation);
}

/** Scales the collision boxes of `text-pitch-alignment: 'map'` symbols for where their anchor lies. */
export function getPitchedTextCorrection(projectedCamera: ProjectedCamera, textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
    if (projectedCamera.projection !== 'globe') return forRenderedProjection(projectedCamera, mercatorMath.getPitchedTextCorrection, verticalPerspectiveMath.getPitchedTextCorrection, textAnchorX, textAnchorY, tileID);
    return lerp(
        mercatorMath.getPitchedTextCorrection(projectedCamera.mercator, textAnchorX, textAnchorY, tileID),
        verticalPerspectiveMath.getPitchedTextCorrection(projectedCamera.verticalPerspective, textAnchorX, textAnchorY, tileID),
        projectedCamera.globeness);
}

/** How much larger the circles of the camera's projection are drawn than on mercator, at the center. */
export function getCircleRadiusCorrection(projectedCamera: ProjectedCamera): number {
    return forRenderedProjection(projectedCamera, mercatorMath.getCircleRadiusCorrection, verticalPerspectiveMath.getCircleRadiusCorrection);
}

/** How much the projection scales the map at the center relative to mercator, which line patterns use. */
export function getPixelScale(projectedCamera: ProjectedCamera): number {
    if (projectedCamera.projection !== 'globe') return forRenderedProjection(projectedCamera, mercatorMath.getPixelScale, verticalPerspectiveMath.getPixelScale);
    return lerp(mercatorMath.getPixelScale(projectedCamera.mercator), verticalPerspectiveMath.getPixelScale(projectedCamera.verticalPerspective), projectedCamera.globeness);
}

/** The light direction in the space of the projection's 3D features. Mostly used for globe + fill-extrusion. */
export function transformLightDirection(projectedCamera: ProjectedCamera, dir: vec3): vec3 {
    return forRenderedProjection(projectedCamera, mercatorMath.transformLightDirection, verticalPerspectiveMath.transformLightDirection, dir);
}

export function calculateFogMatrix(projectedCamera: ProjectedCamera, unwrappedTileID: UnwrappedTileID): mat4 {
    return forRenderedProjection(projectedCamera, mercatorMath.calculateFogMatrix, verticalPerspectiveMath.calculateFogMatrix, unwrappedTileID);
}

/** The copies of the world a tile is drawn in. */
export function getVisibleUnwrappedCoordinates(projectedCamera: ProjectedCamera, projection: CameraProjection, tileID: CanonicalTileID): UnwrappedTileID[] {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.getVisibleUnwrappedCoordinates, verticalPerspectiveMath.getVisibleUnwrappedCoordinates, tileID);
}

export function getCameraFrustum(projectedCamera: ProjectedCamera): Frustum {
    return forRenderedProjection(projectedCamera, mercatorMath.getCameraFrustum, verticalPerspectiveMath.getCameraFrustum);
}

/** The plane that clips what is behind the globe, or null on mercator. */
export function getClippingPlane(projectedCamera: ProjectedCamera): ProjectedCamera['clippingPlane'] {
    return renderedProjectedCamera(projectedCamera).clippingPlane;
}

/** How far a pitched view stretches the top of the screen, from the mercator pixel matrix on a globe too. */
export function maxPitchScaleFactor(projectedCamera: ProjectedCamera): number {
    if (projectedCamera.projection === 'globe') return mercatorMath.maxPitchScaleFactor(projectedCamera.mercator);
    return forRenderedProjection(projectedCamera, mercatorMath.maxPitchScaleFactor, verticalPerspectiveMath.maxPitchScaleFactor);
}

export function getCameraAltitude(projectedCamera: ProjectedCamera): number {
    return forRenderedProjection(projectedCamera, mercatorMath.getCameraAltitude, verticalPerspectiveMath.getCameraAltitude);
}

export function getCameraLngLat(projectedCamera: ProjectedCamera, projection: CameraProjection): LngLat {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.getCameraLngLat, verticalPerspectiveMath.getCameraLngLat);
}

export function getBounds(projectedCamera: ProjectedCamera, projection: CameraProjection): LngLatBounds {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.getBounds, verticalPerspectiveMath.getBounds);
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
export function isLocationOccluded(projectedCamera: ProjectedCamera, projection: CameraProjection, lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.isLocationOccluded, verticalPerspectiveMath.isLocationOccluded, lngLat, terrain, elevation);
}

export function locationToScreenPoint(projectedCamera: ProjectedCamera, projection: CameraProjection, lnglat: LngLat, terrain?: Terrain): Point {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.locationToScreenPoint, verticalPerspectiveMath.locationToScreenPoint, lnglat, terrain);
}

export function screenPointToLocation(projectedCamera: ProjectedCamera, projection: CameraProjection, p: Point, terrain?: Terrain): LngLat {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.screenPointToLocation, verticalPerspectiveMath.screenPointToLocation, p, terrain);
}

export function screenPointToLocationAtElevation(projectedCamera: ProjectedCamera, projection: CameraProjection, p: Point, elevation: number): LngLat {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.screenPointToLocationAtElevation, verticalPerspectiveMath.screenPointToLocationAtElevation, p, elevation);
}

export function screenPointToMercatorCoordinate(projectedCamera: ProjectedCamera, projection: CameraProjection, p: Point, terrain?: Terrain): MercatorCoordinate {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.screenPointToMercatorCoordinate, verticalPerspectiveMath.screenPointToMercatorCoordinate, p, terrain);
}

/**
 * The mercator coordinate where the ray through a screen point hits the rendered terrain surface, with z in meters,
 * or null where the terrain has no renderable tiles or the ray never meets it.
 */
export function screenTerrainPointToMercatorCoordinate(projectedCamera: ProjectedCamera, projection: CameraProjection, p: Point, terrain: Terrain): MercatorCoordinate | null {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.screenTerrainPointToMercatorCoordinate, verticalPerspectiveMath.screenTerrainPointToMercatorCoordinate, p, terrain);
}

export function isPointOnMapSurface(projectedCamera: ProjectedCamera, projection: CameraProjection, p: Point, terrain?: Terrain): boolean {
    return forRenderedProjectionWithWorldMapping(projectedCamera, projection, mercatorMath.isPointOnMapSurface, verticalPerspectiveMath.isPointOnMapSurface, p, terrain);
}

/**
 * The normalized direction of the ray from the camera to a screen pixel, in unit-sphere space. Only the globe camera
 * controls ask for it, so a globe answers from its vertical perspective whatever it renders.
 */
export function getRayDirectionFromPixel(projectedCamera: ProjectedCamera, p: Point): vec3 {
    if (projectedCamera.projection === 'mercator') throw new Error('Not implemented.');
    return verticalPerspectiveMath.getRayDirectionFromPixel(projectedCamera.projection === 'globe' ? projectedCamera.verticalPerspective : projectedCamera, p);
}

/**
 * The point on the screen right under the camera: the center point moved down by the pitch and turned by the roll.
 */
export function getCameraPoint(projectedCamera: ProjectedCamera): Point {
    const offset = Math.tan(projectedCamera.pitchInRadians) * (projectedCamera.cameraToCenterDistance || 1);
    return projectedCamera.centerPoint.add(new Point(offset * Math.sin(projectedCamera.rollInRadians), offset * Math.cos(projectedCamera.rollInRadians)));
}

/**
 * The geometry a query for features that may extrude up into the query area covers: the query geometry and the
 * camera point, see {@link getCameraPoint}. A point query on the globe follows the arc to the point below the camera
 * instead, see `getCameraQueryGeometry` in `vertical_perspective_camera_math.ts`.
 * @param queryGeometry - For point queries, the line from the query point to the "camera point",
 * for other geometries, the envelope of the query geometry and the "camera point"
 * @returns a geometry that includes all of the original query as well as all possible ares of the
 * screen where the *base* of a visible extrusion could be.
 */
export function getCameraQueryGeometry(projectedCamera: ProjectedCamera, queryGeometry: Point[]): Point[] {
    const rendered = renderedProjectedCamera(projectedCamera);
    const projectionGeometry = rendered.projection === 'vertical-perspective' ? verticalPerspectiveMath.getCameraQueryGeometry(rendered, queryGeometry) : null;
    if (projectionGeometry) return projectionGeometry;
    const cameraPoint = getCameraPoint(projectedCamera);
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
