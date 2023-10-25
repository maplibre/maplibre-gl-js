import {Actor, ActorTarget} from './actor';
import {workerFactory} from './web_worker';
import {setGlobalWorker} from '../../test/unit/lib/web_worker_mock';

describe('Actor', () => {
    let originalWorker;
    beforeAll(() => {
        originalWorker = global.Worker;
        setGlobalWorker(class MockWorker {
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
        });
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

});
