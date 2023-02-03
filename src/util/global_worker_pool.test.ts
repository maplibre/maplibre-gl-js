import getGlobalWorkerPool, {prewarm, clearPrewarmedResources} from './global_worker_pool';
import WorkerPool from './worker_pool';

describe('GlobalWorkerPool', () => {

    test('#prewarm', () => {
        WorkerPool.workerCount = 4;

        prewarm();
        const pool = getGlobalWorkerPool();
        expect(pool.isPreloaded()).toBeTruthy();
        expect(pool.numActive()).toBe(1);
        expect(pool.workers).toHaveLength(WorkerPool.workerCount);

        // cleanup
        clearPrewarmedResources();
    });

    test('#prewarm - Don\'t release prewarm resources till clearPrewarmedResources is called', () => {
        let workersTerminated = 0;
        WorkerPool.workerCount = 4;

        prewarm();

        const pool = getGlobalWorkerPool();
        pool.acquire('map-1');
        const workers = pool.acquire('map-2');
        workers.forEach((w) => {
            w.terminate = function () { workersTerminated += 1; };
        });

        pool.release('map-2');

        // keeps workers till prewarm resources are not cleared
        expect(workersTerminated).toBe(0);
        expect(pool.workers.length > 0).toBeTruthy();

        // keeps workers till prewarm resources are not cleared
        pool.release('map-1');
        expect(workersTerminated).toBe(0);
        expect(pool.workers.length > 0).toBeTruthy();

        clearPrewarmedResources();
        expect(workersTerminated).toBe(4);
        expect(pool.workers).toBeFalsy();

    });

    test('#clearPrewarmedResources', () => {
        WorkerPool.workerCount = 4;

        prewarm();
        const pool = getGlobalWorkerPool();
        expect(pool.isPreloaded()).toBeTruthy();
        expect(pool.numActive()).toBe(1);
        expect(pool.workers).toHaveLength(WorkerPool.workerCount);

        clearPrewarmedResources();
        expect(pool.isPreloaded()).toBeFalsy();
        expect(pool.numActive()).toBe(0);
        expect(pool.workers).toBeFalsy();
    });
});
