import type Point from '@mapbox/point-geometry';

import DOM from '../../util/dom';
import {DragMoveHandler, DragPanResult, DragRotateResult, DragPitchResult, DragHandler} from './drag_handler';
import {MouseMoveStateManager} from './drag_move_state_manager';

export interface MousePanHandler extends DragMoveHandler<DragPanResult, MouseEvent> {}
export interface MouseRotateHandler extends DragMoveHandler<DragRotateResult, MouseEvent> {}
export interface MousePitchHandler extends DragMoveHandler<DragPitchResult, MouseEvent> {}

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export const generateMousePanHandler = ({clickTolerance,}: {
    clickTolerance: number;
}): MousePanHandler => {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectButton: (e: MouseEvent) => DOM.mouseButton(e) === LEFT_BUTTON && !e.ctrlKey,
    });
    return new DragHandler<DragPanResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({around: point, panDelta: point.sub(lastPoint)}),
        activateOnStart: true,
        moveStateManager: mouseMoveStateManager,
    });
};

export const generateMouseRotationHandler = ({clickTolerance, bearingDegreesPerPixelMoved = 0.8}: {
    clickTolerance: number;
    bearingDegreesPerPixelMoved?: number;
}): MouseRotateHandler => {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectButton: (e: MouseEvent): boolean =>
            (DOM.mouseButton(e) === LEFT_BUTTON && e.ctrlKey) ||
            (DOM.mouseButton(e) === RIGHT_BUTTON),
    });
    return new DragHandler<DragRotateResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({bearingDelta: (point.x - lastPoint.x) * bearingDegreesPerPixelMoved}),
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        preventContextMenu: true,
        moveStateManager: mouseMoveStateManager,
    });
};

export const generateMousePitchHandler = ({clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
    clickTolerance: number;
    pitchDegreesPerPixelMoved?: number;
}): MousePitchHandler => {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectButton: (e: MouseEvent): boolean =>
            (DOM.mouseButton(e) === LEFT_BUTTON && e.ctrlKey) ||
            (DOM.mouseButton(e) === RIGHT_BUTTON),
    });
    return new DragHandler<DragPitchResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point) =>
            ({pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved}),
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        preventContextMenu: true,
        moveStateManager: mouseMoveStateManager,
    });
};
