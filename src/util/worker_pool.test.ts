import '../../stub_loader';
import {test} from '../../util/test';
import WorkerPool from '../../../rollup/build/tsc/src/util/worker_pool';

test('WorkerPool', (t) => {
    t.test('#acquire', (t) => {
        t.stub(WorkerPool, 'workerCount').value(4);

        const pool = new WorkerPool();

        expect(pool.workers).toBeFalsy();
        const workers1 = pool.acquire('map-1');
        const workers2 = pool.acquire('map-2');
        expect(workers1.length).toBe(4);
        expect(workers2.length).toBe(4);

        // check that the two different dispatchers' workers arrays correspond
        workers1.forEach((w, i) => { expect(w).toBe(workers2[i]); });
        t.end();
    });

    t.test('#release', (t) => {
        let workersTerminated = 0;
        t.stub(WorkerPool, 'workerCount').value(4);

        const pool = new WorkerPool();
        pool.acquire('map-1');
        const workers = pool.acquire('map-2');
        workers.forEach((w) => {
            w.terminate = function () { workersTerminated += 1; };
        });

        pool.release('map-2');
        console.log('keeps workers if a dispatcher is still active');
        expect(workersTerminated).toBe(0);
        expect(pool.workers.length > 0).toBeTruthy();

        console.log('terminates workers if no dispatchers are active');
        pool.release('map-1');
        expect(workersTerminated).toBe(4);
        expect(pool.workers).toBeFalsy();

        t.end();
    });

    t.end();
});
