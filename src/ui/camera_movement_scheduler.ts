import {now} from '../util/time_control.ts';
import {Evented} from '../util/evented.ts';
import {MapMovementEvent} from './events.ts';

import type {MapEventType} from './events.ts';
import type {TaskID} from '../util/task_queue.ts';

/**
 * A part of the camera, besides its center, that a movement can change. Each has start, during and end events
 * of its own, named after it: `zoomstart`, `zoom`, `zoomend` and so on.
 */
export type MovementAxis = 'zoom' | 'rotate' | 'pitch' | 'roll';

const MOVEMENT_AXES: readonly MovementAxis[] = ['zoom', 'rotate', 'pitch', 'roll'];

/** Which parts of the camera a movement changes. */
export type MovementAxes = Record<MovementAxis, boolean>;

function noMovementAxes(): MovementAxes {
    return {zoom: false, rotate: false, pitch: false, roll: false};
}

/**
 * @internal
 * What one timed piece of a camera movement does to the camera, as an `easeTo` or a `flyTo` hands it to
 * {@link CameraMovementScheduler.scheduleSegment} together with its {@link MovementSegmentOptions}. A movement is
 * one segment, or several when each continues the movement of the one before it, see
 * {@link MovementSegmentOptions.easeId}. Everything a frame needs lives in the segment itself, so a segment started
 * from one of its listeners cannot change what it draws.
 */
export interface MovementSegment {
    /**
     * Moves the camera to the eased progress `k`, 0 to 1. It fires no events: the scheduler fires them once the
     * frame is done.
     */
    onFrame(k: number): void;
    /** Runs once when the segment ends, whether it ran to the end or something interrupted it. */
    onFinish(): void;
}

/**
 * @internal
 * How the scheduler runs a {@link MovementSegment}, and which events it fires for it.
 */
export type MovementSegmentOptions = {
    /** In milliseconds. A segment of 0 runs its only frame within {@link CameraMovementScheduler.scheduleSegment}. */
    duration: number;
    easing: (t: number) => number;
    /** The parts of the camera the segment changes, for which its movement fires start, during and end events. */
    axes: MovementAxes;
    /** The properties every event the segment fires carries. */
    eventData?: Record<string, unknown>;
    /**
     * A segment that replaces one with the same id continues its movement: the replaced one fires no end events, and
     * this one fires start events only for the parts of the camera the movement did not change yet.
     */
    easeId?: string;
    /** Whether the segment continues a movement whose `movestart` someone else fired, such as a gesture's inertia. */
    noMoveStart?: boolean;
};

/** A segment the scheduler runs, with the options it was started with. */
type RunningSegment = {
    segment: MovementSegment;
    options: MovementSegmentOptions;
    /** When the segment started, in the time of {@link now}. */
    startTime: number;
};

type QueuedEvent = {
    event: MapMovementEvent;
    /** The segment whose frame fired the event, so that the events of a frame it never gets to finish can be dropped. */
    frameOf?: RunningSegment;
};

/**
 * @internal
 * The map's render loop, on which the scheduler runs each frame of a segment.
 */
export type RenderLoop = {
    /** Runs the callback before the next frame is rendered, and returns an id to cancel it with. */
    requestRenderFrame: (callback: () => void) => TaskID;
    cancelRenderFrame: (id: TaskID) => void;
};

/**
 * @internal
 * Runs the segments of the camera's movements and fires their movement events, which reach the camera's listeners
 * through the camera being its evented parent.
 *
 * At most one segment runs, on at most one render frame task, and every frame reads which segment is current when it
 * runs rather than when it was requested. A segment started or stopped from a listener therefore replaces or ends
 * what the next frame does, and never runs next to the one it interrupted.
 *
 * Events go through one queue that only one loop delivers. A call from a listener changes the camera at once, while
 * the events it causes are delivered after the event being dispatched. So an interrupted segment's end events always
 * come before the start events of the one that interrupted it, and the events of a frame it never finishes are
 * dropped: no `zoom` can follow its `zoomend`, and nothing it fires follows its `moveend`.
 */
export class CameraMovementScheduler extends Evented<MapEventType> {
    private readonly _renderLoop: RenderLoop;
    private _current: RunningSegment | null = null;
    private _taskId: TaskID | null = null;
    /** The parts of the camera the movement in progress changes, whose start events have been queued. */
    private _movingAxes: MovementAxes = noMovementAxes();
    private _queue: QueuedEvent[] = [];
    private _dispatching = false;

    constructor(renderLoop: RenderLoop) {
        super();
        this._renderLoop = renderLoop;
    }

    /**
     * Whether a movement is in progress. A movement lasts as long as a segment runs, and a segment that continues
     * another's movement replaces it without a gap, see {@link MovementSegmentOptions.easeId}.
     */
    isMoving(): boolean {
        return this._current !== null;
    }

    isMovingAxis(axis: MovementAxis): boolean {
        return this._movingAxes[axis];
    }

    /**
     * Whether the running segment is continued by a segment with this `easeId`, which carries on its movement instead
     * of interrupting it, see {@link MovementSegmentOptions.easeId}.
     */
    isContinuedBy(easeId?: string): boolean {
        return !!easeId && this._current?.options.easeId === easeId;
    }

    /**
     * Makes a segment the running one and schedules its frames on the render loop. The segment that ran until now is
     * interrupted at once, its end events queued ahead of the new segment's start events, unless the new one continues
     * its movement. A segment with a duration of 0 runs its frame and ends within this call.
     */
    scheduleSegment(segment: MovementSegment, options: MovementSegmentOptions): void {
        const continuing = this.isContinuedBy(options.easeId);
        if (continuing) this._drop(this._current);
        else this.interrupt();

        const running = {segment, options, startTime: now()};
        this._current = running;
        this._queueStartEvents(options, continuing);

        if (options.duration === 0) {
            this._step(running, 1, true);
            return;
        }
        this._requestFrame();
        this._flush();
    }

    /** Ends the running segment where it is and fires its end events. */
    interrupt(): void {
        const running = this._current;
        if (!running) return;

        this._drop(running);
        this._queueEndEvents(running.options.eventData);
        this._flush();
    }

    /**
     * Fires events that are not a segment's, such as those of a `jumpTo`, whose movement has no frames, after the
     * events already queued, so that they follow the end events of a segment they interrupt.
     */
    fireAfterQueued(events: MapMovementEvent[]): void {
        for (const event of events) this._queue.push({event});
        this._flush();
    }

    private readonly _tick = (): void => {
        this._taskId = null;
        const running = this._current;
        if (!running) return;

        const {duration, easing} = running.options;
        const t = Math.min((now() - running.startTime) / duration, 1);
        this._step(running, easing(t), t === 1);
    };

    /**
     * Draws a frame of the segment and delivers its events. The last frame ends the segment only once its events are
     * delivered, and only if none of their listeners interrupted it.
     */
    private _step(running: RunningSegment, k: number, last: boolean): void {
        running.segment.onFrame(k);
        this._queueFrameEvents(running);
        if (!last) this._requestFrame();
        this._flush();

        if (!last || this._current !== running) return;
        this._end(running);
        this._queueEndEvents(running.options.eventData);
        this._flush();
    }

    /**
     * Ends a segment before its last frame: cancels the frame it asked for and drops the events of a frame of it that
     * are not delivered yet.
     */
    private _drop(running: RunningSegment): void {
        this._cancelFrame();
        this._queue = this._queue.filter(queued => queued.frameOf !== running);
        this._end(running);
    }

    private _end(running: RunningSegment): void {
        this._current = null;
        running.segment.onFinish();
    }

    private _queueEndEvents(eventData: Record<string, unknown> | undefined): void {
        const axes = this._movingAxes;
        this._movingAxes = noMovementAxes();

        for (const axis of MOVEMENT_AXES) {
            if (axes[axis]) this._queue.push({event: new MapMovementEvent(`${axis}end`, eventData)});
        }
        this._queue.push({event: new MapMovementEvent('moveend', eventData)});
    }

    /**
     * @param continuing - whether the segment continues the movement of the one it replaced, which fired its
     * `movestart` and the start events of the parts of the camera it changed
     */
    private _queueStartEvents(options: MovementSegmentOptions, continuing: boolean): void {
        if (!continuing && !options.noMoveStart) {
            this._queue.push({event: new MapMovementEvent('movestart', options.eventData)});
        }

        for (const axis of MOVEMENT_AXES) {
            if (!options.axes[axis] || this._movingAxes[axis]) continue;
            this._movingAxes[axis] = true;
            this._queue.push({event: new MapMovementEvent(`${axis}start`, options.eventData)});
        }
    }

    private _queueFrameEvents(running: RunningSegment): void {
        const {eventData} = running.options;
        this._queue.push({event: new MapMovementEvent('move', eventData), frameOf: running});
        for (const axis of MOVEMENT_AXES) {
            if (this._movingAxes[axis]) this._queue.push({event: new MapMovementEvent(axis, eventData), frameOf: running});
        }
    }

    private _requestFrame(): void {
        if (this._taskId === null) this._taskId = this._renderLoop.requestRenderFrame(this._tick);
    }

    private _cancelFrame(): void {
        if (this._taskId === null) return;
        this._renderLoop.cancelRenderFrame(this._taskId);
        this._taskId = null;
    }

    /**
     * Delivers the queued events, unless an outer call is delivering them already, in which case that call delivers
     * the ones queued now as well. A listener that throws drops the events still queued, as they describe a movement
     * the camera can no longer finish in order.
     */
    private _flush(): void {
        if (this._dispatching) return;
        this._dispatching = true;
        try {
            while (this._queue.length) this.fire(this._queue.shift().event);
        } catch (e) {
            this._queue = [];
            throw e;
        } finally {
            this._dispatching = false;
        }
    }
}
