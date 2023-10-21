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

    test('forwards responses to correct callback', done => {
        setTestWorker(class MockWorker {
            self: any;
            actor: Actor;
            constructor(self) {
                this.self = self;
                this.actor = new Actor(self);
                this.actor.registerMessageHandler('setImages', (_mapId, _params) => {
                    return Promise.resolve();
                });
            }
        });

        const worker = workerFactory();

        const m1 = new Actor(worker, '1');
        const m2 = new Actor(worker, '2');

        let callbackCount = 0;
        m1.send('setImages', {value: 1729}, (err, response) => {
            expect(err).toBeFalsy();
            expect(response).toEqual({value: 1729});
            callbackCount++;
            if (callbackCount === 2) {
                done();
            }
        });
        m2.send('setImages', {value: 4104}, (err, response) => {
            expect(err).toBeFalsy();
            expect(response).toEqual({value: 4104});
            callbackCount++;
            if (callbackCount === 2) {
                done();
            }
        });
    });

    test('targets worker-initiated messages to correct map instance', () => {
        let workerActor;

        setTestWorker(class MockWorker {
            self: any;
            actor: Actor;
            constructor(self) {
                this.self = self;
                this.actor = workerActor = new Actor(self);
            }
            getWorkerSource() { return null; }
        });

        const worker = workerFactory();

        new Actor(worker, '1');
        new Actor(worker, '2');

        workerActor.send('test', {}, () => {}, '1');
    });

    test('#remove unbinds event listener', done => {
        const actor = new Actor({
            addEventListener (type, callback, useCapture) {
                this._addEventListenerArgs = [type, callback, useCapture];
            },
            removeEventListener (type, callback, useCapture) {
                expect([type, callback, useCapture]).toEqual(this._addEventListenerArgs);
                done();
            }
        } as ActorTarget, null);
        actor.remove();
    });

});
