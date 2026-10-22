import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {workerFactory} from './web_worker.ts';
import {config} from './config.ts';

function makeFakeWorker() {
    const listeners: Record<string, Array<() => void>> = {};
    return {
        postMessage: vi.fn(),
        addEventListener: vi.fn((type: string, handler: () => void) => {
            (listeners[type] ||= []).push(handler);
        }),
        removeEventListener: vi.fn((type: string, handler: () => void) => {
            listeners[type] = (listeners[type] || []).filter(h => h !== handler);
        }),
        terminate: vi.fn(),
        emit(type: string) {
            for (const handler of [...(listeners[type] || [])]) {
                handler();
            }
        }
    };
}

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

    test('cross-origin module worker URL is converted to an import script and the Blob URL outlives worker startup', async () => {
        const worker = makeFakeWorker();
        const WorkerSpy = vi.fn(function() { return worker; });
        (globalThis as any).Worker = WorkerSpy;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const BlobSpy = vi.spyOn(globalThis, 'Blob');
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

        const created = await workerFactory();

        expect(fetchSpy).toHaveBeenCalledTimes(0);
        expect(BlobSpy).toHaveBeenCalledWith(['import "https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs"'], {type: 'text/javascript'});
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(created).toBe(worker);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc', {type: 'module'}]);
        // Revoking here would race the worker's own fetch of the script (#8854).
        expect(revokeObjectURLSpy).not.toHaveBeenCalled();

        worker.emit('message');
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);

        // Either event releases the URL, but only once.
        worker.emit('message');
        worker.emit('error');
        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    test('cross-origin classic worker URL is fetched and the Blob URL outlives worker startup', async () => {
        const worker = makeFakeWorker();
        const WorkerSpy = vi.fn(function() { return worker; });
        (globalThis as any).Worker = WorkerSpy;

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        const created = await workerFactory();

        expect(fetchSpy).toHaveBeenCalledWith('https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs');
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(created).toBe(worker);
        expect(WorkerSpy.mock.calls[0]).toEqual(['blob:http://localhost/abc']);
        expect(revokeObjectURLSpy).not.toHaveBeenCalled();

        worker.emit('error');
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('a worker that fails to construct still releases its Blob URL', async () => {
        (globalThis as any).Worker = vi.fn(() => {
            throw new Error('cannot construct');
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('// worker code'),
        } as any);
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');

        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await expect(workerFactory()).rejects.toThrow('cannot construct');
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });

    test('cross-origin fetch failure rejects the promise', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: false, status: 404} as any);
        config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.cjs';

        await expect(workerFactory()).rejects.toThrow('Failed to fetch worker script (404)');
    });
    describe('srcdoc iframes', () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        test('a same-origin worker URL in a srcdoc iframe is not treated as cross-origin', async () => {
            // `location.origin` is "null" for `about:srcdoc`; the document's real
            // origin is inherited from the parent and exposed as `globalThis.origin`.
            vi.stubGlobal('location', {href: 'about:srcdoc', origin: 'null'});
            vi.stubGlobal('origin', 'https://example.com');

            const worker = makeFakeWorker();
            const WorkerSpy = vi.fn(function() { return worker; });
            (globalThis as any).Worker = WorkerSpy;
            const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

            config.WORKER_URL = 'https://example.com/dist/maplibre-gl-worker.mjs';

            await workerFactory();

            expect(WorkerSpy.mock.calls[0]).toEqual(['https://example.com/dist/maplibre-gl-worker.mjs', {type: 'module'}]);
            expect(createObjectURLSpy).not.toHaveBeenCalled();
        });

        test('a genuinely cross-origin worker URL in a srcdoc iframe still goes through a Blob', async () => {
            vi.stubGlobal('location', {href: 'about:srcdoc', origin: 'null'});
            vi.stubGlobal('origin', 'https://example.com');

            const worker = makeFakeWorker();
            (globalThis as any).Worker = vi.fn(function() { return worker; });
            vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/abc');

            config.WORKER_URL = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs';

            await workerFactory();

            expect((globalThis as any).Worker.mock.calls[0]).toEqual(['blob:http://localhost/abc', {type: 'module'}]);
        });
    });
});
