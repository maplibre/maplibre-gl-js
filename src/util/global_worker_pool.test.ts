import {describe, test, expect, afterEach} from 'vitest';
import {getGlobalWorkerPool, restartWorkers} from './global_worker_pool.ts';
import {terminateGlobalWorkers} from './test/util.ts';

describe('restartWorkers', () => {
    afterEach(() => {
        terminateGlobalWorkers();
    });

    test('replaces the global workers', async () => {
        const before = await getGlobalWorkerPool().acquire('map-1');

        restartWorkers();

        const after = await getGlobalWorkerPool().acquire('map-1');
        expect(after).toHaveLength(before.length);
        for (const worker of after) {
            expect(before).not.toContain(worker);
        }
    });
});
