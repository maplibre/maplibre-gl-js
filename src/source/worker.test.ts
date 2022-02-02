import {fakeServer} from 'nise';
import Worker from './worker';
import {LayerSpecification} from '../style-spec/types';
import {Cancelable} from '../types/cancelable';
import {WorkerGlobalScopeInterface} from '../util/web_worker';
import {CanonicalTileID, OverscaledTileID} from './tile_id';
import {TileParameters, WorkerSource, WorkerTileCallback, WorkerTileParameters} from './worker_source';
import {plugin as globalRTLTextPlugin} from './rtl_text_plugin';

const _self = {
    addEventListener() {}
} as any as WorkerGlobalScopeInterface;

class WorkerSourceMock implements WorkerSource {
    availableImages: string[];
    constructor(private actor: any) {}
    loadTile(_: WorkerTileParameters, __: WorkerTileCallback): void {
        this.actor.send('main thread task', {}, () => {}, null);
    }
    reloadTile(_: WorkerTileParameters, __: WorkerTileCallback): void {
        throw new Error('Method not implemented.');
    }
    abortTile(_: TileParameters, __: WorkerTileCallback): void {
        throw new Error('Method not implemented.');
    }
    removeTile(_: TileParameters, __: WorkerTileCallback): void {
        throw new Error('Method not implemented.');
    }
}

describe('load tile', () => {
    test('calls callback on error', done => {
        const server = fakeServer.create();
        global.fetch = null;
        const worker = new Worker(_self);
        worker.loadTile('0', {
            type: 'vector',
            source: 'source',
            uid: '0',
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0} as CanonicalTileID} as any as OverscaledTileID,
            request: {url: '/error'}// Sinon fake server gives 404 responses by default
        } as WorkerTileParameters & { type: string }, (err) => {
            expect(err).toBeTruthy();
            server.restore();
            done();
        });
        server.respond();
    });

    test('isolates different instances\' data', () => {
        const worker = new Worker(_self);

        worker.setLayers('0', [
            {id: 'one', type: 'circle'} as LayerSpecification
        ], () => {});

        worker.setLayers('1', [
            {id: 'one', type: 'circle'} as LayerSpecification,
            {id: 'two', type: 'circle'} as LayerSpecification,
        ], () => {});

        expect(worker.layerIndexes[0]).not.toBe(worker.layerIndexes[1]);
    });

    test('worker source messages dispatched to the correct map instance', done => {
        const worker = new Worker(_self);
        const workerName = 'test';

        worker.actor.send = (type, data, callback, mapId): Cancelable => {
            expect(type).toBe('main thread task');
            expect(mapId).toBe('999');
            done();
            return {cancel: () => {}};
        };

        _self.registerWorkerSource(workerName, WorkerSourceMock);

        expect(() => {
            _self.registerWorkerSource(workerName, WorkerSourceMock);
        }).toThrow(`Worker source with name "${workerName}" already registered.`);

        worker.loadTile('999', {type: 'test'} as WorkerTileParameters & { type: string }, () => {});
    });
});

describe('register RTLTextPlugin', () => {
    test('should not throw and set values in plugin', () => {
        jest.spyOn(globalRTLTextPlugin, 'isParsed').mockImplementation(() => {
            return false;
        });

        const rtlTextPlugin = {
            applyArabicShaping: 'test',
            processBidirectionalText: 'test',
            processStyledBidirectionalText: 'test',
        };

        _self.registerRTLTextPlugin(rtlTextPlugin);
        expect(globalRTLTextPlugin['applyArabicShaping']).toBe('test');
        expect(globalRTLTextPlugin['processBidirectionalText']).toBe('test');
        expect(globalRTLTextPlugin['processStyledBidirectionalText']).toBe('test');
    });

    test('should throw if already parsed', () => {
        jest.spyOn(globalRTLTextPlugin, 'isParsed').mockImplementation(() => {
            return true;
        });

        const rtlTextPlugin = {
            applyArabicShaping: jest.fn(),
            processBidirectionalText: jest.fn(),
            processStyledBidirectionalText: jest.fn(),
        };

        expect(() => {
            _self.registerRTLTextPlugin(rtlTextPlugin);
        }).toThrow('RTL text plugin already registered.');
    });
});

describe('set Referrer', () => {
    test('Referrer is set', () => {
        const worker = new Worker(_self);
        worker.setReferrer('fakeId', 'myMap');
        expect(worker.referrer).toBe('myMap');
    });
});

describe('load worker source', () => {
    test('calls callback on error', done => {
        const server = fakeServer.create();
        global.fetch = null;
        const worker = new Worker(_self);
        worker.loadWorkerSource('0', {
            url: '/error',
        }, (err) => {
            expect(err).toBeTruthy();
            server.restore();
            done();
        });
        server.respond();
    });
});

describe('set images', () => {
    test('set images', () => {
        const worker = new Worker(_self);
        expect(worker.availableImages['0']).toBeUndefined();
        worker.setImages('0', ['availableImages'], () => {});
        expect(worker.availableImages['0']).toEqual(['availableImages']);
    });
});
