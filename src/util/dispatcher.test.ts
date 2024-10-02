import {describe, test, expect, vi} from 'vitest';
import {Actor} from './actor';
import {Dispatcher} from './dispatcher';
import {workerFactory} from './web_worker';
import {WorkerPool} from './worker_pool';

describe('Dispatcher', () => {
    test('requests and releases workers from pool', () => {
        const workers = [workerFactory(), workerFactory()];
        const mapId = 1;
        const releaseCalled = [];
        const workerPool = {
            acquire () {
                return workers;
            },
            release (id) {
                releaseCalled.push(id);
            }
        } as any as WorkerPool;

        const dispatcher = new Dispatcher(workerPool, mapId);
        expect(dispatcher.actors.map((actor) => { return actor.target; })).toEqual(workers);
        dispatcher.remove();
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toEqual([mapId]);

    });

    test('reuse workers till map is disposed', () => {
        let workers = null;
        const mapId = 1;
        const releaseCalled = [];
        const workerPool = {
            acquire () {
                if (!workers) {
                    workers = [workerFactory(), workerFactory()];
                }
                return workers;
            },
            release (id) {
                releaseCalled.push(id);
                workers = null;
            }
        } as any as WorkerPool;

        let dispatcher = new Dispatcher(workerPool, mapId);
        expect(dispatcher.actors.map((actor) => { return actor.target; })).toEqual(workers);

        // Remove dispatcher, but map is not disposed (During style change)
        dispatcher.remove(false);
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toHaveLength(0);

        // Create new instance of dispatcher
        dispatcher = new Dispatcher(workerPool, mapId);
        expect(dispatcher.actors.map((actor) => { return actor.target; })).toEqual(workers);
        dispatcher.remove(true); // mapRemoved = true
        expect(dispatcher.actors).toHaveLength(0);
        expect(releaseCalled).toEqual([mapId]);

    });

    test('#remove destroys actors', () => {
        const actorsRemoved = [];
        const mapId = 1;
        const spy = vi.fn().mockImplementation(() => { actorsRemoved.push(this); });
        Actor.prototype.remove = spy;
        WorkerPool.workerCount = 4;

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, mapId);
        dispatcher.remove();
        expect(actorsRemoved).toHaveLength(4);
    });

});

