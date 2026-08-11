import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {GlobeTransform} from './globe_transform.ts';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper.ts';
import {type MapControlsDeltas} from './camera_helper.ts';

function setup(centerLat: number) {
    const tr = new GlobeTransform();
    tr.resize(512, 512);
    tr.setZoom(4);
    tr.setCenter(new LngLat(0, centerLat));
    tr.setTransitionState(1);
    return {tr, helper: new VerticalPerspectiveCameraHelper()};
}

describe('VerticalPerspectiveCameraHelper.handleMapControlsPan', () => {
    test('preserves bearing away from the poles', () => {
        const {tr, helper} = setup(20);
        helper.handleMapControlsPan(
            {panDelta: new Point(50, 30), around: tr.centerPoint} as MapControlsDeltas,
            tr, tr.center);
        expect(tr.bearing).toBe(0);
        expect(tr.center.lat).not.toBe(20);
    });

    test('preserves bearing near the poles', () => {
        const {tr, helper} = setup(80);
        const grabbed = tr.screenPointToLocation(new Point(300, 300));
        helper.handleMapControlsPan(
            {panDelta: new Point(50, 30), around: tr.centerPoint} as MapControlsDeltas,
            tr, grabbed);
        expect(tr.bearing).toBe(0);
    });

});
