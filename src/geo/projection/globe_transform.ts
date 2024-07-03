import {mat2, mat4, vec3, vec4} from 'gl-matrix';
import {MAX_VALID_LATITUDE, TransformHelper, TransformUpdateResult} from '../transform_helper';
import {Tile} from '../../source/tile';
import {MercatorTransform, translatePosition} from './mercator_transform';
import {LngLat, earthRadius} from '../lng_lat';
import {EXTENT} from '../../data/extent';
import {clamp, differenceOfAnglesDegrees, distanceOfAnglesRadians, easeCubicInOut, lerp, mod, warnOnce, wrap} from '../../util/util';
import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../../source/tile_id';
import Point from '@mapbox/point-geometry';
import {browser} from '../../util/browser';
import {Terrain} from '../../render/terrain';
import {GlobeProjection, globeConstants} from './globe';
import {ProjectionData} from '../../render/program/projection_program';
import {MercatorCoordinate} from '../mercator_coordinate';
import {PointProjection} from '../../symbol/projection';
import {LngLatBounds} from '../lng_lat_bounds';
import {ITransform} from '../transform_interface';
import {PaddingOptions} from '../edge_insets';

export function getGlobeCircumferencePixels(transform: {worldSize: number; center: {lat: number}}): number {
    const radius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
    const circumference = 2.0 * Math.PI * radius;
    return circumference;
}

export function globeDistanceOfLocationsPixels(transform: {worldSize: number; center: {lat: number}}, a: LngLat, b: LngLat): number {
    const vecA = angularCoordinatesToSurfaceVector(a);
    const vecB = angularCoordinatesToSurfaceVector(b);
    const dot = vec3.dot(vecA, vecB);
    const radians = Math.acos(dot);
    const circumference = getGlobeCircumferencePixels(transform);
    return radians / (2.0 * Math.PI) * circumference;
}

/**
 * Returns mercator coordinates in range 0..1 for given coordinates inside a tile and the tile's canonical ID.
 */
function tileCoordinatesToMercatorCoordinates(inTileX: number, inTileY: number, tileID: UnwrappedTileID): [number, number] {
    const scale = 1.0 / (1 << tileID.canonical.z);
    return [
        inTileX / EXTENT * scale + tileID.canonical.x * scale,
        inTileY / EXTENT * scale + tileID.canonical.y * scale
    ];
}

/**
 * For given mercator coordinates in range 0..1, returns the angular coordinates on the sphere's surface, in radians.
 */
export function mercatorCoordinatesToAngularCoordinatesRadians(mercatorX: number, mercatorY: number): [number, number] {
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    return [sphericalX, sphericalY];
}

/**
 * For a given longitude and latitude (note: in radians) returns the normalized vector from the planet center to the specified place on the surface.
 * @param lngRadians - Longitude in radians.
 * @param latRadians - Latitude in radians.
 */
export function angularCoordinatesRadiansToVector(lngRadians: number, latRadians: number): vec3 {
    const len = Math.cos(latRadians);
    const vec = createVec3();
    vec[0] = Math.sin(lngRadians) * len;
    vec[1] = Math.sin(latRadians);
    vec[2] = Math.cos(lngRadians) * len;
    return vec;
}

/**
 * For a given longitude and latitude (note: in degrees) returns the normalized vector from the planet center to the specified place on the surface.
 */
export function angularCoordinatesToSurfaceVector(lngLat: LngLat): vec3 {
    return angularCoordinatesRadiansToVector(lngLat.lng * Math.PI / 180, lngLat.lat * Math.PI / 180);
}

export function getGlobeRadiusPixels(worldSize: number, latitudeDegrees: number) {
    // We want zoom levels to be consistent between globe and flat views.
    // This means that the pixel size of features at the map center point
    // should be the same for both globe and flat view.
    // For this reason we scale the globe up when map center is nearer to the poles.
    return worldSize / (2.0 * Math.PI) / Math.cos(latitudeDegrees * Math.PI / 180);
}

/**
 * Given a 3D point on the surface of a unit sphere, returns its angular coordinates in degrees.
 * The input vector must be normalized.
 */
export function sphereSurfacePointToCoordinates(surface: vec3): LngLat {
    const latRadians = Math.asin(surface[1]);
    const latDegrees = latRadians / Math.PI * 180.0;
    const lengthXZ = Math.sqrt(surface[0] * surface[0] + surface[2] * surface[2]);
    if (lengthXZ > 1e-6) {
        const projX = surface[0] / lengthXZ;
        const projZ = surface[2] / lengthXZ;
        const acosZ = Math.acos(projZ);
        const lngRadians = (projX > 0) ? acosZ : -acosZ;
        const lngDegrees = lngRadians / Math.PI * 180.0;
        return new LngLat(wrap(lngDegrees, -180, 180), latDegrees);
    } else {
        return new LngLat(0.0, latDegrees);
    }
}

/**
 * Computes how much to modify zoom to keep the globe size constant when changing latitude.
 * @param transform - An instance of any transform. Does not have any relation on the computed values.
 * @param oldLat - Latitude before change.
 * @param newLat - Latitude after change.
 * @returns A value to add to zoom level used for old latitude to keep same planet radius at new latitude.
 */
export function getZoomAdjustment(transform: { scaleZoom(scale: number): number }, oldLat: number, newLat: number): number {
    const oldCircumference = Math.cos(oldLat * Math.PI / 180.0);
    const newCircumference = Math.cos(newLat * Math.PI / 180.0);
    return transform.scaleZoom(newCircumference / oldCircumference);
}

/**
 * Returns the angle in radians between two 2D vectors.
 * The angle is how much must the first vector be rotated clockwise
 * (assuming X is right and Y is down) so that it points in the same
 * direction as the second vector.
 * Returns an angle in range -PI..PI.
 */
function angleToRotateBetweenVectors2D(vec1x: number, vec1y: number, vec2x: number, vec2y: number): number {
    // Normalize both vectors
    const length1 = Math.sqrt(vec1x * vec1x + vec1y * vec1y);
    const length2 = Math.sqrt(vec2x * vec2x + vec2y * vec2y);
    vec1x /= length1;
    vec1y /= length1;
    vec2x /= length2;
    vec2y /= length2;
    const dot = vec1x * vec2x + vec1y * vec2y;
    const angle = Math.acos(dot);
    // dot second vector with vector to the right of first (-vec1y, vec1x)
    const isVec2RightOfVec1 = (-vec1y * vec2x + vec1x * vec2y) > 0;
    if (isVec2RightOfVec1) {
        return angle;
    } else {
        return -angle;
    }
}

function createVec4(): vec4 { return new Float64Array(4) as any; }
function createVec3(): vec3 { return new Float64Array(3) as any; }
function createMat4(): mat4 { return new Float64Array(16) as any; }
function createIdentityMat4(): mat4 {
    const m = new Float64Array(16) as any;
    mat4.identity(m);
    return m;
}

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
    coveringZoomLevel(options: { roundZoom?: boolean; tileSize: number }): number {
        return this._helper.coveringZoomLevel(options);
    }
    resize(width: number, height: number): void {
        this._helper.resize(width, height);
    }
    zoomScale(zoom: number): number {
        return this._helper.zoomScale(zoom);
    }
    scaleZoom(scale: number): number {
        return this._helper.scaleZoom(scale);
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

    //
    // Implementation of globe transform
    //

    private _cachedClippingPlane: vec4 = createVec4();

    // Transition handling
    private _lastGlobeStateEnabled: boolean = true;

    private _lastLargeZoomStateChange: number = -1000.0;
    private _lastLargeZoomState: boolean = false;

    private _skipNextAnimation: boolean = true;

    private _globeViewProjMatrix: mat4 = createIdentityMat4();
    private _globeViewProjMatrixNoCorrection: mat4 = createIdentityMat4();
    private _globeViewProjMatrixNoCorrectionInverted: mat4 = createIdentityMat4();
    private _globeProjMatrixInverted: mat4 = createIdentityMat4();

    private _cameraPosition: vec3 = createVec3();

    private _lastGlobeChangeTime: number = -1000.0;
    private _globeProjectionEnabled = true;

    /**
     * Note: projection instance should only be accessed in the {@link newFrameUpdate} function
     * to ensure the transform's state isn't unintentionally changed.
     */
    private _projectionInstance: GlobeProjection;
    private _globeRendering: boolean = true;
    private _lastGlobeRenderingState: boolean = true;
    private _globeLatitudeErrorCorrectionRadians: number = 0;

    /**
     * Globe projection can smoothly interpolate between globe view and mercator. This variable controls this interpolation.
     * Value 0 is mercator, value 1 is globe, anything between is an interpolation between the two projections.
     */
    private _globeness: number = 1.0;
    private _mercatorTransform: MercatorTransform;
    private _initialized: boolean = false;

    public constructor(globeProjection: GlobeProjection, globeProjectionEnabled: boolean = true) {
        this._helper = new TransformHelper({ // JP: TODO: will this break because of "this" reference?
            calcMatrices: this._calcMatrices,
            getConstrained: this.getConstrained
        });
        this._globeProjectionEnabled = globeProjectionEnabled;
        this._globeness = globeProjectionEnabled ? 1 : 0; // When transform is cloned for use in symbols, `_updateAnimation` function which usually sets this value never gets called.
        this._projectionInstance = globeProjection;
        this._mercatorTransform = new MercatorTransform();
        this._initialized = true;
    }

    clone(): ITransform {
        const clone = new GlobeTransform(null, this._globeProjectionEnabled);
        clone.apply(this);
        this.newFrameUpdate();
        return clone;
    }

    public apply(that: ITransform): void {
        this._helper.apply(that);
        this._mercatorTransform.apply(this);
    }

    public get modelViewProjectionMatrix(): mat4 { return this._globeRendering ? this._globeViewProjMatrixNoCorrection : this._mercatorTransform.modelViewProjectionMatrix; }

    public get inverseProjectionMatrix(): mat4 { return this._globeRendering ? this._globeProjMatrixInverted : this._mercatorTransform.inverseProjectionMatrix; }

    public get useGlobeControls(): boolean { return this._globeRendering; }

    public get cameraPosition(): vec3 {
        // Return a copy - don't let outside code mutate our precomputed camera position.
        const copy = createVec3(); // Ensure the resulting vector is float64s
        copy[0] = this._cameraPosition[0];
        copy[1] = this._cameraPosition[1];
        copy[2] = this._cameraPosition[2];
        return copy;
    }

    get cameraToCenterDistance(): number {
        // Globe uses the same cameraToCenterDistance as mercator.
        return this._mercatorTransform.cameraToCenterDistance;
    }

    /**
     * Returns whether globe view is allowed.
     * When allowed, globe fill function as normal, displaying a 3D planet,
     * but transitioning to mercator at high zoom levels.
     * Otherwise, mercator will be used at all zoom levels instead.
     * Set with {@link setGlobeViewAllowed}.
     */
    public getGlobeViewAllowed(): boolean {
        return this._globeProjectionEnabled;
    }

    /**
     * Sets whether globe view is allowed. When allowed, globe fill function as normal, displaying a 3D planet,
     * but transitioning to mercator at high zoom levels.
     * Otherwise, mercator will be used at all zoom levels instead.
     * @param allow - Sets whether glove view is allowed.
     * @param animateTransition - Controls whether the transition between globe view and mercator (if triggered by this call) should be animated. True by default.
     */
    public setGlobeViewAllowed(allow: boolean, animateTransition: boolean = true) {
        if (allow !== this._globeProjectionEnabled) {
            if (!animateTransition) {
                this._skipNextAnimation = true;
            }
            this._globeProjectionEnabled = allow;
            this._lastGlobeChangeTime = browser.now();
        }
    }

    translatePosition(tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number] {
        // In the future, some better translation for globe and other weird projections should be implemented here,
        // especially for the translateAnchor==='viewport' case.
        return translatePosition(this, tile, translate, translateAnchor);
    }

    /**
     * Should be called at the beginning of every frame to synchronize the transform with the underlying projection.
     * May change the transform's state - do not call on cloned transforms that should behave immutably!
     */
    newFrameUpdate(): TransformUpdateResult {
        if (this._projectionInstance) {
            // Note: the _globeRendering field is only updated inside this function.
            // This function should never be called on a cloned transform, thus ensuring that
            // the state of a cloned transform is never changed after creation.
            this._projectionInstance.useGlobeRendering = this._globeRendering;
            this._projectionInstance.errorQueryLatitudeDegrees = this.center.lat;
            this._globeLatitudeErrorCorrectionRadians = this._projectionInstance.latitudeErrorCorrectionRadians;
        }

        if (this._initialized) {
            this._updateAnimation();
        }

        this._calcMatrices();

        let forcePlacementUpdate = false;
        if (this._lastGlobeRenderingState !== this._globeRendering) {
            forcePlacementUpdate = true;
        }
        this._lastGlobeRenderingState = this._globeRendering;
        return {
            forcePlacementUpdate
        };
    }

    private _updateAnimation() {
        // Update globe transition animation
        const globeState = this._globeProjectionEnabled;
        const currentTime = browser.now();
        if (globeState !== this._lastGlobeStateEnabled) {
            this._lastGlobeChangeTime = currentTime;
            this._lastGlobeStateEnabled = globeState;
        }

        const oldGlobeness = this._globeness;

        // Transition parameter, where 0 is the start and 1 is end.
        const globeTransition = Math.min(Math.max((currentTime - this._lastGlobeChangeTime) / 1000.0 / globeConstants.globeTransitionTimeSeconds, 0.0), 1.0);
        this._globeness = globeState ? globeTransition : (1.0 - globeTransition);

        if (this._skipNextAnimation) {
            this._globeness = globeState ? 1.0 : 0.0;
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
        this._globeness = Math.min(this._globeness, zoomGlobenessBound);
        this._globeness = easeCubicInOut(this._globeness); // Smooth animation

        if (oldGlobeness !== this._globeness) {
            this.setCenter(new LngLat(
                this._mercatorTransform.center.lng + differenceOfAnglesDegrees(this._mercatorTransform.center.lng, this.center.lng) * this._globeness,
                lerp(this._mercatorTransform.center.lat, this.center.lat, this._globeness)
            ));
            this.setZoom(lerp(this._mercatorTransform.zoom, this.zoom, this._globeness));
        }
    }

    isRenderingDirty(): boolean {
        const now = browser.now();
        // Globe transition
        return (now - this._lastGlobeChangeTime) / 1000.0 < (Math.max(globeConstants.globeTransitionTimeSeconds, globeConstants.zoomTransitionTimeSeconds) + 0.2);
    }

    getProjectionData(overscaledTileID: OverscaledTileID, aligned?: boolean, ignoreTerrainMatrix?: boolean): ProjectionData {
        const data = this._mercatorTransform.getProjectionData(overscaledTileID, aligned, ignoreTerrainMatrix);

        // Set 'u_projection_matrix' to actual globe transform
        if (this._globeRendering) {
            data['u_projection_matrix'] = this._globeViewProjMatrix;
        }

        data['u_projection_clipping_plane'] = this._cachedClippingPlane as [number, number, number, number];
        data['u_projection_transition'] = this._globeness;

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

    private _projectTileCoordinatesToSphere(inTileX: number, inTileY: number, tileID: UnwrappedTileID): vec3 {
        const mercator = tileCoordinatesToMercatorCoordinates(inTileX, inTileY, tileID);
        const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator[0], mercator[1]);
        const sphere = angularCoordinatesRadiansToVector(angular[0], angular[1]);
        return sphere;
    }

    public isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean {
        if (!this._globeRendering) {
            return this._mercatorTransform.isOccluded(x, y, unwrappedTileID);
        }
        const spherePos = this._projectTileCoordinatesToSphere(x, y, unwrappedTileID);
        return !this.isSurfacePointVisible(spherePos);
    }

    public transformLightDirection(dir: vec3): vec3 {
        const sphereX = this._center.lng * Math.PI / 180.0;
        const sphereY = this._center.lat * Math.PI / 180.0;

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
        return lerp(this._mercatorTransform.center.lat, this._center.lat, this._globeness);
    }

    public getPixelScale(): number {
        return 1.0 / Math.cos(this.getAnimatedLatitude() * Math.PI / 180);
    }

    public getCircleRadiusCorrection(): number {
        return Math.cos(this.getAnimatedLatitude() * Math.PI / 180);
    }

    public getPitchedTextCorrection(textAnchor: Point, tileID: UnwrappedTileID): number {
        if (!this._globeRendering) {
            return 1.0;
        }
        const mercator = tileCoordinatesToMercatorCoordinates(textAnchor.x, textAnchor.y, tileID);
        const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator[0], mercator[1]);
        return this.getCircleRadiusCorrection() / Math.cos(angular[1]);
    }

    public projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number): PointProjection {
        if (!this._globeRendering) {
            return this._mercatorTransform.projectTileCoordinates(x, y, unwrappedTileID, getElevation);
        }

        const spherePos = this._projectTileCoordinatesToSphere(x, y, unwrappedTileID);
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

    protected override _calcMatrices(): void {
        super._calcMatrices();

        if (!this._initialized) {
            return;
        }

        this._globeRendering = this._globeness > 0;

        if (this._mercatorTransform) {
            this._mercatorTransform.apply(this, true);
        }

        const globeRadiusPixels = getGlobeRadiusPixels(this.worldSize, this.center.lat);

        // Construct a completely separate matrix for globe view
        const globeMatrix = createMat4();
        const globeMatrixUncorrected = createMat4();
        mat4.perspective(globeMatrix, this.fov * Math.PI / 180, this.width / this.height, 0.5, this.cameraToCenterDistance + globeRadiusPixels * 2.0); // just set the far plane far enough - we will calculate our own z in the vertex shader anyway
        this._globeProjMatrixInverted = createMat4();
        mat4.invert(this._globeProjMatrixInverted, globeMatrix);
        mat4.translate(globeMatrix, globeMatrix, [0, 0, -this.cameraToCenterDistance]);
        mat4.rotateX(globeMatrix, globeMatrix, -this.pitch * Math.PI / 180);
        mat4.rotateZ(globeMatrix, globeMatrix, -this.angle);
        mat4.translate(globeMatrix, globeMatrix, [0.0, 0, -globeRadiusPixels]);
        // Rotate the sphere to center it on viewed coordinates

        const scaleVec = createVec3();
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

        this._globeViewProjMatrixNoCorrectionInverted = createMat4();
        mat4.invert(this._globeViewProjMatrixNoCorrectionInverted, globeMatrixUncorrected);

        const zero = createVec3();
        this._cameraPosition = createVec3();
        this._cameraPosition[2] = this.cameraToCenterDistance / globeRadiusPixels;
        vec3.rotateX(this._cameraPosition, this._cameraPosition, zero, this.pitch * Math.PI / 180);
        vec3.rotateZ(this._cameraPosition, this._cameraPosition, zero, this.angle);
        vec3.add(this._cameraPosition, this._cameraPosition, [0, 0, 1]);
        vec3.rotateX(this._cameraPosition, this._cameraPosition, zero, -this.center.lat * Math.PI / 180.0);
        vec3.rotateY(this._cameraPosition, this._cameraPosition, zero, this.center.lng * Math.PI / 180.0);

        this._cachedClippingPlane = this._computeClippingPlane(globeRadiusPixels);
    }

    calculateFogMatrix(_unwrappedTileID: UnwrappedTileID): mat4 {
        warnOnce('calculateFogMatrix is not supported on globe projection.');
        const m = createMat4();
        mat4.identity(m);
        return m;
    }

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        // Globe: TODO: implement for globe #3887
        return this._mercatorTransform.getVisibleUnwrappedCoordinates(tileID);
    }

    coveringTiles(options: {
        tileSize: number; minzoom?: number;
        maxzoom?: number; roundZoom?: boolean; reparseOverscaled?: boolean; renderWorldCopies?: boolean; terrain?: Terrain;
    }): OverscaledTileID[] {
        // Globe: TODO: implement for globe #3887
        return this._mercatorTransform.coveringTiles(options);
    }

    recalculateZoom(terrain: Terrain): void {
        this._mercatorTransform.recalculateZoom(terrain);
        this.apply(this._mercatorTransform);
    }

    customLayerMatrix(): mat4 {
        // Globe: TODO
        return this._mercatorTransform.customLayerMatrix();
    }

    maxPitchScaleFactor(): number {
        // Using mercator version of this should be good enough approximation for globe.
        return this._mercatorTransform.maxPitchScaleFactor();
    }

    override getCameraPoint(): Point {
        return this._mercatorTransform.getCameraPoint();
    }

    lngLatToCameraDepth(lngLat: LngLat, elevation: number): number {
        if (!this._globeRendering) {
            return this._mercatorTransform.lngLatToCameraDepth(lngLat, elevation);
        }
        if (!this._globeViewProjMatrixNoCorrection) {
            return 1.0; // _calcMatrices hasn't run yet
        }
        const vec = angularCoordinatesToSurfaceVector(lngLat);
        vec3.scale(vec, vec, (1.0 + elevation / earthRadius));
        const result = createVec4();
        vec4.transformMat4(result, [vec[0], vec[1], vec[2], 1], this._globeViewProjMatrixNoCorrection);
        return result[2] / result[3];
    }

    precacheTiles(coords: OverscaledTileID[]): void {
        this._mercatorTransform.precacheTiles(coords);
    }

    getBounds(): LngLatBounds {
        if (!this._globeRendering) {
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
        if (this.isSurfacePointVisible([0, 1, 0])) {
            // North pole is visible
            // This also means that the entire longitude range must be visible
            boundsArray[3] = 90;
            boundsArray[0] = -180;
            boundsArray[2] = 180;
        }
        if (this.isSurfacePointVisible([0, -1, 0])) {
            // South pole is visible
            boundsArray[1] = -90;
            boundsArray[0] = -180;
            boundsArray[2] = 180;
        }

        return new LngLatBounds(boundsArray);
    }

    override getConstrained(lngLat: LngLat, zoom: number): { center: LngLat; zoom: number } {
        // Globe: TODO: respect _lngRange, _latRange
        // It is possible to implement exact constrain for globe, but I don't think it is worth the effort.
        const constrainedLat = clamp(lngLat.lat, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE);
        const constrainedZoom = clamp(+zoom, this.minZoom + getZoomAdjustment(this, 0, constrainedLat), this.maxZoom);
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
        if (!this._globeRendering) {
            this._mercatorTransform.setLocationAtPoint(lnglat, point);
            this.apply(this._mercatorTransform);
            return;
        }
        // This returns some fake coordinates for pixels that do not lie on the planet.
        // Whatever uses this `setLocationAtPoint` function will need to account for that.
        const pointLngLat = this.unprojectScreenPoint(point);
        const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
        const vecToTarget = angularCoordinatesToSurfaceVector(lnglat);

        const zero = createVec3();
        vec3.zero(zero);

        const rotatedPixelVector = createVec3();
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

        const vecToTargetLngA = createVec3();
        vec3.rotateY(vecToTargetLngA, vecToTarget, zero, -lngA);
        const latA = angleToRotateBetweenVectors2D(vecToTargetLngA[1], vecToTargetLngA[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        const vecToTargetLngB = createVec3();
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
        this.setZoom(this.zoom + getZoomAdjustment(this, oldLat, this.center.lat));
    }

    locationPoint(lnglat: LngLat, terrain?: Terrain): Point {
        if (!this._globeRendering) {
            return this._mercatorTransform.locationPoint(lnglat, terrain);
        }

        const pos = angularCoordinatesToSurfaceVector(lnglat);

        if (terrain) {
            const elevation = terrain.getElevationForLngLatZoom(lnglat, this._tileZoom);
            vec3.scale(pos, pos, 1.0 + elevation / earthRadius);
        }
        const projected = createVec4();
        vec4.transformMat4(projected, [...pos, 1] as vec4, this._globeViewProjMatrixNoCorrection);
        projected[0] /= projected[3];
        projected[1] /= projected[3];
        return new Point(
            (projected[0] * 0.5 + 0.5) * this.width,
            (-projected[1] * 0.5 + 0.5) * this.height
        );
    }

    pointCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        if (!this._globeRendering || terrain) {
            // Mercator has terrain handling implemented properly and since terrain
            // simply draws tile coordinates into a special framebuffer, this works well even for globe.
            return this._mercatorTransform.pointCoordinate(p, terrain);
        }
        return MercatorCoordinate.fromLngLat(this.unprojectScreenPoint(p));
    }

    pointLocation(p: Point, terrain?: Terrain): LngLat {
        if (!this._globeRendering || terrain) {
            // Mercator has terrain handling implemented properly and since terrain
            // simply draws tile coordinates into a special framebuffer, this works well even for globe.
            return this._mercatorTransform.pointLocation(p, terrain);
        }
        return this.unprojectScreenPoint(p);
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        if (!this._globeRendering) {
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
        const pos = createVec4();
        pos[0] = (p.x / this.width) * 2.0 - 1.0;
        pos[1] = ((p.y / this.height) * 2.0 - 1.0) * -1.0;
        pos[2] = 1;
        pos[3] = 1;
        vec4.transformMat4(pos, pos, this._globeViewProjMatrixNoCorrectionInverted);
        pos[0] /= pos[3];
        pos[1] /= pos[3];
        pos[2] /= pos[3];
        const ray = createVec3();
        ray[0] = pos[0] - this._cameraPosition[0];
        ray[1] = pos[1] - this._cameraPosition[1];
        ray[2] = pos[2] - this._cameraPosition[2];
        const rayNormalized: vec3 = createVec3();
        vec3.normalize(rayNormalized, ray);
        return rayNormalized;
    }

    /**
     * For a given point on the unit sphere of the planet, returns whether it is visible from
     * camera's position (not taking into account camera rotation at all).
     */
    private isSurfacePointVisible(p: vec3): boolean {
        if (!this._globeRendering) {
            return true;
        }
        const plane = this._cachedClippingPlane;
        // dot(position on sphere, occlusion plane equation)
        const dotResult = plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
        return dotResult >= 0.0;
    }

    /**
     * Returns the two intersection points of the ray and the planet's sphere, or null if no intersection occurs.
     * The intersections are encoded in the direction along the ray, with `tMin` being the first intersection and `tMax` being the second.
     * @param origin - The ray origin.
     * @param direction - The normalized ray direction.
     */
    private rayPlanetIntersection(origin: vec3, direction: vec3): {
        tMin: number;
        tMax: number;
    } {
        const originDotDirection = vec3.dot(origin, direction);
        const planetRadiusSquared = 1.0; // planet is a unit sphere, so its radius squared is 1

        // Ray-sphere intersection involves a quadratic equation.
        // However solving it in the traditional schoolbook way leads to floating point precision issues.
        // Here we instead use the approach suggested in the book Ray Tracing Gems, chapter 7.
        // https://www.realtimerendering.com/raytracinggems/rtg/index.html
        const inner = createVec3();
        const scaledDir = createVec3();
        vec3.scale(scaledDir, direction, originDotDirection);
        vec3.sub(inner, origin, scaledDir);
        const discriminant = planetRadiusSquared - vec3.dot(inner, inner);

        if (discriminant >= 0) {
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
        } else {
            return null;
        }
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
            // Assume the ray origin is never inside the sphere - just use tMin
            const intersectionPoint = createVec3();
            vec3.add(intersectionPoint, rayOrigin, [
                rayDirection[0] * intersection.tMin,
                rayDirection[1] * intersection.tMin,
                rayDirection[2] * intersection.tMin
            ]);
            const sphereSurface = createVec3();
            vec3.normalize(sphereSurface, intersectionPoint);
            return sphereSurfacePointToCoordinates(sphereSurface);
        } else {
            // Ray does not intersect the sphere -> find the closest point on the horizon to the ray.
            // Intersect the ray with the clipping plane, since we know that the intersection of the clipping plane and the sphere is the horizon.
            const originDotPlaneXyz = this._cachedClippingPlane[0] * rayOrigin[0] + this._cachedClippingPlane[1] * rayOrigin[1] + this._cachedClippingPlane[2] * rayOrigin[2];
            const directionDotPlaneXyz = this._cachedClippingPlane[0] * rayDirection[0] + this._cachedClippingPlane[1] * rayDirection[1] + this._cachedClippingPlane[2] * rayDirection[2];
            const tPlane = -(originDotPlaneXyz + this._cachedClippingPlane[3]) / directionDotPlaneXyz;

            const maxRayLength = 2.0; // One globe diameter
            const planeIntersection = createVec3();

            if (tPlane > 0) {
                vec3.add(planeIntersection, rayOrigin, [
                    rayDirection[0] * tPlane,
                    rayDirection[1] * tPlane,
                    rayDirection[2] * tPlane
                ]);
            } else {
                // When the ray takes too long to hit the plane (>maxRayLength), or if the plane intersection is behind the camera, handle things differently.
                // Take a point along the ray at distance maxRayLength, project it to clipping plane, then continue as normal to find the horizon point.
                const distantPoint = createVec3();
                vec3.add(distantPoint, rayOrigin, [
                    rayDirection[0] * maxRayLength,
                    rayDirection[1] * maxRayLength,
                    rayDirection[2] * maxRayLength
                ]);
                const distanceFromPlane = distantPoint[0] * this._cachedClippingPlane[0] + distantPoint[1] * this._cachedClippingPlane[1] + distantPoint[2] * this._cachedClippingPlane[2] + this._cachedClippingPlane[3];
                vec3.sub(planeIntersection, distantPoint, [
                    this._cachedClippingPlane[0] * distanceFromPlane,
                    this._cachedClippingPlane[1] * distanceFromPlane,
                    this._cachedClippingPlane[2] * distanceFromPlane
                ]);
            }

            const closestOnHorizon = createVec3();
            vec3.normalize(closestOnHorizon, planeIntersection);
            return sphereSurfacePointToCoordinates(closestOnHorizon);
        }
    }
}
