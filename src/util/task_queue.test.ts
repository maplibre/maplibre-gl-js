import TaskQueue from './task_queue';

describe('TaskQueue', () => {
    test('Calls callbacks, in order', () => {
        const q = new TaskQueue();
        let first = 0;
        let second = 0;
        q.add(() => {
            expect(++first).toBe(1);
            expect(second).toBe(0);
        });
        q.add(() => {
            expect(first).toBe(1);
            expect(++second).toBe(1);
        });
        q.run();
        expect(first).toBe(1);
        expect(second).toBe(1);
    });

    test('Allows a given callback to be queued multiple times', () => {
        const q = new TaskQueue();
        const fn = jest.fn();
        q.add(fn);
        q.add(fn);
        q.run();
        expect(fn.mock.calls.length).toBe(2);
    });

    test('Does not call a callback that was cancelled before the queue was run', () => {
        const q = new TaskQueue();
        const yes = jest.fn();
        const no = jest.fn();
        q.add(yes);
        const id = q.add(no);
        q.remove(id);
        q.run();
        expect(yes.mock.calls.length).toBe(1);
        expect(no.mock.calls.length).toBe(0);
    });

    test('Does not call a callback that was cancelled while the queue was running', () => {
        const q = new TaskQueue();
        const yes = jest.fn();
        const no = jest.fn();
        q.add(yes);
        let id; // eslint-disable-line prefer-const
        q.add(() => q.remove(id));
        id = q.add(no);
        q.run();
        expect(yes.mock.calls.length).toBe(1);
        expect(no.mock.calls.length).toBe(0);
    });

    test('Allows each instance of a multiply-queued callback to be cancelled independently', () => {
        const q = new TaskQueue();
        const cb = jest.fn();
        q.add(cb);
        const id = q.add(cb);
        q.remove(id);
        q.run();
        expect(cb.mock.calls.length).toBe(1);
    });

    test('Does not throw if a remove() is called after running the queue', () => {
        const q = new TaskQueue();
        const cb = jest.fn();
        const id = q.add(cb);
        q.run();
        q.remove(id);
        expect(cb.mock.calls.length).toBe(1);
    });

    test('Does not add tasks to the currently-running queue', () => {
        const q = new TaskQueue();
        const cb = jest.fn();
        q.add(() => q.add(cb));
        q.run();
        expect(cb.mock.calls.length).toBe(0);
        q.run();
        expect(cb.mock.calls.length).toBe(1);
    });

    test('TaskQueue#run() throws on attempted re-entrance', () => {
        const q = new TaskQueue();
        q.add(() => q.run());
        expect(() => q.run()).toThrow();
    });

    test('TaskQueue#clear() prevents queued task from being executed', () => {
        const q = new TaskQueue();
        const before = jest.fn();
        const after = jest.fn();
        q.add(before);
        q.clear();
        q.add(after);
        q.run();
        expect(before.mock.calls.length).toBe(0);
        expect(after.mock.calls.length).toBe(1);
    });

    test('TaskQueue#clear() interrupts currently-running queue', () => {
        const q = new TaskQueue();
        const before = jest.fn();
        const after = jest.fn();
        q.add(() => q.add(after));
        q.add(() => q.clear());
        q.add(before);
        q.run();
        expect(before.mock.calls.length).toBe(0);
        q.run();
        expect(after.mock.calls.length).toBe(0);
    });
});
