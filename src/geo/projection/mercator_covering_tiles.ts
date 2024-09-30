import {mat4, vec2, vec3} from 'gl-matrix';
import {OverscaledTileID} from '../../source/tile_id';
import {Aabb, Frustum, IntersectionResult} from '../../util/primitives';
import {MercatorCoordinate} from '../mercator_coordinate';
import {CoveringTilesOptions, IReadonlyTransform} from '../transform_interface';

type CoveringTilesResult = {
    tileID: OverscaledTileID;
    distanceSq: number;
    tileDistanceToCamera: number;
};

type CoveringTilesStackEntry = {
    aabb: Aabb;
    zoom: number;
    x: number;
    y: number;
    wrap: number;
    fullyVisible: boolean;
};

/**
 * Returns a list of tiles that optimally covers the screen.
 * Correctly handles LOD when moving over the antimeridian.
 * @param transform - The mercator transform instance.
 * @param options - Additional coveringTiles options.
 * @param invViewProjMatrix - Inverse view projection matrix, for computing camera frustum.
 * @returns A list of tile coordinates, ordered by ascending distance from camera.
 */
export function mercatorCoveringTiles(transform: IReadonlyTransform, options: CoveringTilesOptions, invViewProjMatrix: mat4): Array<OverscaledTileID> {
    let z = transform.coveringZoomLevel(options);
    const actualZ = z;

    if (options.minzoom !== undefined && z < options.minzoom) return [];
    if (options.maxzoom !== undefined && z > options.maxzoom) z = options.maxzoom;

    const cameraCoord = transform.screenPointToMercatorCoordinate(transform.getCameraPoint());
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center);
    const numTiles = Math.pow(2, z);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
    const cameraFrustum = Frustum.fromInvProjectionMatrix(invViewProjMatrix, transform.worldSize, z);

    // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
    let minZoom = options.minzoom || 0;
    // Use 0.1 as an epsilon to avoid for explicit == 0.0 floating point checks
    if (!options.terrain && transform.pitch <= 60.0 && transform.padding.top < 0.1)
        minZoom = z;

    // There should always be a certain number of maximum zoom level tiles surrounding the center location in 2D or in front of the camera in 3D
    const radiusOfMaxLvlLodInTiles = options.terrain ? 2 / Math.min(transform.tileSize, options.tileSize) * transform.tileSize : 3;

    const newRootTile = (wrap: number): any => {
        return {
            aabb: new Aabb([wrap * numTiles, 0, 0], [(wrap + 1) * numTiles, numTiles, 0]),
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
    const maxZoom = z;
    const overscaledZ = options.reparseOverscaled ? actualZ : z;

    if (transform.renderWorldCopies) {
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

        // Visibility of a tile is not required if any of its ancestor if fully inside the frustum
        if (!fullyVisible) {
            const intersectResult = it.aabb.intersectsFrustum(cameraFrustum);

            if (intersectResult === IntersectionResult.None)
                continue;

            fullyVisible = intersectResult === IntersectionResult.Full;
        }

        const refPoint = options.terrain ? cameraPoint : centerPoint;
        const distanceX = it.aabb.distanceX(refPoint);
        const distanceY = it.aabb.distanceY(refPoint);
        const longestDim = Math.max(Math.abs(distanceX), Math.abs(distanceY));

        // We're using distance based heuristics to determine if a tile should be split into quadrants or not.
        // radiusOfMaxLvlLodInTiles defines that there's always a certain number of maxLevel tiles next to the map center.
        // Using the fact that a parent node in quadtree is twice the size of its children (per dimension)
        // we can define distance thresholds for each relative level:
        // f(k) = offset + 2 + 4 + 8 + 16 + ... + 2^k. This is the same as "offset+2^(k+1)-2"
        const distToSplit = radiusOfMaxLvlLodInTiles + (1 << (maxZoom - it.zoom)) - 2;

        // Have we reached the target depth or is the tile too far away to be any split further?
        if (it.zoom === maxZoom || (longestDim > distToSplit && it.zoom >= minZoom)) {
            const dz = maxZoom - it.zoom, dx = cameraPoint[0] - 0.5 - (x << dz), dy = cameraPoint[1] - 0.5 - (y << dz);
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
            let quadrant = it.aabb.quadrant(i);
            if (options.terrain) {
                const tileID = new OverscaledTileID(childZ, it.wrap, childZ, childX, childY);
                const minMax = options.terrain.getMinMaxElevation(tileID);
                const minElevation = minMax.minElevation ?? transform.elevation;
                const maxElevation = minMax.maxElevation ?? transform.elevation;
                quadrant = new Aabb(
                    [quadrant.min[0], quadrant.min[1], minElevation] as vec3,
                    [quadrant.max[0], quadrant.max[1], maxElevation] as vec3
                );
            }
            stack.push({aabb: quadrant, zoom: childZ, x: childX, y: childY, wrap: it.wrap, fullyVisible});
        }
    }

    return result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
}
