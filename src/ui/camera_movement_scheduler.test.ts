import {test, expect, vi, type Mock} from 'vitest';
import {CameraMovementScheduler, type MovementSegmentOptions} from './camera_movement_scheduler.ts';
import {MapMovementEvent} from './events.ts';
import {TaskQueue} from '../util/task_queue.ts';
import * as timeControl from '../util/time_control.ts';

function createScheduler(queue: TaskQueue): CameraMovementScheduler {
    return new CameraMovementScheduler({
        requestRenderFrame: (callback) => queue.add(callback),
        cancelRenderFrame: (id) => queue.remove(id)
    });
}

function spyOnMovementEvents(scheduler: CameraMovementScheduler): Mock<(event: MapMovementEvent) => void> {
    const listener = vi.fn<(event: MapMovementEvent) => void>();
    for (const type of ['movestart', 'move', 'moveend', 'zoomstart', 'zoom', 'zoomend', 'rotatestart', 'rotateend'] as const) {
        scheduler.on(type, listener);
    }
    return listener;
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
    const scheduler = createScheduler(new TaskQueue());
    const listener = spyOnMovementEvents(scheduler);
    const first = {onFrame: vi.fn(), onFinish: vi.fn()};

    scheduler.scheduleSegment(first, createOptions({easeId: 'keyboard', axes: {zoom: true, rotate: false, pitch: false, roll: false}}));
    scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({easeId: 'keyboard', axes: {zoom: true, rotate: true, pitch: false, roll: false}}));

    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(['movestart', 'zoomstart', 'rotatestart']);
    expect(first.onFinish).toHaveBeenCalledTimes(1);
    expect(scheduler.isMovingAxis('zoom')).toBe(true);
});

test('a listener that throws drops the events still queued', () => {
    const scheduler = createScheduler(new TaskQueue());
    scheduler.on('move', () => { throw new Error('listener failed'); });
    const listener = spyOnMovementEvents(scheduler);

    expect(() => scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({duration: 0}))).toThrow('listener failed');
    scheduler.fireAfterQueued([new MapMovementEvent('movestart')]);

    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(['movestart', 'movestart']);
});

test('a segment scheduled from a listener of the last frame of another runs on instead of being finished', () => {
    const queue = new TaskQueue();
    const scheduler = createScheduler(queue);
    const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
    const first = {onFrame: vi.fn(), onFinish: vi.fn()};
    const second = {onFrame: vi.fn(), onFinish: vi.fn()};

    scheduler.scheduleSegment(first, createOptions({duration: 10}));
    scheduler.once('move', () => scheduler.scheduleSegment(second, createOptions({duration: 10})));
    now.mockReturnValue(10);
    queue.run();

    expect(first.onFinish).toHaveBeenCalledTimes(1);
    expect(second.onFinish).not.toHaveBeenCalled();
    expect(scheduler.isMoving()).toBe(true);

    now.mockReturnValue(20);
    queue.run();

    expect(second.onFrame).toHaveBeenCalledExactlyOnceWith(1);
    expect(second.onFinish).toHaveBeenCalledTimes(1);
});

test('a segment interrupted by a listener of its frame drops the rest of the frame\'s events and ends before the next starts', () => {
    const queue = new TaskQueue();
    const scheduler = createScheduler(queue);
    const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
    const listener = spyOnMovementEvents(scheduler);

    scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({axes: {zoom: true, rotate: false, pitch: false, roll: false}}));
    scheduler.once('move', () => scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({})));
    now.mockReturnValue(50);
    queue.run();

    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(['movestart', 'zoomstart', 'move', 'zoomend', 'moveend', 'movestart']);
});

test('a segment scheduled from a listener of a frame takes over its render frame request instead of adding one', () => {
    const queue = new TaskQueue();
    const scheduler = createScheduler(queue);
    const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
    const second = {onFrame: vi.fn(), onFinish: vi.fn()};

    scheduler.scheduleSegment({onFrame: vi.fn(), onFinish: vi.fn()}, createOptions({}));
    scheduler.once('move', () => scheduler.scheduleSegment(second, createOptions({})));
    now.mockReturnValue(10);
    queue.run();
    now.mockReturnValue(20);
    queue.run();

    expect(second.onFrame).toHaveBeenCalledTimes(1);
});

test('a render frame that arrives after its segment was interrupted does nothing', () => {
    const queue = new TaskQueue();
    const scheduler = new CameraMovementScheduler({
        requestRenderFrame: (callback) => queue.add(callback),
        cancelRenderFrame: () => {}
    });
    const listener = spyOnMovementEvents(scheduler);
    const segment = {onFrame: vi.fn(), onFinish: vi.fn()};

    scheduler.scheduleSegment(segment, createOptions({}));
    scheduler.interrupt();
    queue.run();

    expect(segment.onFrame).not.toHaveBeenCalled();
    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(['movestart', 'moveend']);
});
