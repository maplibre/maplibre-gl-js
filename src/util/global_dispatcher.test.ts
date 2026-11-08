import {describe, afterEach, test, expect, vi} from 'vitest';
import {Actor, type ActorTarget} from './actor.ts';
import {MessageType} from './actor_messages.ts';
import {GlobalDispatcher, getGlobalDispatcher} from './global_dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {terminateGlobalWorkers} from './test/util.ts';
import {WorkerPool} from './worker_pool.ts';

describe('GlobalDispatcher', () => {
    afterEach(async () => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
        await terminateGlobalWorkers();
    });

    test('rejects an in-flight broadcast when the workers terminate', async () => {
        const workers = await getGlobalWorkerPool().acquire('map-1');
        for (const worker of workers) {
            vi.spyOn(worker, 'postMessage').mockImplementation(() => {});
        }
        const resultPromise = getGlobalDispatcher().broadcast('my-plugin-message', 1);

        terminateGlobalWorkers();

        await expect(resultPromise).rejects.toMatchObject({name: 'AbortError', message: 'The workers were terminated while a message was in flight.'});
    });

    test('registers and unregisters a message handler on the workers', async () => {
        const handler = vi.fn();
        await getGlobalWorkerPool().acquire('map-1');
        const registerSpy = vi.spyOn(Actor.prototype, 'registerMessageHandler');
        const unregisterSpy = vi.spyOn(Actor.prototype, 'unregisterMessageHandler');

        await getGlobalDispatcher().registerMessageHandler('my-plugin-message', handler);
        expect(registerSpy).toHaveBeenCalledWith('my-plugin-message', handler);

        await getGlobalDispatcher().unregisterMessageHandler('my-plugin-message');
        expect(unregisterSpy).toHaveBeenCalledWith('my-plugin-message');
    });

    test('fires workerscreate and restores message handlers and scripts on the workers that replace terminated ones', async () => {
        const handler = vi.fn();
        const sendSpy = vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);
        await getGlobalDispatcher().registerMessageHandler('my-plugin-message', handler);
        await getGlobalDispatcher().importScript('plugin.js');
        await terminateGlobalWorkers();
        sendSpy.mockClear();
        const registerSpy = vi.spyOn(Actor.prototype, 'registerMessageHandler');
        const workersCreateListener = vi.fn();
        getGlobalDispatcher().on('workerscreate', workersCreateListener);

        await getGlobalWorkerPool().acquire('map-1');

        await vi.waitFor(() => {
            expect(workersCreateListener).toHaveBeenCalledTimes(1);
            expect(registerSpy).toHaveBeenCalledWith('my-plugin-message', handler);
            expect(sendSpy).toHaveBeenCalledExactlyOnceWith({type: MessageType.importScript, data: 'plugin.js'}, expect.any(AbortController));
        });
    });

    test('fires an error event for worker errors until the workers terminate', async () => {
        vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);
        const worker = new EventTarget() as ActorTarget & EventTarget;
        worker.terminate = vi.fn();
        vi.stubGlobal('Worker', function () { return worker; });
        const workerPool = new WorkerPool();
        await workerPool.acquire('map-1');
        const globalDispatcher = new GlobalDispatcher(workerPool);
        const errorListener = vi.fn();
        globalDispatcher.on('error', errorListener);
        await globalDispatcher.broadcast('my-plugin-message', 1);

        worker.dispatchEvent(new ErrorEvent('error'));
        expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
            error: new Error('Worker failed to load. Check that the worker URL is correct.')
        }));

        await workerPool.release('map-1');
        worker.dispatchEvent(new ErrorEvent('error'));
        expect(errorListener).toHaveBeenCalledTimes(1);
    });

    test('restarts dead workers when the page returns to the foreground', async () => {
        for (const worker of await getGlobalWorkerPool().acquire('map-1')) {
            vi.spyOn(worker, 'postMessage').mockImplementation(() => {});
        }
        const restartSpy = vi.spyOn(getGlobalWorkerPool(), 'restart');
        getGlobalDispatcher().watchWorkers();

        vi.useFakeTimers();
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(2000);

        expect(restartSpy).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
        await expect(getGlobalDispatcher().ping(5000)).resolves.toBe(true);
    });

    test('does nothing when the page returns to the foreground before any workers exist', async () => {
        const restartSpy = vi.spyOn(getGlobalWorkerPool(), 'restart');
        getGlobalDispatcher().watchWorkers();

        vi.useFakeTimers();
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(2000);

        expect(restartSpy).not.toHaveBeenCalled();
    });
});
