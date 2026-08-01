import {afterEach, describe, test, expect, vi} from 'vitest';
import {WorkerPool} from './worker_pool.ts';

describe('WorkerPool', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('acquire', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();

        expect(pool.workersPromise).toBeFalsy();
        const workers1 = await pool.acquire('map-1');
        const workers2 = await pool.acquire('map-2');
        expect(workers1).toHaveLength(4);
        expect(workers2).toHaveLength(4);

        for (let i = 0; i < workers1.length; i++) {
            expect(workers1[i]).toBe(workers2[i]);
        }
    });

    test('release', async () => {
        let workersTerminated = 0;
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();
        await pool.acquire('map-1');
        const workers = await pool.acquire('map-2');
        for (const w of workers) {
            w.terminate = function () { workersTerminated += 1; };
        }

        pool.release('map-2');
        await Promise.resolve();

        expect(workersTerminated).toBe(0);
        expect(pool.workersPromise).toBeTruthy();

        pool.release('map-1');
        await Promise.resolve();
        expect(workersTerminated).toBe(4);
        expect(pool.workersPromise).toBeFalsy();
    });

    test('reports a worker failure to current and later consumers', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 1});
        const worker = new EventTarget() as Worker;
        worker.terminate = vi.fn();
        vi.spyOn(globalThis, 'Worker').mockImplementation(function() {
            return worker;
        });

        let resolveFirstError!: (error: Error) => void;
        const firstErrorPromise = new Promise<Error>((resolve) => {
            resolveFirstError = resolve;
        });
        const firstErrorHandler = vi.fn((error: Error) => resolveFirstError(error));
        const pool = new WorkerPool();
        await pool.acquire('map-1', firstErrorHandler);

        worker.dispatchEvent(new ErrorEvent('error'));
        const firstError = await firstErrorPromise;

        expect(firstErrorHandler).toHaveBeenCalledWith(firstError);

        let resolveSecondError!: (error: Error) => void;
        const secondErrorPromise = new Promise<Error>((resolve) => {
            resolveSecondError = resolve;
        });
        const secondErrorHandler = vi.fn((error: Error) => resolveSecondError(error));
        await pool.acquire('map-2', secondErrorHandler);

        expect(await secondErrorPromise).toBe(firstError);
    });
});
