import {describe, beforeEach, afterEach, test, expect, vi, type Mock} from 'vitest';
import {GLOBAL_DISPATCHER_ID, getGlobalDispatcher, importScriptInWorkers} from './global_dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {MessageType} from './actor_messages.ts';
import {Event} from './evented.ts';

import type MaplibreWorker from '../source/worker.ts';

async function getWorker(): Promise<MaplibreWorker> {
    const workers = await getGlobalWorkerPool().acquire('test');
    getGlobalWorkerPool().release('test');
    return (workers[0] as any).worker;
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
        globalDispatcher.release();
    });

    test('keeps working after the workers were restarted', async () => {
        const globalDispatcher = getGlobalDispatcher();
        const mainHandler = vi.fn().mockResolvedValue('from main');
        await globalDispatcher.registerMessageHandler('my-plugin-message', mainHandler);
        const workerBeforeRestart = await getWorker();

        getGlobalWorkerPool().workersPromise = null;
        getGlobalWorkerPool().fire(new Event('restart'));
        const worker = await getWorker();
        const workerHandler = vi.fn().mockResolvedValue('from worker');
        worker.actor.registerMessageHandler('my-plugin-message' as MessageType, workerHandler);
        const broadcastResults = await globalDispatcher.broadcast('my-plugin-message', {to: 'worker'});
        const sendResult = await worker.actor.sendAsync({type: 'my-plugin-message' as MessageType, data: {to: 'main'}, targetMapId: GLOBAL_DISPATCHER_ID});

        expect(worker).not.toBe(workerBeforeRestart);
        expect(broadcastResults).toEqual(['from worker']);
        expect(sendResult).toBe('from main');
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

    test('imports a script into the workers and keeps the workers until the claim is released', async () => {
        const globalDispatcher = getGlobalDispatcher();

        await globalDispatcher.importScript('http://example.com/script.js');

        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/script.js')).toHaveLength(1);
        expect(getGlobalWorkerPool().numActive()).toBe(1);
        globalDispatcher.release();
        expect(getGlobalWorkerPool().numActive()).toBe(0);
    });

    test('imports the scripts again when the workers are replaced, until the claim is released', async () => {
        const globalDispatcher = getGlobalDispatcher();
        await globalDispatcher.importScript('http://example.com/replaced.js');

        getGlobalWorkerPool().workersPromise = null;
        getGlobalWorkerPool().fire(new Event('restart'));
        await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/replaced.js')).toHaveLength(2));

        globalDispatcher.release();
        const otherGlobalDispatcher = getGlobalDispatcher();
        getGlobalWorkerPool().workersPromise = null;
        getGlobalWorkerPool().fire(new Event('restart'));
        await otherGlobalDispatcher.broadcast(MessageType.setReferrer, 'referrer');

        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/replaced.js')).toHaveLength(2);
        otherGlobalDispatcher.release();
    });

    test('rejects when a script fails to import', async () => {
        fetchMock.mockResolvedValue({ok: false, status: 404});
        const globalDispatcher = getGlobalDispatcher();

        await expect(globalDispatcher.importScript('http://example.com/failed.js')).rejects.toThrow('Failed to load');
        globalDispatcher.release();
    });

    test('importScriptInWorkers keeps the workers after the script was imported', async () => {
        await importScriptInWorkers('http://example.com/deprecated.js');

        expect(fetchMock.mock.calls.filter(([url]) => url === 'http://example.com/deprecated.js')).toHaveLength(1);
        expect(getGlobalWorkerPool().numActive()).toBe(1);
    });
});
