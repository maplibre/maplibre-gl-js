import maplibregl from '../../src/index';
import workerFactory from './web_worker';

describe('web_worker', () => {
    window.Worker = jest.fn();

    test('#workerFactory - maplibregl.workerUrl should be used to create worker', () => {
        maplibregl.workerUrl = 'test url';
        window.Worker = jest.fn((url) => { return {mockWorkerUrl: url} as any as Worker; });
        const workers = workerFactory();
        expect(workers).toHaveLength(maplibregl.workerCount);
        expect((workers[0] as any).mockWorkerUrl).toEqual(maplibregl.workerUrl);
    });

    test('#workerFactory - should return user provided workers', () => {
        const dummyWorker = {} as Worker;
        maplibregl.workers = [dummyWorker, dummyWorker];
        const workers = workerFactory();
        expect(workers).toHaveLength(2);
        expect(workers[0]).toBe(dummyWorker);
    });

    test('#workerFactory - update workerCount to match user provided workers', () => {
        const dummyWorker = {} as Worker;
        maplibregl.workerCount = 2;
        maplibregl.workers = [dummyWorker];
        const workers = workerFactory();
        expect(workers).toHaveLength(1);
        expect(maplibregl.workerCount).toBe(maplibregl.workers.length);
        expect(workers[0]).toBe(dummyWorker);
    });
});
