import Point from '@mapbox/point-geometry';

import {generateOneFingerTouchPitchHandler, generateOneFingerTouchRotationHandler} from './one_finger_touch_drag';

const testTouch = {identifier: 0} as Touch;

describe('one touch drag handler tests', () => {
    test('OneFingerTouchRotateHandler', () => {
        const oneTouchRotate = generateOneFingerTouchRotationHandler({clickTolerance: 2});

        expect(oneTouchRotate.isActive()).toBe(false);
        expect(oneTouchRotate.isEnabled()).toBe(false);
        oneTouchRotate.enable();
        expect(oneTouchRotate.isEnabled()).toBe(true);

        oneTouchRotate.dragStart(new TouchEvent('touchstart', {targetTouches: [testTouch]}), new Point(0, 0));
        expect(oneTouchRotate.isActive()).toBe(false);

        const underToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchRotate.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(oneTouchRotate.isActive()).toBe(false);

        const overToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchRotate.dragMove(overToleranceMove, new Point(10, 10))).toEqual({'bearingDelta': 8});
        expect(oneTouchRotate.isActive()).toBe(true);

        oneTouchRotate.dragEnd(new TouchEvent('touchend', {targetTouches: [testTouch]}));
        expect(oneTouchRotate.isActive()).toBe(false);

        oneTouchRotate.disable();
        expect(oneTouchRotate.isEnabled()).toBe(false);

        oneTouchRotate.dragStart(new TouchEvent('touchstart', {targetTouches: [testTouch]}), new Point(0, 0));
        expect(oneTouchRotate.isActive()).toBe(false);

        expect(oneTouchRotate.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(oneTouchRotate.isActive()).toBe(false);

        expect(oneTouchRotate.dragMove(overToleranceMove, new Point(10, 10))).toBeUndefined();
        expect(oneTouchRotate.isActive()).toBe(false);
    });

    test('OneFingerTouchPitchHandler', () => {
        const oneTouchPitch = generateOneFingerTouchPitchHandler({clickTolerance: 2});

        expect(oneTouchPitch.isActive()).toBe(false);
        expect(oneTouchPitch.isEnabled()).toBe(false);
        oneTouchPitch.enable();
        expect(oneTouchPitch.isEnabled()).toBe(true);

        oneTouchPitch.dragStart(new TouchEvent('touchstart', {targetTouches: [testTouch]}), new Point(0, 0));
        expect(oneTouchPitch.isActive()).toBe(false);

        const underToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchPitch.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(oneTouchPitch.isActive()).toBe(false);

        const overToleranceMove = new TouchEvent('touchmove', {targetTouches: [testTouch]});
        expect(oneTouchPitch.dragMove(overToleranceMove, new Point(10, 10))).toEqual({'pitchDelta': -5});
        expect(oneTouchPitch.isActive()).toBe(true);

        oneTouchPitch.dragEnd(new TouchEvent('touchend', {targetTouches: [testTouch]}));
        expect(oneTouchPitch.isActive()).toBe(false);

        oneTouchPitch.disable();
        expect(oneTouchPitch.isEnabled()).toBe(false);

        oneTouchPitch.dragStart(new TouchEvent('touchstart', {targetTouches: [testTouch]}), new Point(0, 0));
        expect(oneTouchPitch.isActive()).toBe(false);

        expect(oneTouchPitch.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(oneTouchPitch.isActive()).toBe(false);

        expect(oneTouchPitch.dragMove(overToleranceMove, new Point(10, 10))).toBeUndefined();
        expect(oneTouchPitch.isActive()).toBe(false);
    });
});
