import type {OverscaledTileID} from './tile_id';

/**
 * Checks if a GeoJSON geometry intersects with a tile's bounding box.
 * Uses simple point-in-box tests, which may produce false positives for
 * complex geometries (e.g., LineStrings that pass through the tile but
 * have no vertices inside it).
 */
export function geometryIntersectsTile(geometry: GeoJSON.Geometry, tileID: OverscaledTileID): boolean {
    const tilesAtZoom = Math.pow(2, tileID.canonical.z);
    const tileMinX = tileID.canonical.x / tilesAtZoom;
    const tileMaxX = (tileID.canonical.x + 1) / tilesAtZoom;
    const tileMinY = tileID.canonical.y / tilesAtZoom;
    const tileMaxY = (tileID.canonical.y + 1) / tilesAtZoom;

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
                if (geometryIntersectsTile(geom, tileID)) {
                    return true;
                }
            }
            return false;
        default:
            return false;
    }
}
