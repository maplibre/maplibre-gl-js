import {OverscaledTileID} from '../../tile/tile_id.ts';
import {vec2, vec3, type vec4} from 'gl-matrix';
import {Frustum} from '../../util/primitives/frustum.ts';
import {Aabb} from '../../util/primitives/aabb.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {clamp, degreesToRadians, scaleZoom} from '../../util/util.ts';

import type {IReadonlyTransform} from '../transform_interface.ts';
import type {Terrain} from '../../render/terrain.ts';
import {cameraMercatorCoordinate, maxMercatorHorizonAngle} from './mercator_utils.ts';
import {earthRadius} from '../lng_lat.ts';
import {type IBoundingVolume, IntersectionResult} from '../../util/primitives/bounding_volume.ts';

type CoveringTilesResult = {
    tileID: OverscaledTileID;
    distanceSq: number;
    tileDistanceToCamera: number;
};

type CoveringTilesStackEntry = {
    zoom: number;
    x: number;
    y: number;
    wrap: number;
    fullyVisible: boolean;
};

export type CoveringTilesOptions = {
    /**
     * Smallest allowed tile zoom.
     */
    minzoom?: number;
    /**
     * Largest allowed tile zoom.
     */
    maxzoom?: number;
    /**
     * Whether to round or floor the target zoom level. If true, the value will be rounded to the closest integer. Otherwise the value will be floored.
     */
    roundZoom?: boolean;
    /**
     * Tile size, expressed in screen pixels.
     */
    tileSize: number;
};

export type CoveringTilesOptionsInternal = CoveringTilesOptions & {
    /**
     * `true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.
     * Fill this option when computing covering tiles for a source.
     * When true, any tile at `maxzoom` level that should be overscaled to a greater zoom will have
     * its zoom set to the overscaled greater zoom. When false, such tiles will have zoom set to `maxzoom`.
     */
    reparseOverscaled?: boolean;
    /**
     * When terrain is present, tile visibility will be computed in regards to the min and max elevations for each tile.
     */
    terrain?: Terrain;
    /**
     * Optional function to redefine how tiles are loaded at high pitch angles.
     */
    calculateTileZoom?: CalculateTileZoomFunction;
    /**
     * The highest elevation, in meters, that this source's content may reach above the ground,
     * e.g. the largest `symbol-height-offset` in use. Raises the culling allowance near the
     * horizon above the assumed feature height, so tiles under highly elevated content are not
     * dropped while that content is still visible.
     */
    maxContentElevation?: number;
};

/**
 * Function to define how tiles are loaded at high pitch angles
 * @param requestedCenterZoom - the requested zoom level, valid at the center point.
 * @param distanceToTile2D - 2D distance from the camera to the candidate tile, in mercator units.
 * @param distanceToTileZ - vertical distance from the camera to the candidate tile, in mercator units.
 * @param distanceToCenter3D - distance from camera to center point, in mercator units
 * @param cameraVerticalFOV - camera vertical field of view, in degrees
 * @return the desired zoom level for this tile. May not be an integer.
 */
export type CalculateTileZoomFunction = (requestedCenterZoom: number,
    distanceToTile2D: number,
    distanceToTileZ: number,
    distanceToCenter3D: number,
    cameraVerticalFOV: number) => number;

/**
 * A simple/heuristic function that returns whether the tile is visible under the current transform.
 * @returns an {@link IntersectionResult}.
 */
export function isTileVisible(frustum: Frustum, tileBoundingVolume: IBoundingVolume, plane?: vec4): IntersectionResult {
    const frustumTest = tileBoundingVolume.intersectsFrustum(frustum);
    if (!plane || frustumTest === IntersectionResult.None) {
        return frustumTest;
    }
    const planeTest = tileBoundingVolume.intersectsPlane(plane);

    if (planeTest === IntersectionResult.None) {
        return IntersectionResult.None;
    }

    if (frustumTest === IntersectionResult.Full && planeTest === IntersectionResult.Full) {
        return IntersectionResult.Full;
    }

    return IntersectionResult.Partial;
}

/**
 * Definite integral of cos(x)^p. The analytical solution is described in `developer-guides/covering-tiles.md`,
 * but here the integral is evaluated numerically.
 * @param p - the power to raise cos(x) to inside the integral
 * @param x1 - the starting point of the integral.
 * @param x2 - the ending point of the integral.
 * @return the integral of cos(x)^p from x=x1 to x=x2
 */
function integralOfCosXByP(p: number, x1: number, x2: number): number {
    const numPoints = 10;
    let sum = 0;
    const dx = (x2 - x1 ) / numPoints;
    // Midpoint integration
    for( let i = 0; i < numPoints; i++)
    {
        const x = x1 + (i + 0.5)/numPoints * (x2 - x1);
        sum += dx * Math.pow(Math.cos(x), p);
    }
    return sum;
}

export function createCalculateTileZoomFunction(maxZoomLevelsOnScreen: number, tileCountMaxMinRatio: number): CalculateTileZoomFunction {
    return function (requestedCenterZoom: number,
        distanceToTile2D: number,
        distanceToTileZ: number,
        distanceToCenter3D: number,
        cameraVerticalFOV: number): number {
        /**
        * Controls how tiles are loaded at high pitch angles. Higher numbers cause fewer, lower resolution
        * tiles to be loaded. Calculate the value that will result in the selected number of zoom levels in
        * the worst-case condition (when the horizon is at the top of the screen). For more information, see
        * `developer-guides/covering-tiles.md`
        */
        const pitchTileLoadingBehavior = 2 * ((maxZoomLevelsOnScreen - 1) /
            scaleZoom(Math.cos(degreesToRadians(maxMercatorHorizonAngle - cameraVerticalFOV)) /
                Math.cos(degreesToRadians(maxMercatorHorizonAngle))) - 1);

        const centerPitch = Math.acos(distanceToTileZ / distanceToCenter3D);
        const tileCountPitch0 = 2 * integralOfCosXByP(pitchTileLoadingBehavior - 1, 0, degreesToRadians(cameraVerticalFOV / 2));
        const highestPitch = Math.min(degreesToRadians(maxMercatorHorizonAngle), centerPitch + degreesToRadians(cameraVerticalFOV / 2));
        const lowestPitch = Math.min(highestPitch, centerPitch - degreesToRadians(cameraVerticalFOV / 2));
        const tileCount = integralOfCosXByP(pitchTileLoadingBehavior - 1, lowestPitch, highestPitch);
        const thisTilePitch = Math.atan(distanceToTile2D / distanceToTileZ);
        const distanceToTile3D = Math.hypot(distanceToTile2D, distanceToTileZ);

        let thisTileDesiredZ = requestedCenterZoom;
        // if distance to candidate tile is a tiny bit farther than distance to center,
        // use the same zoom as the center. This is achieved by the scaling distance ratio by cos(fov/2)
        thisTileDesiredZ = thisTileDesiredZ + scaleZoom(distanceToCenter3D / distanceToTile3D / Math.max(0.5, Math.cos(degreesToRadians(cameraVerticalFOV / 2))));
        thisTileDesiredZ += pitchTileLoadingBehavior * scaleZoom(Math.cos(thisTilePitch)) / 2;
        thisTileDesiredZ -= scaleZoom(Math.max(1, tileCount / tileCountPitch0 / tileCountMaxMinRatio)) / 2;
        return thisTileDesiredZ;
    };
}
const defaultMaxZoomLevelsOnScreen = 9.314;
const defaultTileCountMaxMinRatio = 3.0;
const defaultCalculateTileZoom = createCalculateTileZoomFunction(defaultMaxZoomLevelsOnScreen, defaultTileCountMaxMinRatio);

/**
 * Return what zoom level of a tile source would most closely cover the tiles displayed by this transform.
 * @param options - The options, most importantly the source's tile size.
 * @returns An integer zoom level at which all tiles will be visible.
 */
export function coveringZoomLevel(transform: IReadonlyTransform, options: CoveringTilesOptions): number {
    const z = (options.roundZoom ? Math.round : Math.floor)(
        transform.zoom + scaleZoom(transform.tileSize / options.tileSize)
    );
    // At negative zoom levels load tiles from z0 because negative tile zoom levels don't exist.
    return Math.max(0, z);
}

/**
 * Without terrain, `getTileBoundingVolume` has no knowledge of extruded features
 * (eg. 3D buildings): every tile's bounding box is flat at the camera's `elevation`.
 * That's a fine approximation of what's visible for most views, but it breaks down
 * as the frustum's bottom edge approaches horizontal (which depends on both `pitch`
 * and `fov`, not pitch alone) - a tall building can still be poking up into view
 * long after its tile's ground point has dropped out of the frustum.
 *
 * This is an assumed upper bound on real-world feature height (in metres), used to
 * grow the elevation used for tile culling as that bottom edge nears horizontal, so
 * such tiles are not dropped too early. It has no effect away from that edge case.
 */
const ASSUMED_MAX_FEATURE_HEIGHT_METERS = 500;

/**
 * Angle between the frustum's bottom edge and the mercator horizon below which
 * the culling elevation starts to grow.
 */
const TILE_CULLING_HORIZON_ONSET_DEGREES = 15;

/**
 * Returns the elevation to use when computing tile bounding volumes for culling:
 * `transform.elevation`, growing by up to `ASSUMED_MAX_FEATURE_HEIGHT_METERS` as
 * the frustum's bottom edge approaches the horizon, where a ground-level bounding
 * box would cull tiles whose extruded features are still visible.
 */
function getElevationForTileCulling(transform: IReadonlyTransform, maxContentElevation?: number): number {
    const bottomEdgeDegreesAboveHorizontal = maxMercatorHorizonAngle - transform.pitch - transform.fov / 2;
    const proximityToHorizon = clamp(
        (TILE_CULLING_HORIZON_ONSET_DEGREES - bottomEdgeDegreesAboveHorizontal) / TILE_CULLING_HORIZON_ONSET_DEGREES,
        0, 1);
    const maxFeatureHeight = Math.max(ASSUMED_MAX_FEATURE_HEIGHT_METERS, maxContentElevation ?? 0);
    return transform.elevation + proximityToHorizon * maxFeatureHeight;
}

/**
 * Returns a copy of the frustum with its far plane, and the far corner points, moved away from
 * the camera by `distance`. The globe frustum's far plane is fitted to the surface horizon, so
 * elevated content beyond it would be culled while still visible.
 */
function pushFrustumFarPlane(frustum: Frustum, distance: number): Frustum {
    const far = frustum.planes[1];
    const offset = vec3.scale(createVec3(), [far[0], far[1], far[2]], -distance);
    const points = frustum.points.map((p) => {
        const distanceToFar = far[0] * p[0] + far[1] * p[1] + far[2] * p[2] + far[3];
        if (Math.abs(distanceToFar) > 1e-6) {
            return p;
        }
        return [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2], p[3]] as vec4;
    });
    const planes = frustum.planes.map((p, i) => i === 1 ? [p[0], p[1], p[2], p[3] + distance] as vec4 : p);
    const min: vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const max: vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const p of points) {
        for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], p[i]);
            max[i] = Math.max(max[i], p[i]);
        }
    }
    return new Frustum(points, planes, new Aabb(min, max));
}

function createVec3(): vec3 {
    return [0, 0, 0];
}

/**
 * Returns a list of tiles that optimally covers the screen. Adapted for globe projection.
 * Correctly handles LOD when moving over the antimeridian.
 * @param transform - The transform instance.
 * @param frustum - The covering frustum.
 * @param plane - The clipping plane used by globe transform, or null.
 * @param cameraCoord - The x, y, z position of the camera in MercatorCoordinates.
 * @param centerCoord - The x, y, z position of the center point in MercatorCoordinates.
 * @param options - Additional coveringTiles options.
 * @param details - Interface to define required helper functions.
 * @returns A list of tile coordinates, ordered by ascending distance from camera.
 */
export function coveringTiles(transform: IReadonlyTransform, options: CoveringTilesOptionsInternal): OverscaledTileID[] {
    let frustum = transform.getCameraFrustum();
    let plane = transform.getClippingPlane();
    if (plane && options.maxContentElevation > 0) {
        // Both the horizon culling plane and the frustum's far plane assume content sits on the
        // surface. A point elevated to radius r (in planet radii) stays visible up to acos(1/r)
        // beyond the surface horizon and up to sqrt(r^2-1) farther away, so both are pushed back
        // accordingly. Without this, tiles under highly elevated symbols are dropped while the
        // symbols are still in view.
        const len = Math.hypot(plane[0], plane[1], plane[2]);
        if (len > 0) {
            const shellRadius = 1.0 + options.maxContentElevation / earthRadius;
            const horizonCos = clamp(-plane[3] / len, -1, 1);
            const shellCos = Math.cos(Math.acos(horizonCos) + Math.acos(1.0 / shellRadius));
            plane = [plane[0], plane[1], plane[2], -shellCos * len] as vec4;
            frustum = pushFrustumFarPlane(frustum, Math.sqrt(shellRadius * shellRadius - 1.0));
        }
    }
    const cameraCoord = cameraMercatorCoordinate(transform);
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center, transform.elevation);
    const elevationForTileCulling = getElevationForTileCulling(transform, options.maxContentElevation);
    const detailsProvider = transform.getCoveringTilesDetailsProvider();
    const allowVariableZoom = detailsProvider.allowVariableZoom(transform, options);
    
    const desiredZ = coveringZoomLevel(transform, options);
    const minZoom = options.minzoom || 0;
    const maxZoom = options.maxzoom !== undefined ? options.maxzoom : transform.maxZoom;
    const nominalZ = Math.min(Math.max(0, desiredZ), maxZoom);

    const numTiles = Math.pow(2, nominalZ);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
    const distanceToCenter2d = Math.hypot(centerCoord.x - cameraCoord.x, centerCoord.y - cameraCoord.y);
    const distanceZ = Math.abs(centerCoord.z - cameraCoord.z);
    const distanceToCenter3d = Math.hypot(distanceToCenter2d, distanceZ);

    const newRootTile = (wrap: number): CoveringTilesStackEntry => {
        return {
            zoom: 0,
            x: 0,
            y: 0,
            wrap,
            fullyVisible: false
        };
    };

    // Do a depth-first traversal to find visible tiles and proper levels of detail
    const stack: CoveringTilesStackEntry[] = [];
    const result: CoveringTilesResult[] = [];

    if (transform.renderWorldCopies && detailsProvider.allowWorldCopies()) {
        // Render copy of the globe thrice on both sides
        for (let i = 1; i <= 3; i++) {
            stack.push(newRootTile(-i));
            stack.push(newRootTile(i));
        }
    }

    stack.push(newRootTile(0));

    while (stack.length > 0) {
        const it = stack.pop();
        const x = it.x;
        const y = it.y;
        let fullyVisible = it.fullyVisible;
        const tileID = {x, y, z: it.zoom};
        const boundingVolume = detailsProvider.getTileBoundingVolume(tileID, it.wrap, elevationForTileCulling, options);

        // Visibility of a tile is not required if any of its ancestor is fully visible
        if (!fullyVisible) {
            const intersectResult = isTileVisible(frustum, boundingVolume, plane);

            if (intersectResult === IntersectionResult.None)
                continue;

            fullyVisible = intersectResult === IntersectionResult.Full;
        }

        const distToTile2d = detailsProvider.distanceToTile2d(cameraCoord.x, cameraCoord.y, tileID, boundingVolume);

        let thisTileDesiredZ = desiredZ;
        if (allowVariableZoom) {
            const tileZoomFunc = options.calculateTileZoom || defaultCalculateTileZoom;
            thisTileDesiredZ = tileZoomFunc(transform.zoom + scaleZoom(transform.tileSize / options.tileSize),
                distToTile2d,
                distanceZ,
                distanceToCenter3d,
                transform.fov);
        }
        thisTileDesiredZ = (options.roundZoom ? Math.round : Math.floor)(thisTileDesiredZ);
        thisTileDesiredZ = Math.max(0, thisTileDesiredZ);
        const z = Math.min(thisTileDesiredZ, maxZoom);

        // We need to compute a valid wrap value for the tile to keep globe compatibility with mercator
        it.wrap = detailsProvider.getWrap(centerCoord, tileID, it.wrap);

        // Have we reached the target depth?
        if (it.zoom >= z) {
            if (it.zoom < minZoom) {
                continue;
            }
            const dz = nominalZ - it.zoom;
            const dx = cameraPoint[0] - 0.5 - (x << dz);
            const dy = cameraPoint[1] - 0.5 - (y << dz);
            const overscaledZ = options.reparseOverscaled ? Math.max(it.zoom, thisTileDesiredZ) : it.zoom;
            result.push({
                tileID: new OverscaledTileID(it.zoom === maxZoom ? overscaledZ : it.zoom, it.wrap, it.zoom, x, y),
                distanceSq: vec2.sqrLen([centerPoint[0] - 0.5 - x, centerPoint[1] - 0.5 - y]),
                // this variable is currently not used, but may be important to reduce the amount of loaded tiles
                tileDistanceToCamera: Math.sqrt(dx * dx + dy * dy)
            });
            continue;
        }

        for (let i = 0; i < 4; i++) {
            const childX = (x << 1) + (i % 2);
            const childY = (y << 1) + (i >> 1);
            const childZ = it.zoom + 1;
            stack.push({zoom: childZ, x: childX, y: childY, wrap: it.wrap, fullyVisible});
        }
    }

    return result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
}
