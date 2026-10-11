import {describe, beforeEach, afterEach, test, expect, vi, type Mock} from 'vitest';
import {GLOBAL_DISPATCHER_ID, type GlobalDispatcher, getGlobalDispatcher, importScriptInWorkers} from './global_dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {MessageType} from './actor_messages.ts';

import type MaplibreWorker from '../source/worker.ts';

async function getWorker(globalDispatcher: GlobalDispatcher): Promise<MaplibreWorker> {
    const actor = await globalDispatcher.getActor();
    return (actor.target as any).worker;
}

describe('global dispatcher', () => {
    test('keeps the workers until the last claim is released', () => {
        const first = getGlobalDispatcher();
        const second = getGlobalDispatcher();
        expect(getGlobalWorkerPool().numActive()).toBe(1);

        first.release();
        expect(getGlobalWorkerPool().numActive()).toBe(1);

        second.release();
        expect(getGlobalWorkerPool().numActive()).toBe(0);
    });

    test('releasing a claim twice does not release the claim of someone else', () => {
        const first = getGlobalDispatcher();
        const second = getGlobalDispatcher();

        first.release();
        first.release();
        expect(getGlobalWorkerPool().numActive()).toBe(1);

        second.release();
    });

    test('throws when used after it was released', () => {
        const globalDispatcher = getGlobalDispatcher();
        globalDispatcher.release();

        expect(() => globalDispatcher.broadcast('my-plugin-message', {})).toThrow('This global dispatcher was released');
    });

    test('exchanges messages with a type that is not built-in with the workers', async () => {
        const globalDispatcher = getGlobalDispatcher();
        const worker = await getWorker(globalDispatcher);
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
        globalDispatcher.release();
    });
});

describe('importScriptInWorkers', () => {
    const originalFetch = global.fetch;
    let fetchMock: Mock;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({ok: true, text: () => Promise.resolve('')});
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('does not keep the workers after the script was imported', async () => {
        await importScriptInWorkers('http://example.com/released.js');

        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/released.js')).toHaveLength(1);
        expect(getGlobalWorkerPool().numActive()).toBe(0);
    });

    test('imports the script again when the workers are recreated', async () => {
        await importScriptInWorkers('http://example.com/again.js');

        const globalDispatcher = getGlobalDispatcher();
        await globalDispatcher.broadcast(MessageType.setReferrer, 'referrer');

        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/again.js')).toHaveLength(2);
        globalDispatcher.release();
    });

    test('does not import again a script that failed to import', async () => {
        fetchMock.mockImplementation((url: string) => {
            return Promise.resolve(url === 'http://example.com/failed.js' ? {ok: false, status: 404} : {ok: true, text: () => Promise.resolve('')});
        });
        await expect(importScriptInWorkers('http://example.com/failed.js')).rejects.toThrow('Failed to load');

        const globalDispatcher = getGlobalDispatcher();
        await globalDispatcher.broadcast(MessageType.setReferrer, 'referrer');

        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/failed.js')).toHaveLength(1);
        globalDispatcher.release();
    });
});
