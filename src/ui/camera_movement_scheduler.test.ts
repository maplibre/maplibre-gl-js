import {test, expect, vi, type Mock} from 'vitest';
import {CameraMovementScheduler, type MovementSegmentOptions} from './camera_movement_scheduler.ts';
import {MapMovementEvent} from './events.ts';
import {TaskQueue} from '../util/task_queue.ts';

function createScheduler(): CameraMovementScheduler {
    const queue = new TaskQueue();
    return new CameraMovementScheduler({
        requestRenderFrame: (callback) => queue.add(callback),
        cancelRenderFrame: (id) => queue.remove(id)
    });
}

function spyOnMovementEvents(scheduler: CameraMovementScheduler): Mock<(event: MapMovementEvent) => void> {
    const listener = vi.fn<(event: MapMovementEvent) => void>();
    for (const type of ['movestart', 'move', 'moveend', 'zoomstart', 'zoomend', 'rotatestart', 'rotateend'] as const) {
        scheduler.on(type, listener);
    }
    return listener;
}

function firedTypes(listener: Mock<(event: MapMovementEvent) => void>): string[] {
    return listener.mock.calls.map(([event]) => event.type);
}

function createOptions(options: Partial<MovementSegmentOptions>): MovementSegmentOptions {
    return {
        duration: 100,
        easing: t => t,
        axes: {zoom: false, rotate: false, pitch: false, roll: false},
        ...options
    };
}

test('a segment with the easeId of the one it interrupts continues its movement', () => {
    const scheduler = createScheduler();
    const listener = spyOnMovementEvents(scheduler);
    const first = {onFrame: vi.fn(), onFinish: vi.fn()};

    scheduler.scheduleSegment(first, createOptions({easeId: 'keyboard', axes: {zoom: true, rotate: false, pitch: false, roll: false}}));
    scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({easeId: 'keyboard', axes: {zoom: true, rotate: true, pitch: false, roll: false}}));

    expect(firedTypes(listener)).toEqual(['movestart', 'zoomstart', 'rotatestart']);
    expect(first.onFinish).toHaveBeenCalledTimes(1);
    expect(scheduler.isMovingAxis('zoom')).toBe(true);
});

test('a listener that throws drops the events still queued', () => {
    const scheduler = createScheduler();
    scheduler.on('move', () => { throw new Error('listener failed'); });
    const listener = spyOnMovementEvents(scheduler);

    expect(() => scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({duration: 0}))).toThrow('listener failed');
    scheduler.fireAfterQueued([new MapMovementEvent('movestart')]);

    expect(firedTypes(listener)).toEqual(['movestart', 'movestart']);
});
