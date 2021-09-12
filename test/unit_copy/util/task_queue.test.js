import {test} from '../../util/test';
import TaskQueue from '../../../rollup/build/tsc/util/task_queue';

test('TaskQueue', (t) => {
    t.test('Calls callbacks, in order', (t) => {
        const q = new TaskQueue();
        let first = 0;
        let second = 0;
        q.add(() => expect(++first).toBe(1) && expect(second).toBe(0));
        q.add(() => expect(first).toBe(1) && expect(++second).toBe(1));
        q.run();
        expect(first).toBe(1);
        expect(second).toBe(1);
        t.end();
    });

    t.test('Allows a given callback to be queued multiple times', (t) => {
        const q = new TaskQueue();
        const fn = t.spy();
        q.add(fn);
        q.add(fn);
        q.run();
        expect(fn.callCount).toBe(2);
        t.end();
    });

    t.test('Does not call a callback that was cancelled before the queue was run', (t) => {
        const q = new TaskQueue();
        const yes = t.spy();
        const no = t.spy();
        q.add(yes);
        const id = q.add(no);
        q.remove(id);
        q.run();
        expect(yes.callCount).toBe(1);
        expect(no.callCount).toBe(0);
        t.end();
    });

    t.test('Does not call a callback that was cancelled while the queue was running', (t) => {
        const q = new TaskQueue();
        const yes = t.spy();
        const no = t.spy();
        q.add(yes);
        let id; // eslint-disable-line prefer-const
        q.add(() => q.remove(id));
        id = q.add(no);
        q.run();
        expect(yes.callCount).toBe(1);
        expect(no.callCount).toBe(0);
        t.end();
    });

    t.test('Allows each instance of a multiply-queued callback to be cancelled independently', (t) => {
        const q = new TaskQueue();
        const cb = t.spy();
        q.add(cb);
        const id = q.add(cb);
        q.remove(id);
        q.run();
        expect(cb.callCount).toBe(1);
        t.end();
    });

    t.test('Does not throw if a remove() is called after running the queue', (t) => {
        const q = new TaskQueue();
        const cb = t.spy();
        const id = q.add(cb);
        q.run();
        q.remove(id);
        expect(cb.callCount).toBe(1);
        t.end();
    });

    t.test('Does not add tasks to the currently-running queue', (t) => {
        const q = new TaskQueue();
        const cb = t.spy();
        q.add(() => q.add(cb));
        q.run();
        expect(cb.callCount).toBe(0);
        q.run();
        expect(cb.callCount).toBe(1);
        t.end();
    });

    t.test('TaskQueue#run() throws on attempted re-entrance', (t) => {
        const q = new TaskQueue();
        q.add(() => q.run());
        expect(() => q.run()).toThrow();
        t.end();
    });

    t.test('TaskQueue#clear() prevents queued task from being executed', (t) => {
        const q = new TaskQueue();
        const before = t.spy();
        const after = t.spy();
        q.add(before);
        q.clear();
        q.add(after);
        q.run();
        expect(before.callCount).toBe(0);
        expect(after.callCount).toBe(1);
        t.end();
    });

    t.test('TaskQueue#clear() interrupts currently-running queue', (t) => {
        const q = new TaskQueue();
        const before = t.spy();
        const after = t.spy();
        q.add(() => q.add(after));
        q.add(() => q.clear());
        q.add(before);
        q.run();
        expect(before.callCount).toBe(0);
        q.run();
        expect(after.callCount).toBe(0);
        t.end();
    });

    t.end();
});
