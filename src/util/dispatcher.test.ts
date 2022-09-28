import Dispatcher from './dispatcher';
import workerFactory from './web_worker';
import WorkerPool from './worker_pool';

describe('Dispatcher', () => {
    test('requests and releases workers from pool', () => {
        const workers = [workerFactory(), workerFactory()];

        const releaseCalled = [];
        const workerPool = {
            acquire () {
                return workers;
            },
            release (id) {
                releaseCalled.push(id);
            }
        } as any as WorkerPool;

        const dispatcher = new Dispatcher(workerPool, {});
        expect(dispatcher.actors.map((actor) => { return actor.target; })).toEqual(workers);
        dispatcher.remove();
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toEqual([dispatcher.id]);

    });

    test('creates Actors with unique map id', () => {
        const ids = [];
        function Actor (target, parent, mapId) { ids.push(mapId); }
        jest.spyOn(Dispatcher, 'Actor').mockImplementation(Actor as any);
        WorkerPool.workerCount = 1;

        const workerPool = new WorkerPool();
        const dispatchers = [new Dispatcher(workerPool, {}), new Dispatcher(workerPool, {})];
        expect(ids).toEqual(dispatchers.map((d) => { return d.id; }));

    });

    test('#remove destroys actors', () => {
        const actorsRemoved = [];
        function Actor() {
            this.remove = function() { actorsRemoved.push(this); };
        }
        jest.spyOn(Dispatcher, 'Actor').mockImplementation(Actor as any);
        WorkerPool.workerCount = 4;

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});
        dispatcher.remove();
        expect(actorsRemoved).toHaveLength(4);
    });

});

