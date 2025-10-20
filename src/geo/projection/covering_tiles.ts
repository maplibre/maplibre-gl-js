import {OverscaledTileID} from '../../source/tile_id';
import {vec2, type vec4} from 'gl-matrix';
import {MercatorCoordinate} from '../mercator_coordinate';
import {degreesToRadians, scaleZoom} from '../../util/util';

import type {IReadonlyTransform} from '../transform_interface';
import type {Terrain} from '../../render/terrain';
import type {Frustum} from '../../util/primitives/frustum';
import {maxMercatorHorizonAngle} from './mercator_utils';
import {type IBoundingVolume, IntersectionResult} from '../../util/primitives/bounding_volume';

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
 * @param p - the power to raise cos(x) to inside the itegral
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
    const frustum = transform.getCameraFrustum();
    const plane = transform.getClippingPlane();
    const cameraCoord = transform.screenPointToMercatorCoordinate(transform.getCameraPoint());
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center, transform.elevation);
    cameraCoord.z = centerCoord.z + Math.cos(transform.pitchInRadians) * transform.cameraToCenterDistance / transform.worldSize;
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
    const stack: Array<CoveringTilesStackEntry> = [];
    const result: Array<CoveringTilesResult> = [];

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
        const boundingVolume = detailsProvider.getTileBoundingVolume(tileID, it.wrap, transform.elevation, options);

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
