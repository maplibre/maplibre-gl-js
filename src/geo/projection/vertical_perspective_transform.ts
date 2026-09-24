import {mat4, vec3, vec4} from 'gl-matrix';
import {Transform} from '../transform.ts';
import {LngLat, type LngLatLike, earthRadius} from '../lng_lat.ts';
import {angleToRotateBetweenVectors2D, clamp, createIdentityMat4f32, degreesToRadians, radiansToDegrees, scaleZoom, createIdentityMat4f64, createMat4f64, createVec3f64, createVec4f64, differenceOfAnglesDegrees, distanceOfAnglesRadians, MAX_VALID_LATITUDE, pointPlaneSignedDistance, remapSaturate, warnOnce, zoomScale, type Mat4f32} from '../../util/util.ts';
import {OverscaledTileID, UnwrappedTileID, type CanonicalTileID} from '../../tile/tile_id.ts';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {tileCoordinatesToMercatorCoordinates} from './mercator_utils.ts';
import {angularCoordinatesToSurfaceVector, clampToSphere, getGlobeRadiusPixels, getZoomAdjustment, horizonPlaneToCenterAndRadius, mercatorCoordinatesToAngularCoordinatesRadians, planetScaleAtLatitude, projectTileCoordinatesToSphere, raySphereIntersection, sphereSurfacePointToCoordinates} from './globe_utils.ts';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider.ts';
import {Frustum} from '../../util/primitives/frustum.ts';
import {bisect, sampleAt, isBelowTerrainSample, TERRAIN_OCCLUSION_MARGIN, type TerrainCoverageIndex, type TerrainSample} from '../../render/terrain_coverage.ts';

import type {PointProjection} from '../../symbol/projection.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {CameraOptionsFromTo, TransformConstrainFunction} from '../transform_interface.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';

const GLOBE_SAMPLES = 256;
const GLOBE_BISECT_EPSILON_T = 1e-12;
/** Latitudes outside the mercator range project past the world edge; the globe mesh still covers them. */
const MAX_MERCATOR_Y = 1 - 1e-9;
/** Two points on the unit globe closer than this, a micrometre, are the same point. */
const SAME_POINT_DISTANCE = 1e-12;
/** A camera whose horizontal offset is this small relative to its distance is straight above the center. */
const STRAIGHT_ABOVE_RATIO = 1e-9;
/**
 * How many times larger than the viewport the area past the mercator edge has grown when the center is back on that edge.
 * While the area fits in the viewport the center can be on the pole.
 */
const POLE_AREA_FADE_SCALE = 4;

/**
 * @internal
 * A ray to intersect with the terrain surface, in globe coordinates:
 * `origin` and the unit-length `direction` are on the unit sphere, and terrain elevations are in meters above sea level.
 */
type GlobeRay = {
    index: TerrainCoverageIndex;
    exaggeration: number;
    origin: vec3;
    direction: vec3;
};

/**
 * @internal
 * The vertical perspective part of a {@link Transform}.
 */
export class VerticalPerspectiveTransform implements IProjectionTransform {
    private _transform: Transform;

    private _cachedClippingPlane: vec4 = createVec4f64();
    private _cachedFrustum: Frustum;
    private _projectionMatrix: mat4 = createIdentityMat4f64();
    private _globeViewProjMatrix32f: Mat4f32 = createIdentityMat4f32(); // Must be 32 bit floats, otherwise WebGL calls in Chrome get very slow.
    private _globeViewProjMatrixF64: mat4 = createIdentityMat4f64();
    private _globeViewProjMatrixF64Inverted: mat4 = createIdentityMat4f64();
    private _globeProjMatrixInverted: mat4 = createIdentityMat4f64();

    private _cameraPosition: vec3 = createVec3f64();
    private _nearZ: number;
    private _farZ: number;
    /**
     * Globe projection can smoothly interpolate between globe view and mercator. This variable controls this interpolation.
     * Value 0 is mercator, value 1 is globe, anything between is an interpolation between the two projections.
     */

    private _coveringTilesDetailsProvider: GlobeCoveringTilesDetailsProvider;

    /**
     * @param transform - The transform whose camera state this part derives its matrices from.
     */
    public constructor(transform: Transform) {
        this._transform = transform;
        this._coveringTilesDetailsProvider = new GlobeCoveringTilesDetailsProvider();
    }

    clone(transform: Transform): VerticalPerspectiveTransform {
        return new VerticalPerspectiveTransform(transform);
    }

    setTransitionState(_value: number): void {
        // Do nothing
    }

    public get projectionMatrix(): mat4 { return this._projectionMatrix; }

    public get nearZ(): number { return this._nearZ; }

    public get farZ(): number { return this._farZ; }

    public get modelViewProjectionMatrix(): mat4 { return this._globeViewProjMatrixF64; }

    public get inverseProjectionMatrix(): mat4 { return this._globeProjMatrixInverted; }

    public get cameraPosition(): vec3 {
        // Return a copy - don't let outside code mutate our precomputed camera position.
        const copy = createVec3f64(); // Ensure the resulting vector is float64s
        copy[0] = this._cameraPosition[0];
        copy[1] = this._cameraPosition[1];
        copy[2] = this._cameraPosition[2];
        return copy;
    }

    getProjectionData(params: ProjectionDataParams): RendererProjectionData {
        const {overscaledTileID, applyGlobeMatrix} = params;
        const mercatorTileCoordinates = this._transform.getMercatorTileCoordinates(overscaledTileID);
        return {
            mainMatrix: this._globeViewProjMatrix32f,
            tileMercatorCoords: mercatorTileCoordinates,
            clippingPlane: this._cachedClippingPlane as [number, number, number, number],
            projectionTransition: applyGlobeMatrix ? 1 : 0,
            fallbackMatrix: this._globeViewProjMatrix32f,
            clipAntimeridian: overscaledTileID?.canonical.z === 0,
        };
    }

    private _computeClippingPlane(globeRadiusPixels: number): vec4 {
        // We want to compute a plane equation that, when applied to the unit sphere generated
        // in the vertex shader, places all visible parts of the sphere into the positive half-space
        // and all the non-visible parts in the negative half-space.
        // We can then use that to accurately clip all non-visible geometry.

        // cam....------------A
        //        ....        |
        //            ....    |
        //                ....B
        //                ggggggggg
        //          gggggg    |   .gggggg
        //       ggg          |       ...ggg    ^
        //     gg             |                 |
        //    g               |                 y
        //    g               |                 |
        //   g                C                 #---x--->
        //
        // Notes:
        // - note the coordinate axes
        // - "g" marks the globe edge
        // - the dotted line is the camera center "ray" - we are looking in this direction
        // - "cam" is camera origin
        // - "C" is globe center
        // - "B" is the point on "top" of the globe - camera is looking at B - "B" is the intersection between the camera center ray and the globe
        // - this._pitchInRadians is the angle at B between points cam,B,A
        // - this._transform.cameraToCenterDistance is the distance from camera to "B"
        // - globe radius is (0.5 * this._transform.worldSize)
        // - "T" is any point where a tangent line from "cam" touches the globe surface
        // - elevation is assumed to be zero - globe rendering must be separate from terrain rendering anyway

        const pitch = this._transform.pitchInRadians;
        // scale things so that the globe radius is 1
        const distanceCameraToB = this._transform.cameraToCenterDistance / globeRadiusPixels;
        const radius = 1;

        // Distance from camera to "A" - the point at the same elevation as camera, right above center point on globe
        const distanceCameraToA = Math.sin(pitch) * distanceCameraToB;
        // Distance from "A" to "C"
        const distanceAtoC = (Math.cos(pitch) * distanceCameraToB + radius);
        // Distance from camera to "C" - the globe center
        const distanceCameraToC = Math.sqrt(distanceCameraToA * distanceCameraToA + distanceAtoC * distanceAtoC);
        // cam - C - T angle cosine (at C)
        const camCTcosine = radius / distanceCameraToC;
        // Distance from globe center to the plane defined by all possible "T" points
        const tangentPlaneDistanceToC = camCTcosine * radius;

        let vectorCtoCamX = -distanceCameraToA;
        let vectorCtoCamY = distanceAtoC;
        // Normalize the vector
        const vectorCtoCamLength = Math.sqrt(vectorCtoCamX * vectorCtoCamX + vectorCtoCamY * vectorCtoCamY);
        vectorCtoCamX /= vectorCtoCamLength;
        vectorCtoCamY /= vectorCtoCamLength;

        // Note the swizzled components
        const planeVector: vec3 = [0, vectorCtoCamX, vectorCtoCamY];
        // Apply transforms - lat, lng and angle (NOT pitch - already accounted for, as it affects the tangent plane)
        vec3.rotateZ(planeVector, planeVector, [0, 0, 0], -this._transform.bearingInRadians);
        vec3.rotateX(planeVector, planeVector, [0, 0, 0], -1 * this._transform.center.lat * Math.PI / 180.0);
        vec3.rotateY(planeVector, planeVector, [0, 0, 0], this._transform.center.lng * Math.PI / 180.0);
        // Normalize the plane vector
        const scale = 1 / vec3.length(planeVector);
        vec3.scale(planeVector, planeVector, scale);
        return [...planeVector, -tangentPlaneDistanceToC * scale];
    }

    /** {@inheritDoc ITransform.isLocationOccluded} */
    public isLocationOccluded(lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        const coverage = terrain?.getCoverageIndex();
        elevation ??= coverage ? terrain.getElevationForLngLat(lngLat, this._transform) : 0;
        const location = raisedSurfaceVector(lngLat, elevation);
        if (!this.isSurfacePointVisible(location)) return true;
        if (!coverage) return false;

        const p = this._projectSurfacePointToScreen(location);
        const origin = this.cameraPosition;
        const direction = this.getRayDirectionFromPixel(p);
        const tLocation = rayParameter(origin, direction, location);
        if (tLocation <= 0) return true;

        const hit = this.screenTerrainPointToMercatorCoordinate(p, terrain);
        return hit != null && rayParameter(origin, direction, raisedSurfaceVector(hit.toLngLat(), hit.z)) < tLocation * (1 - TERRAIN_OCCLUSION_MARGIN);
    }

    public transformLightDirection(dir: vec3): vec3 {
        const sphereX = this._transform.center.lng * Math.PI / 180.0;
        const sphereY = this._transform.center.lat * Math.PI / 180.0;

        const len = Math.cos(sphereY);
        const spherePos: vec3 = [
            Math.sin(sphereX) * len,
            Math.sin(sphereY),
            Math.cos(sphereX) * len
        ];

        const axisRight: vec3 = [spherePos[2], 0.0, -spherePos[0]]; // Equivalent to cross(vec3(0.0, 1.0, 0.0), vec)
        const axisDown: vec3 = [0, 0, 0];
        vec3.cross(axisDown, axisRight, spherePos);
        vec3.normalize(axisRight, axisRight);
        vec3.normalize(axisDown, axisDown);

        const transformed: vec3 = [
            axisRight[0] * dir[0] + axisDown[0] * dir[1] + spherePos[0] * dir[2],
            axisRight[1] * dir[0] + axisDown[1] * dir[1] + spherePos[1] * dir[2],
            axisRight[2] * dir[0] + axisDown[2] * dir[1] + spherePos[2] * dir[2]
        ];

        const normalized: vec3 = [0, 0, 0];
        vec3.normalize(normalized, transformed);
        return normalized;
    }

    public getPixelScale(): number {
        return 1.0 / planetScaleAtLatitude(this._transform.center.lat);
    }

    public getCircleRadiusCorrection(): number {
        return planetScaleAtLatitude(this._transform.center.lat);
    }

    public getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        const mercator = tileCoordinatesToMercatorCoordinates(textAnchorX, textAnchorY, tileID.canonical);
        const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator.x, mercator.y);
        return this.getCircleRadiusCorrection() / Math.cos(angular[1]);
    }

    public projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        const canonical = unwrappedTileID.canonical;
        const spherePos = projectTileCoordinatesToSphere(x, y, canonical.x, canonical.y, canonical.z);
        const vectorMultiplier = 1.0 + (elevation ?? 0.0) / earthRadius;
        const elevatedX = spherePos[0] * vectorMultiplier;
        const elevatedY = spherePos[1] * vectorMultiplier;
        const elevatedZ = spherePos[2] * vectorMultiplier;
        const pos: vec4 = [elevatedX, elevatedY, elevatedZ, 1];
        vec4.transformMat4(pos, pos, this._globeViewProjMatrixF64);

        let isOccluded: boolean;
        if (vectorMultiplier <= 1.0) {
            const plane = this._cachedClippingPlane;
            isOccluded = plane[0] * spherePos[0] + plane[1] * spherePos[1] + plane[2] * spherePos[2] + plane[3] < 0.0;
        } else {
            isOccluded = this._isLineOfSightBlocked(elevatedX, elevatedY, elevatedZ);
        }

        return {
            point: new Point(pos[0] / pos[3], pos[1] / pos[3]),
            signedDistanceFromCamera: pos[3],
            isOccluded
        };
    }

    /**
     * True when the segment from the camera to the given point, both in unit-globe coordinates, passes through the planet.
     */
    private _isLineOfSightBlocked(x: number, y: number, z: number): boolean {
        const cam = this._cameraPosition;
        const dx = x - cam[0];
        const dy = y - cam[1];
        const dz = z - cam[2];
        const lengthSq = dx * dx + dy * dy + dz * dz;
        if (lengthSq === 0) return false;
        const t = clamp(-(cam[0] * dx + cam[1] * dy + cam[2] * dz) / lengthSq, 0, 1);
        const cx = cam[0] + t * dx;
        const cy = cam[1] + t * dy;
        const cz = cam[2] + t * dz;
        return cx * cx + cy * cy + cz * cz < 1.0;
    }

    calcMatrices(): void {
        const globeRadiusPixels = getGlobeRadiusPixels(this._transform.worldSize, this._transform.center.lat);

        // Construct a completely separate matrix for globe view
        const globeMatrix = createMat4f64();
        const override = this._transform.nearFarZOverride;
        this._nearZ = override ? override.nearZ : 0.5;
        this._farZ = override ? override.farZ : this._transform.cameraToCenterDistance + globeRadiusPixels * 2.0; // just set the far plane far enough - we will calculate our own z in the vertex shader anyway
        mat4.perspective(globeMatrix, this._transform.fovInRadians, this._transform.width / this._transform.height, this._nearZ, this._farZ);

        // Apply center of perspective offset
        const offset = this._transform.centerOffset;
        globeMatrix[8] = -offset.x * 2 / this._transform.width;
        globeMatrix[9] = offset.y * 2 / this._transform.height;
        this._projectionMatrix = mat4.clone(globeMatrix);

        this._globeProjMatrixInverted = createMat4f64();
        mat4.invert(this._globeProjMatrixInverted, globeMatrix);
        mat4.translate(globeMatrix, globeMatrix, [0, 0, -this._transform.cameraToCenterDistance]);
        mat4.rotateZ(globeMatrix, globeMatrix, this._transform.rollInRadians);
        mat4.rotateX(globeMatrix, globeMatrix, -this._transform.pitchInRadians);
        mat4.rotateZ(globeMatrix, globeMatrix, this._transform.bearingInRadians);
        mat4.translate(globeMatrix, globeMatrix, [0.0, 0, -globeRadiusPixels]);
        // Rotate the sphere to center it on viewed coordinates

        const scaleVec = createVec3f64();
        scaleVec[0] = globeRadiusPixels;
        scaleVec[1] = globeRadiusPixels;
        scaleVec[2] = globeRadiusPixels;

        mat4.rotateX(globeMatrix, globeMatrix, this._transform.center.lat * Math.PI / 180.0);
        mat4.rotateY(globeMatrix, globeMatrix, -this._transform.center.lng * Math.PI / 180.0);
        mat4.scale(globeMatrix, globeMatrix, scaleVec); // Scale the unit sphere to a sphere with diameter of 1
        this._globeViewProjMatrixF64 = globeMatrix;
        this._globeViewProjMatrix32f = new Float32Array(globeMatrix);

        this._globeViewProjMatrixF64Inverted = createMat4f64();
        mat4.invert(this._globeViewProjMatrixF64Inverted, globeMatrix);

        const zero = createVec3f64();
        this._cameraPosition = createVec3f64();
        this._cameraPosition[2] = this._transform.cameraToCenterDistance / globeRadiusPixels;
        vec3.rotateZ(this._cameraPosition, this._cameraPosition, zero, -this._transform.rollInRadians);
        vec3.rotateX(this._cameraPosition, this._cameraPosition, zero, this._transform.pitchInRadians);
        vec3.rotateZ(this._cameraPosition, this._cameraPosition, zero, -this._transform.bearingInRadians);
        vec3.add(this._cameraPosition, this._cameraPosition, [0, 0, 1]);
        vec3.rotateX(this._cameraPosition, this._cameraPosition, zero, -this._transform.center.lat * Math.PI / 180.0);
        vec3.rotateY(this._cameraPosition, this._cameraPosition, zero, this._transform.center.lng * Math.PI / 180.0);

        this._cachedClippingPlane = this._computeClippingPlane(globeRadiusPixels);

        const matrix = mat4.clone(this._globeViewProjMatrixF64Inverted);
        mat4.scale(matrix, matrix, [1, 1, -1]);
        this._cachedFrustum = Frustum.fromInvProjectionMatrix(matrix, 1, 0, this._cachedClippingPlane, true);
    }

    calculateFogMatrix(_unwrappedTileID: UnwrappedTileID): mat4 {
        warnOnce('calculateFogMatrix is not supported on globe projection.');
        const m = createMat4f64();
        mat4.identity(m);
        return m;
    }

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        // Globe has no wrap.
        return [new UnwrappedTileID(0, tileID)];
    }

    getCameraFrustum(): Frustum {
        return this._cachedFrustum;
    }
    getClippingPlane(): vec4 | null {
        return this._cachedClippingPlane;
    }
    getCoveringTilesDetailsProvider(): CoveringTilesDetailsProvider {
        return this._coveringTilesDetailsProvider;
    }

    recalculateZoomAndCenter(terrain?: Terrain): void {
        if (terrain) {
            warnOnce('terrain is not fully supported on vertical perspective projection.');
            return;
        }
        this._transform.recalculateZoomAndCenterAtElevation(0);
    }

    maxPitchScaleFactor(): number {
        // In mercaltor it uses the pixelMatrix, but this is not available here...
        return 1;
    }

    /**
     * The altitude of the rendered camera above sea level. The sphere keeps the center point at sea level whatever its
     * elevation (`calcMatrices` does not apply it), so unlike on mercator the center elevation does not lift the camera.
     * {@link calculateCameraOptionsFromTo} is the inverse.
     */
    getCameraAltitude(): number {
        // The camera position is in unit-globe coordinates, with the sea-level surface at radius 1.
        return (vec3.length(this._cameraPosition) - 1) * earthRadius;
    }

    getCameraLngLat(): LngLat {
        const surface = createVec3f64();
        vec3.normalize(surface, this._cameraPosition);
        return sphereSurfacePointToCoordinates(surface);
    }

    populateCache(_coords: OverscaledTileID[]): void {
        // Do nothing
    }

    getBounds(): LngLatBounds {
        const xMid = this._transform.width * 0.5;
        const yMid = this._transform.height * 0.5;

        // LngLat extremes will probably tend to be in screen corners or in middle of screen edges.
        // These test points should result in a pretty good approximation.
        const testPoints = [
            new Point(0, 0),
            new Point(xMid, 0),
            new Point(this._transform.width, 0),
            new Point(this._transform.width, yMid),
            new Point(this._transform.width, this._transform.height),
            new Point(xMid, this._transform.height),
            new Point(0, this._transform.height),
            new Point(0, yMid),
        ];

        const projectedPoints = [];
        for (const p of testPoints) {
            projectedPoints.push(this.unprojectScreenPoint(p));
        }

        // We can't construct a simple min/max aabb, since points might lie on either side of the antimeridian.
        // We will instead compute the furthest points relative to map center.
        // We also take advantage of the fact that `unprojectScreenPoint` will snap pixels
        // outside the planet to the closest point on the planet's horizon.
        let mostEast = 0, mostWest = 0, mostNorth = 0, mostSouth = 0; // We will store these values signed.
        const center = this._transform.center;
        for (const p of projectedPoints) {
            const dLng = differenceOfAnglesDegrees(center.lng, p.lng);
            const dLat = differenceOfAnglesDegrees(center.lat, p.lat);
            if (dLng < mostWest) {
                mostWest = dLng;
            }
            if (dLng > mostEast) {
                mostEast = dLng;
            }
            if (dLat < mostSouth) {
                mostSouth = dLat;
            }
            if (dLat > mostNorth) {
                mostNorth = dLat;
            }
        }

        const boundsArray: [number, number, number, number] = [
            center.lng + mostWest,  // west
            center.lat + mostSouth, // south
            center.lng + mostEast,  // east
            center.lat + mostNorth  // north
        ];

        // Sometimes the poles might end up not being on the horizon,
        // thus not being detected as the northernmost/southernmost points.
        // We fix that here.
        if (this.isSurfacePointOnScreen([0, 1, 0])) {
            // North pole is visible
            // This also means that the entire longitude range must be visible
            boundsArray[3] = 90;
            boundsArray[0] = -180;
            boundsArray[2] = 180;
        }
        if (this.isSurfacePointOnScreen([0, -1, 0])) {
            // South pole is visible
            boundsArray[1] = -90;
            boundsArray[0] = -180;
            boundsArray[2] = 180;
        }

        return new LngLatBounds(boundsArray);
    }

    defaultConstrain: TransformConstrainFunction = (lngLat, zoom) => {
        // Globe: TODO: respect _lngRange, _latRange
        // It is possible to implement exact constrain for globe, but I don't think it is worth the effort.
        const constrainedZoom = clamp(+zoom, this._transform.minZoom + getZoomAdjustment(0, lngLat.lat), this._transform.maxZoom);
        const maxLatitude = this._getMaxLatitude(constrainedZoom);
        return {
            center: new LngLat(
                lngLat.lng,
                clamp(lngLat.lat, -maxLatitude, maxLatitude)
            ),
            zoom: constrainedZoom
        };
    };

    /**
     * Returns how close to a pole the center can be at the given zoom. Past the mercator edge there is no data,
     * so the center reaches the pole only while that area fits in the viewport, and eases back to the edge as it outgrows it.
     */
    private _getMaxLatitude(zoom: number): number {
        const areaRadians = degreesToRadians(90 - MAX_VALID_LATITUDE);
        const areaPixels = getGlobeRadiusPixels(this._transform.tileSize * zoomScale(zoom), MAX_VALID_LATITUDE) * areaRadians;
        const reachPixels = Math.min(this._transform.width, this._transform.height) / 2;
        const centerPixels = Math.min(areaPixels, reachPixels) * remapSaturate(areaPixels, reachPixels, reachPixels * POLE_AREA_FADE_SCALE, 1, 0);
        return MAX_VALID_LATITUDE + radiansToDegrees(areaRadians * centerPixels / areaPixels);
    }

    /**
     * Inverts the camera placement of `calcMatrices` in unit-globe coordinates: the camera sits at radius
     * `1 + altitudeFrom / earthRadius` and looks at the center on the sea-level sphere, the target altitude only becoming
     * the center elevation (the inverse of {@link getCameraAltitude}). Pitch and bearing are read in the center's local
     * frame, +z up, +y north, +x east. A camera straight above the center keeps the transform's bearing.
     */
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const center = LngLat.convert(to);
        const camera = angularCoordinatesToSurfaceVector(LngLat.convert(from));
        vec3.scale(camera, camera, 1 + altitudeFrom / earthRadius);
        const target = angularCoordinatesToSurfaceVector(center);
        const targetAtAltitude = vec3.scale(createVec3f64(), target, 1 + altitudeTo / earthRadius);
        const toCamera = vec3.subtract(createVec3f64(), camera, target);
        const distance = vec3.length(toCamera);
        if (distance < SAME_POINT_DISTANCE || vec3.distance(camera, targetAtAltitude) < SAME_POINT_DISTANCE) {
            throw new Error('Can\'t calculate camera options with same From and To');
        }

        const zero = createVec3f64();
        vec3.rotateY(toCamera, toCamera, zero, -degreesToRadians(center.lng));
        vec3.rotateX(toCamera, toCamera, zero, degreesToRadians(center.lat));
        const pitch = radiansToDegrees(Math.acos(clamp(toCamera[2] / distance, -1, 1)));
        const straightAbove = Math.hypot(toCamera[0], toCamera[1]) < distance * STRAIGHT_ABOVE_RATIO;
        const bearing = straightAbove ? this._transform.bearing : radiansToDegrees(Math.atan2(-toCamera[0], -toCamera[1]));

        // The camera sits cameraToCenterDistance / getGlobeRadiusPixels(worldSize, lat) from the center, and the radius doubles per zoom level.
        const zoom = scaleZoom(this._transform.cameraToCenterDistance / distance / getGlobeRadiusPixels(this._transform.tileSize, center.lat));

        return {center, elevation: altitudeTo, zoom, pitch, bearing};
    }

    /**
     * Note: automatically adjusts zoom to keep planet size consistent
     * (same size before and after a {@link setLocationAtPoint} call).
     */
    setLocationAtPoint(lnglat: LngLat, point: Point, _elevation?: number): void {
        // The elevation is ignored: this transform solves on the planet's surface.
        // This returns some fake coordinates for pixels that do not lie on the planet.
        // Whatever uses this `setLocationAtPoint` function will need to account for that.
        const pointLngLat = this.unprojectScreenPoint(point);
        const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
        const vecToTarget = angularCoordinatesToSurfaceVector(lnglat);

        const zero = createVec3f64();
        vec3.zero(zero);

        const rotatedPixelVector = createVec3f64();
        vec3.rotateY(rotatedPixelVector, vecToPixelCurrent, zero, -this._transform.center.lng * Math.PI / 180.0);
        vec3.rotateX(rotatedPixelVector, rotatedPixelVector, zero, this._transform.center.lat * Math.PI / 180.0);

        // We are looking for the lng,lat that will rotate `vecToTarget`
        // so that it is equal to `rotatedPixelVector`.

        // The second rotation around X axis cannot change the X component,
        // so we first must find the longitude such that rotating `vecToTarget` with it
        // will place it so its X component is equal to X component of `rotatedPixelVector`.
        // There will exist zero, one or two longitudes that satisfy this.

        //      x  |
        //     /   |
        //    /    | the line is the target X - rotatedPixelVector.x
        //   /     | the x is vecToTarget projected to x,z plane
        //  .      | the dot is origin
        //
        // We need to rotate vecToTarget so that it intersects the line.
        // If vecToTarget is shorter than the distance to the line from origin, it is impossible.

        // Otherwise, we compute the intersection of the line with a ring with radius equal to
        // length of vecToTarget projected to XZ plane.

        const vecToTargetXZLengthSquared = vecToTarget[0] * vecToTarget[0] + vecToTarget[2] * vecToTarget[2];
        const targetXSquared = rotatedPixelVector[0] * rotatedPixelVector[0];
        if (vecToTargetXZLengthSquared < targetXSquared) {
            // Zero solutions - setLocationAtPoint is impossible.
            return;
        }

        // The intersection's Z coordinates
        const intersectionA = Math.sqrt(vecToTargetXZLengthSquared - targetXSquared);
        const intersectionB = -intersectionA; // the second solution

        const lngA = angleToRotateBetweenVectors2D(vecToTarget[0], vecToTarget[2], rotatedPixelVector[0], intersectionA);
        const lngB = angleToRotateBetweenVectors2D(vecToTarget[0], vecToTarget[2], rotatedPixelVector[0], intersectionB);

        const vecToTargetLngA = createVec3f64();
        vec3.rotateY(vecToTargetLngA, vecToTarget, zero, -lngA);
        const latA = angleToRotateBetweenVectors2D(vecToTargetLngA[1], vecToTargetLngA[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        const vecToTargetLngB = createVec3f64();
        vec3.rotateY(vecToTargetLngB, vecToTarget, zero, -lngB);
        const latB = angleToRotateBetweenVectors2D(vecToTargetLngB[1], vecToTargetLngB[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        // Is at least one of the needed latitudes valid?

        const limit = Math.PI * 0.5;

        const isValidA = latA >= -limit && latA <= limit;
        const isValidB = latB >= -limit && latB <= limit;

        let validLng: number;
        let validLat: number;
        if (isValidA && isValidB) {
            // Pick the solution that is closer to current map center.
            const centerLngRadians = this._transform.center.lng * Math.PI / 180.0;
            const centerLatRadians = this._transform.center.lat * Math.PI / 180.0;
            const lngDistA = distanceOfAnglesRadians(lngA, centerLngRadians);
            const latDistA = distanceOfAnglesRadians(latA, centerLatRadians);
            const lngDistB = distanceOfAnglesRadians(lngB, centerLngRadians);
            const latDistB = distanceOfAnglesRadians(latB, centerLatRadians);

            if ((lngDistA + latDistA) < (lngDistB + latDistB)) {
                validLng = lngA;
                validLat = latA;
            } else {
                validLng = lngB;
                validLat = latB;
            }
        } else if (isValidA) {
            validLng = lngA;
            validLat = latA;
        } else if (isValidB) {
            validLng = lngB;
            validLat = latB;
        } else {
            // No solution.
            return;
        }

        const newLng = validLng / Math.PI * 180;
        const newLat = validLat / Math.PI * 180;
        const oldLat = this._transform.center.lat;
        this._transform.setCenter(new LngLat(newLng, clamp(newLat, -90, 90)));
        this._transform.setZoom(this._transform.zoom + getZoomAdjustment(oldLat, this._transform.center.lat));
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        const pos = angularCoordinatesToSurfaceVector(lnglat);

        if (terrain) {
            const elevation = terrain.getElevationForLngLat(lnglat, this._transform);
            vec3.scale(pos, pos, 1.0 + elevation / earthRadius);
        }

        return this._projectSurfacePointToScreen(pos);
    }

    /**
     * Projects a given vector on the surface of a unit sphere (or possible above the surface)
     * and returns its coordinates on screen in pixels.
     */
    private _projectSurfacePointToScreen(pos: vec3): Point {
        const projected = createVec4f64();
        vec4.transformMat4(projected, [...pos, 1] as vec4, this._globeViewProjMatrixF64);
        projected[0] /= projected[3];
        projected[1] /= projected[3];
        return new Point(
            (projected[0] * 0.5 + 0.5) * this._transform.width,
            (-projected[1] * 0.5 + 0.5) * this._transform.height
        );
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        if (terrain) {
            const coordinate = this.screenTerrainPointToMercatorCoordinate(p, terrain);
            if (coordinate) {
                return coordinate;
            }
        }
        return MercatorCoordinate.fromLngLat(this.unprojectScreenPoint(p));
    }

    /** {@inheritDoc ITransform.screenTerrainPointToMercatorCoordinate} */
    screenTerrainPointToMercatorCoordinate(p: Point, terrain: Terrain): MercatorCoordinate | null {
        const index = terrain.getCoverageIndex();
        if (!index) return null;

        const origin = this.cameraPosition;
        const direction = this.getRayDirectionFromPixel(p);
        const outer = raySphereIntersection(origin, direction, 1 + index.maxElevation / earthRadius);
        if (!outer) return null;
        const inner = raySphereIntersection(origin, direction, 1 + index.minElevation / earthRadius);

        const tStart = Math.max(outer.tMin, 0);
        const tEnd = inner ? inner.tMin : outer.tMax;
        if (tEnd <= tStart) return null;

        const ray: GlobeRay = {index, exaggeration: terrain.exaggeration, origin, direction};

        let previousT = 0;
        for (let i = 0; i <= GLOBE_SAMPLES; i++) {
            const t = tStart + (tEnd - tStart) * i / GLOBE_SAMPLES;
            if (globeIsBelowTerrain(ray, t)) {
                const {hi} = bisect(ray, globeIsBelowTerrain, previousT, t, GLOBE_BISECT_EPSILON_T);
                const {sample, mercator} = globeSampleAt(ray, hi);
                return new MercatorCoordinate(mercator.x, mercator.y, sample.elevation);
            }
            previousT = t;
        }

        return null;
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return this.screenPointToMercatorCoordinate(p, terrain)?.toLngLat();
    }

    screenPointToLocationAtElevation(p: Point, _elevation: number): LngLat {
        // No flat ground plane to intersect at an elevation: use the planet surface.
        return this.screenPointToLocation(p);
    }

    isPointOnMapSurface(p: Point, _terrain?: Terrain): boolean {
        const rayOrigin = this._cameraPosition;
        const rayDirection = this.getRayDirectionFromPixel(p);

        const intersection = raySphereIntersection(rayOrigin, rayDirection);

        return !!intersection;
    }

    /**
     * Computes normalized direction of a ray from the camera to the given screen pixel.
     */
    getRayDirectionFromPixel(p: Point): vec3 {
        const pos = createVec4f64();
        pos[0] = (p.x / this._transform.width) * 2.0 - 1.0;
        pos[1] = ((p.y / this._transform.height) * 2.0 - 1.0) * -1.0;
        pos[2] = 1;
        pos[3] = 1;
        vec4.transformMat4(pos, pos, this._globeViewProjMatrixF64Inverted);
        pos[0] /= pos[3];
        pos[1] /= pos[3];
        pos[2] /= pos[3];
        const ray = createVec3f64();
        ray[0] = pos[0] - this._cameraPosition[0];
        ray[1] = pos[1] - this._cameraPosition[1];
        ray[2] = pos[2] - this._cameraPosition[2];
        const rayNormalized: vec3 = createVec3f64();
        vec3.normalize(rayNormalized, ray);
        return rayNormalized;
    }

    /**
     * For a given point on the unit sphere of the planet, or raised above it, returns whether it lies on the camera's
     * side of the horizon plane, the plane the globe shaders clip with (not taking into account camera rotation at all).
     */
    private isSurfacePointVisible(p: vec3): boolean {
        const plane = this._cachedClippingPlane;
        // dot(position on sphere, occlusion plane equation)
        const dotResult = plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
        return dotResult >= 0.0;
    }

    /**
     * Returns whether surface point is visible on screen.
     * It must both project to a pixel in screen bounds and not be occluded by the planet.
     */
    private isSurfacePointOnScreen(vec: vec3): boolean {
        if (!this.isSurfacePointVisible(vec)) {
            return false;
        }

        const projected = createVec4f64();
        vec4.transformMat4(projected, [...vec, 1] as vec4, this._globeViewProjMatrixF64);
        projected[0] /= projected[3];
        projected[1] /= projected[3];
        projected[2] /= projected[3];
        return projected[0] > -1 && projected[0] < 1 &&
            projected[1] > -1 && projected[1] < 1 &&
            projected[2] > -1 && projected[2] < 1;
    }

    /**
     * @internal
     * Returns a {@link LngLat} representing geographical coordinates that correspond to the specified pixel coordinates.
     * Note: if the point does not lie on the globe, returns a location on the visible globe horizon (edge) that is
     * as close to the point as possible.
     * @param p - Screen point in pixels to unproject.
     * @param terrain - Optional terrain.
     */
    private unprojectScreenPoint(p: Point): LngLat {
        // Here we compute the intersection of the ray towards the pixel at `p` and the planet sphere.
        // As always, we assume that the planet is centered at 0,0,0 and has radius 1.
        // Ray origin is `_cameraPosition` and direction is `rayNormalized`.
        const rayOrigin = this._cameraPosition;
        const rayDirection = this.getRayDirectionFromPixel(p);
        const intersection = raySphereIntersection(rayOrigin, rayDirection);

        if (intersection) {
            // Ray intersects the sphere -> compute intersection LngLat.
            // Assume the ray origin is never inside the sphere - just use tMin
            const intersectionPoint = createVec3f64();
            vec3.add(intersectionPoint, rayOrigin, [
                rayDirection[0] * intersection.tMin,
                rayDirection[1] * intersection.tMin,
                rayDirection[2] * intersection.tMin
            ]);
            const sphereSurface = createVec3f64();
            vec3.normalize(sphereSurface, intersectionPoint);
            return sphereSurfacePointToCoordinates(sphereSurface);
        }

        // Ray does not intersect the sphere -> find the closest point on the horizon to the ray.
        // Intersect the ray with the clipping plane, since we know that the intersection of the clipping plane and the sphere is the horizon.
        const horizonPlane = this._cachedClippingPlane;
        const directionDotPlaneXyz = horizonPlane[0] * rayDirection[0] + horizonPlane[1] * rayDirection[1] + horizonPlane[2] * rayDirection[2];
        const originToPlaneDistance = pointPlaneSignedDistance(horizonPlane, rayOrigin);
        const distanceToIntersection = -originToPlaneDistance / directionDotPlaneXyz;

        const maxRayLength = 2.0; // One globe diameter
        const planeIntersection = createVec3f64();

        if (distanceToIntersection > 0) {
            vec3.add(planeIntersection, rayOrigin, [
                rayDirection[0] * distanceToIntersection,
                rayDirection[1] * distanceToIntersection,
                rayDirection[2] * distanceToIntersection
            ]);
        } else {
            // When the ray takes too long to hit the plane (>maxRayLength), or if the plane intersection is behind the camera, handle things differently.
            // Take a point along the ray at distance maxRayLength, project it to clipping plane, then continue as normal to find the horizon point.
            const distantPoint = createVec3f64();
            vec3.add(distantPoint, rayOrigin, [
                rayDirection[0] * maxRayLength,
                rayDirection[1] * maxRayLength,
                rayDirection[2] * maxRayLength
            ]);
            const distanceFromPlane = pointPlaneSignedDistance(this._cachedClippingPlane, distantPoint);
            vec3.sub(planeIntersection, distantPoint, [
                this._cachedClippingPlane[0] * distanceFromPlane,
                this._cachedClippingPlane[1] * distanceFromPlane,
                this._cachedClippingPlane[2] * distanceFromPlane
            ]);
        }

        const horizonDisk = horizonPlaneToCenterAndRadius(horizonPlane);
        const closestOnHorizon = clampToSphere(horizonDisk.center, horizonDisk.radius, planeIntersection);

        return sphereSurfacePointToCoordinates(closestOnHorizon);
    }

    getProjectionDataForCustomLayer(applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        const globeData = this.getProjectionData({overscaledTileID: new OverscaledTileID(0, 0, 0, 0, 0), applyGlobeMatrix});
        globeData.tileMercatorCoords = [0, 0, 1, 1];
        return globeData;
    }

    getFastPathSimpleProjectionMatrix(_tileID: OverscaledTileID): mat4 {
        return undefined;
    }
}

/**
 * Creates a transform for the vertical perspective projection.
 */
export function createVerticalPerspectiveTransform(options?: TransformOptions): Transform {
    return new Transform((transform) => new VerticalPerspectiveTransform(transform), options);
}

function globeSampleAt(ray: GlobeRay, t: number): {sample: TerrainSample; radius: number; mercator: MercatorCoordinate} {
    const position = createVec3f64();
    vec3.scaleAndAdd(position, ray.origin, ray.direction, t);
    const radius = vec3.length(position);
    const surface = createVec3f64();
    vec3.scale(surface, position, 1 / radius);
    const lngLat = sphereSurfacePointToCoordinates(surface);
    const projected = MercatorCoordinate.fromLngLat(lngLat);
    const mercator = new MercatorCoordinate(projected.x, clamp(projected.y, 0, MAX_MERCATOR_Y));
    const sample = sampleAt(ray.index, ray.exaggeration, mercator.x, mercator.y);
    // The globe mesh caps the poles at elevation zero, matching the GLOBE branch of get_elevation.
    const elevation = Math.abs(lngLat.lat) > MAX_VALID_LATITUDE ? 0 : sample.elevation;
    return {sample: {...sample, elevation}, radius, mercator};
}

function globeIsBelowTerrain(ray: GlobeRay, t: number): boolean {
    const {sample, radius} = globeSampleAt(ray, t);
    return isBelowTerrainSample(sample, (radius - 1) * earthRadius);
}

/**
 * The location as a vector from the globe's center in globe radii, raised `elevation` meters above the surface.
 */
function raisedSurfaceVector(lngLat: LngLat, elevation: number): vec3 {
    const vector = angularCoordinatesToSurfaceVector(lngLat);
    return vec3.scale(vector, vector, 1 + elevation / earthRadius);
}

/**
 * Where the point of the ray closest to `point` lies along it, in units of `direction` from `origin`.
 */
function rayParameter(origin: vec3, direction: vec3, point: vec3): number {
    const offset = vec3.subtract(createVec3f64(), point, origin);
    return vec3.dot(offset, direction);
}
