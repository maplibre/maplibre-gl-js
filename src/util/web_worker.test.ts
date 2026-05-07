import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {workerFactory} from './web_worker.ts';
import {config} from './config.ts';

describe('workerFactory', () => {
    const originalWorker = (globalThis as any).Worker;
    const originalWorkerUrl = config.WORKER_URL;

    beforeEach(() => {
        config.WORKER_URL = '';
    });

    afterEach(() => {
        (globalThis as any).Worker = originalWorker;
        config.WORKER_URL = originalWorkerUrl;
        vi.restoreAllMocks();
    });

    test('creates a classic worker when WORKER_URL is empty', () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;

        workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        // Classic worker: only the URL is passed, no options object
        expect(WorkerSpy.mock.calls[0]).toEqual(['']);
    });

    test('creates a classic worker when WORKER_URL ends with .js', () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.js';

        workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.js']);
    });

    test('creates a module worker when WORKER_URL ends with .mjs', () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.mjs';

        workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.mjs', {type: 'module'}]);
    });

    test('falls back to classic worker if module worker construction throws', () => {
        // Throw on the first construction (module worker), succeed on the second.
        const WorkerSpy = vi.fn()
            .mockImplementationOnce(() => { throw new Error('module workers not supported'); });
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.mjs';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        workerFactory();

        // Two attempts: module first, then classic fallback.
        expect(WorkerSpy).toHaveBeenCalledTimes(2);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.mjs', {type: 'module'}]);
        expect(WorkerSpy.mock.calls[1]).toEqual(['/path/to/worker.mjs']);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Module worker not supported'),
            expect.any(Error)
        );
    });

    test('returns a deferred proxy for cross-origin URLs and constructs the real worker from a Blob URL after fetch', async () => {
        const WorkerSpy = vi.fn(function() {
            return {
                postMessage: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                terminate: vi.fn(),
            };
        });
        (globalThis as any).Worker = WorkerSpy;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);

        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

        const proxy = workerFactory();

        expect(WorkerSpy).not.toHaveBeenCalled();
        expect(typeof (proxy as any).postMessage).toBe('function');

        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(fetchSpy).toHaveBeenCalledWith('https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs');
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc', {type: 'module'}]);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('deferred proxy queues postMessage and addEventListener until the real worker is ready', async () => {
        const realWorker = {
            postMessage: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            terminate: vi.fn(),
        };
        const WorkerSpy = vi.fn(function() { return realWorker; });
        (globalThis as any).Worker = WorkerSpy;

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

        const proxy = workerFactory();

        const listener = vi.fn();
        proxy.addEventListener('message', listener, false);
        proxy.postMessage({type: 'test'}, {transfer: []});

        expect(realWorker.addEventListener).not.toHaveBeenCalled();
        expect(realWorker.postMessage).not.toHaveBeenCalled();

        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(realWorker.addEventListener).toHaveBeenCalledWith('message', listener, false);
        expect(realWorker.postMessage).toHaveBeenCalledWith({type: 'test'}, {transfer: []});
    });

    test('terminate before the real worker exists prevents replay', async () => {
        const realWorker = {
            postMessage: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            terminate: vi.fn(),
        };
        const WorkerSpy = vi.fn(function() { return realWorker; });
        (globalThis as any).Worker = WorkerSpy;

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

        const proxy = workerFactory();
        proxy.postMessage({type: 'test'});
        proxy.terminate?.();

        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(realWorker.postMessage).not.toHaveBeenCalled();
        expect(realWorker.terminate).toHaveBeenCalled();
    });
});
