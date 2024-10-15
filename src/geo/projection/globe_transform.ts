import {mat2, mat4, vec3, vec4} from 'gl-matrix';
import {MAX_VALID_LATITUDE, TransformHelper} from '../transform_helper';
import {MercatorTransform} from './mercator_transform';
import {LngLat, LngLatLike, earthRadius} from '../lng_lat';
import {angleToRotateBetweenVectors2D, clamp, createIdentityMat4f64, createMat4f64, createVec3f64, createVec4f64, differenceOfAnglesDegrees, distanceOfAnglesRadians, easeCubicInOut, lerp, pointPlaneSignedDistance, warnOnce} from '../../util/util';
import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../../source/tile_id';
import Point from '@mapbox/point-geometry';
import {browser} from '../../util/browser';
import {Terrain} from '../../render/terrain';
import {GlobeProjection, globeConstants} from './globe';
import {MercatorCoordinate} from '../mercator_coordinate';
import {PointProjection} from '../../symbol/projection';
import {LngLatBounds} from '../lng_lat_bounds';
import {CoveringTilesOptions, CoveringZoomOptions, IReadonlyTransform, ITransform, TransformUpdateResult} from '../transform_interface';
import {PaddingOptions} from '../edge_insets';
import {tileCoordinatesToMercatorCoordinates} from './mercator_utils';
import {angularCoordinatesToSurfaceVector, getGlobeRadiusPixels, getZoomAdjustment, mercatorCoordinatesToAngularCoordinatesRadians, projectTileCoordinatesToSphere, sphereSurfacePointToCoordinates} from './globe_utils';
import {EXTENT} from '../../data/extent';
import type {ProjectionData} from './projection_data';
import {globeCoveringTiles} from './globe_covering_tiles';
import {Frustum} from '../../util/primitives';

/**
 * Describes the intersection of ray and sphere.
 * When null, no intersection occurred.
 * When both "t" values are the same, the ray just touched the sphere's surface.
 * When both value are different, a full intersection occurred.
 */
type RaySphereIntersection = {
    /**
     * The ray parameter for intersection that is "less" along the ray direction.
     * Note that this value can be negative, meaning that this intersection occurred before the ray's origin.
     * The intersection point can be computed as `origin + direction * tMin`.
     */
    tMin: number;
    /**
     * The ray parameter for intersection that is "more" along the ray direction.
     * Note that this value can be negative, meaning that this intersection occurred before the ray's origin.
     * The intersection point can be computed as `origin + direction * tMax`.
     */
    tMax: number;
} | null;

export class GlobeTransform implements ITransform {
    private _helper: TransformHelper;

    //
    // Implementation of transform getters and setters
    //

    get pixelsToClipSpaceMatrix(): mat4 {
        return this._helper.pixelsToClipSpaceMatrix;
    }
    get clipSpaceToPixelsMatrix(): mat4 {
        return this._helper.clipSpaceToPixelsMatrix;
    }
    get pixelsToGLUnits(): [number, number] {
        return this._helper.pixelsToGLUnits;
    }
    get centerOffset(): Point {
        return this._helper.centerOffset;
    }
    get size(): Point {
        return this._helper.size;
    }
    get rotationMatrix(): mat2 {
        return this._helper.rotationMatrix;
    }
    get centerPoint(): Point {
        return this._helper.centerPoint;
    }
    get pixelsPerMeter(): number {
        return this._helper.pixelsPerMeter;
    }
    setMinZoom(zoom: number): void {
        this._helper.setMinZoom(zoom);
    }
    setMaxZoom(zoom: number): void {
        this._helper.setMaxZoom(zoom);
    }
    setMinPitch(pitch: number): void {
        this._helper.setMinPitch(pitch);
    }
    setMaxPitch(pitch: number): void {
        this._helper.setMaxPitch(pitch);
    }
    setRenderWorldCopies(renderWorldCopies: boolean): void {
        this._helper.setRenderWorldCopies(renderWorldCopies);
    }
    setBearing(bearing: number): void {
        this._helper.setBearing(bearing);
    }
    setPitch(pitch: number): void {
        this._helper.setPitch(pitch);
    }
    setFov(fov: number): void {
        this._helper.setFov(fov);
    }
    setZoom(zoom: number): void {
        this._helper.setZoom(zoom);
    }
    setCenter(center: LngLat): void {
        this._helper.setCenter(center);
    }
    setElevation(elevation: number): void {
        this._helper.setElevation(elevation);
    }
    setMinElevationForCurrentTile(elevation: number): void {
        this._helper.setMinElevationForCurrentTile(elevation);
    }
    setPadding(padding: PaddingOptions): void {
        this._helper.setPadding(padding);
    }
    interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number): void {
        return this._helper.interpolatePadding(start, target, t);
    }
    isPaddingEqual(padding: PaddingOptions): boolean {
        return this._helper.isPaddingEqual(padding);
    }
    coveringZoomLevel(options: CoveringZoomOptions): number {
        return this._helper.coveringZoomLevel(options);
    }
    resize(width: number, height: number): void {
        this._helper.resize(width, height);
    }
    getMaxBounds(): LngLatBounds {
        return this._helper.getMaxBounds();
    }
    setMaxBounds(bounds?: LngLatBounds): void {
        this._helper.setMaxBounds(bounds);
    }
    getCameraQueryGeometry(queryGeometry: Point[]): Point[] {
        return this._helper.getCameraQueryGeometry(this.getCameraPoint(), queryGeometry);
    }

    get tileSize(): number {
        return this._helper.tileSize;
    }
    get tileZoom(): number {
        return this._helper.tileZoom;
    }
    get scale(): number {
        return this._helper.scale;
    }
    get worldSize(): number {
        return this._helper.worldSize;
    }
    get width(): number {
        return this._helper.width;
    }
    get height(): number {
        return this._helper.height;
    }
    get angle(): number {
        return this._helper.angle;
    }
    get lngRange(): [number, number] {
        return this._helper.lngRange;
    }
    get latRange(): [number, number] {
        return this._helper.latRange;
    }
    get minZoom(): number {
        return this._helper.minZoom;
    }
    get maxZoom(): number {
        return this._helper.maxZoom;
    }
    get zoom(): number {
        return this._helper.zoom;
    }
    get center(): LngLat {
        return this._helper.center;
    }
    get minPitch(): number {
        return this._helper.minPitch;
    }
    get maxPitch(): number {
        return this._helper.maxPitch;
    }
    get pitch(): number {
        return this._helper.pitch;
    }
    get bearing(): number {
        return this._helper.bearing;
    }
    get fov(): number {
        return this._helper.fov;
    }
    get elevation(): number {
        return this._helper.elevation;
    }
    get minElevationForCurrentTile(): number {
        return this._helper.minElevationForCurrentTile;
    }
    get padding(): PaddingOptions {
        return this._helper.padding;
    }
    get unmodified(): boolean {
        return this._helper.unmodified;
    }
    get renderWorldCopies(): boolean {
        return this._helper.renderWorldCopies;
    }

    //
    // Implementation of globe transform
    //

    private _cachedClippingPlane: vec4 = createVec4f64();
    private _cachedFrustum: Frustum;

    // Transition handling
    private _lastGlobeStateEnabled: boolean = true;

    private _lastLargeZoomStateChange: number = -1000.0;
    private _lastLargeZoomState: boolean = false;

    /**
     * Stores when {@link newFrameUpdate} was last called.
     * Serves as a unified clock for globe (instead of each function using a slightly different value from `browser.now()`).
     */
    private _lastUpdateTime = browser.now();
    /**
     * Stores when switch from globe to mercator or back last occurred, for animation purposes.
     * This switch can be caused either by the map passing the threshold zoom level,
     * or by {@link setGlobeViewAllowed} being called.
     */
    private _lastGlobeChangeTime: number = browser.now() - 10_000; // Ten seconds before transform creation

    private _skipNextAnimation: boolean = true;

    private _projectionMatrix: mat4 = createIdentityMat4f64();
    private _globeViewProjMatrix: mat4 = createIdentityMat4f64();
    private _globeViewProjMatrixNoCorrection: mat4 = createIdentityMat4f64();
    private _globeViewProjMatrixNoCorrectionInverted: mat4 = createIdentityMat4f64();
    private _globeProjMatrixInverted: mat4 = createIdentityMat4f64();

    private _cameraPosition: vec3 = createVec3f64();

    /**
     * Whether globe projection is allowed to be used.
     * Set with {@link setGlobeViewAllowed}.
     * Can be used to dynamically disable globe projection without changing the map's projection,
     * which would cause a map reload.
     */
    private _globeProjectionAllowed = true;

    /**
     * Note: projection instance should only be accessed in the {@link newFrameUpdate} function.
     * to ensure the transform's state isn't unintentionally changed.
     */
    private _projectionInstance: GlobeProjection;
    private _globeLatitudeErrorCorrectionRadians: number = 0;

    /**
     * True when globe render path should be used instead of the old but simpler mercator rendering.
     * Globe automatically transitions to mercator at high zoom levels, which causes a switch from
     * globe to mercator render path.
     */
    get isGlobeRendering(): boolean {
        return this._globeness > 0;
    }

    /**
     * Globe projection can smoothly interpolate between globe view and mercator. This variable controls this interpolation.
     * Value 0 is mercator, value 1 is globe, anything between is an interpolation between the two projections.
     */
    private _globeness: number = 1.0;
    private _mercatorTransform: MercatorTransform;

    private _nearZ;
    private _farZ;

    public constructor(globeProjection: GlobeProjection, globeProjectionEnabled: boolean = true) {
        this._helper = new TransformHelper({
            calcMatrices: () => { this._calcMatrices(); },
            getConstrained: (center, zoom) => { return this.getConstrained(center, zoom); }
        });
        this._globeProjectionAllowed = globeProjectionEnabled;
        this._globeness = globeProjectionEnabled ? 1 : 0; // When transform is cloned for use in symbols, `_updateAnimation` function which usually sets this value never gets called.
        this._projectionInstance = globeProjection;
        this._mercatorTransform = new MercatorTransform();
    }

    clone(): ITransform {
        const clone = new GlobeTransform(null, this._globeProjectionAllowed);
        clone._applyGlobeTransform(this);
        clone.apply(this);
        return clone;
    }

    public apply(that: IReadonlyTransform): void {
        this._helper.apply(that);
        this._mercatorTransform.apply(this);
    }

    private _applyGlobeTransform(that: GlobeTransform): void {
        this._globeness = that._globeness;
        this._globeLatitudeErrorCorrectionRadians = that._globeLatitudeErrorCorrectionRadians;
    }

    public get projectionMatrix(): mat4 { return this.isGlobeRendering ? this._projectionMatrix : this._mercatorTransform.projectionMatrix; }

    public get modelViewProjectionMatrix(): mat4 { return this.isGlobeRendering ? this._globeViewProjMatrixNoCorrection : this._mercatorTransform.modelViewProjectionMatrix; }

    public get inverseProjectionMatrix(): mat4 { return this.isGlobeRendering ? this._globeProjMatrixInverted : this._mercatorTransform.inverseProjectionMatrix; }

    public get cameraPosition(): vec3 {
        // Return a copy - don't let outside code mutate our precomputed camera position.
        const copy = createVec3f64(); // Ensure the resulting vector is float64s
        copy[0] = this._cameraPosition[0];
        copy[1] = this._cameraPosition[1];
        copy[2] = this._cameraPosition[2];
        return copy;
    }

    get cameraToCenterDistance(): number {
        // Globe uses the same cameraToCenterDistance as mercator.
        return this._mercatorTransform.cameraToCenterDistance;
    }

    public get nearZ(): number { return this._nearZ; }
    public get farZ(): number { return this._farZ; }

    /**
     * Returns whether globe view is allowed.
     * When allowed, globe fill function as normal, displaying a 3D planet,
     * but transitioning to mercator at high zoom levels.
     * Otherwise, mercator will be used at all zoom levels instead.
     * Set with {@link setGlobeViewAllowed}.
     */
    public getGlobeViewAllowed(): boolean {
        return this._globeProjectionAllowed;
    }

    /**
     * Sets whether globe view is allowed. When allowed, globe fill function as normal, displaying a 3D planet,
     * but transitioning to mercator at high zoom levels.
     * Otherwise, mercator will be used at all zoom levels instead.
     * When globe is caused to transition to mercator by this function, the transition will be animated.
     * @param allow - Sets whether glove view is allowed.
     * @param animateTransition - Controls whether the transition between globe view and mercator (if triggered by this call) should be animated. True by default.
     */
    public setGlobeViewAllowed(allow: boolean, animateTransition: boolean = true) {
        if (allow === this._globeProjectionAllowed) {
            return;
        }

        if (!animateTransition) {
            this._skipNextAnimation = true;
        }
        this._globeProjectionAllowed = allow;
        this._lastGlobeChangeTime = this._lastUpdateTime;
    }

    /**
     * Should be called at the beginning of every frame to synchronize the transform with the underlying projection.
     */
    newFrameUpdate(): TransformUpdateResult {
        this._updateErrorCorrectionValue();

        this._lastUpdateTime = browser.now();
        const oldGlobeRendering = this.isGlobeRendering;
        this._globeness = this._computeGlobenessAnimation();

        this._calcMatrices();

        if (oldGlobeRendering === this.isGlobeRendering) {
            return {
                forcePlacementUpdate: false,
            };
        } else {
            return {
                forcePlacementUpdate: true,
                fireProjectionEvent: {
                    type: 'projectiontransition',
                    newProjection: this.isGlobeRendering ? 'globe' : 'globe-mercator',
                },
                forceSourceUpdate: true,
            };
        }
    }

    /**
     * This function should never be called on a cloned transform, thus ensuring that
     * the state of a cloned transform is never changed after creation.
     */
    private _updateErrorCorrectionValue(): void {
        if (!this._projectionInstance) {
            return;
        }
        this._projectionInstance.useGlobeRendering = this.isGlobeRendering;
        this._projectionInstance.errorQueryLatitudeDegrees = this.center.lat;
        this._globeLatitudeErrorCorrectionRadians = this._projectionInstance.latitudeErrorCorrectionRadians;
    }

    /**
     * Compute new globeness, if needed.
     */
    private _computeGlobenessAnimation(): number {
        // Update globe transition animation
        const globeState = this._globeProjectionAllowed;
        const currentTime = this._lastUpdateTime;
        if (globeState !== this._lastGlobeStateEnabled) {
            this._lastGlobeChangeTime = currentTime;
            this._lastGlobeStateEnabled = globeState;
        }

        const oldGlobeness = this._globeness;

        // Transition parameter, where 0 is the start and 1 is end.
        const globeTransition = Math.min(Math.max((currentTime - this._lastGlobeChangeTime) / 1000.0 / globeConstants.globeTransitionTimeSeconds, 0.0), 1.0);
        let newGlobeness = globeState ? globeTransition : (1.0 - globeTransition);

        if (this._skipNextAnimation) {
            newGlobeness = globeState ? 1.0 : 0.0;
            this._lastGlobeChangeTime = currentTime - globeConstants.globeTransitionTimeSeconds * 1000.0 * 2.0;
            this._skipNextAnimation = false;
        }

        // Update globe zoom transition
        const currentZoomState = this.zoom >= globeConstants.maxGlobeZoom;
        if (currentZoomState !== this._lastLargeZoomState) {
            this._lastLargeZoomState = currentZoomState;
            this._lastLargeZoomStateChange = currentTime;
        }
        const zoomTransition = Math.min(Math.max((currentTime - this._lastLargeZoomStateChange) / 1000.0 / globeConstants.zoomTransitionTimeSeconds, 0.0), 1.0);
        const zoomGlobenessBound = currentZoomState ? (1.0 - zoomTransition) : zoomTransition;
        newGlobeness = Math.min(newGlobeness, zoomGlobenessBound);
        newGlobeness = easeCubicInOut(newGlobeness); // Smooth animation

        if (oldGlobeness !== newGlobeness) {
            this.setCenter(new LngLat(
                this._mercatorTransform.center.lng + differenceOfAnglesDegrees(this._mercatorTransform.center.lng, this.center.lng) * newGlobeness,
                lerp(this._mercatorTransform.center.lat, this.center.lat, newGlobeness)
            ));
            this.setZoom(lerp(this._mercatorTransform.zoom, this.zoom, newGlobeness));
        }

        return newGlobeness;
    }

    isRenderingDirty(): boolean {
        // Globe transition
        return (this._lastUpdateTime - this._lastGlobeChangeTime) / 1000.0 < (Math.max(globeConstants.globeTransitionTimeSeconds, globeConstants.zoomTransitionTimeSeconds));
    }

    getProjectionData(overscaledTileID: OverscaledTileID, aligned?: boolean, ignoreTerrainMatrix?: boolean): ProjectionData {
        const data = this._mercatorTransform.getProjectionData(overscaledTileID, aligned, ignoreTerrainMatrix);

        // Set 'projectionMatrix' to actual globe transform
        if (this.isGlobeRendering) {
            data.mainMatrix = this._globeViewProjMatrix;
        }

        data.clippingPlane = this._cachedClippingPlane as [number, number, number, number];
        data.projectionTransition = this._globeness;

        return data;
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
        // - this._pitch is the angle at B between points cam,B,A
        // - this.cameraToCenterDistance is the distance from camera to "B"
        // - globe radius is (0.5 * this.worldSize)
        // - "T" is any point where a tangent line from "cam" touches the globe surface
        // - elevation is assumed to be zero - globe rendering must be separate from terrain rendering anyway

        const pitch = this.pitch * Math.PI / 180.0;
        // scale things so that the globe radius is 1
        const distanceCameraToB = this.cameraToCenterDistance / globeRadiusPixels;
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
        vec3.rotateZ(planeVector, planeVector, [0, 0, 0], this.angle);
        vec3.rotateX(planeVector, planeVector, [0, 0, 0], -1 * this.center.lat * Math.PI / 180.0);
        vec3.rotateY(planeVector, planeVector, [0, 0, 0], this.center.lng * Math.PI / 180.0);
        // Scale the plane vector up
        // we don't want the actually visible parts of the sphere to end up beyond distance 1 from the plane - otherwise they would be clipped by the near plane.
        const scale = 0.25;
        vec3.scale(planeVector, planeVector, scale);
        return [...planeVector, -tangentPlaneDistanceToC * scale];
    }

    public isLocationOccluded(location: LngLat): boolean {
        return !this.isSurfacePointVisible(angularCoordinatesToSurfaceVector(location));
    }

    public transformLightDirection(dir: vec3): vec3 {
        const sphereX = this._helper._center.lng * Math.PI / 180.0;
        const sphereY = this._helper._center.lat * Math.PI / 180.0;

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

    private getAnimatedLatitude() {
        return lerp(this._mercatorTransform.center.lat, this._helper._center.lat, this._globeness);
    }

    public getPixelScale(): number {
        return lerp(this._mercatorTransform.getPixelScale(), 1.0 / Math.cos(this.getAnimatedLatitude() * Math.PI / 180), this._globeness);
    }

    public getCircleRadiusCorrection(): number {
        return lerp(this._mercatorTransform.getCircleRadiusCorrection(), Math.cos(this.getAnimatedLatitude() * Math.PI / 180), this._globeness);
    }

    public getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        const mercatorCorrection = this._mercatorTransform.getPitchedTextCorrection(textAnchorX, textAnchorY, tileID);
        if (!this.isGlobeRendering) {
            return mercatorCorrection;
        }
        const mercator = tileCoordinatesToMercatorCoordinates(textAnchorX, textAnchorY, tileID.canonical);
        const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator.x, mercator.y);
        return lerp(mercatorCorrection, this.getCircleRadiusCorrection() / Math.cos(angular[1]), this._globeness);
    }

    public projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number): PointProjection {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.projectTileCoordinates(x, y, unwrappedTileID, getElevation);
        }

        const canonical = unwrappedTileID.canonical;
        const spherePos = projectTileCoordinatesToSphere(x, y, canonical.x, canonical.y, canonical.z);
        const elevation = getElevation ? getElevation(x, y) : 0.0;
        const vectorMultiplier = 1.0 + elevation / earthRadius;
        const pos: vec4 = [spherePos[0] * vectorMultiplier, spherePos[1] * vectorMultiplier, spherePos[2] * vectorMultiplier, 1];
        vec4.transformMat4(pos, pos, this._globeViewProjMatrixNoCorrection);

        // Also check whether the point projects to the backfacing side of the sphere.
        const plane = this._cachedClippingPlane;
        // dot(position on sphere, occlusion plane equation)
        const dotResult = plane[0] * spherePos[0] + plane[1] * spherePos[1] + plane[2] * spherePos[2] + plane[3];
        const isOccluded = dotResult < 0.0;

        return {
            point: new Point(pos[0] / pos[3], pos[1] / pos[3]),
            signedDistanceFromCamera: pos[3],
            isOccluded
        };
    }

    private _calcMatrices(): void {
        if (!this._helper._width || !this._helper._height) {
            return;
        }

        if (this._mercatorTransform) {
            this._mercatorTransform.apply(this, true);
        }

        const globeRadiusPixels = getGlobeRadiusPixels(this.worldSize, this.center.lat);

        // Construct a completely separate matrix for globe view
        const globeMatrix = createMat4f64();
        const globeMatrixUncorrected = createMat4f64();
        this._nearZ = 0.5;
        this._farZ = this.cameraToCenterDistance + globeRadiusPixels * 2.0; // just set the far plane far enough - we will calculate our own z in the vertex shader anyway
        mat4.perspective(globeMatrix, this.fov * Math.PI / 180, this.width / this.height, this._nearZ, this._farZ);

        // Apply center of perspective offset
        const offset = this.centerOffset;
        globeMatrix[8] = -offset.x * 2 / this._helper._width;
        globeMatrix[9] = offset.y * 2 / this._helper._height;
        this._projectionMatrix = mat4.clone(globeMatrix);

        this._globeProjMatrixInverted = createMat4f64();
        mat4.invert(this._globeProjMatrixInverted, globeMatrix);
        mat4.translate(globeMatrix, globeMatrix, [0, 0, -this.cameraToCenterDistance]);
        mat4.rotateX(globeMatrix, globeMatrix, -this.pitch * Math.PI / 180);
        mat4.rotateZ(globeMatrix, globeMatrix, -this.angle);
        mat4.translate(globeMatrix, globeMatrix, [0.0, 0, -globeRadiusPixels]);
        // Rotate the sphere to center it on viewed coordinates

        const scaleVec = createVec3f64();
        scaleVec[0] = globeRadiusPixels;
        scaleVec[1] = globeRadiusPixels;
        scaleVec[2] = globeRadiusPixels;

        // Keep a atan-correction-free matrix for transformations done on the CPU with accurate math
        mat4.rotateX(globeMatrixUncorrected, globeMatrix, this.center.lat * Math.PI / 180.0);
        mat4.rotateY(globeMatrixUncorrected, globeMatrixUncorrected, -this.center.lng * Math.PI / 180.0);
        mat4.scale(globeMatrixUncorrected, globeMatrixUncorrected, scaleVec); // Scale the unit sphere to a sphere with diameter of 1
        this._globeViewProjMatrixNoCorrection = globeMatrixUncorrected;

        mat4.rotateX(globeMatrix, globeMatrix, this.center.lat * Math.PI / 180.0 - this._globeLatitudeErrorCorrectionRadians);
        mat4.rotateY(globeMatrix, globeMatrix, -this.center.lng * Math.PI / 180.0);
        mat4.scale(globeMatrix, globeMatrix, scaleVec); // Scale the unit sphere to a sphere with diameter of 1
        this._globeViewProjMatrix = globeMatrix;

        this._globeViewProjMatrixNoCorrectionInverted = createMat4f64();
        mat4.invert(this._globeViewProjMatrixNoCorrectionInverted, globeMatrixUncorrected);

        const zero = createVec3f64();
        this._cameraPosition = createVec3f64();
        this._cameraPosition[2] = this.cameraToCenterDistance / globeRadiusPixels;
        vec3.rotateX(this._cameraPosition, this._cameraPosition, zero, this.pitch * Math.PI / 180);
        vec3.rotateZ(this._cameraPosition, this._cameraPosition, zero, this.angle);
        vec3.add(this._cameraPosition, this._cameraPosition, [0, 0, 1]);
        vec3.rotateX(this._cameraPosition, this._cameraPosition, zero, -this.center.lat * Math.PI / 180.0);
        vec3.rotateY(this._cameraPosition, this._cameraPosition, zero, this.center.lng * Math.PI / 180.0);

        this._cachedClippingPlane = this._computeClippingPlane(globeRadiusPixels);

        const matrix = mat4.clone(this._globeViewProjMatrixNoCorrectionInverted);
        mat4.scale(matrix, matrix, [1, 1, -1]);
        this._cachedFrustum = Frustum.fromInvProjectionMatrix(matrix);
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

    coveringTiles(options: CoveringTilesOptions): OverscaledTileID[] {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.coveringTiles(options);
        }

        const coveringZ = this.coveringZoomLevel(options);
        const cameraCoord = this.screenPointToMercatorCoordinate(this.getCameraPoint());
        const centerCoord = MercatorCoordinate.fromLngLat(this.center);

        return globeCoveringTiles(this._cachedFrustum, this._cachedClippingPlane, cameraCoord, centerCoord, coveringZ, options);
    }

    recalculateZoom(terrain: Terrain): void {
        this._mercatorTransform.recalculateZoom(terrain);
        this.apply(this._mercatorTransform);
    }

    maxPitchScaleFactor(): number {
        // Using mercator version of this should be good enough approximation for globe.
        return this._mercatorTransform.maxPitchScaleFactor();
    }

    getCameraPoint(): Point {
        return this._mercatorTransform.getCameraPoint();
    }

    getCameraAltitude(): number {
        return this._mercatorTransform.getCameraAltitude();
    }

    lngLatToCameraDepth(lngLat: LngLat, elevation: number): number {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.lngLatToCameraDepth(lngLat, elevation);
        }
        if (!this._globeViewProjMatrixNoCorrection) {
            return 1.0; // _calcMatrices hasn't run yet
        }
        const vec = angularCoordinatesToSurfaceVector(lngLat);
        vec3.scale(vec, vec, (1.0 + elevation / earthRadius));
        const result = createVec4f64();
        vec4.transformMat4(result, [vec[0], vec[1], vec[2], 1], this._globeViewProjMatrixNoCorrection);
        return result[2] / result[3];
    }

    precacheTiles(coords: OverscaledTileID[]): void {
        this._mercatorTransform.precacheTiles(coords);
    }

    getBounds(): LngLatBounds {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.getBounds();
        }

        const xMid = this.width * 0.5;
        const yMid = this.height * 0.5;

        // LngLat extremes will probably tend to be in screen corners or in middle of screen edges.
        // These test points should result in a pretty good approximation.
        const testPoints = [
            new Point(0, 0),
            new Point(xMid, 0),
            new Point(this.width, 0),
            new Point(this.width, yMid),
            new Point(this.width, this.height),
            new Point(xMid, this.height),
            new Point(0, this.height),
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
        const center = this.center;
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

    getConstrained(lngLat: LngLat, zoom: number): { center: LngLat; zoom: number } {
        // Globe: TODO: respect _lngRange, _latRange
        // It is possible to implement exact constrain for globe, but I don't think it is worth the effort.
        const constrainedLat = clamp(lngLat.lat, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE);
        const constrainedZoom = clamp(+zoom, this.minZoom + getZoomAdjustment(0, constrainedLat), this.maxZoom);
        return {
            center: new LngLat(
                lngLat.lng,
                constrainedLat
            ),
            zoom: constrainedZoom
        };
    }

    /**
     * Note: automatically adjusts zoom to keep planet size consistent
     * (same size before and after a {@link setLocationAtPoint} call).
     */
    setLocationAtPoint(lnglat: LngLat, point: Point): void {
        if (!this.isGlobeRendering) {
            this._mercatorTransform.setLocationAtPoint(lnglat, point);
            this.apply(this._mercatorTransform);
            return;
        }
        // This returns some fake coordinates for pixels that do not lie on the planet.
        // Whatever uses this `setLocationAtPoint` function will need to account for that.
        const pointLngLat = this.unprojectScreenPoint(point);
        const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
        const vecToTarget = angularCoordinatesToSurfaceVector(lnglat);

        const zero = createVec3f64();
        vec3.zero(zero);

        const rotatedPixelVector = createVec3f64();
        vec3.rotateY(rotatedPixelVector, vecToPixelCurrent, zero, -this.center.lng * Math.PI / 180.0);
        vec3.rotateX(rotatedPixelVector, rotatedPixelVector, zero, this.center.lat * Math.PI / 180.0);

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
            const centerLngRadians = this.center.lng * Math.PI / 180.0;
            const centerLatRadians = this.center.lat * Math.PI / 180.0;
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
        const oldLat = this.center.lat;
        this.setCenter(new LngLat(newLng, clamp(newLat, -90, 90)));
        this.setZoom(this.zoom + getZoomAdjustment(oldLat, this.center.lat));
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.locationToScreenPoint(lnglat, terrain);
        }

        const pos = angularCoordinatesToSurfaceVector(lnglat);

        if (terrain) {
            const elevation = terrain.getElevationForLngLatZoom(lnglat, this._helper._tileZoom);
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
        vec4.transformMat4(projected, [...pos, 1] as vec4, this._globeViewProjMatrixNoCorrection);
        projected[0] /= projected[3];
        projected[1] /= projected[3];
        return new Point(
            (projected[0] * 0.5 + 0.5) * this.width,
            (-projected[1] * 0.5 + 0.5) * this.height
        );
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        if (!this.isGlobeRendering || terrain) {
            // Mercator has terrain handling implemented properly and since terrain
            // simply draws tile coordinates into a special framebuffer, this works well even for globe.
            return this._mercatorTransform.screenPointToMercatorCoordinate(p, terrain);
        }
        return MercatorCoordinate.fromLngLat(this.unprojectScreenPoint(p));
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        if (!this.isGlobeRendering || terrain) {
            // Mercator has terrain handling implemented properly and since terrain
            // simply draws tile coordinates into a special framebuffer, this works well even for globe.
            return this._mercatorTransform.screenPointToLocation(p, terrain);
        }
        return this.unprojectScreenPoint(p);
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.isPointOnMapSurface(p, terrain);
        }

        const rayOrigin = this._cameraPosition;
        const rayDirection = this.getRayDirectionFromPixel(p);

        const intersection = this.rayPlanetIntersection(rayOrigin, rayDirection);

        return !!intersection;
    }

    /**
     * Computes normalized direction of a ray from the camera to the given screen pixel.
     */
    getRayDirectionFromPixel(p: Point): vec3 {
        const pos = createVec4f64();
        pos[0] = (p.x / this.width) * 2.0 - 1.0;
        pos[1] = ((p.y / this.height) * 2.0 - 1.0) * -1.0;
        pos[2] = 1;
        pos[3] = 1;
        vec4.transformMat4(pos, pos, this._globeViewProjMatrixNoCorrectionInverted);
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
     * For a given point on the unit sphere of the planet, returns whether it is visible from
     * camera's position (not taking into account camera rotation at all).
     */
    private isSurfacePointVisible(p: vec3): boolean {
        if (!this.isGlobeRendering) {
            return true;
        }
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
        vec4.transformMat4(projected, [...vec, 1] as vec4, this._globeViewProjMatrixNoCorrection);
        projected[0] /= projected[3];
        projected[1] /= projected[3];
        projected[2] /= projected[3];
        return projected[0] > -1 && projected[0] < 1 &&
            projected[1] > -1 && projected[1] < 1 &&
            projected[2] > -1 && projected[2] < 1;
    }

    /**
     * Returns the two intersection points of the ray and the planet's sphere,
     * or null if no intersection occurs.
     * The intersections are encoded as the parameter for parametric ray equation,
     * with `tMin` being the first intersection and `tMax` being the second.
     * Eg. the nearer intersection point can then be computed as `origin + direction * tMin`.
     * @param origin - The ray origin.
     * @param direction - The normalized ray direction.
     */
    private rayPlanetIntersection(origin: vec3, direction: vec3): RaySphereIntersection {
        const originDotDirection = vec3.dot(origin, direction);
        const planetRadiusSquared = 1.0; // planet is a unit sphere, so its radius squared is 1

        // Ray-sphere intersection involves a quadratic equation.
        // However solving it in the traditional schoolbook way leads to floating point precision issues.
        // Here we instead use the approach suggested in the book Ray Tracing Gems, chapter 7.
        // https://www.realtimerendering.com/raytracinggems/rtg/index.html
        const inner = createVec3f64();
        const scaledDir = createVec3f64();
        vec3.scale(scaledDir, direction, originDotDirection);
        vec3.sub(inner, origin, scaledDir);
        const discriminant = planetRadiusSquared - vec3.dot(inner, inner);

        if (discriminant < 0) {
            return null;
        }

        const c = vec3.dot(origin, origin) - planetRadiusSquared;
        const q = -originDotDirection + (originDotDirection < 0 ? 1 : -1) * Math.sqrt(discriminant);
        const t0 = c / q;
        const t1 = q;
        // Assume the ray origin is never inside the sphere
        const tMin = Math.min(t0, t1);
        const tMax = Math.max(t0, t1);
        return {
            tMin,
            tMax
        };
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
        const intersection = this.rayPlanetIntersection(rayOrigin, rayDirection);

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
        const directionDotPlaneXyz = this._cachedClippingPlane[0] * rayDirection[0] + this._cachedClippingPlane[1] * rayDirection[1] + this._cachedClippingPlane[2] * rayDirection[2];
        const originToPlaneDistance = pointPlaneSignedDistance(this._cachedClippingPlane, rayOrigin);
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

        const closestOnHorizon = createVec3f64();
        vec3.normalize(closestOnHorizon, planeIntersection);
        return sphereSurfacePointToCoordinates(closestOnHorizon);
    }

    getMatrixForModel(location: LngLatLike, altitude?: number): mat4 {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.getMatrixForModel(location, altitude);
        }
        const lnglat = LngLat.convert(location);
        const scale = 1.0 / earthRadius;

        const m = createIdentityMat4f64();
        mat4.rotateY(m, m, lnglat.lng / 180.0 * Math.PI);
        mat4.rotateX(m, m, -lnglat.lat / 180.0 * Math.PI);
        mat4.translate(m, m, [0, 0, 1 + altitude / earthRadius]);
        mat4.rotateX(m, m, Math.PI * 0.5);
        mat4.scale(m, m, [scale, scale, scale]);
        return m;
    }

    getProjectionDataForCustomLayer(): ProjectionData {
        const projectionData = this.getProjectionData(new OverscaledTileID(0, 0, 0, 0, 0));
        projectionData.tileMercatorCoords = [0, 0, 1, 1];

        // Even though we requested projection data for the mercator base tile which covers the entire mercator range,
        // the shader projection machinery still expects inputs to be in tile units range [0..EXTENT].
        // Since custom layers are expected to supply mercator coordinates [0..1], we need to rescale
        // the fallback projection matrix by EXTENT.
        // Note that the regular projection matrices do not need to be modified, since the rescaling happens by setting
        // the `u_projection_tile_mercator_coords` uniform correctly.
        const fallbackMatrixScaled = createMat4f64();
        mat4.scale(fallbackMatrixScaled, projectionData.fallbackMatrix, [EXTENT, EXTENT, 1]);

        projectionData.fallbackMatrix = fallbackMatrixScaled;
        return projectionData;
    }

    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        if (!this.isGlobeRendering) {
            return this._mercatorTransform.getFastPathSimpleProjectionMatrix(tileID);
        }
        return undefined;
    }
}
