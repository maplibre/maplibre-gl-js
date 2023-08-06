import Point from '@mapbox/point-geometry';
import {DOM} from '../../util/dom';
import type {Map} from '../map';
import {Handler} from '../handler_manager';

/**
 * An options object sent to the enable function of some of the handlers
 */
export type AroundCenterOptions = {
    /**
     * If "center" is passed, map will zoom around the center of map
     */
    around: 'center';
}

/**
 * The `TwoFingersTouchHandler`s allows the user to zoom, pitch and rotate the map using two fingers
 *
 * @group Handlers
 */
abstract class TwoFingersTouchHandler implements Handler {

    _enabled: boolean;
    _active: boolean;
    _firstTwoTouches: [number, number];
    _vector: Point;
    _startVector: Point;
    _aroundCenter: boolean;

    /** @internal */
    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
        delete this._firstTwoTouches;
    }

    abstract _start(points: [Point, Point]);
    abstract _move(points: [Point, Point], pinchAround: Point, e: TouchEvent);

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        //log('touchstart', points, e.target.innerHTML, e.targetTouches.length ? e.targetTouches[0].target.innerHTML: undefined);
        if (this._firstTwoTouches || mapTouches.length < 2) return;

        this._firstTwoTouches = [
            mapTouches[0].identifier,
            mapTouches[1].identifier
        ];

        // implemented by child classes
        this._start([points[0], points[1]]);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._firstTwoTouches) return;

        e.preventDefault();

        const [idA, idB] = this._firstTwoTouches;
        const a = getTouchById(mapTouches, points, idA);
        const b = getTouchById(mapTouches, points, idB);
        if (!a || !b) return;
        const pinchAround = this._aroundCenter ? null : a.add(b).div(2);

        // implemented by child classes
        return this._move([a, b], pinchAround, e);

    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._firstTwoTouches) return;

        const [idA, idB] = this._firstTwoTouches;
        const a = getTouchById(mapTouches, points, idA);
        const b = getTouchById(mapTouches, points, idB);
        if (a && b) return;

        if (this._active) DOM.suppressClick();

        this.reset();
    }

    touchcancel() {
        this.reset();
    }

    /**
     * Enables the "drag to pitch" interaction.
     *
     * @example
     * ```ts
     * map.touchPitch.enable();
     * ```
     */
    enable(options?: AroundCenterOptions | boolean | null) {
        this._enabled = true;
        this._aroundCenter = !!options && (options as AroundCenterOptions).around === 'center';
    }

    /**
     * Disables the "drag to pitch" interaction.
     *
     * @example
     * ```ts
     * map.touchPitch.disable();
     * ```
     */
    disable() {
        this._enabled = false;
        this.reset();
    }

    /**
     * Returns a Boolean indicating whether the "drag to pitch" interaction is enabled.
     *
     * @returns  `true` if the "drag to pitch" interaction is enabled.
     */
    isEnabled() {
        return this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "drag to pitch" interaction is active, i.e. currently being used.
     *
     * @returns `true` if the "drag to pitch" interaction is active.
     */
    isActive() {
        return this._active;
    }
}

function getTouchById(mapTouches: Array<Touch>, points: Array<Point>, identifier: number) {
    for (let i = 0; i < mapTouches.length; i++) {
        if (mapTouches[i].identifier === identifier) return points[i];
    }
}

/* ZOOM */

const ZOOM_THRESHOLD = 0.1;

function getZoomDelta(distance, lastDistance) {
    return Math.log(distance / lastDistance) / Math.LN2;
}

/**
 * The `TwoFingersTouchHandler`s allows the user to zoom the map two fingers
 *
 * @group Handlers
 */
export class TwoFingersTouchZoomHandler extends TwoFingersTouchHandler {

    _distance: number;
    _startDistance: number;

    reset() {
        super.reset();
        delete this._distance;
        delete this._startDistance;
    }

    _start(points: [Point, Point]) {
        this._startDistance = this._distance = points[0].dist(points[1]);
    }

    _move(points: [Point, Point], pinchAround: Point) {
        const lastDistance = this._distance;
        this._distance = points[0].dist(points[1]);
        if (!this._active && Math.abs(getZoomDelta(this._distance, this._startDistance)) < ZOOM_THRESHOLD) return;
        this._active = true;
        return {
            zoomDelta: getZoomDelta(this._distance, lastDistance),
            pinchAround
        };
    }
}

/* ROTATE */

const ROTATION_THRESHOLD = 25; // pixels along circumference of touch circle

function getBearingDelta(a, b) {
    return a.angleWith(b) * 180 / Math.PI;
}

/**
 * The `TwoFingersTouchHandler`s allows the user to rotate the map two fingers
 *
 * @group Handlers
 */
export class TwoFingersTouchRotateHandler extends TwoFingersTouchHandler {
    _minDiameter: number;

    reset() {
        super.reset();
        delete this._minDiameter;
        delete this._startVector;
        delete this._vector;
    }

    _start(points: [Point, Point]) {
        this._startVector = this._vector = points[0].sub(points[1]);
        this._minDiameter = points[0].dist(points[1]);
    }

    _move(points: [Point, Point], pinchAround: Point) {
        const lastVector = this._vector;
        this._vector = points[0].sub(points[1]);

        if (!this._active && this._isBelowThreshold(this._vector)) return;
        this._active = true;

        return {
            bearingDelta: getBearingDelta(this._vector, lastVector),
            pinchAround
        };
    }

    _isBelowThreshold(vector: Point) {
        /*
         * The threshold before a rotation actually happens is configured in
         * pixels along the circumference of the circle formed by the two fingers.
         * This makes the threshold in degrees larger when the fingers are close
         * together and smaller when the fingers are far apart.
         *
         * Use the smallest diameter from the whole gesture to reduce sensitivity
         * when pinching in and out.
         */

        this._minDiameter = Math.min(this._minDiameter, vector.mag());
        const circumference = Math.PI * this._minDiameter;
        const threshold = ROTATION_THRESHOLD / circumference * 360;

        const bearingDeltaSinceStart = getBearingDelta(vector, this._startVector);
        return Math.abs(bearingDeltaSinceStart) < threshold;
    }
}

/* PITCH */

function isVertical(vector) {
    return Math.abs(vector.y) > Math.abs(vector.x);
}

const ALLOWED_SINGLE_TOUCH_TIME = 100;

/**
 * The `TwoFingersTouchPitchHandler` allows the user to pitch the map by dragging up and down with two fingers.
 *
 * @group Handlers
 */
export class TwoFingersTouchPitchHandler extends TwoFingersTouchHandler {

    _valid: boolean | void;
    _firstMove: number;
    _lastPoints: [Point, Point];
    _map: Map;
    _currentTouchCount: number;

    constructor(map: Map) {
        super();
        this._map = map;
    }

    reset() {
        super.reset();
        this._valid = undefined;
        delete this._firstMove;
        delete this._lastPoints;
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        super.touchstart(e, points, mapTouches);
        this._currentTouchCount = mapTouches.length;
    }

    _start(points: [Point, Point]) {
        this._lastPoints = points;
        if (isVertical(points[0].sub(points[1]))) {
            // fingers are more horizontal than vertical
            this._valid = false;

        }
    }

    _move(points: [Point, Point], center: Point, e: TouchEvent) {
        // If cooperative gestures is enabled, we need a 3-finger minimum for this gesture to register
        if (this._map._cooperativeGestures && this._currentTouchCount < 3) {
            return;
        }

        const vectorA = points[0].sub(this._lastPoints[0]);
        const vectorB = points[1].sub(this._lastPoints[1]);

        this._valid = this.gestureBeginsVertically(vectorA, vectorB, e.timeStamp);
        if (!this._valid) return;

        this._lastPoints = points;
        this._active = true;
        const yDeltaAverage = (vectorA.y + vectorB.y) / 2;
        const degreesPerPixelMoved = -0.5;
        return {
            pitchDelta: yDeltaAverage * degreesPerPixelMoved
        };
    }

    gestureBeginsVertically(vectorA: Point, vectorB: Point, timeStamp: number) {
        if (this._valid !== undefined) return this._valid;

        const threshold = 2;
        const movedA = vectorA.mag() >= threshold;
        const movedB = vectorB.mag() >= threshold;

        // neither finger has moved a meaningful amount, wait
        if (!movedA && !movedB) return;

        // One finger has moved and the other has not.
        // If enough time has passed, decide it is not a pitch.
        if (!movedA || !movedB) {
            if (this._firstMove === undefined) {
                this._firstMove = timeStamp;
            }

            if (timeStamp - this._firstMove < ALLOWED_SINGLE_TOUCH_TIME) {
                // still waiting for a movement from the second finger
                return undefined;
            } else {
                return false;
            }
        }

        const isSameDirection = vectorA.y > 0 === vectorB.y > 0;
        return isVertical(vectorA) && isVertical(vectorB) && isSameDirection;
    }
}
