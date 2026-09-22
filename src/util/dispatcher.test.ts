import {describe, afterEach, test, expect, vi} from 'vitest';
import {Actor, type ActorTarget} from './actor.ts';
import {MessageType} from './actor_messages.ts';
import {Dispatcher, getGlobalDispatcher, onGlobalWorkersCreated} from './dispatcher.ts';
import {clearPrewarmedResources, getGlobalWorkerPool, prewarm} from './global_worker_pool.ts';
import {workerFactory} from './web_worker.ts';
import {WorkerPool} from './worker_pool.ts';
import {terminateGlobalWorkers} from './test/util.ts';

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

        dispatcher.remove({releaseWorkers: false});
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toHaveLength(0);

        dispatcher = new Dispatcher(workerPool, mapId);
        await dispatcher.actorsPromise;
        expect(dispatcher.actors.map((actor) => actor.target)).toEqual(workers);
        dispatcher.remove();
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

describe('global dispatcher', () => {
    afterEach(terminateGlobalWorkers);

    test('removing the last map dispatcher terminates the workers', () => {
        const pool = getGlobalWorkerPool();
        getGlobalDispatcher();

        new Dispatcher(pool, 1).remove();

        expect(pool.numActive()).toBe(0);
    });

    test('a replay that reaches for the global dispatcher does not recurse while it is being created', async () => {
        vi.resetModules();
        const dispatcherModule = await import('./dispatcher.ts');
        dispatcherModule.onGlobalWorkersCreated(() => {
            dispatcherModule.getGlobalDispatcher();
        });

        expect(() => dispatcherModule.getGlobalDispatcher()).not.toThrow();
    });

    test('creating a map dispatcher replays the worker state onto the workers it reports to', async () => {
        const globalWorkersCreated = vi.fn();
        onGlobalWorkersCreated(globalWorkersCreated);

        new Dispatcher(getGlobalWorkerPool(), 1);

        await getGlobalDispatcher().getActors();
        expect(globalWorkersCreated).toHaveBeenCalled();
    });

    test('keeps the workers while another map still holds them', () => {
        const pool = getGlobalWorkerPool();
        const mapDispatcher = new Dispatcher(pool, 1);
        new Dispatcher(pool, 2);

        mapDispatcher.remove();

        expect(pool.workersPromise).toBeTruthy();
    });

    test('the global dispatcher works again on the workers that replace terminated ones', async () => {
        const globalDispatcher = getGlobalDispatcher();
        const actor = await globalDispatcher.getActor();

        terminateGlobalWorkers();

        await expect(globalDispatcher.getActor()).resolves.not.toBe(actor);
    });

    test('a message handler registered on the global dispatcher comes back with the new workers', async () => {
        const handler = vi.fn();
        const globalDispatcher = getGlobalDispatcher();
        await globalDispatcher.registerMessageHandler(MessageType.importScript, handler);

        terminateGlobalWorkers();

        expect((await globalDispatcher.getActor()).messageHandlers[MessageType.importScript]).toBe(handler);
    });

    test('prewarm keeps the workers alive once the last map is removed', () => {
        prewarm();
        const pool = getGlobalWorkerPool();

        new Dispatcher(pool, 1).remove();

        expect(pool.workersPromise).toBeTruthy();
    });

    test('clearPrewarmedResources releases the workers once the last map is removed', () => {
        prewarm();
        const pool = getGlobalWorkerPool();
        new Dispatcher(pool, 1).remove();

        clearPrewarmedResources();

        expect(pool.numActive()).toBe(0);
    });
});
