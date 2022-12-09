import Point from '@mapbox/point-geometry';

import {setMatchMedia, setPerformance, setWebGlContext} from '../../util/test/util';
import {OneFingerTouchHandler} from './one_finger_touch_drag';

beforeEach(() => {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
});

const testTouch = {identifier: 0} as Touch;

describe('one touch drag handler tests', () => {
    test('OneFingerTouchRotateHandler', () => {
        const oneTouchRotate = OneFingerTouchHandler.generateRotationHandler({clickTolerance: 2});

        expect(oneTouchRotate.isActive()).toBe(false);

        oneTouchRotate.touchstart(new TouchEvent('touchstart', {targetTouches: [testTouch]}), new Point(0, 0));
        expect(oneTouchRotate.isActive()).toBe(false);

        const underToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchRotate.touchmoveWindow(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(oneTouchRotate.isActive()).toBe(false);

        const overToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchRotate.touchmoveWindow(overToleranceMove, new Point(10, 10))).toEqual({'bearingDelta': 8});
        expect(oneTouchRotate.isActive()).toBe(true);

        oneTouchRotate.touchendWindow(new TouchEvent('touchend', {targetTouches: [testTouch]}));
        expect(oneTouchRotate.isActive()).toBe(false);
    });

    test('OneFingerTouchPitchHandler', () => {
        const oneTouchPitch = OneFingerTouchHandler.generatePitchHandler({clickTolerance: 2});

        expect(oneTouchPitch.isActive()).toBe(false);

        oneTouchPitch.touchstart(new TouchEvent('touchstart', {targetTouches: [testTouch]}), new Point(0, 0));
        expect(oneTouchPitch.isActive()).toBe(false);

        const underToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchPitch.touchmoveWindow(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(oneTouchPitch.isActive()).toBe(false);

        const overToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchPitch.touchmoveWindow(overToleranceMove, new Point(10, 10))).toEqual({'pitchDelta': -5});
        expect(oneTouchPitch.isActive()).toBe(true);

        oneTouchPitch.touchendWindow(new TouchEvent('touchend', {targetTouches: [testTouch]}));
        expect(oneTouchPitch.isActive()).toBe(false);
    });
});
