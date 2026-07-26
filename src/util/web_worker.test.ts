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

    test('creates a module worker when WORKER_URL is empty', async () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['', {type: 'module'}]);
    });

    test('creates a classic worker when WORKER_URL ends with .cjs', async () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.cjs';

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.cjs']);
    });

    test('creates a module worker when WORKER_URL ends with .mjs', async () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.mjs';

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.mjs', {type: 'module'}]);
    });

    test('falls back to classic worker if module worker construction throws', async () => {
        const WorkerSpy = vi.fn()
            .mockImplementationOnce(() => { throw new Error('module workers not supported'); });
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.mjs';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(2);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.mjs', {type: 'module'}]);
        expect(WorkerSpy.mock.calls[1]).toEqual(['/path/to/worker.mjs']);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Module worker not supported'),
            expect.any(Error)
        );
    });

    test('cross-origin module worker URL is converted to an import script and the worker is constructed from a Blob URL', async () => {
        const WorkerSpy = vi.fn(function() {
            return {postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), terminate: vi.fn()};
        });
        (globalThis as any).Worker = WorkerSpy;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const BlobSpy = vi.spyOn(globalThis, 'Blob');
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

        await workerFactory();

        expect(fetchSpy).toHaveBeenCalledTimes(0);
        expect(BlobSpy).toHaveBeenCalledWith(['import "https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs"'], {type: 'text/javascript'});
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc', {type: 'module'}]);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('cross-origin classic worker URL is fetched and the worker is constructed from a Blob URL', async () => {
        const WorkerSpy = vi.fn(function() {
            return {postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), terminate: vi.fn()};
        });
        (globalThis as any).Worker = WorkerSpy;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await workerFactory();

        expect(fetchSpy).toHaveBeenCalledWith('https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs');
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc']);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('cross-origin fetch failure rejects the promise', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: false, status: 404} as any);
        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await expect(workerFactory()).rejects.toThrow('Failed to fetch worker script (404)');
    });

    test('reports worker script load failures with the resolved URL and migration guidance', async () => {
        const listeners = new Map<string, EventListener>();
        const WorkerSpy = vi.fn(function() {
            return {
                addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
                removeEventListener: vi.fn(),
                postMessage: vi.fn(),
                terminate: vi.fn()
            };
        });
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/missing-worker.mjs';
        const onError = vi.fn();

        await workerFactory(onError);
        listeners.get('error')({message: ''} as ErrorEvent);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(onError.mock.calls[0][0].message).toContain(`Failed to load the MapLibre worker script: ${new URL('/missing-worker.mjs', globalThis.location.href).href}`);
        expect(onError.mock.calls[0][0].message).toContain('set the worker URL explicitly');
        expect(onError.mock.calls[0][0].message).toContain('https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/');
    });

    test('reports worker runtime failures without bundler guidance after receiving a message', async () => {
        const listeners = new Map<string, EventListener>();
        const WorkerSpy = vi.fn(function() {
            return {
                addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
                removeEventListener: vi.fn(),
                postMessage: vi.fn(),
                terminate: vi.fn()
            };
        });
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/worker.mjs';
        const onError = vi.fn();

        await workerFactory(onError);
        listeners.get('message')({} as MessageEvent);
        listeners.get('error')({message: 'Unexpected failure'} as ErrorEvent);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toContain('worker script failed while running');
        expect(onError.mock.calls[0][0].message).toContain('Unexpected failure');
        expect(onError.mock.calls[0][0].message).not.toContain('bundler');
    });
});
