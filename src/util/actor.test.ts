import '../../stub_loader';
import Actor from '../util/actor';
import workerFactory from '../util/web_worker';

describe('Actor', done => {
    test('forwards resopnses to correct callback', done => {
        t.stub(workerFactory, 'Worker').callsFake(function Worker(self) {
            this.self = self;
            this.actor = new Actor(self, this);
            this.test = function (mapId, params, callback) {
                setTimeout(callback, 0, null, params);
            };
        });

        const worker = workerFactory();

        const m1 = new Actor(worker, {}, 1);
        const m2 = new Actor(worker, {}, 2);

        expect.assertions(4);
        m1.send('test', {value: 1729}, (err, response) => {
            expect(err).toBeFalsy();
            expect(response).toEqual({value: 1729});
        });
        m2.send('test', {value: 4104}, (err, response) => {
            expect(err).toBeFalsy();
            expect(response).toEqual({value: 4104});
        });
    });

    test('targets worker-initiated messages to correct map instance', done => {
        let workerActor;

        t.stub(workerFactory, 'Worker').callsFake(function Worker(self) {
            this.self = self;
            this.actor = workerActor = new Actor(self, this);
        });

        const worker = workerFactory();

        new Actor(worker, {
            test () { t.end(); }
        }, 1);
        new Actor(worker, {
            test () {
                t.fail();
                done();
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

    done();
});
