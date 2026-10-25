import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createGlobeTransform} from '../geo/projection/globe_transform.ts';
import {projectTileCoordinatesToSphere} from '../geo/projection/globe_utils.ts';
import {getGlobeQueryPlane, mayIntersectGlobeQueryPlane} from './feature_index.ts';
import {EXTENT} from './extent.ts';

describe('globe extrusion query plane broadphase', () => {
    const tile = new OverscaledTileID(10, 0, 10, 312, 655);

    test('only rejects footprints too far from the ray plane', () => {
        // The equatorial plane cannot contain a small footprint at -45 degrees.
        expect(mayIntersectGlobeQueryPlane([0, 1, 0], tile, 3900, 3900, 3910, 3910, 0)).toBe(false);
        // A world-size box cannot be culled by a narrow ray plane.
        const globe = new OverscaledTileID(0, 0, 0, 0, 0);
        expect(mayIntersectGlobeQueryPlane([0, 1, 0], globe, 0, 0, EXTENT, EXTENT, 0)).toBe(true);
    });

    test('conservatively retains boxes containing points on random great-circle planes', () => {
        for (let i = 0; i < 1000; i++) {
            const x = 100 + (i * 1297) % 7990;
            const y = 100 + (i * 2819) % 7990;
            const surface = projectTileCoordinatesToSphere(x, y, 312, 655, 10);
            const other = i % 2 ? [0, 1, 0] : [1, 0, 0];
            const cross = [
                surface[1] * other[2] - surface[2] * other[1],
                surface[2] * other[0] - surface[0] * other[2],
                surface[0] * other[1] - surface[1] * other[0]
            ];
            const length = Math.hypot(...cross);
            const normal = cross.map(value => value / length) as [number, number, number];
            expect(mayIntersectGlobeQueryPlane(normal, tile, x - 4, y - 4, x + 4, y + 4, 0)).toBe(true);
        }
    });

    test('reconstructs the ray plane from a point query on the visible globe', () => {
        const transform = createGlobeTransform();
        transform.resize(512, 512);
        transform.setCenter(new LngLat(-70, -45));
        transform.setZoom(10);
        transform.setPitch(60);
        transform.setBearing(30);

        const point = new Point(316, 140);
        const mercator = transform.screenPointToMercatorCoordinate(point);
        const tilePoint = tile.canonical.getTilePoint(mercator);
        const normal = getGlobeQueryPlane(tilePoint, tile, transform);
        expect(normal).not.toBeNull();
        if (!normal) return;

        const origin = transform.cameraPosition;
        const direction = transform.getRayDirectionFromPixel(point);
        expect(Math.abs(normal[0] * origin[0] + normal[1] * origin[1] + normal[2] * origin[2])).toBeLessThan(1e-8);
        expect(Math.abs(normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2])).toBeLessThan(1e-7);
    });
});
