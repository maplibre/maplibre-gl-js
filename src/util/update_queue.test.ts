import {describe, test, expect, vi} from 'vitest';
import {UpdateQueue} from './update_queue.ts';
import {sleep} from './test/util.ts';

function createQueue() {
    const sent: string[] = [];
    const answers: Array<() => void> = [];
    const results: string[] = [];
    const replaced: boolean[] = [];
    const queue = new UpdateQueue<string, string>({
        send: (update) => {
            sent.push(update);
            return new Promise((resolve) => answers.push(() => resolve(update)));
        },
        onResult: (_update, result, wasReplaced) => {
            results.push(result);
            replaced.push(wasReplaced);
        },
        onError: () => {}
    });
    const answer = async () => {
        answers.shift()();
        await sleep(0);
    };
    return {queue, sent, results, replaced, answer};
}

describe('UpdateQueue', () => {
    test('sends one update at a time, in order', async () => {
        const {queue, sent, results, answer} = createQueue();
        queue.enqueue('a');
        queue.enqueue('b');
        queue.flush();
        expect(sent).toEqual(['a']);

        await answer();
        expect(sent).toEqual(['a', 'b']);
        expect(results).toEqual(['a']);

        await answer();
        expect(results).toEqual(['a', 'b']);
        expect(queue.isIdle()).toBe(true);
    });

    test('does not send before flush', () => {
        const {queue, sent} = createQueue();
        queue.enqueue('a');
        expect(sent).toEqual([]);
        expect(queue.isIdle()).toBe(false);
    });

    test('exposes the last waiting update, not the one being sent', async () => {
        const {queue, answer} = createQueue();
        queue.enqueue('a');
        queue.flush();
        expect(queue.top()).toBeUndefined();

        queue.enqueue('b');
        queue.enqueue('c');
        expect(queue.top()).toBe('c');

        await answer();
        await answer();
        expect(queue.top()).toBeUndefined();
    });

    test('sends a waiting update as changed through top', async () => {
        const sent: Array<{value: string}> = [];
        const queue = new UpdateQueue<{value: string}, void>({
            send: (update) => {
                sent.push({...update});
                return Promise.resolve();
            },
            onResult: () => {},
            onError: () => {}
        });
        queue.enqueue({value: 'a'});
        queue.top().value += 'b';
        await queue.flush();
        expect(sent).toEqual([{value: 'ab'}]);
    });

    test('replaces the waiting updates, and tells that the update being sent was replaced', async () => {
        const {queue, sent, replaced, answer} = createQueue();
        queue.enqueue('a');
        queue.flush();
        queue.enqueue('b');
        queue.replace('c');

        await answer();
        expect(sent).toEqual(['a', 'c']);
        await answer();
        expect(replaced).toEqual([true, false]);
    });

    test('drops the waiting updates on clear, and resolves flush once the one being sent is done', async () => {
        const {queue, sent, answer} = createQueue();
        const done = vi.fn();
        queue.enqueue('a');
        queue.flush().then(done);
        queue.enqueue('b');
        queue.clear();

        await answer();
        expect(sent).toEqual(['a']);
        expect(done).toHaveBeenCalledTimes(1);
        expect(queue.isIdle()).toBe(true);
    });

    test('resolves flush once every update is done', async () => {
        const {queue, answer} = createQueue();
        const done = vi.fn();
        queue.enqueue('a');
        queue.flush().then(done);
        queue.enqueue('b');
        queue.flush().then(done);

        await answer();
        expect(done).not.toHaveBeenCalled();
        await answer();
        expect(done).toHaveBeenCalledTimes(2);
    });

    test('is idle when the result of the last update is handled', async () => {
        const idle: boolean[] = [];
        const queue = new UpdateQueue<string, void>({
            send: () => Promise.resolve(),
            onResult: () => { idle.push(queue.isIdle()); },
            onError: () => {}
        });
        queue.enqueue('a');
        await queue.flush();
        expect(idle).toEqual([true]);
    });

    test('passes a failed update to onError and sends the next one', async () => {
        const errors: unknown[] = [];
        const sent: string[] = [];
        const queue = new UpdateQueue<string, void>({
            send: (update) => {
                sent.push(update);
                return update === 'a' ? Promise.reject(new Error('failed')) : Promise.resolve();
            },
            onResult: () => {},
            onError: (_update, error) => { errors.push(error); }
        });
        queue.enqueue('a');
        queue.enqueue('b');
        await queue.flush();
        expect(sent).toEqual(['a', 'b']);
        expect(errors).toHaveLength(1);
    });
});
