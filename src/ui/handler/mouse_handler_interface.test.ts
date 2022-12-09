import Point from '@mapbox/point-geometry';

import {setMatchMedia, setPerformance, setWebGlContext} from '../../util/test/util';
import {MouseHandler} from './mouse';

beforeEach(() => {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
});

describe('mouse handler tests', () => {
    test('MouseRotateHandler', () => {
        const mouseRotate = MouseHandler.generateRotationHandler({clickTolerance: 2});

        expect(mouseRotate.isActive()).toBe(false);

        mouseRotate.mousedown(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mouseRotate.isActive()).toBe(false);

        const underToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 1, clientY: 1});
        expect(mouseRotate.mousemoveWindow(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mouseRotate.isActive()).toBe(false);

        const overToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 10, clientY: 10});
        expect(mouseRotate.mousemoveWindow(overToleranceMove, new Point(10, 10))).toEqual({'bearingDelta': 8});
        expect(mouseRotate.isActive()).toBe(true);

        mouseRotate.mouseupWindow(new MouseEvent('mouseup', {buttons: 0, button: 2}));
        expect(mouseRotate.isActive()).toBe(false);
    });

    test('MousePitchHandler', () => {
        const mousePitch = MouseHandler.generatePitchHandler({clickTolerance: 2});

        expect(mousePitch.isActive()).toBe(false);

        mousePitch.mousedown(new MouseEvent('mousedown', {buttons: 2, button: 2}), new Point(0, 0));
        expect(mousePitch.isActive()).toBe(false);

        const underToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 1, clientY: 1});
        expect(mousePitch.mousemoveWindow(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mousePitch.isActive()).toBe(false);

        const overToleranceMove = new MouseEvent('mousemove', {buttons: 2, clientX: 10, clientY: 10});
        expect(mousePitch.mousemoveWindow(overToleranceMove, new Point(10, 10))).toEqual({'pitchDelta': -5});
        expect(mousePitch.isActive()).toBe(true);

        mousePitch.mouseupWindow(new MouseEvent('mouseup', {buttons: 0, button: 2}));
        expect(mousePitch.isActive()).toBe(false);
    });

    test('MousePanHandler', () => {
        const mousePan = MouseHandler.generatePanHandler({clickTolerance: 2});

        expect(mousePan.isActive()).toBe(false);

        mousePan.mousedown(new MouseEvent('mousedown', {buttons: 1, button: 0}), new Point(0, 0));
        expect(mousePan.isActive()).toBe(true);

        const underToleranceMove = new MouseEvent('mousemove', {buttons: 1, clientX: 1, clientY: 1});
        expect(mousePan.mousemoveWindow(underToleranceMove, new Point(1, 1))).toBeUndefined();
        expect(mousePan.isActive()).toBe(true);

        const overToleranceMove = new MouseEvent('mousemove', {buttons: 1, clientX: 10, clientY: 10});
        expect(mousePan.mousemoveWindow(overToleranceMove, new Point(10, 10)))
            .toEqual({'around': {'x': 10, 'y': 10,}, 'panDelta': {'x': 10, 'y': 10,}});
        expect(mousePan.isActive()).toBe(true);

        mousePan.mouseupWindow(new MouseEvent('mouseup', {buttons: 0, button: 0}));
        expect(mousePan.isActive()).toBe(false);
    });
});
