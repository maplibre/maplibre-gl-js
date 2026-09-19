import {now} from '../util/time_control.ts';
import {bezier, clamp, extend, evaluateZoomSnap} from '../util/util.ts';
import Point from '@mapbox/point-geometry';

import type {DragPanOptions} from './handler/shim/drag_pan.ts';
import type {HandlerResult} from './handler_manager.ts';
import type {EaseToOptions} from './camera.ts';
import type {Map} from './map.ts';

const defaultInertiaOptions = {
    linearity: 0.3,
    easing: bezier(0, 0, 0.3, 1),
};

const defaultPanInertiaOptions = extend({
    deceleration: 2500,
    maxSpeed: 1400
}, defaultInertiaOptions);

const defaultZoomInertiaOptions = extend({
    deceleration: 20,
    maxSpeed: 1400
}, defaultInertiaOptions);

const defaultBearingInertiaOptions = extend({
    deceleration: 1000,
    maxSpeed: 360
}, defaultInertiaOptions);

const defaultPitchInertiaOptions = extend({
    deceleration: 1000,
    maxSpeed: 90
}, defaultInertiaOptions);

const defaultRollInertiaOptions = extend({
    deceleration: 1000,
    maxSpeed: 360
}, defaultInertiaOptions);

export type InertiaOptions = {
    linearity: number;
    easing: (t: number) => number;
    deceleration: number;
    maxSpeed: number;
};

/**
 * The maximum age of a recorded gesture update, in milliseconds.
 */
const BUFFER_CUTOFF = 160;

/**
 * The time window the gesture velocity is measured over, in milliseconds.
 */
const VELOCITY_WINDOW = 60;

type InertiaBufferEntry = {
    time: number;
    settings: HandlerResult;
};

export class HandlerInertia {
    _map: Map;
    _inertiaBuffer: InertiaBufferEntry[];

    constructor(map: Map) {
        this._map = map;
        this.clear();
    }

    clear(): void {
        this._inertiaBuffer = [];
    }

    record(settings: HandlerResult): void {
        this._drainInertiaBuffer();
        this._inertiaBuffer.push({time: now(), settings});
    }

    _drainInertiaBuffer(): void {
        const inertia = this._inertiaBuffer,
            currentTime = now();

        while (inertia.length > 0 && currentTime - inertia[0].time > BUFFER_CUTOFF)
            inertia.shift();
    }

    /**
     * Returns the entries the velocity is measured from: everything recorded within
     * {@link VELOCITY_WINDOW} before now, but never fewer than the last two, so that
     * inertia also works below two recorded updates per window.
     */
    _getVelocityEntries(): InertiaBufferEntry[] {
        const inertia = this._inertiaBuffer;
        const windowStart = now() - VELOCITY_WINDOW;

        let firstIndex = Math.max(0, inertia.length - 2);
        while (firstIndex > 0 && inertia[firstIndex - 1].time >= windowStart) {
            firstIndex--;
        }

        return inertia.slice(firstIndex);
    }

    /**
     * Returns the ease which continues the gesture that has just ended.
     *
     * The velocity is measured over the time up to the release and not up to the last
     * recorded movement, so that a gesture held still before being released has a lower
     * velocity, down to no inertia at all. The delta of an entry happened before it was
     * recorded, so the first entry only marks the start of the measured interval; anchors
     * are the exception, as they describe the state at the moment of their entry.
     *
     * @param panInertiaOptions - overrides for the pan inertia defaults
     * @returns the ease options, or `undefined` when the measured interval holds no
     * movement, which terrain gestures produce by recording updates without any delta
     */
    _onMoveEnd(panInertiaOptions?: DragPanOptions | boolean): EaseToOptions {
        this._drainInertiaBuffer();
        const entries = this._getVelocityEntries();
        if (entries.length < 2) {
            this.clear();
            return;
        }

        const deltas = {
            zoom: 0,
            bearing: 0,
            pitch: 0,
            roll: 0,
            pan: new Point(0, 0),
            pinchAround: undefined,
            around: undefined
        };

        for (const {settings} of entries) {
            if (settings.around) deltas.around = settings.around;
            if (settings.pinchAround) deltas.pinchAround = settings.pinchAround;
        }

        for (const {settings} of entries.slice(1)) {
            deltas.zoom += settings.zoomDelta || 0;
            deltas.bearing += settings.bearingDelta || 0;
            deltas.pitch += settings.pitchDelta || 0;
            deltas.roll += settings.rollDelta || 0;
            if (settings.panDelta) deltas.pan._add(settings.panDelta);
        }

        if (!deltas.pan.mag() && !deltas.zoom && !deltas.bearing && !deltas.pitch && !deltas.roll) {
            this.clear();
            return;
        }

        const duration = now() - entries[0].time;

        const easeOptions = {} as any;

        if (deltas.pan.mag()) {
            const result = calculateEasing(deltas.pan.mag(), duration, extend({}, defaultPanInertiaOptions, panInertiaOptions || {}));
            const finalPan = deltas.pan.mult(result.amount / deltas.pan.mag());
            const computedEaseOptions = this._map._camera.cameraHelper.handlePanInertia(finalPan, this._map._camera.transform);
            easeOptions.center = computedEaseOptions.easingCenter;
            easeOptions.offset = computedEaseOptions.easingOffset;
            extendDuration(easeOptions, result);
        }

        if (deltas.zoom) {
            const result = calculateEasing(deltas.zoom, duration, defaultZoomInertiaOptions);
            easeOptions.zoom = evaluateZoomSnap(this._map.getZoom() + result.amount, this._map.getZoomSnap(), result.amount);
            extendDuration(easeOptions, result);
        }

        if (deltas.bearing) {
            const result = calculateEasing(deltas.bearing, duration, defaultBearingInertiaOptions);
            easeOptions.bearing = this._map.getBearing() + clamp(result.amount, -179, 179);
            extendDuration(easeOptions, result);
        }

        if (deltas.pitch) {
            const result = calculateEasing(deltas.pitch, duration, defaultPitchInertiaOptions);
            easeOptions.pitch = this._map.getPitch() + result.amount;
            extendDuration(easeOptions, result);
        }

        if (deltas.roll) {
            const result = calculateEasing(deltas.roll, duration, defaultRollInertiaOptions);
            easeOptions.roll = this._map.getRoll() + clamp(result.amount, -179, 179);
            extendDuration(easeOptions, result);
        }

        if (easeOptions.zoom || easeOptions.bearing) {
            const last = deltas.pinchAround === undefined ? deltas.around : deltas.pinchAround;
            easeOptions.around = last ? this._map.unproject(last) : this._map.getCenter();
        }

        this.clear();
        return extend(easeOptions, {
            noMoveStart: true
        });

    }
}

// Unfortunately zoom, bearing, etc can't have different durations and easings so
// we need to choose one. We use the longest duration and it's corresponding easing.
function extendDuration(easeOptions, result) {
    if (!easeOptions.duration || easeOptions.duration < result.duration) {
        easeOptions.duration = result.duration;
        easeOptions.easing = result.easing;
    }
}

function calculateEasing(amount, inertiaDuration: number, inertiaOptions) {
    const {maxSpeed, linearity, deceleration} = inertiaOptions;
    const speed = clamp(
        amount * linearity / (inertiaDuration / 1000),
        -maxSpeed,
        maxSpeed);
    const duration = Math.abs(speed) / (deceleration * linearity);
    return {
        easing: inertiaOptions.easing,
        duration: duration * 1000,
        amount: speed * (duration / 2)
    };
}
