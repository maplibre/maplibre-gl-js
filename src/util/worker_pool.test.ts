import {describe, test, expect, vi} from 'vitest';
import {WorkerPool} from './worker_pool.ts';
import {workerFactory} from './web_worker.ts';

vi.mock(import('./web_worker.ts'), {spy: true});

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

    test('a weak acquirer does not keep the workers alive', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});
        const terminateListener = vi.fn();

        const pool = new WorkerPool();
        await pool.weakAcquire(terminateListener);
        await pool.acquire('map-1');

        pool.release('map-1');

        expect(terminateListener).toHaveBeenCalled();
    });

    test('workers that fail to start are not cached, so the next acquirer tries again', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 1});
        const workerFactorySpy = vi.mocked(workerFactory).mockRejectedValueOnce(new Error('worker url is invalid'));

        const pool = new WorkerPool();
        await expect(pool.acquire('map-1')).rejects.toThrow('worker url is invalid');
        await pool.acquire('map-2');

        expect(workerFactorySpy).toHaveBeenCalledTimes(2);
    });
});
