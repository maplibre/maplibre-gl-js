import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {MercatorCoordinate, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate.ts';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, createMat4f64, degreesToRadians, radiansToDegrees, createIdentityMat4f32, zoomScale, scaleZoom, type Mat4f32, type Mat4f64} from '../../util/util.ts';
import {mat4, vec3, vec4} from 'gl-matrix';
import {UnwrappedTileID, OverscaledTileID, type CanonicalTileID, calculateTileKey} from '../../tile/tile_id.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {type PointProjection, xyTransformMat4} from '../../symbol/projection.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {getMercatorHorizon, projectToWorldCoordinates, unprojectFromWorldCoordinates, calculateTileMatrix, maxMercatorHorizonAngle, cameraMercatorCoordinateFromCenterAndRotation} from './mercator_utils.ts';
import {EXTENT} from '../../data/extent.ts';
import {Transform} from '../transform.ts';
import {MercatorCoveringTilesDetailsProvider} from './mercator_covering_tiles_details_provider.ts';
import {Frustum} from '../../util/primitives/frustum.ts';
import {fastInvertProjMat4} from '../../util/fast_maths.ts';
import {bisect, sampleAt, isBelowTerrainSample, TERRAIN_OCCLUSION_MARGIN, type TerrainCoverageIndex, type TerrainSample} from '../../render/terrain_coverage.ts';

import type {CameraOptionsFromTo, TransformConstrainFunction} from '../transform_interface.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';

/**
 * @internal
 * The portion of a ray through a screen pixel that lies inside the view frustum.
 * Both endpoints use world pixels for x and y, and meters above sea level for z.
 */
type RaySegment = {
    near: vec3;
    far: vec3;
};

const TARGET_WORLD_STEP_PX = 4;
const MAX_SAMPLES = 512;
const MERCATOR_BISECT_EPSILON_WORLD_PX = 1e-3;
/**
 * How many times {@link MercatorTransform.recalculateZoomAndCenter} picks the terrain under the center and moves the
 * center onto it, and how far above or below the terrain a center may stay. Each pass keeps the camera where it is,
 * so the center's latitude changes the mercator scale the next pass sees and the terrain pick moves with it; the
 * remainder shrinks by the scale difference each pass, from meters to under a millimeter on the second.
 */
const CENTER_ON_TERRAIN_PASSES = 3;
const CENTER_ON_TERRAIN_TOLERANCE_M = 0.0001;
/**
 * The clip-space depth of the near clipping plane, where the ray segment through a screen pixel starts for a terrain
 * pick so that it holds all the view shows; see `getRaySegmentFromPixel`.
 */
const NEAR_PLANE_CLIP_Z = -1;

/**
 * @internal
 * A ray to intersect with the terrain surface, in world pixels:
 * `near` is the segment start, `dx`/`dy`/`dz` span to the segment end, and z values are meters above sea level.
 */
type MercatorRay = {
    index: TerrainCoverageIndex;
    exaggeration: number;
    near: vec3;
    dx: number;
    dy: number;
    dz: number;
    worldSize: number;
};

/**
 * @internal
 * The mercator part of a {@link Transform}.
 */
export class MercatorTransform implements IProjectionTransform {
    private _transform: Transform;

    private _cameraPosition: vec3;

    private _mercatorMatrix: mat4;
    private _projectionMatrix: mat4;
    private _viewProjMatrix: mat4;
    private _invViewProjMatrix: mat4;
    private _invProjMatrix: mat4;
    private _alignedProjMatrix: mat4;
    private _pixelMatrix: mat4;
    private _pixelMatrix3D: mat4;
    private _pixelMatrixInverse: mat4;
    private _fogMatrix: mat4;

    private _posMatrixCache: Map<string, {f64: Mat4f64; f32: Mat4f32}> = new Map();
    private _alignedPosMatrixCache: Map<string, {f64: Mat4f64; f32: Mat4f32}> = new Map();
    private _fogMatrixCacheF32: Map<string, mat4> = new Map();

    private _coveringTilesDetailsProvider;

    /**
     * @param transform - The transform whose camera state this part derives its matrices from.
     */
    constructor(transform: Transform) {
        this._transform = transform;
        this._coveringTilesDetailsProvider = new MercatorCoveringTilesDetailsProvider();
    }

    clone(transform: Transform): MercatorTransform {
        return new MercatorTransform(transform);
    }

    setTransitionState(_value: number): void {
        // Do nothing
    }

    public get cameraPosition(): vec3 { return this._cameraPosition; }
    public get projectionMatrix(): mat4 { return this._projectionMatrix; }
    public get modelViewProjectionMatrix(): mat4 { return this._viewProjMatrix; }
    public get inverseProjectionMatrix(): mat4 { return this._invProjMatrix; }
    public get mercatorMatrix(): mat4 { return this._mercatorMatrix; } // Not part of ITransform interface

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        const result = [new UnwrappedTileID(0, tileID)];
        if (this._transform.renderWorldCopies) {
            const utl = this.screenPointToMercatorCoordinate(new Point(0, 0));
            const utr = this.screenPointToMercatorCoordinate(new Point(this._transform.width, 0));
            const ubl = this.screenPointToMercatorCoordinate(new Point(this._transform.width, this._transform.height));
            const ubr = this.screenPointToMercatorCoordinate(new Point(0, this._transform.height));
            const w0 = Math.floor(Math.min(utl.x, utr.x, ubl.x, ubr.x));
            const w1 = Math.floor(Math.max(utl.x, utr.x, ubl.x, ubr.x));

            // Add an extra copy of the world on each side to properly render ImageSources and CanvasSources.
            // Both sources draw outside the tile boundaries of the tile that "contains them" so we need
            // to add extra copies on both sides in case offscreen tiles need to draw into on-screen ones.
            const extraWorldCopy = 1;

            for (let w = w0 - extraWorldCopy; w <= w1 + extraWorldCopy; w++) {
                if (w === 0) continue;
                result.push(new UnwrappedTileID(w, tileID));
            }
        }
        return result;
    }

    getCameraFrustum(): Frustum {
        return Frustum.fromInvProjectionMatrix(this._invViewProjMatrix, this._transform.worldSize);
    }
    getClippingPlane(): vec4 | null {
        return null;
    }
    getCoveringTilesDetailsProvider(): CoveringTilesDetailsProvider {
        return this._coveringTilesDetailsProvider;
    }

    recalculateZoomAndCenter(terrain?: Terrain): void {
        for (let pass = 0; pass < CENTER_ON_TERRAIN_PASSES; pass++) {
            // find position the camera is looking on
            const center = (terrain && this._terrainPointPastMaxZoom(terrain)) || this.screenPointToLocation(this._transform.centerPoint, terrain);
            const elevation = terrain ? terrain.getElevationForLngLat(center, this._transform) : 0;
            if (this._transform.pitch < 90 && elevation >= this.getCameraAltitude()) return;
            this._transform.recalculateZoomAndCenterAtElevation(elevation);
            if (!terrain || Math.abs(terrain.getElevationForLngLat(this._transform.center, this._transform) - this._transform.elevation) <= CENTER_ON_TERRAIN_TOLERANCE_M) return;
        }
    }

    /**
     * Moves the center so that `lnglat`, on the ground at `elevation` meters, renders
     * at the screen `point`. Both rays are cast through the same inverse pixel matrix
     * so its inversion error cancels out of their difference; the current-center ray
     * must be intersected at the center's own elevation (z=0) — intersecting it with
     * the elevated plane would land `(elevation - centerElevation)·tan(pitch)` away
     * from the center and make repeated calls drift.
     */
    setLocationAtPoint(lnglat: LngLat, point: Point, elevation: number = this._transform.elevation): void {
        const z = elevation - this._transform.elevation;
        const a = this.screenPointToMercatorCoordinateAtZ(point, z);
        const b = this.screenPointToMercatorCoordinateAtZ(this._transform.centerPoint, 0);
        const loc = MercatorCoordinate.fromLngLat(lnglat);
        const newCenter = new MercatorCoordinate(
            loc.x - (a.x - b.x),
            loc.y - (a.y - b.y));
        this._transform.setCenter(newCenter?.toLngLat());
        if (this._transform.renderWorldCopies) {
            this._transform.setCenter(this._transform.center.wrap());
        }
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        return terrain ?
            this.coordinatePoint(MercatorCoordinate.fromLngLat(lnglat), terrain.getElevationForLngLat(lnglat, this._transform), this._pixelMatrix3D) :
            this.coordinatePoint(MercatorCoordinate.fromLngLat(lnglat));
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return this.screenPointToMercatorCoordinate(p, terrain)?.toLngLat();
    }

    screenPointToLocationAtElevation(p: Point, elevation: number): LngLat {
        return this.screenPointToMercatorCoordinateAtZ(p, elevation - this._transform.elevation)?.toLngLat();
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        if (terrain) {
            const coordinate = this.screenTerrainPointToMercatorCoordinate(p, terrain);
            if (coordinate != null) {
                return coordinate;
            }
        }
        return this.screenPointToMercatorCoordinateAtZ(p);
    }

    /**
     * Where the center ray meets the terrain beyond the distance at which the center sits from the camera at maxZoom,
     * if the ray is above the terrain there; null otherwise. A center on nearer terrain needs a zoom past maxZoom, which
     * `setZoom` clamps by moving the camera back, so once the ray has cleared a bump nearer than that, the center goes
     * to the terrain behind it. Where maxZoom lets the camera nearer than the near clipping plane, the ray is followed
     * from that plane, like every terrain pick.
     */
    private _terrainPointPastMaxZoom(terrain: Terrain): LngLat | null {
        const index = terrain.getCoverageIndex();
        if (!index) return null;
        const {near, far} = this.getRaySegmentFromPixel(this._transform.centerPoint, NEAR_PLANE_CLIP_Z);
        const distanceAtMaxZoom = this._transform.cameraToCenterDistance * zoomScale(this._transform.zoom - this._transform.maxZoom);
        const start = vec3.lerp([], near, far, Math.max(0, (distanceAtMaxZoom - this._transform.nearZ) / (this._transform.farZ - this._transform.nearZ)));
        if (isBelowTerrainSample(sampleAt(index, terrain.exaggeration, start[0] / this._transform.worldSize, start[1] / this._transform.worldSize), start[2])) return null;
        return this._raycastTerrain(start, far, terrain)?.toLngLat() ?? null;
    }

    /** {@inheritDoc ITransform.screenTerrainPointToMercatorCoordinate} */
    screenTerrainPointToMercatorCoordinate(p: Point, terrain: Terrain): MercatorCoordinate | null {
        const {near, far} = this.getRaySegmentFromPixel(p, NEAR_PLANE_CLIP_Z);
        return this._raycastTerrain(near, far, terrain);
    }

    /** The first point where the segment from `near` to `far` enters the terrain from above, or null. */
    private _raycastTerrain(near: vec3, far: vec3, terrain: Terrain): MercatorCoordinate | null {
        const index = terrain.getCoverageIndex();
        if (!index) return null;

        const worldSize = this._transform.worldSize;
        const dx = far[0] - near[0];
        const dy = far[1] - near[1];
        const dz = far[2] - near[2];
        const ray: MercatorRay = {index, exaggeration: terrain.exaggeration, near, dx, dy, dz, worldSize};

        let tStart = 0;
        let tEnd = 1;
        if (dz === 0) {
            if (near[2] > index.maxElevation || near[2] < index.minElevation) return null;
        } else {
            const tHigh = (index.maxElevation - near[2]) / dz;
            const tLow = (index.minElevation - near[2]) / dz;
            tStart = Math.max(tStart, Math.min(tHigh, tLow));
            tEnd = Math.min(tEnd, Math.max(tHigh, tLow));
            if (tStart > tEnd) return null;
        }

        const horizontalLength = Math.hypot(dx, dy);
        const samples = clamp(Math.ceil(horizontalLength * (tEnd - tStart) / TARGET_WORLD_STEP_PX), 1, MAX_SAMPLES);

        let previousT = 0;
        let aboveTerrain = !mercatorIsBelowTerrain(ray, 0);

        for (let i = 0; i <= samples; i++) {
            const t = tStart + (tEnd - tStart) * i / samples;

            if (!aboveTerrain) {
                aboveTerrain = !mercatorIsBelowTerrain(ray, t);
            } else if (mercatorIsBelowTerrain(ray, t)) {
                const {lo, hi} = bisect(ray, mercatorIsBelowTerrain, previousT, t, MERCATOR_BISECT_EPSILON_WORLD_PX / horizontalLength);
                const sampleLo = mercatorSampleAt(ray, lo);
                const sampleHi = mercatorSampleAt(ray, hi);
                const fLo = near[2] + lo * dz - sampleLo.elevation;
                const fHi = near[2] + hi * dz - sampleHi.elevation;
                const hit = sampleLo.covered && fLo > fHi ? clamp(lo + fLo * (hi - lo) / (fLo - fHi), lo, hi) : hi;
                return new MercatorCoordinate(
                    (near[0] + hit * dx) / worldSize,
                    (near[1] + hit * dy) / worldSize,
                    mercatorSampleAt(ray, hit).elevation);
            }

            previousT = t;
        }

        return null;
    }

    /**
     * Returns the segment of the ray through the given screen pixel from its point at depth `clipZ` in clip space to the
     * far clipping plane. The default of 0 lies at about twice the near clipping plane's distance from the camera, which
     * is all a plane intersection needs; `NEAR_PLANE_CLIP_Z` starts the segment at the near clipping plane, so it holds
     * all the view shows, as terrain picks need.
     */
    private getRaySegmentFromPixel(p: Point, clipZ: number = 0): RaySegment {
        const coord0 = [p.x, p.y, clipZ, 1] as vec4;
        const coord1 = [p.x, p.y, 1, 1] as vec4;

        vec4.transformMat4(coord0, coord0, this._pixelMatrixInverse);
        vec4.transformMat4(coord1, coord1, this._pixelMatrixInverse);

        const w0 = coord0[3];
        const w1 = coord1[3];
        // The pixel matrix is built before the elevation translate, so unprojected z is relative to the center's elevation.
        const elevation = this._transform.elevation;

        return {
            near: [coord0[0] / w0, coord0[1] / w0, coord0[2] / w0 + elevation],
            far: [coord1[0] / w1, coord1[1] / w1, coord1[2] / w1 + elevation]
        };
    }

    /**
     * Intersects the ray through a screen point with the horizontal plane at `z`,
     * given in meters relative to the plane at the center's elevation (not mercator units).
     */
    screenPointToMercatorCoordinateAtZ(p: Point, z?: number): MercatorCoordinate {
        const targetZ = z ? z : 0;
        const {near, far} = this.getRaySegmentFromPixel(p);

        const t = near[2] === far[2] ? 0 : (targetZ + this._transform.elevation - near[2]) / (far[2] - near[2]);

        return new MercatorCoordinate(
            interpolates.number(near[0], far[0], t) / this._transform.worldSize,
            interpolates.number(near[1], far[1], t) / this._transform.worldSize,
            targetZ);
    }

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param coord - the coordinates
     * @param elevation - the elevation
     * @param pixelMatrix - the pixel matrix
     * @returns screen point. Point will be outside the viewport if the coordinate is behind the camera.
     */
    coordinatePoint(coord: MercatorCoordinate, elevation: number = 0, pixelMatrix: mat4 = this._pixelMatrix): Point {
        const p = this._coordinateClipPoint(coord, elevation, pixelMatrix);
        const w = p[3];
        if (w > 0) {
            return new Point(p[0] / w, p[1] / w);
        }
        return this._offScreenPointBehindCamera(p[0], p[1], w);
    }

    /**
     * The coordinate in the clip space of `pixelMatrix`: pixel x and y and NDC depth, each times `w`, which is positive
     * in front of the camera.
     */
    private _coordinateClipPoint(coord: MercatorCoordinate, elevation: number, pixelMatrix: mat4): vec4 {
        const p = [coord.x * this._transform.worldSize, coord.y * this._transform.worldSize, elevation, 1] as vec4;
        return vec4.transformMat4(p, p, pixelMatrix);
    }

    /**
     * Returns a screen point outside the viewport for a coordinate that is behind the camera.
     * The point lies on the boundary of the viewport enlarged by one viewport size on each side,
     * on whichever edge the ray from the screen centre in the coordinate's direction reaches first.
     * A coordinate exactly behind the camera has no direction to leave through, so it is placed straight down.
     * @param x - the x component of the clip space position, before the division by w
     * @param y - the y component of the clip space position, before the division by w
     * @param w - the w component of the clip space position, zero or negative
     * @returns screen point outside the viewport
     */
    private _offScreenPointBehindCamera(x: number, y: number, w: number): Point {
        const cx = this._transform.width / 2;
        const cy = this._transform.height / 2;
        const dx = x - cx * w;
        let dy = y - cy * w;
        if (dx === 0 && dy === 0) {
            dy = 1;
        }
        const halfExtentX = cx + this._transform.width;
        const halfExtentY = cy + this._transform.height;
        const scale = Math.min(
            dx !== 0 ? halfExtentX / Math.abs(dx) : Infinity,
            dy !== 0 ? halfExtentY / Math.abs(dy) : Infinity);
        return new Point(cx + dx * scale, cy + dy * scale);
    }

    getBounds(): LngLatBounds {
        const top = Math.max(0, this._transform.height / 2 - getMercatorHorizon(this._transform));
        return new LngLatBounds()
            .extend(this.screenPointToLocation(new Point(0, top)))
            .extend(this.screenPointToLocation(new Point(this._transform.width, top)))
            .extend(this.screenPointToLocation(new Point(this._transform.width, this._transform.height)))
            .extend(this.screenPointToLocation(new Point(0, this._transform.height)));
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        if (terrain) {
            return this.screenTerrainPointToMercatorCoordinate(p, terrain) != null;
        }
        return (p.y > this._transform.centerPoint.y - getMercatorHorizon(this._transform));
    }

    /**
     * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
     * This function is specific to the mercator projection.
     * @param tileID - the tile ID
     * @param aligned - whether to use a pixel-aligned matrix variant, intended for rendering raster tiles
     * @param useFloat32 - when true, returns a float32 matrix instead of float64. Use float32 for matrices that are passed to shaders, use float64 for everything else.
     */
    calculatePosMatrix(tileID: UnwrappedTileID | OverscaledTileID, aligned: boolean | undefined, useFloat32: true): Mat4f32;
    calculatePosMatrix(tileID: UnwrappedTileID | OverscaledTileID, aligned?: boolean, useFloat32?: false): Mat4f64;
    calculatePosMatrix(tileID: UnwrappedTileID | OverscaledTileID, aligned: boolean = false, useFloat32: boolean = false): Mat4f32 | Mat4f64 {
        const posMatrixKey = tileID.key ?? calculateTileKey(tileID.wrap, tileID.canonical.z, tileID.canonical.z, tileID.canonical.x, tileID.canonical.y);
        const cache = aligned ? this._alignedPosMatrixCache : this._posMatrixCache;
        if (cache.has(posMatrixKey)) {
            const matrices = cache.get(posMatrixKey);
            return useFloat32 ? matrices.f32 : matrices.f64;
        }

        const tileMatrix = calculateTileMatrix(tileID, this._transform.worldSize);
        mat4.multiply(tileMatrix, aligned ? this._alignedProjMatrix : this._viewProjMatrix, tileMatrix);
        const matrices: {f64: Mat4f64; f32: Mat4f32} = {
            f64: tileMatrix,
            f32: new Float32Array(tileMatrix), // Must have a 32 bit float version for WebGL, otherwise WebGL calls in Chrome get very slow.
        };
        cache.set(posMatrixKey, matrices);
        // Make sure to return the correct precision
        return useFloat32 ? matrices.f32 : matrices.f64;
    }

    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4 {
        const posMatrixKey = unwrappedTileID.key;
        const cache = this._fogMatrixCacheF32;
        if (cache.has(posMatrixKey)) {
            return cache.get(posMatrixKey);
        }

        const fogMatrix = calculateTileMatrix(unwrappedTileID, this._transform.worldSize);
        mat4.multiply(fogMatrix, this._fogMatrix, fogMatrix);

        cache.set(posMatrixKey, new Float32Array(fogMatrix)); // Must be 32 bit floats, otherwise WebGL calls in Chrome get very slow.
        return cache.get(posMatrixKey);
    }

    /**
     * This mercator implementation returns center lngLat and zoom to ensure that:
     *
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     *
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    defaultConstrain: TransformConstrainFunction = (lngLat, zoom) => {
        zoom = clamp(+zoom, this._transform.minZoom, this._transform.maxZoom);
        const result = {
            center: new LngLat(lngLat.lng, lngLat.lat),
            zoom
        };

        let lngRange = this._transform.lngRange;

        if (!this._transform.renderWorldCopies && lngRange === null) {
            const almost180 = 180 - 1e-10;
            lngRange = [-almost180, almost180];
        }

        const worldSize = this._transform.tileSize * zoomScale(result.zoom); // A world size for the requested zoom level, not the current world size
        let minY = 0;
        let maxY = worldSize;
        let minX = 0;
        let maxX = worldSize;
        let scaleY = 0;
        let scaleX = 0;
        const {top = 0, bottom = 0, left = 0, right = 0} = this._transform.padding;
        const screenWidth = this._transform.width - left - right;
        const screenHeight = this._transform.height - top - bottom;

        if (this._transform.latRange) {
            const latRange = this._transform.latRange;
            minY = mercatorYfromLat(latRange[1]) * worldSize;
            maxY = mercatorYfromLat(latRange[0]) * worldSize;
            const shouldZoomIn = maxY - minY < screenHeight;
            if (shouldZoomIn) scaleY = screenHeight / (maxY - minY);
        }

        if (lngRange) {
            minX = wrap(
                mercatorXfromLng(lngRange[0]) * worldSize,
                0,
                worldSize
            );
            maxX = wrap(
                mercatorXfromLng(lngRange[1]) * worldSize,
                0,
                worldSize
            );

            if (maxX < minX) maxX += worldSize;

            const shouldZoomIn = maxX - minX < screenWidth;
            if (shouldZoomIn) scaleX = screenWidth / (maxX - minX);
        }

        const {x: originalX, y: originalY} = projectToWorldCoordinates(worldSize, lngLat);
        let modifiedX, modifiedY;

        const scale = Math.max(scaleX || 0, scaleY || 0);

        if (scale) {
            // zoom in to exclude all beyond the given lng/lat ranges
            const newPoint = new Point(
                scaleX ? (maxX + minX) / 2 : originalX,
                scaleY ? (maxY + minY) / 2 : originalY);
            result.center = unprojectFromWorldCoordinates(worldSize, newPoint).wrap();
            result.zoom += scaleZoom(scale);
            return result;
        }

        if (this._transform.latRange) {
            const h2 = screenHeight / 2;
            if (originalY - h2 < minY) modifiedY = minY + h2;
            if (originalY + h2 > maxY) modifiedY = maxY - h2;
        }

        if (lngRange) {
            const centerX = (minX + maxX) / 2;
            let wrappedX = originalX;
            if (this._transform.renderWorldCopies) {
                wrappedX = wrap(originalX, centerX - worldSize / 2, centerX + worldSize / 2);
            }
            const w2 = screenWidth / 2;

            if (wrappedX - w2 < minX) modifiedX = minX + w2;
            if (wrappedX + w2 > maxX) modifiedX = maxX - w2;
        }

        // pan the map if the screen goes off the range
        if (modifiedX !== undefined || modifiedY !== undefined) {
            const newPoint = new Point(modifiedX ?? originalX, modifiedY ?? originalY);
            result.center = unprojectFromWorldCoordinates(worldSize, newPoint).wrap();
        }

        return result;
    };

    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const fromMercator = MercatorCoordinate.fromLngLat(from, altitudeFrom);
        const toMercator = MercatorCoordinate.fromLngLat(to, altitudeTo);
        const dx = toMercator.x - fromMercator.x;
        const dy = toMercator.y - fromMercator.y;
        const dz = toMercator.z - fromMercator.z;

        const distance3D = Math.hypot(dx, dy, dz);
        if (distance3D === 0) throw new Error('Can\'t calculate camera options with same From and To');

        const groundDistance = Math.hypot(dx, dy);

        const zoom = scaleZoom(this._transform.cameraToCenterDistance / distance3D / this._transform.tileSize);
        const bearing = radiansToDegrees(Math.atan2(dx, -dy));
        let pitch = radiansToDegrees(Math.acos(groundDistance / distance3D));
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;

        return {center: toMercator.toLngLat(), elevation: altitudeTo, zoom, pitch, bearing};
    }

    _calculateNearFarZ(cameraToSeaLevelDistance: number, limitedPitchRadians: number, offset: Point): void {
        // In case of negative minimum elevation (e.g. the dead see, under the sea maps) use a lower plane for calculation
        const minRenderDistanceBelowCameraInMeters = 100;
        const minElevation = Math.min(this._transform.elevation, this._transform.minElevationForCurrentTile, this.getCameraAltitude() - minRenderDistanceBelowCameraInMeters);
        const cameraToLowestPointDistance = cameraToSeaLevelDistance - minElevation * this._transform.pixelsPerMeter / Math.cos(limitedPitchRadians);
        const lowestPlane = minElevation < 0 ? cameraToLowestPointDistance : cameraToSeaLevelDistance;

        // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
        // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        const groundAngle = Math.PI / 2 + this._transform.pitchInRadians;
        const zfov = degreesToRadians(this._transform.fov) * (Math.abs(Math.cos(degreesToRadians(this._transform.roll))) * this._transform.height + Math.abs(Math.sin(degreesToRadians(this._transform.roll))) * this._transform.width) / this._transform.height;
        const fovAboveCenter = zfov * (0.5 + offset.y / this._transform.height);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));

        // Find the distance from the center point to the horizon
        const horizon = getMercatorHorizon(this._transform);
        const horizonAngle = Math.atan(horizon / this._transform.cameraToCenterDistance);
        const minFovCenterToHorizonRadians = degreesToRadians(90 - maxMercatorHorizonAngle);
        const fovCenterToHorizon = horizonAngle > minFovCenterToHorizonRadians ? 2 * horizonAngle * (0.5 + offset.y / (horizon * 2)) : minFovCenterToHorizonRadians;
        const topHalfSurfaceDistanceHorizon = Math.sin(fovCenterToHorizon) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovCenterToHorizon, 0.01, Math.PI - 0.01));

        // Calculate z distance of the farthest fragment that should be rendered.
        // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
        const topHalfMinDistance = Math.min(topHalfSurfaceDistance, topHalfSurfaceDistanceHorizon);

        this._transform._farZ = (Math.cos(Math.PI / 2 - limitedPitchRadians) * topHalfMinDistance + lowestPlane) * 1.01;

        // The larger the value of nearZ is
        // - the more depth precision is available for features (good)
        // - clipping starts appearing sooner when the camera is close to 3d features (bad)
        //
        // Other values work for mapbox-gl-js but deck.gl was encountering precision issues
        // when rendering custom layers. This value was experimentally chosen and
        // seems to solve z-fighting issues in deck.gl while not clipping buildings too close to the camera.
        this._transform._nearZ = this._transform.height / 50;
    }

    /**
     * @param calculateNearFarZ - Whether to compute the near/far Z range, or leave the range the transform already
     * holds. Defaults to {@link Transform.autoCalculateNearFarZ}; a composing part such as {@link GlobeTransform}
     * overrides it so that its two children share a single depth range.
     */
    calcMatrices(calculateNearFarZ: boolean = this._transform.autoCalculateNearFarZ): void {
        const offset = this._transform.centerOffset;
        const point = projectToWorldCoordinates(this._transform.worldSize, this._transform.center);
        const x = point.x, y = point.y;

        // Calculate the camera to sea-level distance in pixel in respect of terrain
        const limitedPitchRadians = degreesToRadians(Math.min(this._transform.pitch, maxMercatorHorizonAngle));
        const cameraToSeaLevelDistance = Math.max(this._transform.cameraToCenterDistance / 2, this._transform.cameraToCenterDistance + this._transform.elevation * this._transform.pixelsPerMeter / Math.cos(limitedPitchRadians));

        if (calculateNearFarZ) {
            this._calculateNearFarZ(cameraToSeaLevelDistance, limitedPitchRadians, offset);
        }

        // matrix for conversion from location to clip space(-1 .. 1)
        let m: mat4;
        m = new Float64Array(16);
        mat4.perspective(m, this._transform.fovInRadians, this._transform.width / this._transform.height, this._transform._nearZ, this._transform._farZ);
        this._invProjMatrix = new Float64Array(16);
        fastInvertProjMat4(this._invProjMatrix, m);

        // Apply center of perspective offset
        m[8] = -offset.x * 2 / this._transform.width;
        m[9] = offset.y * 2 / this._transform.height;
        this._projectionMatrix = mat4.clone(m);

        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [0, 0, -this._transform.cameraToCenterDistance]);
        mat4.rotateZ(m, m, -this._transform.rollInRadians);
        mat4.rotateX(m, m, this._transform.pitchInRadians);
        mat4.rotateZ(m, m, -this._transform.bearingInRadians);
        mat4.translate(m, m, [-x, -y, 0]);

        // The mercatorMatrix can be used to transform points from mercator coordinates
        // ([0, 0] nw, [1, 1] se) to clip space.
        this._mercatorMatrix = mat4.scale([], m, [this._transform.worldSize, this._transform.worldSize, this._transform.worldSize]);

        // scale vertically to meters per pixel (inverse of ground resolution):
        mat4.scale(m, m, [1, 1, this._transform.pixelsPerMeter]);

        // matrix for conversion from world space to screen coordinates in 2D
        this._pixelMatrix = mat4.multiply(new Float64Array(16), this._transform.clipSpaceToPixelsMatrix, m);

        // matrix for conversion from world space to clip space (-1 .. 1)
        mat4.translate(m, m, [0, 0, -this._transform.elevation]); // elevate camera over terrain
        this._viewProjMatrix = m;
        this._invViewProjMatrix = mat4.invert([], m);

        const cameraPos: vec4 = [0, 0, -1, 1];
        vec4.transformMat4(cameraPos, cameraPos, this._invViewProjMatrix);
        this._cameraPosition = [
            cameraPos[0] / cameraPos[3],
            cameraPos[1] / cameraPos[3],
            cameraPos[2] / cameraPos[3]
        ];

        // create a fog matrix, same es proj-matrix but with near clipping-plane in mapcenter
        // needed to calculate a correct z-value for fog calculation, because projMatrix z value is not
        this._fogMatrix = new Float64Array(16);
        mat4.perspective(this._fogMatrix, this._transform.fovInRadians, this._transform.width / this._transform.height, cameraToSeaLevelDistance, this._transform._farZ);
        this._fogMatrix[8] = -offset.x * 2 / this._transform.width;
        this._fogMatrix[9] = offset.y * 2 / this._transform.height;
        mat4.scale(this._fogMatrix, this._fogMatrix, [1, -1, 1]);
        mat4.translate(this._fogMatrix, this._fogMatrix, [0, 0, -this._transform.cameraToCenterDistance]);
        mat4.rotateZ(this._fogMatrix, this._fogMatrix, -this._transform.rollInRadians);
        mat4.rotateX(this._fogMatrix, this._fogMatrix, this._transform.pitchInRadians);
        mat4.rotateZ(this._fogMatrix, this._fogMatrix, -this._transform.bearingInRadians);
        mat4.translate(this._fogMatrix, this._fogMatrix, [-x, -y, 0]);
        mat4.scale(this._fogMatrix, this._fogMatrix, [1, 1, this._transform.pixelsPerMeter]);
        mat4.translate(this._fogMatrix, this._fogMatrix, [0, 0, -this._transform.elevation]); // elevate camera over terrain

        // matrix for conversion from world space to screen coordinates in 3D
        this._pixelMatrix3D = mat4.multiply(new Float64Array(16), this._transform.clipSpaceToPixelsMatrix, m);

        // Make a second projection matrix that is aligned to a pixel grid for rendering raster tiles.
        // We're rounding the (floating point) x/y values to achieve to avoid rendering raster images to fractional
        // coordinates. Additionally, we adjust by half a pixel in either direction in case that viewport dimension
        // is an odd integer to preserve rendering to the pixel grid. We're rotating this shift based on the angle
        // of the transformation so that 0°, 90°, 180°, and 270° rasters are crisp, and adjust the shift so that
        // it is always <= 0.5 pixels.
        const xShift = (this._transform.width % 2) / 2, yShift = (this._transform.height % 2) / 2,
            angleCos = Math.cos(this._transform.bearingInRadians), angleSin = Math.sin(-this._transform.bearingInRadians),
            dx = x - Math.round(x) + angleCos * xShift + angleSin * yShift,
            dy = y - Math.round(y) + angleCos * yShift + angleSin * xShift;
        const alignedM = new Float64Array(m) as any as mat4;
        mat4.translate(alignedM, alignedM, [dx > 0.5 ? dx - 1 : dx, dy > 0.5 ? dy - 1 : dy, 0]);
        this._alignedProjMatrix = alignedM;

        // inverse matrix for conversion from screen coordinates to location
        m = mat4.invert(new Float64Array(16), this._pixelMatrix);
        if (!m) throw new Error('failed to invert matrix');
        this._pixelMatrixInverse = m;

        this._clearMatrixCaches();
    }

    private _clearMatrixCaches(): void {
        this._posMatrixCache.clear();
        this._alignedPosMatrixCache.clear();
        this._fogMatrixCacheF32.clear();
    }

    maxPitchScaleFactor(): number {
        // calcMatrices hasn't run yet
        if (!this._pixelMatrixInverse) return 1;

        const coord = this.screenPointToMercatorCoordinate(new Point(0, 0));
        const p = [coord.x * this._transform.worldSize, coord.y * this._transform.worldSize, 0, 1] as vec4;
        const topPoint = vec4.transformMat4(p, p, this._pixelMatrix);
        return topPoint[3] / this._transform.cameraToCenterDistance;
    }

    getCameraAltitude(): number {
        return Math.cos(this._transform.pitchInRadians) * this._transform.cameraToCenterDistance / this._transform.pixelsPerMeter + this._transform.elevation;
    }

    getCameraLngLat(): LngLat {
        const pixelPerMeter = mercatorZfromAltitude(1, this._transform.center.lat) * this._transform.worldSize;
        const cameraToCenterDistanceMeters = this._transform.cameraToCenterDistance / pixelPerMeter;
        const camMercator = cameraMercatorCoordinateFromCenterAndRotation(this._transform.center, this._transform.elevation, this._transform.pitch, this._transform.bearing, cameraToCenterDistanceMeters);
        return camMercator.toLngLat();
    }

    getProjectionData(params: ProjectionDataParams): RendererProjectionData {
        const {overscaledTileID, aligned, applyTerrainMatrix} = params;
        const mercatorTileCoordinates = this._transform.getMercatorTileCoordinates(overscaledTileID);
        const tilePosMatrix = overscaledTileID ? this.calculatePosMatrix(overscaledTileID, aligned, true) : null;

        let mainMatrix: Mat4f32;
        if (overscaledTileID?.terrainRttPosMatrix32f && applyTerrainMatrix) {
            mainMatrix = overscaledTileID.terrainRttPosMatrix32f;
        } else if (tilePosMatrix) {
            mainMatrix = tilePosMatrix; // This matrix should be float32
        } else {
            mainMatrix = createIdentityMat4f32();
        }
        return {
            mainMatrix, // Might be set to a custom matrix by different projections.
            tileMercatorCoords: mercatorTileCoordinates,
            clippingPlane: [0, 0, 0, 0],
            projectionTransition: 0.0, // Range 0..1, where 0 is mercator, 1 is another projection, mostly globe.
            fallbackMatrix: mainMatrix,
            clipAntimeridian: false,
        };
    }

    /** {@inheritDoc ITransform.isLocationOccluded} */
    isLocationOccluded(lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        if (!terrain?.getCoverageIndex()) return false;

        const location = MercatorCoordinate.fromLngLat(lngLat);
        elevation ??= terrain.getElevationForLngLat(lngLat, this._transform);
        const clip = this._coordinateClipPoint(location, elevation, this._pixelMatrix3D);
        const w = clip[3];
        if (w <= 0 || clip[2] > w) return true;
        const p = new Point(clip[0] / w, clip[1] / w);

        const hit = this.screenTerrainPointToMercatorCoordinate(p, terrain);
        if (hit == null) return false;
        const segment = this.getRaySegmentFromPixel(p, NEAR_PLANE_CLIP_Z);
        const tLocation = raySegmentParameter(segment, location.x * this._transform.worldSize, location.y * this._transform.worldSize, elevation);
        return raySegmentParameter(segment, hit.x * this._transform.worldSize, hit.y * this._transform.worldSize, hit.z) < tLocation * (1 - TERRAIN_OCCLUSION_MARGIN);
    }

    getPixelScale(): number {
        return 1.0;
    }

    getCircleRadiusCorrection(): number {
        return 1.0;
    }

    getPitchedTextCorrection(_textAnchorX: number, _textAnchorY: number, _tileID: UnwrappedTileID): number {
        return 1.0;
    }

    transformLightDirection(dir: vec3): vec3 {
        return vec3.clone(dir);
    }

    getRayDirectionFromPixel(_p: Point): vec3 {
        throw new Error('Not implemented.'); // No need for this in mercator transform
    }

    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        const matrix = this.calculatePosMatrix(unwrappedTileID);
        let pos;
        if (elevation != null) { // slow because of handle z-index
            pos = [x, y, elevation, 1] as vec4;
            vec4.transformMat4(pos, pos, matrix);
        } else { // fast because of ignore z-index
            pos = [x, y, 0, 1] as vec4;
            xyTransformMat4(pos, pos, matrix);
        }
        const w = pos[3];
        return {
            point: new Point(pos[0] / w, pos[1] / w),
            signedDistanceFromCamera: w,
            isOccluded: false
        };
    }

    populateCache(coords: OverscaledTileID[]): void {
        for (const coord of coords) {
            // Return value is thrown away, but this function will still
            // place the pos matrix into the transform's internal cache.
            this.calculatePosMatrix(coord);
        }
    }

    getProjectionDataForCustomLayer(applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const rendererProjectionData = this.getProjectionData({overscaledTileID: tileID, applyGlobeMatrix});
        const tileMatrix = calculateTileMatrix(tileID, this._transform.worldSize);
        mat4.multiply(tileMatrix, this._viewProjMatrix, tileMatrix);

        // Even though we requested projection data for the mercator base tile which covers the entire mercator range,
        // the shader projection machinery still expects inputs to be in tile units range [0..EXTENT].
        // Since custom layers are expected to supply mercator coordinates [0..1], we need to rescale
        // both matrices by EXTENT. We also need to rescale Z.

        const scale: vec3 = [EXTENT, EXTENT, this._transform.worldSize / this._transform.pixelsPerMeter];

        // We pass full-precision 64bit float matrices to custom layers to prevent precision loss in case the user wants to do further transformations.
        // Otherwise we get very visible precision-artifacts and twitching for objects that are bulding-scale.
        const projectionMatrixScaled = createMat4f64();
        mat4.scale(projectionMatrixScaled, tileMatrix, scale);

        return {
            ...rendererProjectionData,
            tileMercatorCoords: [0, 0, 1, 1],
            fallbackMatrix: projectionMatrixScaled,
            mainMatrix: projectionMatrixScaled,
        };
    }

    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        return this.calculatePosMatrix(tileID);
    }
}

/**
 * Creates a transform for the mercator projection.
 */
export function createMercatorTransform(options?: TransformOptions): Transform {
    return new Transform((transform) => new MercatorTransform(transform), options);
}

function mercatorSampleAt(ray: MercatorRay, t: number): TerrainSample {
    return sampleAt(ray.index, ray.exaggeration, (ray.near[0] + t * ray.dx) / ray.worldSize, (ray.near[1] + t * ray.dy) / ray.worldSize);
}

function mercatorIsBelowTerrain(ray: MercatorRay, t: number): boolean {
    return isBelowTerrainSample(mercatorSampleAt(ray, t), ray.near[2] + t * ray.dz);
}

/**
 * Where the point of `segment` closest to the given world pixel position and elevation lies along it,
 * as the fraction from `near` (0) to `far` (1).
 */
function raySegmentParameter({near, far}: RaySegment, worldX: number, worldY: number, elevation: number): number {
    const dx = far[0] - near[0];
    const dy = far[1] - near[1];
    const dz = far[2] - near[2];
    return ((worldX - near[0]) * dx + (worldY - near[1]) * dy + (elevation - near[2]) * dz) / (dx * dx + dy * dy + dz * dz);
}
