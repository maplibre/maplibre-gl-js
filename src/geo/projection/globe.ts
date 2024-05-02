import {mat4, vec3, vec4} from 'gl-matrix';
import type {Context} from '../../gl/context';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import {Mesh} from '../../render/mesh';
import {EXTENT} from '../../data/extent';
import {SegmentVector} from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import type {Tile} from '../../source/tile';
import {browser} from '../../util/browser';
import {easeCubicInOut, lerp, mod} from '../../util/util';
import {mercatorYfromLat} from '../mercator_coordinate';
import {NORTH_POLE_Y, SOUTH_POLE_Y} from '../../render/subdivision';
import {SubdivisionGranularityExpression, SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import Point from '@mapbox/point-geometry';
import type {ProjectionData} from '../../render/program/projection_program';
import type {Projection, ProjectionGPUContext, TransformLike} from './projection';
import {PreparedShader, shaders} from '../../shaders/shaders';
import {MercatorProjection, translatePosition} from './mercator';
import {ProjectionErrorMeasurement} from './globe_projection_error_measurement';
import {LngLat, earthRadius} from '../lng_lat';
import type {Terrain} from '../../render/terrain';
import type {Transform} from '../transform'; // JP: TODO: maybe remove transform references?

/**
 * The size of border region for stencil masks, in internal tile coordinates.
 * Used for globe rendering.
 */
const EXTENT_STENCIL_BORDER = EXTENT / 128;

const globeTransitionTimeSeconds = 0.5;
const zoomTransitionTimeSeconds = 0.5;
const maxGlobeZoom = 12.0;
const errorTransitionTimeSeconds = 0.5;

const granularitySettingsGlobe: SubdivisionGranularitySetting = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(128, 1),
    line: new SubdivisionGranularityExpression(512, 1),
    // Always keep at least some subdivision on raster tiles, etc,
    // otherwise they will be visibly warped at high zooms (before mercator transition).
    // This si not needed on fill, because fill geometry tends to already be
    // highly tessellated and granular at high zooms.
    tile: new SubdivisionGranularityExpression(128, 16),
    circle: 3
});

export class GlobeProjection implements Projection {
    private _mercator: MercatorProjection;

    private _tileMeshCache: {[_: string]: Mesh} = {};
    private _cachedClippingPlane: vec4 = [1, 0, 0, 0];

    // Transition handling
    private _lastGlobeStateEnabled: boolean = true;
    private _lastGlobeChangeTime: number = -1000.0;
    private _lastLargeZoomStateChange: number = -1000.0;
    private _lastLargeZoomState: boolean = false;

    /**
     * Globe projection can smoothly interpolate between globe view and mercator. This variable controls this interpolation.
     * Value 0 is mercator, value 1 is globe, anything between is an interpolation between the two projections.
     */
    private _globeness: number = 1.0;

    private _skipNextAnimation: boolean = true;

    // GPU atan() error correction
    private _errorMeasurement: ProjectionErrorMeasurement;
    private _errorQueryLatitudeDegrees: number;
    private _errorCorrectionUsable: number = 0.0;
    private _errorMeasurementLastValue: number = 0.0;
    private _errorCorrectionPreviousValue: number = 0.0;
    private _errorMeasurementLastChangeTime: number = -1000.0;

    private _globeProjectionOverride = true;

    private _globeProjMatrix: mat4 = mat4.create();
    private _globeProjMatrixNoCorrection: mat4 = mat4.create();

    private _cameraPosition: vec3 = [0, 0, 0];

    get name(): string {
        return 'globe';
    }

    /**
     * This property is true when globe rendering and globe shader variants should be in use.
     * This is false when globe is disabled, or when globe is enabled, but mercator rendering is used due to zoom level (and no transition is happening).
     */
    get useGlobeRendering(): boolean {
        return this._globeness > 0.0;
    }

    get cameraPosition(): vec3 {
        return vec3.clone(this._cameraPosition); // Return a copy - don't let outside code mutate our precomputed camera position.
    }

    /**
     * This property is true when wrapped tiles need to be rendered.
     * This is false when globe rendering is used and no transition is happening.
     */
    get drawWrappedTiles(): boolean {
        return this._globeness < 1.0;
    }

    get useSubdivision(): boolean {
        return this.useGlobeRendering;
    }

    get useSpecialProjectionForSymbols(): boolean {
        return this.useGlobeRendering;
    }

    get shaderVariantName(): string {
        return this.useGlobeRendering ? 'globe' : this._mercator.shaderVariantName;
    }

    get shaderDefine(): string {
        return this.useGlobeRendering ? '#define GLOBE' : this._mercator.shaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        return this.useGlobeRendering ? shaders.projectionGlobe : this._mercator.shaderPreludeCode;
    }

    get vertexShaderPreludeCode(): string {
        return shaders.projectionMercator.vertexSource;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        return granularitySettingsGlobe;
    }

    /**
     * Returns whether globe view is allowed.
     * When allowed, globe fill function as normal, displaying a 3D planet,
     * but transitioning to mercator at high zoom levels.
     * Otherwise, mercator will be used at all zoom levels instead.
     * Set with {@link setGlobeViewAllowed}.
     */
    public getGlobeViewAllowed(): boolean {
        return this._globeProjectionOverride;
    }

    /**
     * Sets whether globe view is allowed. When allowed, globe fill function as normal, displaying a 3D planet,
     * but transitioning to mercator at high zoom levels.
     * Otherwise, mercator will be used at all zoom levels instead.
     * @param allow - Sets whether glove view is allowed.
     * @param animateTransition - Controls whether the transition between globe view and mercator (if triggered by this call) should be animated. True by default.
     */
    public setGlobeViewAllowed(allow: boolean, animateTransition: boolean = true) {
        if (!animateTransition && allow !== this._globeProjectionOverride) {
            this._skipNextAnimation = true;
        }
        this._globeProjectionOverride = allow;
    }

    constructor() {
        this._mercator = new MercatorProjection();
    }

    public destroy() {
        if (this._errorMeasurement) {
            this._errorMeasurement.destroy();
        }
    }

    public updateGPUdependent(renderContext: ProjectionGPUContext): void {
        if (!this._errorMeasurement) {
            this._errorMeasurement = new ProjectionErrorMeasurement(renderContext);
        }
        const mercatorY = mercatorYfromLat(this._errorQueryLatitudeDegrees);
        const expectedResult = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
        const newValue = this._errorMeasurement.updateErrorLoop(mercatorY, expectedResult);

        const now = browser.now();

        if (newValue !== this._errorMeasurementLastValue) {
            this._errorCorrectionPreviousValue = this._errorCorrectionUsable; // store the interpolated value
            this._errorMeasurementLastValue = newValue;
            this._errorMeasurementLastChangeTime = now;
        }

        const sinceUpdateSeconds = (now - this._errorMeasurementLastChangeTime) / 1000.0;
        const mix = Math.min(Math.max(sinceUpdateSeconds / errorTransitionTimeSeconds, 0.0), 1.0);
        const newCorrection = -this._errorMeasurementLastValue; // Note the negation
        this._errorCorrectionUsable = lerp(this._errorCorrectionPreviousValue, newCorrection, easeCubicInOut(mix));
    }

    public updateProjection(transform: TransformLike): void {
        this._errorQueryLatitudeDegrees = transform.center.lat;
        this._updateAnimation(transform.zoom);

        // We want zoom levels to be consistent between globe and flat views.
        // This means that the pixel size of features at the map center point
        // should be the same for both globe and flat view.
        const globeRadiusPixels = transform.worldSize / (2.0 * Math.PI) / Math.cos(transform.center.lat * Math.PI / 180);

        // Construct a completely separate matrix for globe view
        const globeMatrix = new Float64Array(16) as any;
        const globeMatrixUncorrected = new Float64Array(16) as any;
        mat4.perspective(globeMatrix, transform.fov * Math.PI / 180, transform.width / transform.height, 0.5, transform.cameraToCenterDistance + globeRadiusPixels * 2.0); // just set the far plane far enough - we will calculate our own z in the vertex shader anyway
        mat4.translate(globeMatrix, globeMatrix, [0, 0, -transform.cameraToCenterDistance]);
        mat4.rotateX(globeMatrix, globeMatrix, -transform.pitch * Math.PI / 180);
        mat4.rotateZ(globeMatrix, globeMatrix, -transform.angle);
        mat4.translate(globeMatrix, globeMatrix, [0.0, 0, -globeRadiusPixels]);
        // Rotate the sphere to center it on viewed coordinates

        // Keep a atan-correction-free matrix for transformations done on the CPU with accurate math
        mat4.rotateX(globeMatrixUncorrected, globeMatrix, transform.center.lat * Math.PI / 180.0);
        mat4.rotateY(globeMatrixUncorrected, globeMatrixUncorrected, -transform.center.lng * Math.PI / 180.0);
        mat4.scale(globeMatrixUncorrected, globeMatrixUncorrected, [globeRadiusPixels, globeRadiusPixels, globeRadiusPixels]); // Scale the unit sphere to a sphere with diameter of 1
        this._globeProjMatrixNoCorrection = globeMatrix;

        mat4.rotateX(globeMatrix, globeMatrix, transform.center.lat * Math.PI / 180.0 - this._errorCorrectionUsable);
        mat4.rotateY(globeMatrix, globeMatrix, -transform.center.lng * Math.PI / 180.0);
        mat4.scale(globeMatrix, globeMatrix, [globeRadiusPixels, globeRadiusPixels, globeRadiusPixels]); // Scale the unit sphere to a sphere with diameter of 1
        this._globeProjMatrix = globeMatrix;

        const invProj = mat4.create();
        mat4.invert(invProj, globeMatrix);

        const cameraPos: vec4 = [0, 0, -1, 1];
        vec4.transformMat4(cameraPos, cameraPos, invProj);
        this._cameraPosition = [
            cameraPos[0] / cameraPos[3],
            cameraPos[1] / cameraPos[3],
            cameraPos[2] / cameraPos[3]
        ];

        this._cachedClippingPlane = this._computeClippingPlane(transform, globeRadiusPixels);
    }

    public getProjectionData(canonicalTileCoords: {x: number; y: number; z: number}, tilePosMatrix: mat4, useAtanCorrection: boolean = true): ProjectionData {
        const data = this._mercator.getProjectionData(canonicalTileCoords, tilePosMatrix);

        // Set 'u_projection_matrix' to actual globe transform
        if (this.useGlobeRendering) {
            data['u_projection_matrix'] = useAtanCorrection ? this._globeProjMatrix : this._globeProjMatrixNoCorrection;
        }

        data['u_projection_clipping_plane'] = this._cachedClippingPlane as [number, number, number, number];
        data['u_projection_transition'] = this._globeness;

        return data;
    }

    public isRenderingDirty(): boolean {
        const now = browser.now();
        let dirty = false;
        // Globe transition
        dirty = dirty || (now - this._lastGlobeChangeTime) / 1000.0 < (Math.max(globeTransitionTimeSeconds, zoomTransitionTimeSeconds) + 0.2);
        // Error correction transition
        dirty = dirty || (now - this._errorMeasurementLastChangeTime) / 1000.0 < (errorTransitionTimeSeconds + 0.2);
        // Error correction query in flight
        dirty = dirty || this._errorMeasurement.awaitingQuery;
        return dirty;
    }

    private _computeClippingPlane(
        transform: { center: LngLat; pitch: number; angle: number; cameraToCenterDistance: number },
        globeRadiusPixels: number
    ): vec4 {
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

        const pitch = transform.pitch * Math.PI / 180.0;
        // scale things so that the globe radius is 1
        const distanceCameraToB = transform.cameraToCenterDistance / globeRadiusPixels;
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
        vec3.rotateZ(planeVector, planeVector, [0, 0, 0], transform.angle);
        vec3.rotateX(planeVector, planeVector, [0, 0, 0], -1 * transform.center.lat * Math.PI / 180.0);
        vec3.rotateY(planeVector, planeVector, [0, 0, 0], transform.center.lng * Math.PI / 180.0);
        // Scale the plane vector up
        // we don't want the actually visible parts of the sphere to end up beyond distance 1 from the plane - otherwise they would be clipped by the near plane.
        const scale = 0.25;
        vec3.scale(planeVector, planeVector, scale);
        return [...planeVector, -tangentPlaneDistanceToC * scale];
    }

    /**
     * Returns mercator coordinates in range 0..1 for given coordinates inside a tile and the tile's canonical ID.
     */
    private _tileCoordinatesToMercatorCoordinates(inTileX: number, inTileY: number, tileID: UnwrappedTileID): [number, number] {
        const scale = 1.0 / (1 << tileID.canonical.z);
        return [
            inTileX / EXTENT * scale + tileID.canonical.x * scale,
            inTileY / EXTENT * scale + tileID.canonical.y * scale
        ];
    }

    /**
     * For given mercator coordinates in range 0..1, returns the angular coordinates on the sphere's surface, in radians.
     */
    private _mercatorCoordinatesToAngularCoordinates(mercatorX: number, mercatorY: number): [number, number] {
        const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
        const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
        return [sphericalX, sphericalY];
    }

    private _angularCoordinatesToVector(lngRadians: number, latRadians: number): vec3 {
        const len = Math.cos(latRadians);
        return [
            Math.sin(lngRadians) * len,
            Math.sin(latRadians),
            Math.cos(lngRadians) * len
        ];
    }

    /**
     * Given a 3D point on the surface of a unit sphere, returns its angular coordinates in degrees.
     */
    private _sphereSurfacePointToCoordinates(surface: vec3): LngLat {
        const latRadians = Math.asin(surface[1]);
        const latDegrees = latRadians / Math.PI * 180.0;
        const lengthXZ = Math.sqrt(surface[0] * surface[0] + surface[2] * surface[2]);
        if (lengthXZ > 1e-6) {
            const projX = surface[0] / lengthXZ;
            const projZ = surface[2] / lengthXZ;
            const acosZ = Math.acos(projZ);
            const lngRadians = (projX > 0) ? acosZ : -acosZ;
            const lngDegrees = lngRadians / Math.PI * 180.0;
            return new LngLat(lngDegrees, latDegrees);
        } else {
            return new LngLat(0.0, latDegrees);
        }
    }

    private _projectTileCoordinatesToSphere(inTileX: number, inTileY: number, tileID: UnwrappedTileID): vec3 {
        const mercator = this._tileCoordinatesToMercatorCoordinates(inTileX, inTileY, tileID);
        const angular = this._mercatorCoordinatesToAngularCoordinates(mercator[0], mercator[1]);
        const sphere = this._angularCoordinatesToVector(angular[0], angular[1]);
        return sphere;
    }

    public isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean {
        const spherePos = this._projectTileCoordinatesToSphere(x, y, unwrappedTileID);

        const plane = this._cachedClippingPlane;
        // dot(position on sphere, occlusion plane equation)
        const dotResult = plane[0] * spherePos[0] + plane[1] * spherePos[1] + plane[2] * spherePos[2] + plane[3];
        return dotResult < 0.0;
    }

    public transformLightDirection(transform: { center: LngLat }, dir: vec3): vec3 {
        const sphereX = transform.center.lng * Math.PI / 180.0;
        const sphereY = transform.center.lat * Math.PI / 180.0;

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

    public getPixelScale(transform: { center: LngLat }): number {
        const globePixelScale = 1.0 / Math.cos(transform.center.lat * Math.PI / 180);
        const flatPixelScale = 1.0;
        if (this.useGlobeRendering) {
            return lerp(flatPixelScale, globePixelScale, this._globeness);
        }
        return flatPixelScale;
    }

    public getCircleRadiusCorrection(transform: { center: LngLat }): number {
        return Math.cos(transform.center.lat * Math.PI / 180);
    }

    public getPitchedTextCorrection(transform: { center: LngLat }, textAnchor: Point, tileID: UnwrappedTileID): number {
        if (!this.useGlobeRendering) {
            return 1.0;
        }
        const mercator = this._tileCoordinatesToMercatorCoordinates(textAnchor.x, textAnchor.y, tileID);
        const angular = this._mercatorCoordinatesToAngularCoordinates(mercator[0], mercator[1]);
        return this.getCircleRadiusCorrection(transform) / Math.cos(angular[1]);
    }

    private _updateAnimation(currentZoom: number) {
        // Update globe transition animation
        const globeState = this._globeProjectionOverride;
        const currentTime = browser.now();
        if (globeState !== this._lastGlobeStateEnabled) {
            this._lastGlobeChangeTime = currentTime;
            this._lastGlobeStateEnabled = globeState;
        }
        // Transition parameter, where 0 is the start and 1 is end.
        const globeTransition = Math.min(Math.max((currentTime - this._lastGlobeChangeTime) / 1000.0 / globeTransitionTimeSeconds, 0.0), 1.0);
        this._globeness = globeState ? globeTransition : (1.0 - globeTransition);

        if (this._skipNextAnimation) {
            this._globeness = globeState ? 1.0 : 0.0;
            this._lastGlobeChangeTime = currentTime - globeTransitionTimeSeconds * 1000.0 * 2.0;
            this._skipNextAnimation = false;
        }

        // Update globe zoom transition
        const currentZoomState = currentZoom >= maxGlobeZoom;
        if (currentZoomState !== this._lastLargeZoomState) {
            this._lastLargeZoomState = currentZoomState;
            this._lastLargeZoomStateChange = currentTime;
        }
        const zoomTransition = Math.min(Math.max((currentTime - this._lastLargeZoomStateChange) / 1000.0 / zoomTransitionTimeSeconds, 0.0), 1.0);
        const zoomGlobenessBound = currentZoomState ? (1.0 - zoomTransition) : zoomTransition;
        this._globeness = Math.min(this._globeness, zoomGlobenessBound);
        this._globeness = easeCubicInOut(this._globeness); // Smooth animation
    }

    private _getMeshKey(granularity: number, border: boolean, north: boolean, south: boolean): string {
        return `${granularity.toString(36)}_${border ? 'b' : ''}${north ? 'n' : ''}${south ? 's' : ''}`;
    }

    public getMeshFromTileID(context: Context, canonical: CanonicalTileID, hasBorder: boolean): Mesh {
        // Stencil granularity must match fill granularity
        const granularity = granularitySettingsGlobe.fill.getGranularityForZoomLevel(canonical.z);
        const north = (canonical.y === 0);
        const south = (canonical.y === (1 << canonical.z) - 1);
        return this._getMesh(context, granularity, hasBorder, north, south);
    }

    private _getMesh(context: Context, granularity: number, hasBorder: boolean, hasNorthEdge: boolean, hasSouthEdge: boolean): Mesh {
        const key = this._getMeshKey(granularity, hasBorder, hasNorthEdge, hasSouthEdge);

        if (key in this._tileMeshCache) {
            return this._tileMeshCache[key];
        }

        const mesh = this._createQuadMesh(context, granularity, hasBorder, hasNorthEdge, hasSouthEdge);
        this._tileMeshCache[key] = mesh;
        return mesh;
    }

    public translatePosition(transform: { angle: number; zoom: number }, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number] {
        // In the future, some better translation for globe and other weird projections should be implemented here,
        // especially for the translateAnchor==='viewport' case.
        return translatePosition(transform, tile, translate, translateAnchor);
    }

    /**
     * Creates a quad mesh covering positions in range 0..EXTENT, for tile clipping.
     * @param context - MapLibre's rendering context object.
     * @param granularity - Mesh triangulation granularity: 1 for just a single quad, 3 for 3x3 quads.
     * @returns
     */
    private _createQuadMesh(context: Context, granularity: number, border: boolean, north: boolean, south: boolean): Mesh {
        const vertexArray = new PosArray();
        const indexArray = new TriangleIndexArray();

        // We only want to generate the north/south border if the tile
        // does NOT border the north/south edge of the mercator range.

        const quadsPerAxisX = granularity + (border ? 2 : 0); // two extra quads for border
        const quadsPerAxisY = granularity + ((north || border) ? 1 : 0) + (south || border ? 1 : 0);
        const verticesPerAxisX = quadsPerAxisX + 1; // one more vertex than quads
        //const verticesPerAxisY = quadsPerAxisY + 1; // one more vertex than quads
        const offsetX = border ? -1 : 0;
        const offsetY = (border || north) ? -1 : 0;
        const endX = granularity + (border ? 1 : 0);
        const endY = granularity + ((border || south) ? 1 : 0);

        const northY = NORTH_POLE_Y;
        const southY = SOUTH_POLE_Y;

        for (let y = offsetY; y <= endY; y++) {
            for (let x = offsetX; x <= endX; x++) {
                let vx = x / granularity * EXTENT;
                if (x === -1) {
                    vx = -EXTENT_STENCIL_BORDER;
                }
                if (x === granularity + 1) {
                    vx = EXTENT + EXTENT_STENCIL_BORDER;
                }
                let vy = y / granularity * EXTENT;
                if (y === -1) {
                    vy = north ? northY : (-EXTENT_STENCIL_BORDER);
                }
                if (y === granularity + 1) {
                    vy = south ? southY : EXTENT + EXTENT_STENCIL_BORDER;
                }
                vertexArray.emplaceBack(vx, vy);
            }
        }

        for (let y = 0; y < quadsPerAxisY; y++) {
            for (let x = 0; x < quadsPerAxisX; x++) {
                const v0 = x + y * verticesPerAxisX;
                const v1 = (x + 1) + y * verticesPerAxisX;
                const v2 = x + (y + 1) * verticesPerAxisX;
                const v3 = (x + 1) + (y + 1) * verticesPerAxisX;
                // v0----v1
                //  |  / |
                //  | /  |
                // v2----v3
                indexArray.emplaceBack(v0, v2, v1);
                indexArray.emplaceBack(v1, v2, v3);
            }
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return mesh;
    }

    public projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number) {
        const spherePos = this._projectTileCoordinatesToSphere(x, y, unwrappedTileID);
        const elevation = getElevation ? getElevation(x, y) : 0.0;
        const vectorMultiplier = 1.0 + elevation / earthRadius;
        const pos: vec4 = [spherePos[0] * vectorMultiplier, spherePos[1] * vectorMultiplier, spherePos[2] * vectorMultiplier, 1];
        vec4.transformMat4(pos, pos, this._globeProjMatrixNoCorrection);

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
}
