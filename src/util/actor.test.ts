import {Actor, ActorTarget} from './actor';
import {workerFactory} from './web_worker';
import {MessageBus} from '../../test/unit/lib/web_worker_mock';

const originalWorker = global.Worker;

function setTestWorker(MockWorker: { new(...args: any): any}) {
    (global as any).Worker = function Worker(_: string) {
        const parentListeners = [];
        const workerListeners = [];
        const parentBus = new MessageBus(workerListeners, parentListeners);
        const workerBus = new MessageBus(parentListeners, workerListeners);

        parentBus.target = workerBus;
        workerBus.target = parentBus;

        new MockWorker(workerBus);

        return parentBus;
    };
}

describe('Actor', () => {
    afterAll(() => {
        global.Worker = originalWorker;
    });

    test('forwards responses to correct handler', async () => {
        setTestWorker(class MockWorker {
            self: any;
            actor: Actor;
            constructor(self) {
                this.self = self;
                this.actor = new Actor(self);
                this.actor.registerMessageHandler('geojson.getClusterExpansionZoom', (_mapId, params) => {
                    return Promise.resolve(params.clusterId);
                });
            }
        });

        const worker = workerFactory();

        const m1 = new Actor(worker, '1');
        const m2 = new Actor(worker, '2');

        const p1 = m1.sendAsync({type: 'geojson.getClusterExpansionZoom', data: {type: 'geojson', source: '', clusterId: 1729}}).then((response) => {
            expect(response).toBe(1729);
        }).catch(() => expect(false).toBeTruthy());
        const p2 = m2.sendAsync({type: 'geojson.getClusterExpansionZoom', data: {type: 'geojson', source: '', clusterId: 4104}}).then((response) => {
            expect(response).toBe(4104);
        }).catch(() => expect(false).toBeTruthy());

        await Promise.all([p1, p2]);
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
