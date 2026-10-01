import Point from '@mapbox/point-geometry';
import {type DragMoveHandler, type DragPanResult, type DragRotateResult, type DragPitchResult, DragHandler, type DragRollResult} from './drag_handler.ts';
import {MouseMoveStateManager} from './drag_move_state_manager.ts';
import {getAngleDelta} from '../../util/util.ts';

/**
 * `MousePanHandler` allows the user to pan the map by clicking and dragging
 */
export interface MousePanHandler extends DragMoveHandler<DragPanResult, MouseEvent> {}
/**
 * `MouseRotateHandler` allows the user to rotate the map by clicking and dragging
 */
export interface MouseRotateHandler extends DragMoveHandler<DragRotateResult, MouseEvent> {}
/**
 * `MousePitchHandler` allows the user to zoom the map by pitching
 */
export interface MousePitchHandler extends DragMoveHandler<DragPitchResult, MouseEvent> {}
/**
 * `MouseRollHandler` allows the user to roll the camera by holding `Ctrl`, right-clicking and dragging
 */
export interface MouseRollHandler extends DragMoveHandler<DragRollResult, MouseEvent> {}

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

/** Gives a move around the pointer the drag's start point as its `around`, but not a move without a change, which would make the handler active. */
function aroundDragStart<T extends DragRotateResult | DragPitchResult | DragRollResult>(result: T, around: 'center' | 'pointer', startPoint: Point): T {
    if (around === 'center' || !(result.bearingDelta || result.pitchDelta || result.rollDelta)) return result;
    return {...result, around: startPoint};
}

const assignEvents = <T extends DragPanResult | DragRotateResult | DragPitchResult | DragRollResult>(handler: DragHandler<T, MouseEvent>): void => {
    handler.mousedown = handler.dragStart;
    handler.mousemoveWindow = handler.dragMove;
    handler.mouseup = handler.dragEnd;
    handler.contextmenu = (e: MouseEvent) => {
        e.preventDefault();
    };
};

export function generateMousePanHandler({enable, clickTolerance}: {
    clickTolerance: number;
    enable?: boolean;
}): MousePanHandler {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent) => e.button === LEFT_BUTTON && !e.ctrlKey,
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

export function generateMouseRotationHandler({enable, clickTolerance, aroundCenter = true, minPixelCenterThreshold = 100, rotateSpeed = 0.8}: {
    clickTolerance: number;
    enable?: boolean;
    aroundCenter?: boolean;
    minPixelCenterThreshold?: number;
    /**
     * Degrees the bearing changes per pixel of horizontal drag.
     * @defaultValue 0.8
     */
    rotateSpeed?: number;
}, getCenter: () => Point, getAround?: () => 'center' | 'pointer'): MouseRotateHandler {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent): boolean =>
            (e.button === LEFT_BUTTON && e.ctrlKey) ||
            (e.button === RIGHT_BUTTON && !e.ctrlKey),
    });
    return new DragHandler<DragRotateResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, currentPoint: Point, startPoint: Point) => {
            if (getAround?.() === 'pointer') {
                return aroundDragStart({bearingDelta: (currentPoint.x - lastPoint.x) * rotateSpeed}, 'pointer', startPoint);
            }
            const center = getCenter();
            if (aroundCenter && Math.abs(center.y - lastPoint.y) > minPixelCenterThreshold) {
                // Avoid rotation related to y axis since it is "saved" for pitch
                return {bearingDelta: getAngleDelta(new Point(lastPoint.x, currentPoint.y), currentPoint, center)};
            }
            let bearingDelta = (currentPoint.x - lastPoint.x) * rotateSpeed;
            if (aroundCenter && currentPoint.y < center.y) {
                bearingDelta = -bearingDelta;
            }
            return {bearingDelta};
        },
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
};

export function generateMousePitchHandler({enable, clickTolerance, pitchSpeed = -0.5}: {
    clickTolerance: number;
    /**
     * Degrees the pitch changes per pixel of vertical drag.
     * @defaultValue -0.5
     */
    pitchSpeed?: number;
    enable?: boolean;
}, getAround?: () => 'center' | 'pointer'): MousePitchHandler {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent): boolean =>
            (e.button === LEFT_BUTTON && e.ctrlKey) ||
            (e.button === RIGHT_BUTTON),
    });
    return new DragHandler<DragPitchResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, point: Point, startPoint: Point) =>
            aroundDragStart({pitchDelta: (point.y - lastPoint.y) * pitchSpeed}, getAround?.() ?? 'center', startPoint),
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
};

export function generateMouseRollHandler({enable, clickTolerance, rollDegreesPerPixelMoved = 0.3}: {
    clickTolerance: number;
    rollDegreesPerPixelMoved?: number;
    enable?: boolean;
}, getCenter: () => Point, getAround?: () => 'center' | 'pointer'): MouseRollHandler {
    const mouseMoveStateManager = new MouseMoveStateManager({
        checkCorrectEvent: (e: MouseEvent): boolean =>
            (e.button === RIGHT_BUTTON && e.ctrlKey),
    });
    return new DragHandler<DragRollResult, MouseEvent>({
        clickTolerance,
        move: (lastPoint: Point, currentPoint: Point, startPoint: Point) => {
            const center = getCenter();
            let rollDelta = (currentPoint.x - lastPoint.x) * rollDegreesPerPixelMoved;
            if (currentPoint.y < center.y) {
                rollDelta = -rollDelta;
            }
            return aroundDragStart({rollDelta}, getAround?.() ?? 'center', startPoint);
        },
        // prevent browser context menu when necessary; we don't allow it with roll
        // because we can't discern roll gesture start from contextmenu on Mac
        moveStateManager: mouseMoveStateManager,
        enable,
        assignEvents,
    });
};
