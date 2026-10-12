import {describe, afterEach, test, expect, vi} from 'vitest';
import {Actor, type ActorTarget} from './actor.ts';
import {MessageType} from './actor_messages.ts';
import {Dispatcher} from './dispatcher.ts';
import {GlobalDispatcher, getGlobalDispatcher} from './global_dispatcher.ts';
import {clearPrewarmedResources, getGlobalWorkerPool, prewarm} from './global_worker_pool.ts';
import {terminateGlobalWorkers} from './test/util.ts';
import {WorkerPool} from './worker_pool.ts';

describe('global dispatcher', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        terminateGlobalWorkers();
    });

    test('creating a map dispatcher notifies the listeners that new global workers exist', async () => {
        const globalWorkersCreated = vi.fn();
        getGlobalDispatcher().on('workersCreated', globalWorkersCreated);

        await new Dispatcher(getGlobalWorkerPool(), 1).actorsPromise;

        expect(globalWorkersCreated).toHaveBeenCalled();
    });

    test('the global dispatcher broadcasts through fresh actors after its workers terminate', async () => {
        const sendSpy = vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);
        const globalDispatcher = getGlobalDispatcher();
        await globalDispatcher.broadcast('my-plugin-message', 1);
        const actorBefore = sendSpy.mock.contexts[0];

        terminateGlobalWorkers();
        sendSpy.mockClear();
        await globalDispatcher.broadcast('my-plugin-message', 2);

        expect(sendSpy.mock.contexts[0]).not.toBe(actorBefore);
    });

    test('a message handler registered on the global dispatcher comes back with the new workers', async () => {
        const handler = vi.fn();
        await new Dispatcher(getGlobalWorkerPool(), 1).actorsPromise;
        await getGlobalDispatcher().registerMessageHandler('my-plugin-message', handler);
        terminateGlobalWorkers();
        const registerSpy = vi.spyOn(Actor.prototype, 'registerMessageHandler');

        await new Dispatcher(getGlobalWorkerPool(), 1).actorsPromise;

        expect(registerSpy).toHaveBeenCalledWith('my-plugin-message', handler);
    });

    test('an in-flight broadcast rejects when the workers terminate', async () => {
        vi.spyOn(Actor.prototype, 'sendAsync').mockReturnValue(new Promise(() => {}));
        const resultPromise = getGlobalDispatcher().broadcast('my-plugin-message', 1);

        terminateGlobalWorkers();

        await expect(resultPromise).rejects.toThrow('The workers were terminated while a message was in flight.');
    });

    test('registers and unregisters a handler for a plugin-defined message type', async () => {
        const handler = vi.fn();
        vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);
        const globalDispatcher = getGlobalDispatcher();
        await globalDispatcher.broadcast('my-plugin-message', 1);
        const registerSpy = vi.spyOn(Actor.prototype, 'registerMessageHandler');
        const unregisterSpy = vi.spyOn(Actor.prototype, 'unregisterMessageHandler');

        await globalDispatcher.registerMessageHandler('my-plugin-message', handler);
        expect(registerSpy).toHaveBeenCalledWith('my-plugin-message', handler);

        await globalDispatcher.unregisterMessageHandler('my-plugin-message');
        expect(unregisterSpy).toHaveBeenCalledWith('my-plugin-message');
    });

    test('fires worker errors through Evented until the workers terminate', async () => {
        vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);
        const worker = new EventTarget() as ActorTarget & EventTarget;
        worker.postMessage = vi.fn();
        worker.terminate = vi.fn();
        const workerPool = new WorkerPool();
        workerPool.workersPromise = Promise.resolve([worker]);
        const globalDispatcher = new GlobalDispatcher(workerPool);
        const errorListener = vi.fn();
        globalDispatcher.on('error', errorListener);
        await globalDispatcher.broadcast('my-plugin-message', 1);

        worker.dispatchEvent(new ErrorEvent('error'));

        expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
            error: new Error('Worker failed to load. Check that the worker URL is correct.')
        }));
        workerPool.release(1);
        worker.dispatchEvent(new ErrorEvent('error'));
        expect(errorListener).toHaveBeenCalledTimes(1);
    });

    test('prewarm keeps the workers alive once the last map is removed, until they are cleared', () => {
        prewarm();
        const pool = getGlobalWorkerPool();
        const terminateSpy = vi.fn();
        pool.on('terminate', terminateSpy);
        new Dispatcher(pool, 1).remove();
        expect(terminateSpy).not.toHaveBeenCalled();

        clearPrewarmedResources();

        expect(terminateSpy).toHaveBeenCalled();
    });
});

describe('importScript', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        terminateGlobalWorkers();
    });

    test('re-imports the scripts into the workers that replace terminated ones', async () => {
        const sendSpy = vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);
        await getGlobalDispatcher().importScript('plugin.js');
        terminateGlobalWorkers();
        sendSpy.mockClear();

        await new Dispatcher(getGlobalWorkerPool(), 1).actorsPromise;

        expect(sendSpy).toHaveBeenCalledExactlyOnceWith({type: MessageType.importScript, data: 'plugin.js'});
    });
});
