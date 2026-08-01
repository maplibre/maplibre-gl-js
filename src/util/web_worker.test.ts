import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {workerFactory} from './web_worker.ts';
import {config} from './config.ts';

const WORKER_MIGRATION_GUIDE = 'https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/';

function createMockWorker(): Worker {
    const worker = new EventTarget() as Worker;
    worker.postMessage = vi.fn();
    worker.terminate = vi.fn();
    return worker;
}

function spyOnWorker(worker = createMockWorker()) {
    return vi.spyOn(globalThis, 'Worker').mockImplementation(function() {
        return worker;
    });
}

describe('workerFactory', () => {
    const originalWorkerUrl = config.WORKER_URL;

    beforeEach(() => {
        config.WORKER_URL = '';
    });

    afterEach(() => {
        config.WORKER_URL = originalWorkerUrl;
        vi.restoreAllMocks();
    });

    test('creates a module worker when WORKER_URL is empty', async () => {
        const WorkerSpy = spyOnWorker();

        await workerFactory(vi.fn());

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['', {type: 'module'}]);
    });

    test('creates a classic worker when WORKER_URL ends with .cjs', async () => {
        const WorkerSpy = spyOnWorker();
        config.WORKER_URL = '/path/to/worker.cjs';

        await workerFactory(vi.fn());

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.cjs']);
    });

    test('creates a module worker when WORKER_URL ends with .mjs', async () => {
        const WorkerSpy = spyOnWorker();
        config.WORKER_URL = '/path/to/worker.mjs';

        await workerFactory(vi.fn());

        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.mjs', {type: 'module'}]);
    });

    test('falls back to classic worker if module worker construction throws', async () => {
        const worker = createMockWorker();
        const WorkerSpy = vi.spyOn(globalThis, 'Worker')
            .mockImplementationOnce(() => { throw new Error('module workers not supported'); })
            .mockImplementation(function() {
                return worker;
            });
        config.WORKER_URL = '/path/to/worker.mjs';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await workerFactory(vi.fn());

        expect(WorkerSpy).toHaveBeenCalledTimes(2);
        expect(WorkerSpy.mock.calls[0]).toEqual(['/path/to/worker.mjs', {type: 'module'}]);
        expect(WorkerSpy.mock.calls[1]).toEqual(['/path/to/worker.mjs']);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Module worker not supported'),
            expect.any(Error)
        );
    });

    test('cross-origin module worker URL is converted to an import script and the worker is constructed from a Blob URL', async () => {
        const WorkerSpy = spyOnWorker();

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const BlobSpy = vi.spyOn(globalThis, 'Blob');
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

        await workerFactory(vi.fn());

        expect(fetchSpy).toHaveBeenCalledTimes(0);
        expect(BlobSpy).toHaveBeenCalledWith(['import "https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs"'], {type: 'text/javascript'});
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc', {type: 'module'}]);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('cross-origin classic worker URL is fetched and the worker is constructed from a Blob URL', async () => {
        const WorkerSpy = spyOnWorker();

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await workerFactory(vi.fn());

        expect(fetchSpy).toHaveBeenCalledWith('https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs');
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(WorkerSpy).toHaveBeenCalledTimes(1);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc']);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('cross-origin fetch failure rejects the promise', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: false, status: 404} as any);
        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await expect(workerFactory(vi.fn())).rejects.toThrow('Failed to fetch worker script (404)');
    });

    test('reports worker script load failures with the resolved URL and migration guidance', async () => {
        const worker = createMockWorker();
        spyOnWorker(worker);
        config.WORKER_URL = '/missing-worker.mjs';
        const onError = vi.fn();

        await workerFactory(onError);
        worker.dispatchEvent(new ErrorEvent('error'));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(onError.mock.calls[0][0].message).toBe(
            `Failed to load the MapLibre worker script: ${new URL('/missing-worker.mjs', globalThis.location.href).href}\n` +
            `If you use a bundler, set the worker URL explicitly; see ${WORKER_MIGRATION_GUIDE}`
        );
    });

    test('reports worker runtime failures without bundler guidance after receiving a message', async () => {
        const worker = createMockWorker();
        spyOnWorker(worker);
        config.WORKER_URL = '/worker.mjs';
        const onError = vi.fn();

        await workerFactory(onError);
        worker.dispatchEvent(new MessageEvent('message'));
        worker.dispatchEvent(new ErrorEvent('error', {message: 'Unexpected failure'}));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe(
            `The MapLibre worker script failed while running: ${new URL('/worker.mjs', globalThis.location.href).href} (Unexpected failure)`
        );
    });

    test('reports worker message deserialization failures', async () => {
        const worker = createMockWorker();
        spyOnWorker(worker);
        config.WORKER_URL = '/worker.mjs';
        const onError = vi.fn();

        await workerFactory(onError);
        worker.dispatchEvent(new MessageEvent('messageerror'));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe(
            `Failed to communicate with the MapLibre worker script: ${new URL('/worker.mjs', globalThis.location.href).href}`
        );
    });

    test('preserves a malformed worker URL in the load failure message', async () => {
        const worker = createMockWorker();
        spyOnWorker(worker);
        config.WORKER_URL = 'http://[';
        const onError = vi.fn();

        await workerFactory(onError);
        worker.dispatchEvent(new ErrorEvent('error'));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe(
            'Failed to load the MapLibre worker script: http://[\n' +
            `If you use a bundler, set the worker URL explicitly; see ${WORKER_MIGRATION_GUIDE}`
        );
    });
});
