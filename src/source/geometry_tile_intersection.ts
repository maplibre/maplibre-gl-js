import type {OverscaledTileID} from './tile_id';
import {EXTENT} from '../data/extent';

/**
 * Checks if a GeoJSON geometry intersects with a tile's bounding box.
 * Uses simple point-in-box tests, which may produce false positives for
 * complex geometries (e.g., LineStrings that pass through the tile but
 * have no vertices inside it).
 *
 * @param geometry - The GeoJSON geometry to check
 * @param tileID - The tile ID to check against
 * @param buffer - Buffer size in tile coordinates (0-EXTENT range, default 0)
 */
export function geometryIntersectsTile(geometry: GeoJSON.Geometry, tileID: OverscaledTileID, buffer: number = 0): boolean {
    const tilesAtZoom = Math.pow(2, tileID.canonical.z);
    const bufferInTiles = buffer / EXTENT;
    const tileMinX = tileID.canonical.x / tilesAtZoom - bufferInTiles;
    const tileMaxX = (tileID.canonical.x + 1) / tilesAtZoom + bufferInTiles;
    const tileMinY = tileID.canonical.y / tilesAtZoom - bufferInTiles;
    const tileMaxY = (tileID.canonical.y + 1) / tilesAtZoom + bufferInTiles;

    const checkCoordinate = (coord: number[]) => {
        const [lng, lat] = coord;
        // Convert lng/lat to mercator coordinates (0-1 range)
        const x = (lng + 180) / 360;
        const latRad = lat * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
        return x >= tileMinX && x <= tileMaxX && y >= tileMinY && y <= tileMaxY;
    };

    const checkCoordinates = (coords: any): boolean => {
        if (typeof coords[0] === 'number') {
            return checkCoordinate(coords);
        }
        for (const coord of coords) {
            if (checkCoordinates(coord)) return true;
        }
        return false;
    };

    switch (geometry.type) {
        case 'Point':
            return checkCoordinate(geometry.coordinates);
        case 'MultiPoint':
        case 'LineString':
            return checkCoordinates(geometry.coordinates);
        case 'MultiLineString':
        case 'Polygon':
            return checkCoordinates(geometry.coordinates);
        case 'MultiPolygon':
            return checkCoordinates(geometry.coordinates);
        case 'GeometryCollection':
            for (const geom of geometry.geometries) {
                if (geometryIntersectsTile(geom, tileID, buffer)) {
                    return true;
                }
            }
            return false;
        default:
            return false;
    }
}
