import {Actor, ActorTarget} from './actor';
import {WorkerGlobalScopeInterface, workerFactory} from './web_worker';
import {setGlobalWorker} from '../../test/unit/lib/web_worker_mock';
import {sleep} from './test/util';
import {ABORT_ERROR, createAbortError} from './abort_error';
import {MessageType} from './actor_messages';

class MockWorker {
    self: any;
    actor: Actor;
    constructor(self) {
        this.self = self;
        this.actor = new Actor(self);
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
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, async (_mapId, params) => {
            await sleep(0);
            return params.clusterId;
        });

        const m1 = new Actor(worker, '1');
        const m2 = new Actor(worker, '2');

        const p1 = m1.sendAsync({type: MessageType.getClusterExpansionZoom, data: {type: 'geojson', source: '', clusterId: 1729}});
        const p2 = m2.sendAsync({type: MessageType.getClusterExpansionZoom, data: {type: 'geojson', source: '', clusterId: 4104}});

        await Promise.all([p1, p2]);
        await expect(p1).resolves.toBe(1729);
        await expect(p2).resolves.toBe(4104);
    });

    test('cancel a request does not reject or resolve a promise', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, async (_mapId, params) => {
            await sleep(200);
            return params.clusterId;
        });

        const m1 = new Actor(worker, '1');

        let received = false;
        const abortController = new AbortController();
        const p1 = m1.sendAsync({type: MessageType.getClusterExpansionZoom, data: {type: 'geojson', source: '', clusterId: 1729}}, abortController)
            .then(() => { received = true; })
            .catch(() => { received = true; });

        abortController.abort();

        const p2 = new Promise((resolve) => (setTimeout(resolve, 500)));

        await Promise.any([p1, p2]);
        expect(received).toBeFalsy();
    });

    test('aborting a request will successfully abort it', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        let gotAbortSignal = false;
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, (_mapId, _params, handlerAbortController) => {
            return new Promise((resolve, reject) => {
                handlerAbortController.signal.addEventListener('abort', () => {
                    gotAbortSignal = true;
                    reject(createAbortError());
                });
                setTimeout(resolve, 200);
            });
        });

        const m1 = new Actor(worker, '1');

        let received = false;
        const abortController = new AbortController();
        m1.sendAsync({type: MessageType.getClusterExpansionZoom, data: {type: 'geojson', source: '', clusterId: 1729}}, abortController)
            .then(() => { received = true; })
            .catch(() => { received = true; });

        abortController.abort();

        await sleep(500);

        expect(received).toBeFalsy();
        expect(gotAbortSignal).toBeTruthy();
    });

    test('cancel a request that must be queued will not call the method at all', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        const spy = jest.fn().mockReturnValue(Promise.resolve({}));
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, spy);

        let received = false;
        const abortController = new AbortController();
        const p1 = actor.sendAsync({type: MessageType.getClusterExpansionZoom, data: {type: 'geojson', source: '', clusterId: 1729}, mustQueue: true}, abortController)
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

        worker.worker.actor.registerMessageHandler(MessageType.abortTile, () => Promise.reject(createAbortError()));

        await expect(async () => actor.sendAsync({type: MessageType.abortTile, data: {} as any})).rejects.toThrow(ABORT_ERROR);
    });

    test('send a messege that must be queued, it should still arrive', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, () => Promise.resolve(42));

        const response = await actor.sendAsync({type: MessageType.getClusterExpansionZoom, data: {} as any, mustQueue: true});

        expect(response).toBe(42);
    });

    test('send a message is not registered should throw', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, () => Promise.resolve(42));

        await expect(async () => actor.sendAsync({type: MessageType.abortTile, data: {} as any})).rejects.toThrow(/Could not find a registered handler for.*/);
    });

    test('should not process a message with the wrong map id', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        worker.worker.actor.mapId = '2';

        const spy = jest.fn().mockReturnValue(Promise.resolve({}));
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, spy);

        actor.sendAsync({type: MessageType.getClusterExpansionZoom, data: {} as any, targetMapId: '1'});

        await sleep(100);

        expect(spy).not.toHaveBeenCalled();
    });

    test('should not process a message with the wrong origin', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        const spy = jest.fn().mockReturnValue(Promise.resolve({}));
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, spy);

        actor.target.postMessage({type: 'getClusterExpansionZoom', data: {} as any, origin: 'https://example.com'});

        await sleep(100);

        expect(spy).not.toHaveBeenCalled();
    });

    test('should process a message when origin is "file://"', async () => {
        const worker = workerFactory() as any as WorkerGlobalScopeInterface & ActorTarget;
        const actor = new Actor(worker, '1');

        const spy = jest.fn().mockReturnValue(Promise.resolve({}));
        worker.worker.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, spy);

        actor.target.postMessage({type: MessageType.getClusterExpansionZoom, data: {} as any, origin: 'file://'});

        await sleep(0);

        expect(spy).toHaveBeenCalled();
    });
});
