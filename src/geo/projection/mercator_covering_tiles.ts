import {mat4, vec2, vec3} from 'gl-matrix';
import {OverscaledTileID} from '../../source/tile_id';
import {Aabb, Frustum, IntersectionResult} from '../../util/primitives';
import {MercatorCoordinate} from '../mercator_coordinate';
import {CoveringTilesOptions, IReadonlyTransform} from '../transform_interface';
import {scaleZoom} from '../transform_helper';
import {CoveringTilesResult, CoveringTilesStackEntry, isTileVisible} from './covering_tiles'


/**
 * Returns the AABB of the specified tile.
 * @param tileId - Tile x, y and z for zoom.
 */
export function getTileAABB(tileId: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptions): Aabb {
    let minElevation = elevation;
    let maxElevation = elevation;
    if (options.terrain) {
        const tileID = new OverscaledTileID(tileId.z, wrap, tileId.z, tileId.x, tileId.y);
        const minMax = options.terrain.getMinMaxElevation(tileID);
        minElevation = minMax.minElevation ?? elevation;
        maxElevation = minMax.maxElevation ?? elevation;
    }
    const numTiles = 1 << tileId.z;
    return new Aabb([wrap + tileId.x / numTiles, tileId.y / numTiles, minElevation],
        [wrap + (tileId.x + 1) / numTiles, (tileId.y + 1) / numTiles, maxElevation]);
}

/**
 * Returns a list of tiles that optimally covers the screen.
 * Correctly handles LOD when moving over the antimeridian.
 * @param transform - The mercator transform instance.
 * @param options - Additional coveringTiles options.
 * @param invViewProjMatrix - Inverse view projection matrix, for computing camera frustum.
 * @returns A list of tile coordinates, ordered by ascending distance from camera.
 */
export function mercatorCoveringTiles(transform: IReadonlyTransform, options: CoveringTilesOptions, invViewProjMatrix: mat4): Array<OverscaledTileID> {
    const desiredZ = transform.coveringZoomLevel(options);

    const minZoom = options.minzoom || 0;
    const maxZoom = options.maxzoom !== undefined ? options.maxzoom : transform.maxZoom;
    const nominalZ = Math.min(Math.max(0, desiredZ), maxZoom);

    const cameraCoord = transform.screenPointToMercatorCoordinate(transform.getCameraPoint());
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center);
    const numTiles = Math.pow(2, nominalZ);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
    const cameraFrustum = Frustum.fromInvProjectionMatrix(invViewProjMatrix, transform.worldSize);
    const distanceToCenter2d = Math.hypot(centerCoord.x - cameraCoord.x, centerCoord.y - cameraCoord.y);
    const distanceZ = Math.cos(transform.pitch * Math.PI / 180.0) * transform.cameraToCenterDistance / transform.worldSize;
    const distanceToCenter3d = Math.hypot(distanceToCenter2d, distanceZ);

    const newRootTile = (wrap: number): any => {
        return {
            aabb: new Aabb([wrap, 0, 0], [(wrap + 1), 1, 0]),
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
        const tileID = {x, y, z: it.zoom};
        const aabb = getTileAABB(tileID, it.wrap, transform.elevation, options);

        // Visibility of a tile is not required if any of its ancestor is fully visible
        if (!fullyVisible) {
            const intersectResult = isTileVisible(cameraFrustum, null, aabb);

            if (intersectResult === IntersectionResult.None)
                continue;

            fullyVisible = intersectResult === IntersectionResult.Full;
        }

        const distanceX = aabb.distanceX([cameraCoord.x, cameraCoord.y]);
        const distanceY = aabb.distanceY([cameraCoord.x, cameraCoord.y]);
        const distToTile2d = Math.hypot(distanceX, distanceY);
        const distToTile3d = Math.hypot(distanceZ, distToTile2d);

        // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
        let thisTileDesiredZ = desiredZ;
        // Use 0.1 as an epsilon to avoid for explicit == 0.0 floating point checks
        if (options.terrain || transform.pitch > 60.0 || transform.padding.top >= 0.1) {
            const thisTilePitch = Math.atan(distToTile2d / distanceZ);
            thisTileDesiredZ = (options.roundZoom ? Math.round : Math.floor)(
                transform.zoom + transform.pitchBehavior * scaleZoom(Math.cos(thisTilePitch)) / 2 + scaleZoom(transform.tileSize / options.tileSize * distanceToCenter3d / distToTile3d / Math.cos(transform.fov / 2.0 * Math.PI / 180.0))
            );
        }
        thisTileDesiredZ = Math.max(0, thisTileDesiredZ);
        const z = Math.min(thisTileDesiredZ, maxZoom);

        // Have we reached the target depth?
        if (it.zoom >= z) {
            if (it.zoom < minZoom) {
                continue;
            }
            const dz = nominalZ - it.zoom;
            const dx = cameraPoint[0] - 0.5 - (x << dz);
            const dy = cameraPoint[1] - 0.5 - (y << dz);
            const overscaledZ = options.reparseOverscaled ? thisTileDesiredZ : it.zoom;
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
