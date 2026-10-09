import {describe, expect, test} from 'vitest';
import {LngLat} from './lng_lat.ts';
import {LngLatBounds} from './lng_lat_bounds.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {expectToBeCloseToArray} from '../util/test/util.ts';
import {EXTENT} from '../data/extent.ts';
import {createMercatorTransform} from './projection/mercator_transform.ts';

describe('Transform', () => {
    test('does not calculate the projection matrices while the width or height is zero', () => {
        const transform = createMercatorTransform();
        transform.resize(0, 480, false);
        transform.resize(640, 0, false);
        transform.resize(0, 0, false);
        expect(transform.modelViewProjectionMatrix).toBeUndefined();
        transform.resize(640, 480, false);
        expect(transform.modelViewProjectionMatrix).toBeDefined();
    });

    test('apply', () => {
        const original = createMercatorTransform();
        original.setConstrainOverride((lngLat, zoom) => {
            return {center: lngLat, zoom: zoom ?? 0};
        });
        original.setBearing(12);
        original.setCenter(new LngLat(3, 4));
        original.setElevation(5);
        original.setFov(1);
        original.setMaxBounds(new LngLatBounds([-160, -80, 160, 80]));
        original.setMaxPitch(50);
        original.setMaxZoom(10);
        original.setMinElevationForCurrentTile(0.1);
        original.setMinPitch(0.1);
        original.setMinZoom(0.1);
        original.setPadding({
            top: 1,
            right: 4,
            bottom: 2,
            left: 3,
        });
        original.setPitch(3);
        original.setRoll(7);
        original.setRenderWorldCopies(false);
        original.setZoom(2.3);

        const cloned = createMercatorTransform();
        cloned.apply(original, false);

        // Check all getters from the ITransformGetters interface
        expect(cloned.constrainOverride).toEqual(original.constrainOverride);
        expect(cloned.tileSize).toEqual(original.tileSize);
        expect(cloned.tileZoom).toEqual(original.tileZoom);
        expect(cloned.scale).toEqual(original.scale);
        expect(cloned.worldSize).toEqual(original.worldSize);
        expect(cloned.width).toEqual(original.width);
        expect(cloned.height).toEqual(original.height);
        expect(cloned.bearingInRadians).toEqual(original.bearingInRadians);
        expect(cloned.lngRange).toEqual(original.lngRange);
        expect(cloned.latRange).toEqual(original.latRange);
        expect(cloned.minZoom).toEqual(original.minZoom);
        expect(cloned.maxZoom).toEqual(original.maxZoom);
        expect(cloned.zoom).toEqual(original.zoom);
        expect(cloned.center).toEqual(original.center);
        expect(cloned.minPitch).toEqual(original.minPitch);
        expect(cloned.maxPitch).toEqual(original.maxPitch);
        expect(cloned.pitch).toEqual(original.pitch);
        expect(cloned.roll).toEqual(original.roll);
        expect(cloned.bearing).toEqual(original.bearing);
        expect(cloned.fov).toEqual(original.fov);
        expect(cloned.elevation).toEqual(original.elevation);
        expect(cloned.minElevationForCurrentTile).toEqual(original.minElevationForCurrentTile);
        expect(cloned.padding).toEqual(original.padding);
        expect(cloned.unmodified).toEqual(original.unmodified);
        expect(cloned.renderWorldCopies).toEqual(original.renderWorldCopies);
    });

    describe('getMercatorTilesCoordinates', () => {
        test('mercator tile extents are set', () => {
            const transform = createMercatorTransform();

            let tileMercatorCoords = transform.getMercatorTileCoordinates(new OverscaledTileID(0, 0, 0, 0, 0));
            expectToBeCloseToArray(tileMercatorCoords, [0, 0, 1 / EXTENT, 1 / EXTENT]);

            tileMercatorCoords = transform.getMercatorTileCoordinates(new OverscaledTileID(1, 0, 1, 0, 0));
            expectToBeCloseToArray(tileMercatorCoords, [0, 0, 0.5 / EXTENT, 0.5 / EXTENT]);

            tileMercatorCoords = transform.getMercatorTileCoordinates(new OverscaledTileID(1, 0, 1, 1, 0));
            expectToBeCloseToArray(tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
    });
});
