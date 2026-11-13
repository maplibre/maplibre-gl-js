import {lerp} from '../util/util.ts';
import {isGlobeRendering, renderedProjectedCamera} from './projected_camera.ts';

import type Point from '@mapbox/point-geometry';
import type {mat4, vec3, vec4} from 'gl-matrix';
import type {GlobeProjectedCamera} from './projected_camera.ts';
import type {LngLat} from '../geo/lng_lat.ts';
import type {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import type {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import type {PointProjection} from '../symbol/projection.ts';
import type {Terrain} from '../render/terrain.ts';
import type {Frustum} from '../util/primitives/frustum.ts';
import type {CameraMath} from './camera_math.ts';
import type {MercatorCameraMath} from './mercator_camera_math.ts';
import type {VerticalPerspectiveCameraMath} from './vertical_perspective_camera_math.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

/**
 * @internal
 * The {@link CameraMath} of the globe, which draws as the vertical perspective while it renders and as mercator once
 * it has turned into mercator at high zoom levels, see {@link renderedProjectedCamera}. Most methods answer from the
 * projection the globe renders with; the matrices and corrections the renderer draws the transition with blend the
 * two by the globe's `globeness`.
 */
export class GlobeCameraMath implements CameraMath {
    private readonly _mercator: MercatorCameraMath;
    private readonly _verticalPerspective: VerticalPerspectiveCameraMath;

    constructor(mercator: MercatorCameraMath, verticalPerspective: VerticalPerspectiveCameraMath) {
        this._mercator = mercator;
        this._verticalPerspective = verticalPerspective;
    }

    /** The math of the projection the globe renders with, which is handed {@link renderedProjectedCamera}. */
    private _renderedMath(projectedCamera: GlobeProjectedCamera): CameraMath {
        return isGlobeRendering(projectedCamera) ? this._verticalPerspective : this._mercator;
    }

    getProjectionData(projectedCamera: GlobeProjectedCamera, params: ProjectionDataParams): RendererProjectionData {
        const mercatorProjectionData = this._mercator.getProjectionData(projectedCamera.mercator, params);
        const verticalPerspectiveProjectionData = this._verticalPerspective.getProjectionData(projectedCamera.verticalPerspective, params);
        return {
            mainMatrix: isGlobeRendering(projectedCamera) ? verticalPerspectiveProjectionData.mainMatrix : mercatorProjectionData.mainMatrix,
            clippingPlane: verticalPerspectiveProjectionData.clippingPlane,
            tileMercatorCoords: verticalPerspectiveProjectionData.tileMercatorCoords,
            projectionTransition: params.applyGlobeMatrix ? projectedCamera.globeness : 0,
            fallbackMatrix: mercatorProjectionData.fallbackMatrix,
            clipAntimeridian: verticalPerspectiveProjectionData.clipAntimeridian,
        };
    }

    getProjectionDataForCustomLayer(projectedCamera: GlobeProjectedCamera, applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        const mercatorData = this._mercator.getProjectionDataForCustomLayer(projectedCamera.mercator, applyGlobeMatrix);
        if (!isGlobeRendering(projectedCamera)) return mercatorData;
        const globeData = this._verticalPerspective.getProjectionDataForCustomLayer(projectedCamera.verticalPerspective, applyGlobeMatrix);
        globeData.fallbackMatrix = mercatorData.mainMatrix;
        globeData.projectionTransition = projectedCamera.globeness;
        return globeData;
    }

    getFastPathSimpleProjectionMatrix(projectedCamera: GlobeProjectedCamera, tileID: OverscaledTileID): mat4 {
        return this._renderedMath(projectedCamera).getFastPathSimpleProjectionMatrix(renderedProjectedCamera(projectedCamera), tileID);
    }

    projectTileCoordinates(projectedCamera: GlobeProjectedCamera, x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        return this._renderedMath(projectedCamera).projectTileCoordinates(renderedProjectedCamera(projectedCamera), x, y, unwrappedTileID, elevation);
    }

    getPitchedTextCorrection(projectedCamera: GlobeProjectedCamera, textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        return lerp(
            this._mercator.getPitchedTextCorrection(projectedCamera.mercator, textAnchorX, textAnchorY, tileID),
            this._verticalPerspective.getPitchedTextCorrection(projectedCamera.verticalPerspective, textAnchorX, textAnchorY, tileID),
            projectedCamera.globeness);
    }

    getCircleRadiusCorrection(projectedCamera: GlobeProjectedCamera): number {
        return this._renderedMath(projectedCamera).getCircleRadiusCorrection(renderedProjectedCamera(projectedCamera));
    }

    getPixelScale(projectedCamera: GlobeProjectedCamera): number {
        return lerp(
            this._mercator.getPixelScale(projectedCamera.mercator),
            this._verticalPerspective.getPixelScale(projectedCamera.verticalPerspective),
            projectedCamera.globeness);
    }

    transformLightDirection(projectedCamera: GlobeProjectedCamera, dir: vec3): vec3 {
        return this._renderedMath(projectedCamera).transformLightDirection(renderedProjectedCamera(projectedCamera), dir);
    }

    calculateFogMatrix(projectedCamera: GlobeProjectedCamera, unwrappedTileID: UnwrappedTileID): mat4 {
        return this._renderedMath(projectedCamera).calculateFogMatrix(renderedProjectedCamera(projectedCamera), unwrappedTileID);
    }

    getVisibleUnwrappedCoordinates(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, tileID: CanonicalTileID): UnwrappedTileID[] {
        return this._renderedMath(projectedCamera).getVisibleUnwrappedCoordinates(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, tileID);
    }

    getCameraFrustum(projectedCamera: GlobeProjectedCamera): Frustum {
        return this._renderedMath(projectedCamera).getCameraFrustum(renderedProjectedCamera(projectedCamera));
    }

    getClippingPlane(projectedCamera: GlobeProjectedCamera): vec4 | null {
        return this._renderedMath(projectedCamera).getClippingPlane(renderedProjectedCamera(projectedCamera));
    }

    /** Read from the mercator pixel matrix whatever the globe renders with. */
    maxPitchScaleFactor(projectedCamera: GlobeProjectedCamera): number {
        return this._mercator.maxPitchScaleFactor(projectedCamera.mercator);
    }

    getCameraAltitude(projectedCamera: GlobeProjectedCamera): number {
        return this._renderedMath(projectedCamera).getCameraAltitude(renderedProjectedCamera(projectedCamera));
    }

    getCameraLngLat(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper): LngLat {
        return this._renderedMath(projectedCamera).getCameraLngLat(renderedProjectedCamera(projectedCamera), worldCoordinateHelper);
    }

    getBounds(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper): LngLatBounds {
        return this._renderedMath(projectedCamera).getBounds(renderedProjectedCamera(projectedCamera), worldCoordinateHelper);
    }

    isLocationOccluded(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        return this._renderedMath(projectedCamera).isLocationOccluded(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, lngLat, terrain, elevation);
    }

    locationToScreenPoint(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, terrain?: Terrain): Point {
        return this._renderedMath(projectedCamera).locationToScreenPoint(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, lngLat, terrain);
    }

    screenPointToLocation(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): LngLat {
        return this._renderedMath(projectedCamera).screenPointToLocation(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, p, terrain);
    }

    screenPointToLocationAtElevation(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, elevation: number): LngLat {
        return this._renderedMath(projectedCamera).screenPointToLocationAtElevation(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, p, elevation);
    }

    screenPointToMercatorCoordinate(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): MercatorCoordinate {
        return this._renderedMath(projectedCamera).screenPointToMercatorCoordinate(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, p, terrain);
    }

    screenTerrainPointToMercatorCoordinate(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain: Terrain): MercatorCoordinate | null {
        return this._renderedMath(projectedCamera).screenTerrainPointToMercatorCoordinate(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, p, terrain);
    }

    isPointOnMapSurface(projectedCamera: GlobeProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): boolean {
        return this._renderedMath(projectedCamera).isPointOnMapSurface(renderedProjectedCamera(projectedCamera), worldCoordinateHelper, p, terrain);
    }

    /** Answered from the vertical perspective whatever the globe renders with: only the globe camera controls ask. */
    getRayDirectionFromPixel(projectedCamera: GlobeProjectedCamera, p: Point): vec3 {
        return this._verticalPerspective.getRayDirectionFromPixel(projectedCamera.verticalPerspective, p);
    }

    getCameraQueryGeometry(projectedCamera: GlobeProjectedCamera, queryGeometry: Point[]): Point[] {
        return this._renderedMath(projectedCamera).getCameraQueryGeometry(renderedProjectedCamera(projectedCamera), queryGeometry);
    }
}
