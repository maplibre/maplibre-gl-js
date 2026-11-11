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

/** Movement axes of which none is moving. */
function idleMovementAxes(): MovementAxes {
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
    /** Whether someone else fired the movement's `movestart` already, such as the gesture the segment is the inertia of. */
    movestartFired?: boolean;
};

/** A segment as it was scheduled, with its options and the time it started at. */
type ScheduledSegment = {
    segment: MovementSegment;
    options: MovementSegmentOptions;
    /** When the segment started, in the time of {@link now}. */
    startTime: number;
};

type PendingEvent = {
    event: MapMovementEvent;
    /**
     * The segment whose frame queued the event, set only on frame events, so that a segment stopped before they are
     * delivered can drop them.
     */
    frameSegment?: ScheduledSegment;
};

/**
 * @internal
 * The map's render loop, on which the scheduler runs each frame of a segment and the handler manager each frame of a gesture.
 */
export type RenderLoop = {
    /** Runs the callback with the frame's time stamp before the next frame is rendered, and returns an id to cancel it with. */
    requestRenderFrame: (callback: (timeStamp: number) => void) => TaskID;
    cancelRenderFrame: (id: TaskID) => void;
};

/**
 * @internal
 * Runs the segments of the camera's movements and fires their movement events, which reach the camera's listeners
 * through the camera being its evented parent.
 *
 * At most one segment runs, on at most one render frame request, and every frame reads which segment is current when
 * it runs rather than when it was requested. A segment started or stopped from a listener therefore replaces or ends
 * what the next frame does, and never runs next to the one it interrupted.
 *
 * Events wait in one list of pending events that only one loop delivers. A call from a listener changes the camera at
 * once, while the events it causes are delivered after the event being delivered. So an interrupted segment's end
 * events always come before the start events of the one that interrupted it, and the events of a frame it never
 * finishes are dropped: no `zoom` can follow its `zoomend`, and nothing it fires follows its `moveend`.
 */
export class CameraMovementScheduler extends Evented<MapEventType> {
    private readonly _renderLoop: RenderLoop;
    private _currentSegment: ScheduledSegment | null = null;
    private _frameRequestId: TaskID | null = null;
    /** The parts of the camera the movement in progress changes, whose start events have been queued. */
    private _movingAxes: MovementAxes = idleMovementAxes();
    private _pendingEvents: PendingEvent[] = [];
    private _deliveringEvents = false;

    constructor(renderLoop: RenderLoop) {
        super();
        this._renderLoop = renderLoop;
    }

    /**
     * Whether a movement is in progress. A movement lasts as long as a segment runs, and a segment that continues
     * another's movement replaces it without a gap, see {@link MovementSegmentOptions.easeId}.
     */
    isMoving(): boolean {
        return this._currentSegment !== null;
    }

    isMovingAxis(axis: MovementAxis): boolean {
        return this._movingAxes[axis];
    }

    /**
     * Whether the current segment is continued by a segment with this `easeId`, which carries on its movement instead
     * of interrupting it, see {@link MovementSegmentOptions.easeId}.
     */
    isContinuedBy(easeId?: string): boolean {
        return !!easeId && this._currentSegment?.options.easeId === easeId;
    }

    /**
     * Makes a segment the current one and schedules its frames on the render loop. The segment that ran until now is
     * interrupted at once, its end events queued ahead of the new segment's start events, unless the new one continues
     * its movement. A segment with a duration of 0 runs its frame and ends within this call.
     */
    scheduleSegment(segment: MovementSegment, options: MovementSegmentOptions): void {
        const continuing = this.isContinuedBy(options.easeId);
        if (continuing) this._stopSegment(this._currentSegment);
        else this.interrupt();

        this._currentSegment = {segment, options, startTime: now()};
        this._queueStartEvents(options, continuing);

        if (options.duration === 0) {
            this._runSegmentFrame(this._currentSegment, 1, true);
            return;
        }
        this._requestRenderFrame();
        this._deliverPendingEvents();
    }

    /** Ends the current segment where it is and fires its end events. */
    interrupt(): void {
        if (!this._currentSegment) return;

        const {eventData} = this._currentSegment.options;
        this._stopSegment(this._currentSegment);
        this._queueEndEvents(eventData);
        this._deliverPendingEvents();
    }

    /**
     * Fires events that are not a segment's, such as those of a `jumpTo`, whose movement has no frames, after the
     * events already queued, so that they follow the end events of a segment they interrupt.
     */
    fireAfterQueued(events: MapMovementEvent[]): void {
        for (const event of events) this._pendingEvents.push({event});
        this._deliverPendingEvents();
    }

    private readonly _onRenderFrame = (): void => {
        this._frameRequestId = null;
        if (!this._currentSegment) return;

        const {startTime, options: {duration, easing}} = this._currentSegment;
        const t = Math.min((now() - startTime) / duration, 1);
        this._runSegmentFrame(this._currentSegment, easing(t), t === 1);
    };

    /**
     * Draws a frame of the segment and delivers its events. The last frame finishes the segment only once its events
     * are delivered, and only if none of their listeners interrupted it.
     */
    private _runSegmentFrame(scheduled: ScheduledSegment, k: number, last: boolean): void {
        scheduled.segment.onFrame(k);
        this._queueFrameEvents(scheduled);
        if (!last) this._requestRenderFrame();
        this._deliverPendingEvents();

        if (!last || this._currentSegment !== scheduled) return;
        this._finishSegment(scheduled);
        this._queueEndEvents(scheduled.options.eventData);
        this._deliverPendingEvents();
    }

    /**
     * Ends a segment before its last frame: cancels the frame it requested and drops the events of a frame of it that
     * are not delivered yet.
     */
    private _stopSegment(scheduled: ScheduledSegment): void {
        this._cancelRenderFrame();
        this._pendingEvents = this._pendingEvents.filter(pending => pending.frameSegment !== scheduled);
        this._finishSegment(scheduled);
    }

    private _finishSegment(scheduled: ScheduledSegment): void {
        this._currentSegment = null;
        scheduled.segment.onFinish();
    }

    private _requestRenderFrame(): void {
        this._frameRequestId = this._renderLoop.requestRenderFrame(this._onRenderFrame);
    }

    private _cancelRenderFrame(): void {
        if (this._frameRequestId === null) return;
        this._renderLoop.cancelRenderFrame(this._frameRequestId);
        this._frameRequestId = null;
    }

    /**
     * @param continuing - whether the segment continues the movement of the one it replaced, which fired its
     * `movestart` and the start events of the parts of the camera it changed
     */
    private _queueStartEvents(options: MovementSegmentOptions, continuing: boolean): void {
        if (!continuing && !options.movestartFired) {
            this._pendingEvents.push({event: new MapMovementEvent('movestart', options.eventData)});
        }

        for (const axis of MOVEMENT_AXES) {
            if (!options.axes[axis] || this._movingAxes[axis]) continue;
            this._movingAxes[axis] = true;
            this._pendingEvents.push({event: new MapMovementEvent(`${axis}start`, options.eventData)});
        }
    }

    private _queueFrameEvents(scheduled: ScheduledSegment): void {
        const {eventData} = scheduled.options;
        this._pendingEvents.push({event: new MapMovementEvent('move', eventData), frameSegment: scheduled});
        for (const axis of MOVEMENT_AXES) {
            if (this._movingAxes[axis]) this._pendingEvents.push({event: new MapMovementEvent(axis, eventData), frameSegment: scheduled});
        }
    }

    private _queueEndEvents(eventData: Record<string, unknown> | undefined): void {
        const axes = this._movingAxes;
        this._movingAxes = idleMovementAxes();

        for (const axis of MOVEMENT_AXES) {
            if (axes[axis]) this._pendingEvents.push({event: new MapMovementEvent(`${axis}end`, eventData)});
        }
        this._pendingEvents.push({event: new MapMovementEvent('moveend', eventData)});
    }

    /**
     * Delivers the pending events, unless an outer call is delivering them already, in which case that call delivers
     * the ones queued now as well. A listener that throws drops the events still pending, as they describe a movement
     * the camera can no longer finish in order.
     */
    private _deliverPendingEvents(): void {
        if (this._deliveringEvents) return;
        this._deliveringEvents = true;
        try {
            while (this._pendingEvents.length) this.fire(this._pendingEvents.shift().event);
        } catch (e) {
            this._pendingEvents = [];
            throw e;
        } finally {
            this._deliveringEvents = false;
        }
    }
}
