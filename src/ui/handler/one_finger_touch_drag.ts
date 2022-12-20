import type Point from '@mapbox/point-geometry';

import {DragMoveHandler, DragRotateResult, DragPitchResult, DragHandler} from './drag_handler';
import {OneFingerTouchMoveStateManager} from './drag_move_state_manager';

export interface OneFingerTouchRotateHandler extends DragMoveHandler<DragRotateResult, TouchEvent> {}
export interface OneFingerTouchPitchHandler extends DragMoveHandler<DragPitchResult, TouchEvent> {}

const assignEvents = (handler: DragHandler<DragRotateResult, TouchEvent>) => {
    handler.touchstart = handler.dragStart;
    handler.touchmoveWindow = handler.dragMove;
    handler.touchend = handler.dragEnd;
};

export const generateOneFingerTouchRotationHandler = ({enable, clickTolerance, bearingDegreesPerPixelMoved = 0.8}: {
    clickTolerance: number;
    bearingDegreesPerPixelMoved?: number;
    enable?: boolean;
}): OneFingerTouchRotateHandler => {
    const touchMoveStateManager = new OneFingerTouchMoveStateManager();
    return new DragHandler<DragRotateResult, TouchEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({bearingDelta: (point.x - lastPoint.x) * bearingDegreesPerPixelMoved}),
        moveStateManager: touchMoveStateManager,
        enable,
        assignEvents,
    });
};

export const generateOneFingerTouchPitchHandler = ({enable, clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
    clickTolerance: number;
    pitchDegreesPerPixelMoved?: number;
    enable?: boolean;
}): OneFingerTouchPitchHandler => {
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
