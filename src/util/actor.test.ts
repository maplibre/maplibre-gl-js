import {Actor, ActorTarget} from './actor';
import {WorkerGlobalScopeInterface, workerFactory} from './web_worker';
import {setGlobalWorker} from '../../test/unit/lib/web_worker_mock';

class MockWorker {
    self: any;
    actor: Actor;
    constructor(self) {
        this.self = self;
        this.actor = new Actor(self);
        this.actor.registerMessageHandler('getClusterExpansionZoom', async (_mapId, params) => {
            await new Promise((resolve) => (setTimeout(resolve, 200)));
            return params.clusterId;
        });
    }
}

describe('Actor', () => {
    let originalWorker;
    beforeAll(() => {
        originalWorker = global.Worker;
        setGlobalWorker(MockWorker);
    });
    afterAll(() => {
        global.Worker = originalWorker;
    });

    test('forwards responses to correct handler', async () => {
        const worker = workerFactory();

        const m1 = new Actor(worker, '1');
        const m2 = new Actor(worker, '2');

        const p1 = m1.sendAsync({type: 'getClusterExpansionZoom', data: {type: 'geojson', source: '', clusterId: 1729}}).then((response) => {
            expect(response).toBe(1729);
        }).catch(() => expect(false).toBeTruthy());
        const p2 = m2.sendAsync({type: 'getClusterExpansionZoom', data: {type: 'geojson', source: '', clusterId: 4104}}).then((response) => {
            expect(response).toBe(4104);
        }).catch(() => expect(false).toBeTruthy());

        await Promise.all([p1, p2]);
    });

    test('cancel a request does not reject or resolves a promise', async () => {
        const worker = workerFactory();

        const m1 = new Actor(worker, '1');

        let received = false;
        const abortController = new AbortController();
        const p1 = m1.sendAsync({type: 'getClusterExpansionZoom', data: {type: 'geojson', source: '', clusterId: 1729}}, abortController)
            .then(() => { received = true; })
            .catch(() => { received = true; });

        abortController.abort();

        const p2 = new Promise((resolve) => (setTimeout(resolve, 500)));

        await Promise.any([p1, p2]);
        expect(received).toBeFalsy();
    });

    test('cancel a request that must be queued will not call the method at all', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        const spy = jest.fn().mockReturnValue(Promise.resolve({}));
        worker.worker.actor.registerMessageHandler('getClusterExpansionZoom', spy);

        let received = false;
        const abortController = new AbortController();
        const p1 = actor.sendAsync({type: 'getClusterExpansionZoom', data: {type: 'geojson', source: '', clusterId: 1729}, mustQueue: true}, abortController)
            .then(() => { received = true; })
            .catch(() => { received = true; });

        abortController.abort();

        const p2 = new Promise((resolve) => (setTimeout(resolve, 500)));

        await Promise.any([p1, p2]);
        expect(received).toBeFalsy();
        expect(spy).not.toHaveBeenCalled();
    });

    test('#remove unbinds event listener', done => {
        const actor = new Actor({
            addEventListener(type, callback, useCapture) {
                this._addEventListenerArgs = [type, callback, useCapture];
            },
            removeEventListener(type, callback, useCapture) {
                expect([type, callback, useCapture]).toEqual(this._addEventListenerArgs);
                done();
            }
        } as ActorTarget, null);
        actor.remove();
    });

    test('send a messege that is rejected', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.registerMessageHandler('abortTile', () => Promise.reject(new Error('AbortError')));

        await expect(async () => actor.sendAsync({type: 'abortTile', data: {} as any})).rejects.toThrow('AbortError');
    });

    test('send a messege that must be queued, it should still arrive', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.registerMessageHandler('getClusterExpansionZoom', () => Promise.resolve(42));

        const response = await actor.sendAsync({type: 'getClusterExpansionZoom', data: {} as any, mustQueue: true});

        expect(response).toBe(42);
    });

    test('send a messege is not registered should throw', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.registerMessageHandler('getClusterExpansionZoom', () => Promise.resolve(42));

        await expect(async () => actor.sendAsync({type: 'abortTile', data: {} as any})).rejects.toThrow(/Could not find a registered handler for.*/);
    });

    test('should not process a message with the wrong map id', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.mapId = '2';

        const spy = jest.fn().mockReturnValue(Promise.resolve({}));
        worker.worker.actor.registerMessageHandler('getClusterExpansionZoom', spy);

        actor.sendAsync({type: 'getClusterExpansionZoom', data: {} as any, targetMapId: '1'});

        await new Promise((resolve) => (setTimeout(resolve, 100)));

        expect(spy).not.toHaveBeenCalled();
    });
});
