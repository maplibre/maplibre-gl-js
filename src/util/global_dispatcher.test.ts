import {describe, beforeEach, afterEach, test, expect, vi, type Mock} from 'vitest';
import {GLOBAL_DISPATCHER_ID, getGlobalDispatcher} from './global_dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {Event} from './evented.ts';

import type MaplibreWorker from '../source/worker.ts';
import type {MessageType} from './actor_messages.ts';

async function getWorker(): Promise<MaplibreWorker> {
    const workers = await getGlobalWorkerPool().acquire('test');
    getGlobalWorkerPool().release('test');
    return (workers[0] as any).worker;
}

describe('global dispatcher', () => {
    test('keeps the workers until the last claim is released, and a claim is released once', () => {
        const first = getGlobalDispatcher();
        const second = getGlobalDispatcher();
        expect(getGlobalWorkerPool().numActive()).toBe(1);

        first.release();
        first.release();
        expect(getGlobalWorkerPool().numActive()).toBe(1);

        second.release();
        expect(getGlobalWorkerPool().numActive()).toBe(0);
    });

    test('throws when used after it was released', () => {
        const globalDispatcher = getGlobalDispatcher();
        globalDispatcher.release();

        expect(() => globalDispatcher.broadcast('my-plugin-message', {})).toThrow('This global dispatcher was released');
    });

    test('exchanges messages with a type that is not built-in with the workers', async () => {
        const globalDispatcher = getGlobalDispatcher();
        const worker = await getWorker();
        const workerHandler = vi.fn().mockResolvedValue('from worker');
        worker.actor.registerMessageHandler('my-plugin-message' as MessageType, workerHandler);
        const mainHandler = vi.fn().mockResolvedValue('from main');
        await globalDispatcher.registerMessageHandler('my-plugin-message', mainHandler);

        const broadcastResults = await globalDispatcher.broadcast('my-plugin-message', {to: 'worker'});
        const sendResult = await worker.actor.sendAsync({type: 'my-plugin-message' as MessageType, data: {to: 'main'}, targetMapId: GLOBAL_DISPATCHER_ID});

        expect(workerHandler.mock.calls[0][0]).toBe(GLOBAL_DISPATCHER_ID);
        expect(workerHandler.mock.calls[0][1]).toEqual({to: 'worker'});
        expect(broadcastResults).toEqual(['from worker']);
        expect(mainHandler.mock.calls[0][1]).toEqual({to: 'main'});
        expect(sendResult).toBe('from main');

        await globalDispatcher.unregisterMessageHandler('my-plugin-message');
        await worker.actor.sendAsync({type: 'my-plugin-message' as MessageType, data: {to: 'main'}, targetMapId: GLOBAL_DISPATCHER_ID});
        expect(mainHandler).toHaveBeenCalledTimes(1);
        globalDispatcher.release();
    });
});

describe('importing scripts', () => {
    const originalFetch = global.fetch;
    let fetchMock: Mock;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({ok: true, text: () => Promise.resolve('')});
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('imports again, when the workers are replaced, only the scripts that were imported by a claim that is still held', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        fetchMock.mockImplementation((url: string) => {
            return Promise.resolve(url === 'http://example.com/failed.js' ? {ok: false, status: 404} : {ok: true, text: () => Promise.resolve('')});
        });
        const heldGlobalDispatcher = getGlobalDispatcher();
        const releasedGlobalDispatcher = getGlobalDispatcher();
        await heldGlobalDispatcher.importScript('http://example.com/held.js');
        await releasedGlobalDispatcher.importScript('http://example.com/released.js');
        await expect(heldGlobalDispatcher.importScript('http://example.com/failed.js')).rejects.toThrow('Failed to load');
        releasedGlobalDispatcher.release();
        fetchMock.mockResolvedValue({ok: false, status: 404});

        getGlobalWorkerPool().workersPromise = null;
        getGlobalWorkerPool().fire(new Event('restart'));

        await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to import script http://example.com/held.js')));
        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/held.js')).toHaveLength(2);
        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/released.js')).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/failed.js')).toHaveLength(1);
        warn.mockRestore();
        heldGlobalDispatcher.release();
    });
});
