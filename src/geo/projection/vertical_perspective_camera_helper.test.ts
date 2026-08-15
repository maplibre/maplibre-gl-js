import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {GlobeTransform} from './globe_transform.ts';
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
});
