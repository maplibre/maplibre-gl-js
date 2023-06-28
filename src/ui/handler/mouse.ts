import type Point from '@mapbox/point-geometry';

import {DOM} from '../../util/dom';
import {DragMoveHandler, DragPanResult, DragRotateResult, DragPitchResult, DragHandler} from './drag_handler';
import {MouseMoveStateManager} from './drag_move_state_manager';

export interface MousePanHandler extends DragMoveHandler<DragPanResult, MouseEvent> {}
export interface MouseRotateHandler extends DragMoveHandler<DragRotateResult, MouseEvent> {}
export interface MousePitchHandler extends DragMoveHandler<DragPitchResult, MouseEvent> {}

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

const assignEvents = (handler: DragHandler<DragPanResult, MouseEvent>) => {
    handler.mousedown = handler.dragStart;
    handler.mousemoveWindow = handler.dragMove;
    handler.mouseup = handler.dragEnd;
    handler.contextmenu = function(e: MouseEvent) {
        e.preventDefault();
    };
};

export const generateMousePanHandler = ({enable, clickTolerance,}: {
    clickTolerance: number;
    enable?: boolean;
}): MousePanHandler => {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent) => DOM.mouseButton(e) === LEFT_BUTTON && !e.ctrlKey,
    });
    return new DragHandler<DragPanResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({around: point, panDelta: point.sub(lastPoint)}),
        activateOnStart: true,
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
};

export const generateMouseRotationHandler = ({enable, clickTolerance, bearingDegreesPerPixelMoved = 0.8}: {
    clickTolerance: number;
    bearingDegreesPerPixelMoved?: number;
    enable?: boolean;
}): MouseRotateHandler => {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent): boolean =>
            (DOM.mouseButton(e) === LEFT_BUTTON && e.ctrlKey) ||
            (DOM.mouseButton(e) === RIGHT_BUTTON),
    });
    return new DragHandler<DragRotateResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({bearingDelta: (point.x - lastPoint.x) * bearingDegreesPerPixelMoved}),
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
};

export const generateMousePitchHandler = ({enable, clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
    clickTolerance: number;
    pitchDegreesPerPixelMoved?: number;
    enable?: boolean;
}): MousePitchHandler => {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent): boolean =>
            (DOM.mouseButton(e) === LEFT_BUTTON && e.ctrlKey) ||
            (DOM.mouseButton(e) === RIGHT_BUTTON),
    });
    return new DragHandler<DragPitchResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved}),
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
};
