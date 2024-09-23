import {mat4, vec2, vec3} from 'gl-matrix';
import {OverscaledTileID} from '../../source/tile_id';
import {Aabb, Frustum, IntersectionResult} from '../../util/primitives';
import {MercatorCoordinate} from '../mercator_coordinate';
import {CoveringTilesOptions, IReadonlyTransform} from '../transform_interface';
import {scaleZoom} from '../transform_helper';

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
    let nominalZ = transform.coveringZoomLevel(options);

    const minZoom = options.minzoom || 0;
    const maxZoom = options.maxzoom !== undefined ? options.maxzoom : transform.maxZoom;
    nominalZ = Math.min(Math.max(0, nominalZ), maxZoom);
    let actualZ = nominalZ;

    const cameraCoord = transform.screenPointToMercatorCoordinate(transform.getCameraPoint());
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center);        const numTiles = Math.pow(2, nominalZ);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
    const cameraFrustum = Frustum.fromInvProjectionMatrix(invViewProjMatrix, transform.worldSize, nominalZ);
    const distanceToCenter2d = Math.hypot(centerPoint[0] - cameraPoint[0], centerPoint[1] - cameraPoint[1]);
    const distanceZ = distanceToCenter2d / Math.max(0.001, Math.tan(transform.pitch * Math.PI / 180.0));
    const distanceToCenter3d = Math.hypot(distanceToCenter2d, distanceZ);

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

        const distanceX = it.aabb.distanceX(cameraPoint);
        const distanceY = it.aabb.distanceY(cameraPoint);
        const distToTile2d = Math.hypot(distanceX, distanceY);
        const distToTile3d = Math.hypot(distanceZ, distToTile2d);

        // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
        // Use 0.1 as an epsilon to avoid for explicit == 0.0 floating point checks
        if (options.terrain || transform.pitch > 60.0 || transform.padding.top >= 0.1) {
            actualZ = (options.roundZoom ? Math.round : Math.floor)(
                transform.zoom + scaleZoom(transform.tileSize / options.tileSize * distanceToCenter3d / distToTile3d)
            );
        }
        const z = Math.min(actualZ, maxZoom);

        // Have we reached the target depth?
        if (it.zoom >= z) {
            if (it.zoom < minZoom) {
                continue;
            }
            const dz = nominalZ - it.zoom, dx = cameraPoint[0] - 0.5 - (x << dz), dy = cameraPoint[1] - 0.5 - (y << dz);
            const overscaledZ = options.reparseOverscaled ? actualZ : it.zoom;
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
