import Point from '@mapbox/point-geometry';

import {generateMousePanHandler, generateMousePitchHandler, generateMouseRotationHandler} from './mouse';

describe('mouse handler tests', () => {
    test('MouseRotateHandler', () => {
        const mouseRotate = generateMouseRotationHandler({clickTolerance: 2});

        expect(mouseRotate.isActive()).toBe(false);
        expect(mouseRotate.isEnabled()).toBe(false);
        mouseRotate.enable();
        expect(mouseRotate.isEnabled()).toBe(true);

        mouseRotate.dragStart(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mouseRotate.isActive()).toBe(false);

        const underToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 1, clientY: 1});
        expect(mouseRotate.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mouseRotate.isActive()).toBe(false);

        const overToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 10, clientY: 10});
        expect(mouseRotate.dragMove(overToleranceMove, new Point(10, 10))).toEqual({'bearingDelta': 8});
        expect(mouseRotate.isActive()).toBe(true);

        mouseRotate.dragEnd(new MouseEvent('mouseup', {buttons: 0, button: 2}));
        expect(mouseRotate.isActive()).toBe(false);

        mouseRotate.disable();
        expect(mouseRotate.isEnabled()).toBe(false);

        mouseRotate.dragStart(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mouseRotate.isActive()).toBe(false);

        expect(mouseRotate.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mouseRotate.isActive()).toBe(false);

        expect(mouseRotate.dragMove(overToleranceMove, new Point(10, 10))).toBeUndefined();
        expect(mouseRotate.isActive()).toBe(false);
    });

    test('MousePitchHandler', () => {
        const mousePitch = generateMousePitchHandler({clickTolerance: 2});

        expect(mousePitch.isActive()).toBe(false);
        expect(mousePitch.isEnabled()).toBe(false);
        mousePitch.enable();
        expect(mousePitch.isEnabled()).toBe(true);

        mousePitch.dragStart(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mousePitch.isActive()).toBe(false);

        const underToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 1, clientY: 1});
        expect(mousePitch.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mousePitch.isActive()).toBe(false);

        const overToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 10, clientY: 10});
        expect(mousePitch.dragMove(overToleranceMove, new Point(10, 10))).toEqual({'pitchDelta': -5});
        expect(mousePitch.isActive()).toBe(true);

        mousePitch.dragEnd(new MouseEvent('mouseup', {buttons: 0, button: 2}));
        expect(mousePitch.isActive()).toBe(false);

        mousePitch.disable();
        expect(mousePitch.isEnabled()).toBe(false);

        mousePitch.dragStart(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mousePitch.isActive()).toBe(false);

        expect(mousePitch.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mousePitch.isActive()).toBe(false);

        expect(mousePitch.dragMove(overToleranceMove, new Point(10, 10))).toBeUndefined();
        expect(mousePitch.isActive()).toBe(false);
    });

    test('MousePanHandler', () => {
        const mousePan = generateMousePanHandler({clickTolerance: 2});

        expect(mousePan.isActive()).toBe(false);
        expect(mousePan.isEnabled()).toBe(false);
        mousePan.enable();
        expect(mousePan.isEnabled()).toBe(true);

        mousePan.dragStart(new MouseEvent('mousedown', {buttons: 1, button: 0}), new Point(0, 0));
        expect(mousePan.isActive()).toBe(true);

        const underToleranceMove = new MouseEvent('mousemove', {buttons: 1, clientX: 1, clientY: 1});
        expect(mousePan.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mousePan.isActive()).toBe(true);

        const overToleranceMove = new MouseEvent('mousemove', {buttons: 1, clientX: 10, clientY: 10});
        expect(mousePan.dragMove(overToleranceMove, new Point(10, 10)))
            .toEqual({'around': {'x': 10, 'y': 10,}, 'panDelta': {'x': 10, 'y': 10,}});
        expect(mousePan.isActive()).toBe(true);

        mousePan.dragEnd(new MouseEvent('mouseup', {buttons: 0, button: 0}));
        expect(mousePan.isActive()).toBe(false);

        mousePan.disable();
        expect(mousePan.isEnabled()).toBe(false);

        mousePan.dragStart(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mousePan.isActive()).toBe(false);

        expect(mousePan.dragMove(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mousePan.isActive()).toBe(false);

        expect(mousePan.dragMove(overToleranceMove, new Point(10, 10))).toBeUndefined();
        expect(mousePan.isActive()).toBe(false);
    });
});
