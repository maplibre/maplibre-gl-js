import {fakeServer} from 'nise';
import Worker from './worker';
import {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {WorkerGlobalScopeInterface} from '../util/web_worker';
import {CanonicalTileID, OverscaledTileID} from './tile_id';
import {WorkerSource, WorkerTileParameters, WorkerTileResult} from './worker_source';
import {rtlWorkerPlugin} from './rtl_text_plugin_worker';
import {ActorTarget, IActor} from '../util/actor';

class WorkerSourceMock implements WorkerSource {
    availableImages: string[];
    constructor(private actor: IActor) {}
    loadTile(_: WorkerTileParameters): Promise<WorkerTileResult> {
        return this.actor.sendAsync({type: 'loadTile', data: {} as any}, new AbortController());
    }
    reloadTile(_: WorkerTileParameters): Promise<WorkerTileResult> {
        throw new Error('Method not implemented.');
    }
    abortTile(_: WorkerTileParameters): Promise<void> {
        throw new Error('Method not implemented.');
    }
    removeTile(_: WorkerTileParameters): Promise<void> {
        throw new Error('Method not implemented.');
    }
}

describe('Worker register RTLTextPlugin', () => {
    let worker: Worker;
    let _self: WorkerGlobalScopeInterface & ActorTarget;

    beforeEach(() => {
        _self = {
            addEventListener() {}
        } as any;
        worker = new Worker(_self);
        global.fetch = null;
    });

    test('should validate handlers execution in worker for load tile', done => {
        const server = fakeServer.create();
        worker.actor.messageHandlers['loadTile']('0', {
            type: 'vector',
            source: 'source',
            uid: '0',
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0} as CanonicalTileID} as any as OverscaledTileID,
            request: {url: '/error'}// Sinon fake server gives 404 responses by default
        } as WorkerTileParameters).catch((err) => {
            expect(err).toBeTruthy();
            server.restore();
            done();
        });
        server.respond();
    });

    test('isolates different instances\' data', () => {
        worker.actor.messageHandlers['setLayers']('0', [
            {id: 'one', type: 'circle'} as LayerSpecification
        ]);

        worker.actor.messageHandlers['setLayers']('1', [
            {id: 'one', type: 'circle'} as LayerSpecification,
            {id: 'two', type: 'circle'} as LayerSpecification,
        ]);

        expect(worker.layerIndexes[0]).not.toBe(worker.layerIndexes[1]);
    });

    test('worker source messages dispatched to the correct map instance', done => {
        const extenalSourceName = 'test';

        worker.actor.sendAsync = (message, abortController) => {
            expect(message.type).toBe('loadTile');
            expect(message.targetMapId).toBe('999');
            expect(abortController).toBeDefined();
            done();
            return Promise.resolve({} as any);
        };

        _self.registerWorkerSource(extenalSourceName, WorkerSourceMock);

        expect(() => {
            _self.registerWorkerSource(extenalSourceName, WorkerSourceMock);
        }).toThrow(`Worker source with name "${extenalSourceName}" already registered.`);

        worker.actor.messageHandlers['loadTile']('999', {type: extenalSourceName} as WorkerTileParameters);
    });

    test('should not throw and set values in plugin', () => {
        jest.spyOn(rtlWorkerPlugin, 'isParsed').mockImplementation(() => {
            return false;
        });

        const rtlTextPlugin = {
            applyArabicShaping: 'test',
            processBidirectionalText: 'test',
            processStyledBidirectionalText: 'test',
        };

        _self.registerRTLTextPlugin(rtlTextPlugin);
        expect(rtlWorkerPlugin.applyArabicShaping).toBe('test');
        expect(rtlWorkerPlugin.processBidirectionalText).toBe('test');
        expect(rtlWorkerPlugin.processStyledBidirectionalText).toBe('test');
    });

    test('should throw if already parsed', () => {
        jest.spyOn(rtlWorkerPlugin, 'isParsed').mockImplementation(() => {
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

    test('Referrer is set', () => {
        worker.actor.messageHandlers['setReferrer']('fakeId', 'myMap');
        expect(worker.referrer).toBe('myMap');
    });

    test('calls callback on error', done => {
        const server = fakeServer.create();
        worker.actor.messageHandlers['importScript']('0', '/error').catch((err) => {
            expect(err).toBeTruthy();
            server.restore();
            done();
        });
        server.respond();
    });

    test('set images', () => {
        expect(worker.availableImages['0']).toBeUndefined();
        worker.actor.messageHandlers['setImages']('0', ['availableImages']);
        expect(worker.availableImages['0']).toEqual(['availableImages']);
    });

    test('clears resources when map is removed', () => {
        worker.actor.messageHandlers['setLayers']('0', []);
        expect(worker.layerIndexes['0']).toBeDefined();
        worker.actor.messageHandlers['removeMap']('0', undefined);
        expect(worker.layerIndexes['0']).toBeUndefined();
    });
});
