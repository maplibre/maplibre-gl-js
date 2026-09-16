import {describe, test, expect, vi} from 'vitest';
import {Actor, type ActorTarget} from './actor.ts';
import {Dispatcher} from './dispatcher.ts';
import {workerFactory} from './web_worker.ts';
import {WorkerPool} from './worker_pool.ts';

describe('Dispatcher', () => {
    test('requests and releases workers from pool', async () => {
        const workers = [await workerFactory(), await workerFactory()];
        const mapId = 1;
        const releaseCalled = [];
        const workerPool = {
            acquire () {
                return Promise.resolve(workers);
            },
            release (id) {
                releaseCalled.push(id);
            }
        } as any as WorkerPool;

        const dispatcher = new Dispatcher(workerPool, mapId);
        await dispatcher.actorsPromise;
        expect(dispatcher.actors.map((actor) => actor.target)).toEqual(workers);
        dispatcher.remove();
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toEqual([mapId]);
    });

    test('reuse workers till map is disposed', async () => {
        let workers = null;
        const mapId = 1;
        const releaseCalled = [];
        const workerPool = {
            async acquire () {
                workers ||= [await workerFactory(), await workerFactory()];
                return workers;
            },
            release (id) {
                releaseCalled.push(id);
                workers = null;
            }
        } as any as WorkerPool;

        let dispatcher = new Dispatcher(workerPool, mapId);
        await dispatcher.actorsPromise;
        expect(dispatcher.actors.map((actor) => actor.target)).toEqual(workers);

        dispatcher.remove(false);
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toHaveLength(0);

        dispatcher = new Dispatcher(workerPool, mapId);
        await dispatcher.actorsPromise;
        expect(dispatcher.actors.map((actor) => actor.target)).toEqual(workers);
        dispatcher.remove(true);
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toEqual([mapId]);
    });

    test('remove destroys actors', async () => {
        const actorsRemoved = [];
        const mapId = 1;
        vi.spyOn(Actor.prototype, 'remove').mockImplementation(() => {
            actorsRemoved.push(this);
        });
        WorkerPool.workerCount = 4;

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, mapId);
        await dispatcher.actorsPromise;
        dispatcher.remove();
        expect(actorsRemoved).toHaveLength(4);
    });

    test('fires worker errors through Evented', async () => {
        const worker = new EventTarget() as ActorTarget & EventTarget;
        worker.postMessage = vi.fn();
        const workerPool = {
            acquire() {
                return Promise.resolve([worker]);
            },
            release() {}
        } as any as WorkerPool;
        const dispatcher = new Dispatcher(workerPool, 1);
        const listener = vi.fn();
        dispatcher.on('error', listener);
        await dispatcher.actorsPromise;

        worker.dispatchEvent(new ErrorEvent('error'));

        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            error: new Error('Worker failed to load. Check that the worker URL is correct.')
        }));
        dispatcher.remove();
        worker.dispatchEvent(new ErrorEvent('error'));
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
