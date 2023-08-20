import {WorkerPool} from './worker_pool';

describe('WorkerPool', () => {
    test('#acquire', () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();

        expect(pool.workers).toBeFalsy();
        const workers1 = pool.acquire('map-1');
        const workers2 = pool.acquire('map-2');
        expect(workers1).toHaveLength(4);
        expect(workers2).toHaveLength(4);

        // check that the two different dispatchers' workers arrays correspond
        workers1.forEach((w, i) => { expect(w).toBe(workers2[i]); });
    });

    test('#release', () => {
        let workersTerminated = 0;
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();
        pool.acquire('map-1');
        const workers = pool.acquire('map-2');
        workers.forEach((w) => {
            w.terminate = function () { workersTerminated += 1; };
        });

        pool.release('map-2');

        // keeps workers if a dispatcher is still active
        expect(workersTerminated).toBe(0);
        expect(pool.workers.length > 0).toBeTruthy();

        // terminates workers if no dispatchers are active
        pool.release('map-1');
        expect(workersTerminated).toBe(4);
        expect(pool.workers).toBeFalsy();

    });

});
