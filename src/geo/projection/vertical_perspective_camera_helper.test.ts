import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {GlobeTransform} from './globe_transform.ts';
import {getZoomAdjustment} from './globe_utils.ts';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper.ts';
import {type MapControlsDeltas} from './camera_helper.ts';

describe('VerticalPerspectiveCameraHelper.handleMapControlsPan', () => {
    test('preserves bearing away from the poles', () => {
        const tr = new GlobeTransform();
        tr.resize(512, 512);
        tr.setZoom(4);
        tr.setCenter(new LngLat(0, 20));
        tr.setTransitionState(1);
        const helper = new VerticalPerspectiveCameraHelper();

        helper.handleMapControlsPan(
            {panDelta: new Point(50, 30), around: tr.centerPoint} as MapControlsDeltas,
            tr, tr.center);

        expect(tr.bearing).toBe(0);
        expect(tr.center.lat).not.toBe(20);
    });

    test('does not zoom in when panning off the pole on the constrained min zoom', () => {
        const tr = new GlobeTransform();
        tr.resize(512, 512);
        tr.setCenter(new LngLat(0, 80));
        tr.setMinZoom(3);
        tr.setTransitionState(1);
        tr.setZoom(0); // clamps to the latitude-compensated floor, minZoom + getZoomAdjustment(0, 80)
        const zoomBefore = tr.zoom;
        expect(zoomBefore).toBeCloseTo(3 + getZoomAdjustment(0, 80), 10);
        const helper = new VerticalPerspectiveCameraHelper();

        helper.handleMapControlsPan(
            {panDelta: new Point(0, -50), around: tr.centerPoint} as MapControlsDeltas,
            tr, tr.center);

        expect(tr.center.lat).toBeLessThan(80);
        // The globe's drawn size is unchanged: zoom moved by exactly the latitude compensation
        expect(tr.zoom).toBeCloseTo(zoomBefore + getZoomAdjustment(80, tr.center.lat), 10);
    });

    describe('anchor', () => {
        function panFrom(around: Point) {
            const tr = new GlobeTransform();
            tr.resize(512, 512);
            tr.setZoom(1);
            tr.setCenter(new LngLat(0, 0));
            tr.setTransitionState(1);
            new VerticalPerspectiveCameraHelper().handleMapControlsPan(
                {panDelta: new Point(50, 30), around} as MapControlsDeltas,
                tr, tr.center);
            return tr;
        }

        const centerPoint = new Point(256, 256);
        const offSphere = new Point(500, 30);

        test('a grab off the sphere pans from the center point', () => {
            const dragged = panFrom(offSphere);
            const centered = panFrom(centerPoint);

            expect(dragged.center.lng).toBe(centered.center.lng);
            expect(dragged.center.lat).toBe(centered.center.lat);
        });

        test('a grab on the sphere pans from the grab', () => {
            const dragged = panFrom(new Point(300, 256));

            expect(dragged.center.lng).not.toBe(panFrom(centerPoint).center.lng);
        });
    });
});
