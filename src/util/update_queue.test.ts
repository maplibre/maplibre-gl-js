import {describe, test, expect, vi} from 'vitest';
import {UpdateQueue} from './update_queue.ts';
import {sleep} from './test/util.ts';

function createQueue() {
    const sent: string[] = [];
    const answers: Array<() => void> = [];
    const results: Array<{result: string; replaced: boolean; idle: boolean}> = [];
    const queue = new UpdateQueue<string, string>({
        send: (update) => {
            sent.push(update);
            return new Promise((resolve) => answers.push(() => resolve(update)));
        },
        onResult: (_update, result, replaced) => { results.push({result, replaced, idle: queue.isIdle()}); },
        onError: () => {}
    });
    const answer = async () => {
        answers.shift()();
        await sleep(0);
    };
    return {queue, sent, results, answer};
}

describe('UpdateQueue', () => {
    test('sends the updates one at a time, in order, once flushed', async () => {
        const {queue, sent, results, answer} = createQueue();
        const done = vi.fn();
        queue.enqueue('a');
        expect(sent).toEqual([]);
        expect(queue.isIdle()).toBe(false);

        queue.flush().then(done);
        queue.enqueue('b');
        queue.flush().then(done);
        expect(sent).toEqual(['a']);

        await answer();
        expect(sent).toEqual(['a', 'b']);
        expect(done).not.toHaveBeenCalled();

        await answer();
        expect(results).toEqual([
            {result: 'a', replaced: false, idle: false},
            {result: 'b', replaced: false, idle: true}
        ]);
        expect(done).toHaveBeenCalledTimes(2);
        await expect(queue.flush()).resolves.toBeUndefined();
    });

    test('exposes the last waiting update, not the one being sent, to be changed until it is sent', async () => {
        const sent: string[] = [];
        const queue = new UpdateQueue<{value: string}, void>({
            send: (update) => {
                sent.push(update.value);
                return Promise.resolve();
            },
            onResult: () => {},
            onError: () => {}
        });
        queue.enqueue({value: 'a'});
        queue.flush();
        expect(queue.top()).toBeUndefined();

        queue.enqueue({value: 'b'});
        queue.enqueue({value: 'c'});
        queue.top().value += '!';
        await queue.flush();

        expect(sent).toEqual(['a', 'b', 'c!']);
        expect(queue.top()).toBeUndefined();
    });

    test('replaces the waiting updates, and tells that the update being sent was replaced', async () => {
        const {queue, sent, results, answer} = createQueue();
        queue.enqueue('a');
        queue.flush();
        queue.enqueue('b');
        queue.replace('c');

        await answer();
        expect(sent).toEqual(['a', 'c']);
        await answer();
        expect(results.map(({replaced}) => replaced)).toEqual([true, false]);
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
