import {describe, test, expect, vi} from 'vitest';
import {Actor} from './actor.ts';
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

    test('a borrower does not keep the workers alive', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();
        await pool.borrowActors((worker) => new Actor(worker, 'global'));
        await pool.acquire('map-1');

        pool.release('map-1');

        expect(pool.workersPromise).toBeFalsy();
    });

    test('terminating the workers removes the borrowed actors', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();
        const actors = await pool.borrowActors((worker) => new Actor(worker, 'global'));
        await pool.acquire('map-1');
        const removeSpy = vi.spyOn(actors[0], 'remove');

        pool.release('map-1');
        await Promise.resolve();

        expect(removeSpy).toHaveBeenCalled();
    });
});
