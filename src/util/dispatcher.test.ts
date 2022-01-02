import '../../stub_loader';
import {test} from '../../util/test';
import Dispatcher from '../../../rollup/build/tsc/src/util/dispatcher';
import WebWorker from '../../../rollup/build/tsc/src/util/web_worker';
import WorkerPool from '../../../rollup/build/tsc/src/util/worker_pool';

test('Dispatcher', (t) => {
    t.test('requests and releases workers from pool', (t) => {
        const workers = [new WebWorker(), new WebWorker()];

        const releaseCalled = [];
        const workerPool = {
            acquire () {
                return workers;
            },
            release (id) {
                releaseCalled.push(id);
            }
        };

        const dispatcher = new Dispatcher(workerPool, {});
        expect(dispatcher.actors.map((actor) => { return actor.target; })).toEqual(workers);
        dispatcher.remove();
        expect(dispatcher.actors.length).toBe(0);
        expect(releaseCalled).toEqual([dispatcher.id]);

        t.end();
    });

    t.test('creates Actors with unique map id', (t) => {
        const ids = [];
        function Actor (target, parent, mapId) { ids.push(mapId); }
        t.stub(Dispatcher, 'Actor').callsFake(Actor);
        t.stub(WorkerPool, 'workerCount').value(1);

        const workerPool = new WorkerPool();
        const dispatchers = [new Dispatcher(workerPool, {}), new Dispatcher(workerPool, {})];
        expect(ids).toEqual(dispatchers.map((d) => { return d.id; }));

        t.end();
    });

    t.test('#remove destroys actors', (t) => {
        const actorsRemoved = [];
        function Actor() {
            this.remove = function() { actorsRemoved.push(this); };
        }
        t.stub(Dispatcher, 'Actor').callsFake(Actor);
        t.stub(WorkerPool, 'workerCount').value(4);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});
        dispatcher.remove();
        expect(actorsRemoved.length).toBe(4);
        t.end();
    });

    t.end();
});

