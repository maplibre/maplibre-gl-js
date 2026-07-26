import {describe, test, expect, vi} from 'vitest';
import {WorkerPool} from './worker_pool.ts';

describe('WorkerPool', () => {
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
        const originalWorker = globalThis.Worker;
        const worker = new EventTarget() as Worker;
        worker.terminate = vi.fn();
        (globalThis as any).Worker = vi.fn(function() {
            return worker;
        });

        try {
            const pool = new WorkerPool();
            const firstErrorHandler = vi.fn();
            const secondErrorHandler = vi.fn();
            await pool.acquire('map-1', firstErrorHandler);

            worker.dispatchEvent(new Event('error'));
            await Promise.resolve();

            expect(firstErrorHandler).toHaveBeenCalledTimes(1);
            await pool.acquire('map-2', secondErrorHandler);
            await Promise.resolve();
            expect(secondErrorHandler).toHaveBeenCalledWith(firstErrorHandler.mock.calls[0][0]);
        } finally {
            (globalThis as any).Worker = originalWorker;
        }
    });
});
