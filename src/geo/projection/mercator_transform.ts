import {LngLat, LngLatLike} from '../lng_lat';
import {MercatorCoordinate, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, createIdentityMat4f64, createMat4f64} from '../../util/util';
import {mat2, mat4, vec3, vec4} from 'gl-matrix';
import {UnwrappedTileID, OverscaledTileID, CanonicalTileID, calculateTileKey} from '../../source/tile_id';
import {Terrain} from '../../render/terrain';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {PointProjection, xyTransformMat4} from '../../symbol/projection';
import {LngLatBounds} from '../lng_lat_bounds';
import {CoveringTilesOptions, CoveringZoomOptions, IReadonlyTransform, ITransform, TransformUpdateResult} from '../transform_interface';
import {PaddingOptions} from '../edge_insets';
import {mercatorCoordinateToLocation, getBasicProjectionData, getMercatorHorizon, locationToMercatorCoordinate, projectToWorldCoordinates, unprojectFromWorldCoordinates, calculateTileMatrix} from './mercator_utils';
import {EXTENT} from '../../data/extent';
import type {ProjectionData} from './projection_data';
import {scaleZoom, TransformHelper, zoomScale} from '../transform_helper';
import {mercatorCoveringTiles} from './mercator_covering_tiles';

export class MercatorTransform implements ITransform {
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
    // Implementation of mercator transform
    //

    private _cameraToCenterDistance: number;
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

    private _posMatrixCache: {[_: string]: mat4};
    private _fogMatrixCache: {[_: string]: mat4};
    private _alignedPosMatrixCache: {[_: string]: mat4};

    private _nearZ;
    private _farZ;

    constructor(minZoom?: number, maxZoom?: number, minPitch?: number, maxPitch?: number, renderWorldCopies?: boolean) {
        this._helper = new TransformHelper({
            calcMatrices: () => { this._calcMatrices(); },
            getConstrained: (center, zoom) => { return this.getConstrained(center, zoom); }
        }, minZoom, maxZoom, minPitch, maxPitch, renderWorldCopies);
        this._clearMatrixCaches();
    }

    public clone(): ITransform {
        const clone = new MercatorTransform();
        clone.apply(this);
        return clone;
    }

    public apply(that: IReadonlyTransform, constrain?: boolean): void {
        this._helper.apply(that, constrain);
    }

    public get cameraToCenterDistance(): number { return this._cameraToCenterDistance; }
    public get cameraPosition(): vec3 { return this._cameraPosition; }
    public get projectionMatrix(): mat4 { return this._projectionMatrix; }
    public get modelViewProjectionMatrix(): mat4 { return this._viewProjMatrix; }
    public get inverseProjectionMatrix(): mat4 { return this._invProjMatrix; }
    public get nearZ(): number { return this._nearZ; }
    public get farZ(): number { return this._farZ; }

    public get mercatorMatrix(): mat4 { return this._mercatorMatrix; } // Not part of ITransform interface

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): Array<UnwrappedTileID> {
        const result = [new UnwrappedTileID(0, tileID)];
        if (this._helper._renderWorldCopies) {
            const utl = this.screenPointToMercatorCoordinate(new Point(0, 0));
            const utr = this.screenPointToMercatorCoordinate(new Point(this._helper._width, 0));
            const ubl = this.screenPointToMercatorCoordinate(new Point(this._helper._width, this._helper._height));
            const ubr = this.screenPointToMercatorCoordinate(new Point(0, this._helper._height));
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

    coveringTiles(options: CoveringTilesOptions): Array<OverscaledTileID> {
        return mercatorCoveringTiles(this, options, this._invViewProjMatrix);
    }

    recalculateZoom(terrain: Terrain): void {
        const origElevation = this.elevation;
        const origAltitude = Math.cos(this._helper._pitch) * this._cameraToCenterDistance / this._helper._pixelPerMeter;

        // find position the camera is looking on
        const center = this.screenPointToLocation(this.centerPoint, terrain);
        const elevation = terrain.getElevationForLngLatZoom(center, this._helper._tileZoom);
        const deltaElevation = this.elevation - elevation;
        if (!deltaElevation) return;

        // The camera's altitude off the ground + the ground's elevation = a constant:
        // this means the camera stays at the same total height.
        const requiredAltitude = origAltitude + origElevation - elevation;
        // Since altitude = Math.cos(this._pitch) * this.cameraToCenterDistance / pixelPerMeter:
        const requiredPixelPerMeter = Math.cos(this._helper._pitch) * this._cameraToCenterDistance / requiredAltitude;
        // Since pixelPerMeter = mercatorZfromAltitude(1, center.lat) * worldSize:
        const requiredWorldSize = requiredPixelPerMeter / mercatorZfromAltitude(1, center.lat);
        // Since worldSize = this.tileSize * scale:
        const requiredScale = requiredWorldSize / this.tileSize;
        const zoom = scaleZoom(requiredScale);

        // update matrices
        this._helper._elevation = elevation;
        this._helper._center = center;
        this.setZoom(zoom);
    }

    setLocationAtPoint(lnglat: LngLat, point: Point) {
        const a = this.screenPointToMercatorCoordinate(point);
        const b = this.screenPointToMercatorCoordinate(this.centerPoint);
        const loc = locationToMercatorCoordinate(lnglat);
        const newCenter = new MercatorCoordinate(
            loc.x - (a.x - b.x),
            loc.y - (a.y - b.y));
        this.setCenter(mercatorCoordinateToLocation(newCenter));
        if (this._helper._renderWorldCopies) {
            this.setCenter(this.center.wrap());
        }
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        return terrain ?
            this.coordinatePoint(locationToMercatorCoordinate(lnglat), terrain.getElevationForLngLatZoom(lnglat, this._helper._tileZoom), this._pixelMatrix3D) :
            this.coordinatePoint(locationToMercatorCoordinate(lnglat));
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return mercatorCoordinateToLocation(this.screenPointToMercatorCoordinate(p, terrain));
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        // get point-coordinate from terrain coordinates framebuffer
        if (terrain) {
            const coordinate = terrain.pointCoordinate(p);
            if (coordinate != null) {
                return coordinate;
            }
        }

        // calculate point-coordinate on flat earth
        const targetZ = 0;
        // since we don't know the correct projected z value for the point,
        // unproject two points to get a line and then find the point on that
        // line with z=0

        const coord0 = [p.x, p.y, 0, 1] as vec4;
        const coord1 = [p.x, p.y, 1, 1] as vec4;

        vec4.transformMat4(coord0, coord0, this._pixelMatrixInverse);
        vec4.transformMat4(coord1, coord1, this._pixelMatrixInverse);

        const w0 = coord0[3];
        const w1 = coord1[3];
        const x0 = coord0[0] / w0;
        const x1 = coord1[0] / w1;
        const y0 = coord0[1] / w0;
        const y1 = coord1[1] / w1;
        const z0 = coord0[2] / w0;
        const z1 = coord1[2] / w1;

        const t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);

        return new MercatorCoordinate(
            interpolates.number(x0, x1, t) / this.worldSize,
            interpolates.number(y0, y1, t) / this.worldSize);
    }

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param coord - the coordinates
     * @param elevation - the elevation
     * @param pixelMatrix - the pixel matrix
     * @returns screen point
     */
    coordinatePoint(coord: MercatorCoordinate, elevation: number = 0, pixelMatrix: mat4 = this._pixelMatrix): Point {
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, elevation, 1] as vec4;
        vec4.transformMat4(p, p, pixelMatrix);
        return new Point(p[0] / p[3], p[1] / p[3]);
    }

    getBounds(): LngLatBounds {
        const top = Math.max(0, this._helper._height / 2 - getMercatorHorizon(this));
        return new LngLatBounds()
            .extend(this.screenPointToLocation(new Point(0, top)))
            .extend(this.screenPointToLocation(new Point(this._helper._width, top)))
            .extend(this.screenPointToLocation(new Point(this._helper._width, this._helper._height)))
            .extend(this.screenPointToLocation(new Point(0, this._helper._height)));
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        if (terrain) {
            const coordinate = terrain.pointCoordinate(p);
            return coordinate != null;
        }
        return (p.y > this.height / 2 - getMercatorHorizon(this));
    }

    /**
     * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
     * This function is specific to the mercator projection.
     * @param tileID - the tile ID
     * @param aligned - whether to use a pixel-aligned matrix variant, intended for rendering raster tiles
     */
    calculatePosMatrix(tileID: UnwrappedTileID | OverscaledTileID, aligned: boolean = false): mat4 {
        const posMatrixKey = tileID.key ?? calculateTileKey(tileID.wrap, tileID.canonical.z, tileID.canonical.z, tileID.canonical.x, tileID.canonical.y);
        const cache = aligned ? this._alignedPosMatrixCache : this._posMatrixCache;
        if (cache[posMatrixKey]) {
            return cache[posMatrixKey];
        }

        const tileMatrix = calculateTileMatrix(tileID, this.worldSize);
        mat4.multiply(tileMatrix, aligned ? this._alignedProjMatrix : this._viewProjMatrix, tileMatrix);

        cache[posMatrixKey] = tileMatrix;
        return cache[posMatrixKey];
    }

    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4 {
        const posMatrixKey = unwrappedTileID.key;
        const cache = this._fogMatrixCache;
        if (cache[posMatrixKey]) {
            return cache[posMatrixKey];
        }

        const fogMatrix = calculateTileMatrix(unwrappedTileID, this.worldSize);
        mat4.multiply(fogMatrix, this._fogMatrix, fogMatrix);

        cache[posMatrixKey] = fogMatrix;
        return cache[posMatrixKey];
    }

    /**
     * This mercator implementation returns center lngLat and zoom to ensure that:
     *
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     *
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    getConstrained(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
        zoom = clamp(+zoom, this.minZoom, this.maxZoom);
        const result = {
            center: new LngLat(lngLat.lng, lngLat.lat),
            zoom
        };

        let lngRange = this._helper._lngRange;

        if (!this._helper._renderWorldCopies && lngRange === null) {
            const almost180 = 180 - 1e-10;
            lngRange = [-almost180, almost180];
        }

        const worldSize = this.tileSize * zoomScale(result.zoom); // A world size for the requested zoom level, not the current world size
        let minY = 0;
        let maxY = worldSize;
        let minX = 0;
        let maxX = worldSize;
        let scaleY = 0;
        let scaleX = 0;
        const {x: screenWidth, y: screenHeight} = this.size;

        if (this._helper._latRange) {
            const latRange = this._helper._latRange;
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

        if (this._helper._latRange) {
            const h2 = screenHeight / 2;
            if (originalY - h2 < minY) modifiedY = minY + h2;
            if (originalY + h2 > maxY) modifiedY = maxY - h2;
        }

        if (lngRange) {
            const centerX = (minX + maxX) / 2;
            let wrappedX = originalX;
            if (this._helper._renderWorldCopies) {
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
    }

    _calcMatrices(): void {
        if (!this._helper._height) return;

        const halfFov = this._helper._fov / 2;
        const offset = this.centerOffset;
        const point = projectToWorldCoordinates(this.worldSize, this.center);
        const x = point.x, y = point.y;
        this._cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this._helper._height;
        this._helper._pixelPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;

        // Calculate the camera to sea-level distance in pixel in respect of terrain
        const cameraToSeaLevelDistance = this._cameraToCenterDistance + this._helper._elevation * this._helper._pixelPerMeter / Math.cos(this._helper._pitch);
        // In case of negative minimum elevation (e.g. the dead see, under the sea maps) use a lower plane for calculation
        const minElevation = Math.min(this.elevation, this.minElevationForCurrentTile);
        const cameraToLowestPointDistance = cameraToSeaLevelDistance - minElevation * this._helper._pixelPerMeter / Math.cos(this._helper._pitch);
        const lowestPlane = minElevation < 0 ? cameraToLowestPointDistance : cameraToSeaLevelDistance;

        // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
        // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        const groundAngle = Math.PI / 2 + this._helper._pitch;
        const fovAboveCenter = this._helper._fov * (0.5 + offset.y / this._helper._height);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));

        // Find the distance from the center point to the horizon
        const horizon = getMercatorHorizon(this);
        const horizonAngle = Math.atan(horizon / this._cameraToCenterDistance);
        const fovCenterToHorizon = 2 * horizonAngle * (0.5 + offset.y / (horizon * 2));
        const topHalfSurfaceDistanceHorizon = Math.sin(fovCenterToHorizon) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovCenterToHorizon, 0.01, Math.PI - 0.01));

        // Calculate z distance of the farthest fragment that should be rendered.
        // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
        const topHalfMinDistance = Math.min(topHalfSurfaceDistance, topHalfSurfaceDistanceHorizon);
        this._farZ = (Math.cos(Math.PI / 2 - this._helper._pitch) * topHalfMinDistance + lowestPlane) * 1.01;

        // The larger the value of nearZ is
        // - the more depth precision is available for features (good)
        // - clipping starts appearing sooner when the camera is close to 3d features (bad)
        //
        // Other values work for mapbox-gl-js but deck.gl was encountering precision issues
        // when rendering custom layers. This value was experimentally chosen and
        // seems to solve z-fighting issues in deck.gl while not clipping buildings too close to the camera.
        this._nearZ = this._helper._height / 50;

        // matrix for conversion from location to clip space(-1 .. 1)
        let m: mat4;
        m = new Float64Array(16) as any;
        mat4.perspective(m, this._helper._fov, this._helper._width / this._helper._height, this._nearZ, this._farZ);
        this._invProjMatrix = new Float64Array(16) as any as mat4;
        mat4.invert(this._invProjMatrix, m);

        // Apply center of perspective offset
        m[8] = -offset.x * 2 / this._helper._width;
        m[9] = offset.y * 2 / this._helper._height;
        this._projectionMatrix = mat4.clone(m);

        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [0, 0, -this._cameraToCenterDistance]);
        mat4.rotateX(m, m, this._helper._pitch);
        mat4.rotateZ(m, m, this._helper._angle);
        mat4.translate(m, m, [-x, -y, 0]);

        // The mercatorMatrix can be used to transform points from mercator coordinates
        // ([0, 0] nw, [1, 1] se) to clip space.
        this._mercatorMatrix = mat4.scale([] as any, m, [this.worldSize, this.worldSize, this.worldSize]);

        // scale vertically to meters per pixel (inverse of ground resolution):
        mat4.scale(m, m, [1, 1, this._helper._pixelPerMeter]);

        // matrix for conversion from world space to screen coordinates in 2D
        this._pixelMatrix = mat4.multiply(new Float64Array(16) as any, this.clipSpaceToPixelsMatrix, m);

        // matrix for conversion from world space to clip space (-1 .. 1)
        mat4.translate(m, m, [0, 0, -this.elevation]); // elevate camera over terrain
        this._viewProjMatrix = m;
        this._invViewProjMatrix = mat4.invert([] as any, m);

        const cameraPos: vec4 = [0, 0, -1, 1];
        vec4.transformMat4(cameraPos, cameraPos, this._invViewProjMatrix);
        this._cameraPosition = [
            cameraPos[0] / cameraPos[3],
            cameraPos[1] / cameraPos[3],
            cameraPos[2] / cameraPos[3]
        ];

        // create a fog matrix, same es proj-matrix but with near clipping-plane in mapcenter
        // needed to calculate a correct z-value for fog calculation, because projMatrix z value is not
        this._fogMatrix = new Float64Array(16) as any;
        mat4.perspective(this._fogMatrix, this._helper._fov, this.width / this.height, cameraToSeaLevelDistance, this._farZ);
        this._fogMatrix[8] = -offset.x * 2 / this.width;
        this._fogMatrix[9] = offset.y * 2 / this.height;
        mat4.scale(this._fogMatrix, this._fogMatrix, [1, -1, 1]);
        mat4.translate(this._fogMatrix, this._fogMatrix, [0, 0, -this.cameraToCenterDistance]);
        mat4.rotateX(this._fogMatrix, this._fogMatrix, this._helper._pitch);
        mat4.rotateZ(this._fogMatrix, this._fogMatrix, this.angle);
        mat4.translate(this._fogMatrix, this._fogMatrix, [-x, -y, 0]);
        mat4.scale(this._fogMatrix, this._fogMatrix, [1, 1, this._helper._pixelPerMeter]);
        mat4.translate(this._fogMatrix, this._fogMatrix, [0, 0, -this.elevation]); // elevate camera over terrain

        // matrix for conversion from world space to screen coordinates in 3D
        this._pixelMatrix3D = mat4.multiply(new Float64Array(16) as any, this.clipSpaceToPixelsMatrix, m);

        // Make a second projection matrix that is aligned to a pixel grid for rendering raster tiles.
        // We're rounding the (floating point) x/y values to achieve to avoid rendering raster images to fractional
        // coordinates. Additionally, we adjust by half a pixel in either direction in case that viewport dimension
        // is an odd integer to preserve rendering to the pixel grid. We're rotating this shift based on the angle
        // of the transformation so that 0°, 90°, 180°, and 270° rasters are crisp, and adjust the shift so that
        // it is always <= 0.5 pixels.
        const xShift = (this._helper._width % 2) / 2, yShift = (this._helper._height % 2) / 2,
            angleCos = Math.cos(this._helper._angle), angleSin = Math.sin(this._helper._angle),
            dx = x - Math.round(x) + angleCos * xShift + angleSin * yShift,
            dy = y - Math.round(y) + angleCos * yShift + angleSin * xShift;
        const alignedM = new Float64Array(m) as any as mat4;
        mat4.translate(alignedM, alignedM, [dx > 0.5 ? dx - 1 : dx, dy > 0.5 ? dy - 1 : dy, 0]);
        this._alignedProjMatrix = alignedM;

        // inverse matrix for conversion from screen coordinates to location
        m = mat4.invert(new Float64Array(16) as any, this._pixelMatrix);
        if (!m) throw new Error('failed to invert matrix');
        this._pixelMatrixInverse = m;

        this._clearMatrixCaches();
    }

    private _clearMatrixCaches(): void {
        this._posMatrixCache = {};
        this._alignedPosMatrixCache = {};
        this._fogMatrixCache = {};
    }

    maxPitchScaleFactor(): number {
        // calcMatrices hasn't run yet
        if (!this._pixelMatrixInverse) return 1;

        const coord = this.screenPointToMercatorCoordinate(new Point(0, 0));
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, 0, 1] as vec4;
        const topPoint = vec4.transformMat4(p, p, this._pixelMatrix);
        return topPoint[3] / this._cameraToCenterDistance;
    }

    getCameraPoint(): Point {
        const pitch = this._helper._pitch;
        const yOffset = Math.tan(pitch) * (this._cameraToCenterDistance || 1);
        return this.centerPoint.add(new Point(0, yOffset));
    }

    getCameraAltitude(): number {
        const altitude = Math.cos(this._helper._pitch) * this._cameraToCenterDistance / this._helper._pixelPerMeter;
        return altitude + this.elevation;
    }

    lngLatToCameraDepth(lngLat: LngLat, elevation: number) {
        const coord = locationToMercatorCoordinate(lngLat);
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, elevation, 1] as vec4;
        vec4.transformMat4(p, p, this._viewProjMatrix);
        return (p[2] / p[3]);
    }

    isRenderingDirty(): boolean {
        return false;
    }

    getProjectionData(overscaledTileID: OverscaledTileID, aligned?: boolean, ignoreTerrainMatrix?: boolean): ProjectionData {
        const matrix = overscaledTileID ? this.calculatePosMatrix(overscaledTileID, aligned) : null;
        return getBasicProjectionData(overscaledTileID, matrix, ignoreTerrainMatrix);
    }

    isLocationOccluded(_: LngLat): boolean {
        return false;
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

    newFrameUpdate(): TransformUpdateResult {
        return {};
    }

    transformLightDirection(dir: vec3): vec3 {
        return vec3.clone(dir);
    }

    getRayDirectionFromPixel(_p: Point): vec3 {
        throw new Error('Not implemented.'); // No need for this in mercator transform
    }

    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number): PointProjection {
        const matrix = this.calculatePosMatrix(unwrappedTileID);
        let pos;
        if (getElevation) { // slow because of handle z-index
            pos = [x, y, getElevation(x, y), 1] as vec4;
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

    precacheTiles(coords: Array<OverscaledTileID>): void {
        for (const coord of coords) {
            // Return value is thrown away, but this function will still
            // place the pos matrix into the transform's internal cache.
            this.calculatePosMatrix(coord);
        }
    }

    getMatrixForModel(location: LngLatLike, altitude?: number): mat4 {
        const modelAsMercatorCoordinate = MercatorCoordinate.fromLngLat(
            location,
            altitude
        );
        const scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();

        const m = createIdentityMat4f64();
        mat4.translate(m, m, [modelAsMercatorCoordinate.x, modelAsMercatorCoordinate.y, modelAsMercatorCoordinate.z]);
        mat4.rotateZ(m, m, Math.PI);
        mat4.rotateX(m, m, Math.PI / 2);
        mat4.scale(m, m, [-scale, scale, scale]);
        return m;
    }

    getProjectionDataForCustomLayer(): ProjectionData {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const projectionData = this.getProjectionData(tileID, false, true);

        const tileMatrix = calculateTileMatrix(tileID, this.worldSize);
        mat4.multiply(tileMatrix, this._viewProjMatrix, tileMatrix);

        projectionData.tileMercatorCoords = [0, 0, 1, 1];

        // Even though we requested projection data for the mercator base tile which covers the entire mercator range,
        // the shader projection machinery still expects inputs to be in tile units range [0..EXTENT].
        // Since custom layers are expected to supply mercator coordinates [0..1], we need to rescale
        // both matrices by EXTENT. We also need to rescale Z.

        const scale: vec3 = [EXTENT, EXTENT, this.worldSize / this._helper.pixelsPerMeter];
        const translate: vec3 = [0, 0, this.elevation];

        const fallbackMatrixScaled = createMat4f64();
        mat4.translate(fallbackMatrixScaled, tileMatrix, translate);
        mat4.scale(fallbackMatrixScaled, fallbackMatrixScaled, scale);

        const projectionMatrixScaled = createMat4f64();
        mat4.translate(projectionMatrixScaled, tileMatrix, translate);
        mat4.scale(projectionMatrixScaled, projectionMatrixScaled, scale);

        projectionData.fallbackMatrix = fallbackMatrixScaled;
        projectionData.mainMatrix = projectionMatrixScaled;
        return projectionData;
    }

    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        return this.calculatePosMatrix(tileID);
    }
}
