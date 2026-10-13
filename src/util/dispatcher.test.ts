import {describe, test, expect, vi} from 'vitest';
import {Actor, type ActorTarget} from './actor.ts';
import {Dispatcher} from './dispatcher.ts';
import {workerFactory} from './web_worker.ts';
import {WorkerPool} from './worker_pool.ts';
import {MessageType} from './actor_messages.ts';
import {Event} from './evented.ts';

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
            },
            on() {
                return {unsubscribe() {}};
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
            },
            on() {
                return {unsubscribe() {}};
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
            release() {},
            on() {
                return {unsubscribe() {}};
            }
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

    test('uses the new workers after the pool restarted them', async () => {
        const workerPool = new WorkerPool();
        const handler = vi.fn().mockResolvedValue({});
        const dispatcher = new Dispatcher(workerPool, 1);
        const restartListener = vi.fn();
        dispatcher.on('workersrestart', restartListener);
        await dispatcher.registerMessageHandler(MessageType.getGlyphs, handler);
        const actorsBeforeRestart = await dispatcher.actorsPromise;

        workerPool.workersPromise = null;
        workerPool.fire(new Event('restart'));
        const actorsAfterRestart = await dispatcher.actorsPromise;

        expect(actorsAfterRestart[0].target).not.toBe(actorsBeforeRestart[0].target);
        expect(actorsAfterRestart[0].messageHandlers[MessageType.getGlyphs]).toBe(handler);
        expect(restartListener).toHaveBeenCalledTimes(1);
        dispatcher.remove();
    });

    test('gives the new actors to a caller that was waiting when the pool restarted the workers', async () => {
        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, 1);
        const actorPromise = dispatcher.getActor();

        workerPool.workersPromise = null;
        workerPool.fire(new Event('restart'));
        const actor = await actorPromise;

        expect(dispatcher.actors).toContain(actor);
        dispatcher.remove();
    });
});
