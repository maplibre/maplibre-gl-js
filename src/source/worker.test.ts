import {describe, beforeEach, test, expect, vi} from 'vitest';
import {fakeServer} from 'nise';
import Worker from './worker';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type WorkerGlobalScopeInterface} from '../util/web_worker';
import {type CanonicalTileID, type OverscaledTileID} from './tile_id';
import {type WorkerSource, type WorkerTileParameters, type WorkerTileResult} from './worker_source';
import {rtlWorkerPlugin} from './rtl_text_plugin_worker';
import {type ActorTarget, type IActor} from '../util/actor';
import {MessageType} from '../util/actor_messages';

class WorkerSourceMock implements WorkerSource {
    availableImages: string[];
    constructor(private actor: IActor) {}
    loadTile(_: WorkerTileParameters): Promise<WorkerTileResult> {
        return this.actor.sendAsync({type: MessageType.loadTile, data: {} as any}, new AbortController());
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

describe('Worker RTLTextPlugin', () => {
    let worker: Worker;
    let _self: WorkerGlobalScopeInterface & ActorTarget;

    beforeEach(() => {
        _self = {
            addEventListener() {},
            importScripts() {}
        } as any;
        worker = new Worker(_self);
        global.fetch = null;
    });

    test('should call setMethods in plugin', () => {
        const spy = vi.spyOn(rtlWorkerPlugin, 'setMethods').mockImplementation(() => {});

        _self.registerRTLTextPlugin({} as any);

        expect(spy).toHaveBeenCalled();
    });

    test('should call syncState when rtl message is received', async () => {
        const syncStateSpy = vi.spyOn(rtlWorkerPlugin, 'syncState').mockImplementation((_, __) => Promise.resolve({} as any));

        await worker.actor.messageHandlers[MessageType.syncRTLPluginState]('', {} as any) as any;

        expect(syncStateSpy).toHaveBeenCalled();
    });
});

describe('Worker generic testing', () => {
    let worker: Worker;
    let _self: WorkerGlobalScopeInterface & ActorTarget;

    beforeEach(() => {
        _self = {
            addEventListener() {}
        } as any;
        worker = new Worker(_self);
        global.fetch = null;
    });

    test('should validate handlers execution in worker for load tile', () => new Promise<void>(done => {
        const server = fakeServer.create();
        worker.actor.messageHandlers[MessageType.loadTile]('0', {
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
    }));

    test('isolates different instances\' data', () => {
        worker.actor.messageHandlers[MessageType.setLayers]('0', [
            {id: 'one', type: 'circle'} as LayerSpecification
        ]);

        worker.actor.messageHandlers[MessageType.setLayers]('1', [
            {id: 'one', type: 'circle'} as LayerSpecification,
            {id: 'two', type: 'circle'} as LayerSpecification,
        ]);

        expect(worker.layerIndexes[0]).not.toBe(worker.layerIndexes[1]);
    });

    test('worker source messages dispatched to the correct map instance', () => new Promise<void>(done => {
        const externalSourceName = 'test';

        worker.actor.sendAsync = (message, abortController) => {
            expect(message.type).toBe(MessageType.loadTile);
            expect(message.targetMapId).toBe('999');
            expect(abortController).toBeDefined();
            done();
            return Promise.resolve({} as any);
        };

        _self.registerWorkerSource(externalSourceName, WorkerSourceMock);

        expect(() => {
            _self.registerWorkerSource(externalSourceName, WorkerSourceMock);
        }).toThrow(`Worker source with name "${externalSourceName}" already registered.`);

        worker.actor.messageHandlers[MessageType.loadTile]('999', {type: externalSourceName} as WorkerTileParameters);
    }));

    test('Referrer is set', () => {
        worker.actor.messageHandlers[MessageType.setReferrer]('fakeId', 'myMap');
        expect(worker.referrer).toBe('myMap');
    });

    test('calls callback on error', () => new Promise<void>(done => {
        const server = fakeServer.create();
        worker.actor.messageHandlers[MessageType.importScript]('0', '/error').catch((err) => {
            expect(err).toBeTruthy();
            server.restore();
            done();
        });
        server.respond();
    }));

    test('set images', () => {
        expect(worker.availableImages['0']).toBeUndefined();
        worker.actor.messageHandlers[MessageType.setImages]('0', ['availableImages']);
        expect(worker.availableImages['0']).toEqual(['availableImages']);
    });

    test('clears resources when map is removed', () => {
        worker.actor.messageHandlers[MessageType.setLayers]('0', []);
        expect(worker.layerIndexes['0']).toBeDefined();
        worker.actor.messageHandlers[MessageType.removeMap]('0', undefined);
        expect(worker.layerIndexes['0']).toBeUndefined();
    });
});
