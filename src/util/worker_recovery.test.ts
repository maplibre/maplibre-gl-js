import {describe, test, expect, vi, afterEach} from 'vitest';
import {restartWorkersIfTerminated, watchWorkerHealth} from './worker_recovery.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {GlobalDispatcher} from './global_dispatcher.ts';
import {terminateGlobalWorkers} from './test/util.ts';

describe('worker recovery', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        terminateGlobalWorkers();
    });

    test('does nothing when no workers exist', async () => {
        const restartSpy = vi.spyOn(getGlobalWorkerPool(), 'restart');

        await restartWorkersIfTerminated(1);

        expect(restartSpy).not.toHaveBeenCalled();
    });

    test('leaves workers that answer the ping alone', async () => {
        await getGlobalWorkerPool().acquire('map-1');
        const restartSpy = vi.spyOn(getGlobalWorkerPool(), 'restart');

        await restartWorkersIfTerminated(5000);

        expect(restartSpy).not.toHaveBeenCalled();
    });

    test('restarts workers that never answer the ping', async () => {
        await getGlobalWorkerPool().acquire('map-1');
        vi.spyOn(GlobalDispatcher.prototype, 'broadcast').mockReturnValue(new Promise(() => {}));
        const restartSpy = vi.spyOn(getGlobalWorkerPool(), 'restart');

        await restartWorkersIfTerminated(1);

        expect(restartSpy).toHaveBeenCalledTimes(1);
    });

    test('checks worker health when the page returns to the foreground', async () => {
        await getGlobalWorkerPool().acquire('map-1');
        vi.spyOn(GlobalDispatcher.prototype, 'broadcast').mockReturnValue(new Promise(() => {}));
        const restartSpy = vi.spyOn(getGlobalWorkerPool(), 'restart');
        watchWorkerHealth();

        vi.useFakeTimers();
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(2000);

        expect(restartSpy).toHaveBeenCalledTimes(1);
    });
});
