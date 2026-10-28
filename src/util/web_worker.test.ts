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
        vi.unstubAllGlobals();
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

    test('creates a classic worker when a .cjs WORKER_URL has a query string', async () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker.cjs?v=6.10.0';

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.cjs?v=6.10.0']);
    });

    test('creates a classic worker when WORKER_URL has a .cjs fragment', async () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker#maplibre-gl-worker.cjs';

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker#maplibre-gl-worker.cjs']);
    });

    test('creates a classic worker when WORKER_URL query ends with .cjs', async () => {
        const WorkerSpy = vi.fn();
        (globalThis as any).Worker = WorkerSpy;
        config.WORKER_URL = '/path/to/worker?maplibre-gl-worker.cjs';

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker?maplibre-gl-worker.cjs']);
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

    test('a page with an opaque origin starts a classic worker from a Blob URL and sends it the module worker URL to import', async () => {
        vi.stubGlobal('origin', 'null');
        const worker = {postMessage: vi.fn()};
        const WorkerSpy = vi.fn(function() { return worker; });
        vi.stubGlobal('Worker', WorkerSpy);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:null/bootstrap');
        config.WORKER_URL = 'worker/maplibre-gl-worker.mjs';

        await workerFactory();

        expect(WorkerSpy).toHaveBeenCalledWith(expect.stringMatching(/^blob:/));
        expect(worker.postMessage).toHaveBeenCalledWith('http://localhost/worker/maplibre-gl-worker.mjs');
    });

    test('a page with an opaque origin sends a blob: worker URL to the classic worker as a data URL holding the fetched module', async () => {
        vi.stubGlobal('origin', 'null');
        const worker = {postMessage: vi.fn()};
        vi.stubGlobal('Worker', vi.fn(function() { return worker; }));
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('self.worker = 1'));
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:null/bootstrap');
        config.WORKER_URL = 'blob:null/worker';

        await workerFactory();

        expect(fetchSpy).toHaveBeenCalledWith('blob:null/worker');
        expect(worker.postMessage).toHaveBeenCalledWith('data:text/javascript;charset=utf-8,self.worker%20%3D%201');
    });

    test('cross-origin fetch failure rejects the promise', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: false, status: 404} as any);
        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await expect(workerFactory()).rejects.toThrow('Failed to fetch worker script (404)');
    });
});
