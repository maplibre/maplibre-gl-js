import {describe, afterEach, test, expect, vi} from 'vitest';
import {Actor, type ActorTarget} from './actor.ts';
import {MessageType} from './actor_messages.ts';
import {Dispatcher, getGlobalDispatcher, importScriptInWorkers, onGlobalWorkersCreated} from './dispatcher.ts';
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
        await dispatcher.getActors();
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
        await dispatcher.getActors();
        expect(dispatcher.actors.map((actor) => actor.target)).toEqual(workers);

        dispatcher.remove(false);
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toHaveLength(0);

        dispatcher = new Dispatcher(workerPool, mapId);
        await dispatcher.getActors();
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
        await dispatcher.getActors();
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
        await dispatcher.getActors();

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

    test('removing the last map dispatcher terminates the workers', async () => {
        const pool = getGlobalWorkerPool();
        getGlobalDispatcher();
        const mapDispatcher = new Dispatcher(pool, 1);
        await mapDispatcher.getActors();

        mapDispatcher.remove();

        expect(pool.workersPromise).toBeFalsy();
    });

    test('creating a map dispatcher notifies the listeners that new global workers exist', async () => {
        const globalWorkersCreated = vi.fn();
        onGlobalWorkersCreated(globalWorkersCreated);

        await new Dispatcher(getGlobalWorkerPool(), 1).getActors();

        expect(globalWorkersCreated).toHaveBeenCalled();
    });

    test('keeps the workers while another map still holds them', async () => {
        const pool = getGlobalWorkerPool();
        const mapDispatcher = new Dispatcher(pool, 1);
        await mapDispatcher.getActors();
        await new Dispatcher(pool, 2).getActors();

        mapDispatcher.remove();

        expect(pool.workersPromise).toBeTruthy();
    });

    test('the global dispatcher hands out fresh actors after its workers terminate', async () => {
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

    test('prewarm keeps the workers alive once the last map is removed, until they are cleared', () => {
        prewarm();
        const pool = getGlobalWorkerPool();
        new Dispatcher(pool, 1).remove();
        expect(pool.workersPromise).toBeTruthy();

        clearPrewarmedResources();

        expect(pool.numActive()).toBe(0);
    });
});

describe('importScriptInWorkers', () => {
    afterEach(terminateGlobalWorkers);

    test('imports a script once when the call itself creates the global dispatcher', async () => {
        const broadcastSpy = vi.spyOn(Dispatcher.prototype, 'broadcast').mockResolvedValue([]);

        await importScriptInWorkers('plugin.js');

        expect(broadcastSpy).toHaveBeenCalledExactlyOnceWith(MessageType.importScript, 'plugin.js');
    });

    test('re-imports the scripts into the workers of a recreated global dispatcher', async () => {
        const broadcastSpy = vi.spyOn(Dispatcher.prototype, 'broadcast').mockResolvedValue([]);
        await importScriptInWorkers('plugin.js');
        terminateGlobalWorkers();
        broadcastSpy.mockClear();

        getGlobalDispatcher();

        expect(broadcastSpy).toHaveBeenCalledExactlyOnceWith(MessageType.importScript, 'plugin.js');
    });
});
