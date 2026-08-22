import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {EXTENT} from '../../data/extent.ts';
import {LngLat} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {createDEM, createDEMTerrain} from '../../util/test/util.ts';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform.ts';

describe('VerticalPerspectiveTransform.screenTerrainPointToMercatorCoordinate', () => {
    function createTransform(center: LngLat, zoom: number): VerticalPerspectiveTransform {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(512, 512);
        transform.setCenter(center);
        transform.setZoom(zoom);
        return transform;
    }

    test('hits the terrain under the globe center', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));
        const transform = createTransform(new LngLat(0, 0), 1);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBeCloseTo(1000, 6);
        expect(result.x).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).x, 6);
        expect(result.y).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).y, 6);
    });

    test('returns null for a ray that misses the planet', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createTransform(new LngLat(0, 0), 0);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(0, 0), terrain)).toBeNull();
    });

    test('caps the poles at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 2000));
        const transform = createTransform(new LngLat(0, 90), 1);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain).z).toBeCloseTo(2000, 6);

        const beyondTheMercatorEdge = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 200), terrain);

        expect(beyondTheMercatorEdge).not.toBeNull();
        expect(beyondTheMercatorEdge.z).toBe(0);
    });

    test('returns null when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const transform = createTransform(new LngLat(0, 0), 1);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain)).toBeNull();
    });

    test('returns null for a ray that hits the planet outside the renderable tiles', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const transform = createTransform(new LngLat(90, -45), 1);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain)).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const transform = createTransform(new LngLat(0, 0), 1);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
        expect(result.x).toBeCloseTo(0.5, 6);
        expect(result.y).toBeCloseTo(0.5, 6);
    });

    test('hits entirely flat terrain at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createTransform(new LngLat(0, 0), 1);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x, y) => 500 * x + 300 * y));
        const transform = createTransform(new LngLat(0, 0), 2);

        for (const p of [new Point(256, 256), new Point(230, 280), new Point(300, 220)]) {
            const result = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
            expect(result).not.toBeNull();
            expect(terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT)).toBeCloseTo(result.z, 3);
        }
    });
});
