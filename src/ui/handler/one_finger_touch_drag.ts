import Point from '@mapbox/point-geometry';

import type {DragMoveHandler, DragRotateResult, DragPitchResult} from './drag_handler';
import {DragHandler} from './drag_handler';
import {OneFingerTouchMoveStateManager} from './drag_move_state_manager';
import {getAngleDelta} from '../../util/util';

export interface OneFingerTouchRotateHandler extends DragMoveHandler<DragRotateResult, TouchEvent> {}
export interface OneFingerTouchPitchHandler extends DragMoveHandler<DragPitchResult, TouchEvent> {}

const assignEvents = (handler: DragHandler<DragRotateResult, TouchEvent>) => {
    handler.touchstart = handler.dragStart;
    handler.touchmoveWindow = handler.dragMove;
    handler.touchend = handler.dragEnd;
};

export function generateOneFingerTouchRotationHandler({enable, clickTolerance, aroundCenter = true}: {
    clickTolerance: number;
    enable?: boolean;
    aroundCenter?: boolean;
}): OneFingerTouchRotateHandler {
    const touchMoveStateManager = new OneFingerTouchMoveStateManager();
    return new DragHandler<DragRotateResult, TouchEvent>({
        clickTolerance,
        move: (lastPoint: Point, currentPoint: Point, center: Point) => {
            if (aroundCenter) {
                // Avoid rotation related to y axis since it is "saved" for pitch
                return {bearingDelta: getAngleDelta(new Point(lastPoint.x, currentPoint.y), currentPoint, center)};
            }
            return {bearingDelta: (currentPoint.x - lastPoint.x) * 0.8}
        },
        moveStateManager: touchMoveStateManager,
        enable,
        assignEvents,
    });
};

export function generateOneFingerTouchPitchHandler({enable, clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
    clickTolerance: number;
    pitchDegreesPerPixelMoved?: number;
    enable?: boolean;
}): OneFingerTouchPitchHandler {
    const touchMoveStateManager = new OneFingerTouchMoveStateManager();
    return new DragHandler<DragPitchResult, TouchEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved}),
        moveStateManager: touchMoveStateManager,
        enable,
        assignEvents,
    });
};
