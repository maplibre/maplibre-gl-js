import {afterEach, describe, expect, test, vi} from 'vitest';
import {Style} from './style.ts';
import {WorkerPool} from '../util/worker_pool.ts';
import {StubMap} from '../util/test/util.ts';

describe('Style worker errors', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('forwards worker script load failures to the map error event', async () => {
        WorkerPool.workerCount = 1;
        const worker = new EventTarget() as Worker;
        worker.postMessage = vi.fn();
        worker.terminate = vi.fn();
        vi.spyOn(globalThis, 'Worker').mockImplementation(function() {
            return worker;
        });
        const map = new StubMap();
        const style = new Style(map as any);
        style.setEventedParent(map);
        const errorPromise = map.once('error');
        await style.dispatcher.actorsPromise;

        worker.dispatchEvent(new ErrorEvent('error'));
        const event = await errorPromise;

        expect(event.error.message).toBe(
            `Failed to load the MapLibre worker script: ${globalThis.location.href}\n` +
            'If you use a bundler, set the worker URL explicitly; see ' +
            'https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/'
        );
        style._remove();
    });
});
