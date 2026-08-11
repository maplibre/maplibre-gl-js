import {now} from '../util/time_control.ts';
import {bezier, clamp, extend, evaluateZoomSnap} from '../util/util.ts';
import Point from '@mapbox/point-geometry';

import type {DragPanOptions} from './handler/shim/drag_pan.ts';
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
 * Maximum age of a recorded gesture update, in milliseconds. Older entries are dropped.
 */
const bufferCutoff = 160;

/**
 * The gesture velocity is measured over this time window, in milliseconds, ending at the
 * moment the gesture was released. Keeping the window short makes the estimate follow the
 * velocity the gesture actually had when it was released, so that slowing down or stopping
 * right before the release does not fling the map. At least the last two recorded updates
 * are always used, so that inertia also works at frame rates where fewer than two updates
 * fit into the window - their age is accounted for by the measured duration.
 */
const velocityWindow = 60;

export type InertiaBufferEntry = {
    time: number;
    settings: any;
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

    record(settings: any): void {
        this._drainInertiaBuffer();
        this._inertiaBuffer.push({time: now(), settings});
    }

    _drainInertiaBuffer(): void {
        const inertia = this._inertiaBuffer,
            currentTime = now();

        while (inertia.length > 0 && currentTime - inertia[0].time > bufferCutoff)
            inertia.shift();
    }

    /**
     * Returns the buffer entries the velocity is measured from: everything recorded within
     * {@link velocityWindow} before now, but never fewer than the last two entries.
     */
    _getVelocityEntries(): InertiaBufferEntry[] {
        const inertia = this._inertiaBuffer;
        const windowStart = now() - velocityWindow;

        let firstIndex = Math.max(0, inertia.length - 2);
        while (firstIndex > 0 && inertia[firstIndex - 1].time >= windowStart) {
            firstIndex--;
        }

        return inertia.slice(firstIndex);
    }

    _onMoveEnd(panInertiaOptions?: DragPanOptions | boolean): EaseToOptions {
        this._drainInertiaBuffer();
        const entries = this._getVelocityEntries();
        // The gesture is over, so whatever is left in the buffer must not leak into the next one.
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

        // Unlike the deltas, an anchor describes the state at the moment its entry was
        // recorded, so it counts even when it comes from the entry the interval starts at.
        for (const {settings} of entries) {
            if (settings.around) deltas.around = settings.around;
            if (settings.pinchAround) deltas.pinchAround = settings.pinchAround;
        }

        // The delta of an entry describes the movement which happened before it was recorded,
        // so the first entry only marks the start of the measured interval and its delta
        // belongs to the time before it.
        for (const {settings} of entries.slice(1)) {
            deltas.zoom += settings.zoomDelta || 0;
            deltas.bearing += settings.bearingDelta || 0;
            deltas.pitch += settings.pitchDelta || 0;
            deltas.roll += settings.rollDelta || 0;
            if (settings.panDelta) deltas.pan._add(settings.panDelta);
        }

        // Entries without any delta are recorded during terrain gestures, so the measured
        // interval can hold no movement at all. Returning ease options for that would start a
        // camera animation which moves nothing and only delays `moveend`.
        if (!deltas.pan.mag() && !deltas.zoom && !deltas.bearing && !deltas.pitch && !deltas.roll) {
            this.clear();
            return;
        }

        // Measure up to the moment of the release and not up to the last recorded movement:
        // a gesture which was held still before being released has a longer duration and
        // therefore a lower velocity, down to no inertia at all.
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
