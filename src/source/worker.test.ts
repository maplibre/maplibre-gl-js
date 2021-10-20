import '../../stub_loader';
import Worker from '../source/worker';

const _self = {
    addEventListener() {}
};

describe('load tile', done => {
    test('calls callback on error', done => {
        window.useFakeXMLHttpRequest();
        const worker = new Worker(_self);
        worker.loadTile(0, {
            type: 'vector',
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: '/error'}// Sinon fake server gives 404 responses by default
        }, (err) => {
            expect(err).toBeTruthy();
            window.clearFakeXMLHttpRequest();
            done();
        });
        window.server.respond();
    });

    done();
});

describe('isolates different instances\' data', done => {
    const worker = new Worker(_self);

    worker.setLayers(0, [
        {id: 'one', type: 'circle'}
    ], () => {});

    worker.setLayers(1, [
        {id: 'one', type: 'circle'},
        {id: 'two', type: 'circle'},
    ], () => {});

    expect(worker.layerIndexes[0]).not.toBe(worker.layerIndexes[1]);
    done();
});

describe('worker source messages dispatched to the correct map instance', done => {
    const worker = new Worker(_self);

    worker.actor.send = function (type, data, callback, mapId) {
        expect(type).toBe('main thread task');
        expect(mapId).toBe(999);
        done();
    };

    _self.registerWorkerSource('test', function(actor) {
        this.loadTile = function() {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            actor.send('main thread task', {}, () => {}, null);
        };
    });

    worker.loadTile(999, {type: 'test'});
});
