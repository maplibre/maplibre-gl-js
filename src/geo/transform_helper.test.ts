import {LngLat} from './lng_lat';
import {LngLatBounds} from './lng_lat_bounds';
import {scaleZoom, TransformHelper, zoomScale} from './transform_helper';

describe('TransformHelper', () => {
    test('apply', () => {
        const emptyCallbacks = {
            calcMatrices: () => {},
            getConstrained: (center, zoom) => { return {center, zoom}; },
        };

        const original = new TransformHelper(emptyCallbacks);
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
        original.setRenderWorldCopies(false);
        original.setZoom(2.3);

        const cloned = new TransformHelper(emptyCallbacks);
        cloned.apply(original);

        // Check all getters from the ITransformGetters interface
        expect(cloned.tileSize).toEqual(original.tileSize);
        expect(cloned.tileZoom).toEqual(original.tileZoom);
        expect(cloned.scale).toEqual(original.scale);
        expect(cloned.worldSize).toEqual(original.worldSize);
        expect(cloned.width).toEqual(original.width);
        expect(cloned.height).toEqual(original.height);
        expect(cloned.angle).toEqual(original.angle);
        expect(cloned.lngRange).toEqual(original.lngRange);
        expect(cloned.latRange).toEqual(original.latRange);
        expect(cloned.minZoom).toEqual(original.minZoom);
        expect(cloned.maxZoom).toEqual(original.maxZoom);
        expect(cloned.zoom).toEqual(original.zoom);
        expect(cloned.center).toEqual(original.center);
        expect(cloned.minPitch).toEqual(original.minPitch);
        expect(cloned.maxPitch).toEqual(original.maxPitch);
        expect(cloned.pitch).toEqual(original.pitch);
        expect(cloned.bearing).toEqual(original.bearing);
        expect(cloned.fov).toEqual(original.fov);
        expect(cloned.elevation).toEqual(original.elevation);
        expect(cloned.minElevationForCurrentTile).toEqual(original.minElevationForCurrentTile);
        expect(cloned.padding).toEqual(original.padding);
        expect(cloned.unmodified).toEqual(original.unmodified);
        expect(cloned.renderWorldCopies).toEqual(original.renderWorldCopies);
    });

    test('scaleZoom+zoomScale', () => {
        expect(scaleZoom(0)).toBe(-Infinity);
        expect(scaleZoom(10)).toBe(3.3219280948873626);
        expect(zoomScale(3.3219280948873626)).toBeCloseTo(10, 10);
        expect(scaleZoom(zoomScale(5))).toBe(5);
    });
});
