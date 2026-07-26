import {afterEach, describe, expect, test, vi} from 'vitest';
import {Style} from './style.ts';
import {WorkerPool} from '../util/worker_pool.ts';
import {StubMap} from '../util/test/util.ts';

describe('Style worker errors', () => {
    const originalWorker = globalThis.Worker;

    afterEach(() => {
        (globalThis as any).Worker = originalWorker;
    });

    test('forwards worker script load failures to the map error event', async () => {
        WorkerPool.workerCount = 1;
        const worker = new EventTarget() as Worker;
        worker.postMessage = vi.fn();
        worker.terminate = vi.fn();
        (globalThis as any).Worker = vi.fn(function() {
            return worker;
        });
        const map = new StubMap();
        const style = new Style(map as any);
        style.setEventedParent(map);
        const onError = vi.fn();
        map.on('error', onError);
        await style.dispatcher.actorsPromise;

        worker.dispatchEvent(new Event('error'));
        await Promise.resolve();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].error.message).toContain('Failed to load the MapLibre worker script');
        style._remove();
    });
});
