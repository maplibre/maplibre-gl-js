import {describe, test, expect, vi} from 'vitest';
import {WorkerPool} from './worker_pool.ts';
import {clearPrewarmedResources, getGlobalWorkerPool, prewarm} from './global_worker_pool.ts';

describe('WorkerPool', () => {
    test('acquire', async () => {
        Object.defineProperty(WorkerPool, 'workerCount', {value: 4});

        const pool = new WorkerPool();

        expect(pool.isStarted()).toBe(false);
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
        expect(pool.isStarted()).toBe(true);

        pool.release('map-1');
        await Promise.resolve();
        expect(workersTerminated).toBe(4);
        expect(pool.isStarted()).toBe(false);
    });

    test('restart terminates the workers and creates replacements, keeping the claims', async () => {
        const pool = new WorkerPool();
        const before = await pool.acquire('map-1');
        const terminateSpies = before.map((w) => vi.spyOn(w, 'terminate'));

        pool.restart();
        await Promise.resolve();

        for (const spy of terminateSpies) {
            expect(spy).toHaveBeenCalledTimes(1);
        }
        const after = await pool.acquire('map-1');
        expect(after).toHaveLength(before.length);
        for (const w of after) {
            expect(before).not.toContain(w);
        }
    });

    test('restart before any worker exists does nothing', () => {
        const pool = new WorkerPool();
        const createListener = vi.fn();
        pool.on('create', createListener);

        pool.restart();

        expect(createListener).not.toHaveBeenCalled();
        expect(pool.isStarted()).toBe(false);
    });

    test('start fires create before it returns', () => {
        const pool = new WorkerPool();
        const createListener = vi.fn();
        pool.on('create', createListener);

        pool.start();

        expect(createListener).toHaveBeenCalledTimes(1);
    });

    test('starting the workers does not keep them alive', async () => {
        const terminateListener = vi.fn();

        const pool = new WorkerPool();
        pool.on('terminate', terminateListener);
        await pool.start();
        await pool.acquire('map-1');

        pool.release('map-1');

        expect(terminateListener).toHaveBeenCalled();
    });

    test('prewarm keeps the workers alive once the last map is removed, until they are cleared', async () => {
        prewarm();
        const pool = getGlobalWorkerPool();
        const terminateListener = vi.fn();
        pool.on('terminate', terminateListener);
        await pool.acquire('map-1');
        pool.release('map-1');
        expect(terminateListener).not.toHaveBeenCalled();

        clearPrewarmedResources();

        expect(terminateListener).toHaveBeenCalledTimes(1);
    });
});
