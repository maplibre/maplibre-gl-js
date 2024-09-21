import {fakeServer} from 'nise';
import Worker from './worker';
import {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {WorkerGlobalScopeInterface} from '../util/web_worker';
import {CanonicalTileID, OverscaledTileID} from './tile_id';
import {WorkerSource, WorkerTileParameters, WorkerTileResult} from './worker_source';
import {rtlWorkerPlugin} from './rtl_text_plugin_worker';
import {ActorTarget, IActor} from '../util/actor';
import {PluginState} from './rtl_text_plugin_status';
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
        rtlWorkerPlugin.setMethods({
            applyArabicShaping: null,
            processBidirectionalText: null,
            processStyledBidirectionalText: null
        });
        jest.spyOn(rtlWorkerPlugin, 'isParsed').mockImplementation(() => {
            return false;
        });
    });

    test('should not throw and set values in plugin', () => {
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

    test('should move RTL plugin from unavailable to deferred', async () => {
        rtlWorkerPlugin.setState({
            pluginURL: '',
            pluginStatus: 'unavailable'
        }
        );
        const mockMessage: PluginState = {
            pluginURL: 'https://somehost/somescript',
            pluginStatus: 'deferred'
        };

        await worker.actor.messageHandlers[MessageType.syncRTLPluginState]('', mockMessage);
        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('deferred');
    });

    test('should download RTL plugin when "loading" message is received', async () => {
        rtlWorkerPlugin.setState({
            pluginURL: '',
            pluginStatus: 'deferred'
        });

        const mockURL = 'https://somehost/somescript';
        const mockMessage: PluginState = {
            pluginURL: mockURL,
            pluginStatus: 'loading'
        };

        const importSpy = jest.spyOn(worker.self, 'importScripts').mockImplementation(() => {
            // after importing isParse() to return true
            jest.spyOn(rtlWorkerPlugin, 'isParsed').mockImplementation(() => {
                return true;
            });
        });

        const syncResult: PluginState = await worker.actor.messageHandlers[MessageType.syncRTLPluginState]('', mockMessage) as any;
        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('loaded');
        expect(importSpy).toHaveBeenCalledWith(mockURL);

        expect(syncResult.pluginURL).toBe(mockURL);
        expect(syncResult.pluginStatus).toBe('loaded');
    });

    test('should not change RTL plugin status if already parsed', async () => {
        const originalUrl = 'https://somehost/somescript1';
        rtlWorkerPlugin.setState({
            pluginURL: originalUrl,
            pluginStatus: 'loaded'
        });

        jest.spyOn(rtlWorkerPlugin, 'isParsed').mockImplementation(() => {
            return true;
        });
        const mockMessage: PluginState = {
            pluginURL: 'https://somehost/somescript2',
            pluginStatus: 'loading'
        };

        const workerResult: PluginState = await worker.actor.messageHandlers[MessageType.syncRTLPluginState]('', mockMessage) as any;
        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('loaded');
        expect(rtlWorkerPlugin.getPluginURL()).toBe(originalUrl);

        expect(workerResult.pluginStatus).toBe('loaded');
        expect(workerResult.pluginURL).toBe(originalUrl);
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
