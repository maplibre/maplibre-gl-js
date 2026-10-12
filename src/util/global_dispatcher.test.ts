import {describe, afterEach, test, expect, vi} from 'vitest';
import {Actor} from './actor.ts';
import {MessageType} from './actor_messages.ts';
import {Dispatcher} from './dispatcher.ts';
import {getGlobalDispatcher} from './global_dispatcher.ts';
import {clearPrewarmedResources, getGlobalWorkerPool, prewarm} from './global_worker_pool.ts';
import {terminateGlobalWorkers} from './test/util.ts';

describe('global dispatcher', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        terminateGlobalWorkers();
    });

    test('removing the last map dispatcher terminates the workers', async () => {
        const pool = getGlobalWorkerPool();
        const mapDispatcher = new Dispatcher(pool, 1);
        await mapDispatcher.actorsPromise;

        mapDispatcher.remove();

        expect(pool.workersPromise).toBeFalsy();
    });

    test('creating a map dispatcher notifies the listeners that new global workers exist', async () => {
        const globalWorkersCreated = vi.fn();
        getGlobalDispatcher().on('workersCreated', globalWorkersCreated);

        await new Dispatcher(getGlobalWorkerPool(), 1).actorsPromise;

        expect(globalWorkersCreated).toHaveBeenCalled();
    });

    test('keeps the workers while another map still holds them', async () => {
        const pool = getGlobalWorkerPool();
        const mapDispatcher = new Dispatcher(pool, 1);
        await mapDispatcher.actorsPromise;
        await new Dispatcher(pool, 2).actorsPromise;

        mapDispatcher.remove();

        expect(pool.workersPromise).toBeTruthy();
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
        await getGlobalDispatcher().registerMessageHandler('my-plugin-message', handler);
        terminateGlobalWorkers();
        const registerSpy = vi.spyOn(Actor.prototype, 'registerMessageHandler');

        await new Dispatcher(getGlobalWorkerPool(), 1).actorsPromise;

        expect(registerSpy).toHaveBeenCalledWith('my-plugin-message', handler);
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

    test('prewarm keeps the workers alive once the last map is removed, until they are cleared', () => {
        prewarm();
        const pool = getGlobalWorkerPool();
        new Dispatcher(pool, 1).remove();
        expect(pool.workersPromise).toBeTruthy();

        clearPrewarmedResources();

        expect(pool.numActive()).toBe(0);
    });
});

describe('importScript', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        terminateGlobalWorkers();
    });

    test('sends the script to the workers', async () => {
        const sendSpy = vi.spyOn(Actor.prototype, 'sendAsync').mockResolvedValue(undefined);

        await getGlobalDispatcher().importScript('plugin.js');

        expect(sendSpy).toHaveBeenCalledWith({type: MessageType.importScript, data: 'plugin.js'});
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
