import Actor from './actor';
import workerFactory from './web_worker';

describe('Actor', () => {
    test('forwards responses to correct callback', done => {
        jest.spyOn(workerFactory, 'Worker').mockImplementation(function Worker(self) {
            this.self = self;
            this.actor = new Actor(self, this);
            this.test = function (mapId, params, callback) {
                setTimeout(callback, 0, null, params);
            };
        } as any);

        const worker = workerFactory();

        const m1 = new Actor(worker, {}, 1);
        const m2 = new Actor(worker, {}, 2);

        let callbackCount = 0;
        m1.send('test', {value: 1729}, (err, response) => {
            expect(err).toBeFalsy();
            expect(response).toEqual({value: 1729});
            callbackCount++;
            if (callbackCount === 2) {
                done();
            }
        });
        m2.send('test', {value: 4104}, (err, response) => {
            expect(err).toBeFalsy();
            expect(response).toEqual({value: 4104});
            callbackCount++;
            if (callbackCount === 2) {
                done();
            }
        });
    });

    test('targets worker-initiated messages to correct map instance', done => {
        let workerActor;

        jest.spyOn(workerFactory, 'Worker').mockImplementation(function Worker(self) {
            this.self = self;
            this.actor = workerActor = new Actor(self, this);
        } as any);

        const worker = workerFactory();

        new Actor(worker, {
            test () { done(); }
        }, 1);
        new Actor(worker, {
            test () {
                done('test failed');
            }
        }, 2);

        workerActor.send('test', {}, () => {}, 1);
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
        }, {}, null);
        actor.remove();
    });

});
