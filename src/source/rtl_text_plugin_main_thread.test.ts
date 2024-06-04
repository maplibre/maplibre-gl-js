import {FakeServer, fakeServer} from 'nise';
import {rtlMainThreadPluginFactory} from './rtl_text_plugin_main_thread';
import {sleep} from '../util/test/util';
import {browser} from '../util/browser';
import {Dispatcher} from '../util/dispatcher';
import {PluginState} from './rtl_text_plugin_status';
import {MessageType} from '../util/actor_messages';
const rtlMainThreadPlugin = rtlMainThreadPluginFactory();

describe('RTLMainThreadPlugin', () => {
    let server: FakeServer;
    let broadcastSpy: jest.SpyInstance;
    const url = 'http://example.com/plugin';
    const failedToLoadMessage = `RTL Text Plugin failed to import scripts from ${url}`;
    const SyncRTLPluginStateMessageName = MessageType.syncRTLPluginState;

    beforeEach(() => {
        server = fakeServer.create();
        global.fetch = null;
        // Reset the singleton instance before each test
        rtlMainThreadPlugin.clearRTLTextPlugin();
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => { return Promise.resolve({} as any); });
    });

    function broadcastMockSuccess(message: MessageType, payload: PluginState): Promise<PluginState[]> {
        console.log('broadcastMockSuccessDefer', payload.pluginStatus);
        if (message === SyncRTLPluginStateMessageName) {
            if (payload.pluginStatus === 'loading') {
                const resultState: PluginState = {
                    pluginStatus: 'loaded',
                    pluginURL: payload.pluginURL
                };
                return Promise.resolve([resultState]);
            }
        }
    }

    function broadcastMockSuccessDefer(message: MessageType, payload: PluginState): Promise<PluginState[]> {
        if (message === SyncRTLPluginStateMessageName) {
            if (payload.pluginStatus === 'deferred') {
                const resultState: PluginState = {
                    pluginStatus: 'deferred',
                    pluginURL: payload.pluginURL
                };
                return Promise.resolve([resultState]);
            }
        }
    }

    function broadcastMockFailure(message: MessageType, payload: PluginState): Promise<PluginState[]> {
        if (message === SyncRTLPluginStateMessageName) {
            if (payload.pluginStatus === 'loading') {
                return Promise.reject(failedToLoadMessage);
            }
        } else {
            return Promise.resolve([]);
        }
    }

    afterEach(() => {
        server.restore();
        broadcastSpy.mockRestore();
    });

    it('should get the RTL text plugin status', () => {
        const status = rtlMainThreadPlugin.getRTLTextPluginStatus();
        expect(status).toBe('unavailable');
    });

    it('should set the RTL text plugin and download it', async () => {
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccess as any);
        await rtlMainThreadPlugin.setRTLTextPlugin(url);
        expect(rtlMainThreadPlugin.url).toEqual(url);
        expect(rtlMainThreadPlugin.status).toBe('loaded');
    });

    it('should set the RTL text plugin but deffer downloading', async () => {
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(rtlMainThreadPlugin.status).toBe('deferred');
        expect(broadcastSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'deferred', pluginURL: url});
    });

    it('should throw if the plugin is already set', async () => {
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        await expect(rtlMainThreadPlugin.setRTLTextPlugin(url)).rejects.toThrow('setRTLTextPlugin cannot be called multiple times.');
    });

    it('should throw if the plugin url is not set', async () => {
        const spy = jest.spyOn(browser, 'resolveURL').mockImplementation(() => { return ''; });
        await expect(rtlMainThreadPlugin.setRTLTextPlugin(null)).rejects.toThrow('requested url null is invalid');
        spy.mockRestore();
    });

    it('should be in error state if download fails', async () => {
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockFailure as any);
        const resultPromise = rtlMainThreadPlugin.setRTLTextPlugin(url);
        await expect(resultPromise).rejects.toBe(failedToLoadMessage);
        expect(rtlMainThreadPlugin.url).toEqual(url);
        expect(rtlMainThreadPlugin.status).toBe('error');
    });

    it('should lazy load the plugin if deferred', async () => {
        // use success spy to make sure test case does not throw exception
        const deferredSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccessDefer as any);
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(deferredSpy).toHaveBeenCalledTimes(1);
        expect(deferredSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'deferred', pluginURL: url});
        expect(rtlMainThreadPlugin.status).toBe('deferred');
        deferredSpy.mockRestore();

        // this is really a fire and forget
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccess as any);
        rtlMainThreadPlugin.lazyLoad();
        await sleep(1);

        // 'loading'
        expect(broadcastSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'loading', pluginURL: url});
        expect(broadcastSpy).toHaveBeenCalledTimes(1);

        // second call to lazyLoad should not change anything
        rtlMainThreadPlugin.lazyLoad();
        expect(broadcastSpy).toHaveBeenCalledTimes(1);

        expect(rtlMainThreadPlugin.status).toBe('loaded');

        // 3rd call to lazyLoad should not change anything
        rtlMainThreadPlugin.lazyLoad();
        expect(rtlMainThreadPlugin.status).toBe('loaded');
        expect(broadcastSpy).toHaveBeenCalledTimes(1);
    });

    it('should set status to requested if RTL plugin was not set', async () => {
        rtlMainThreadPlugin.lazyLoad();
        expect(rtlMainThreadPlugin.status).toBe('requested');
    });

    it('should immediately download if RTL plugin was already requested, ignoring deferred:true', async () => {
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccess as any);
        rtlMainThreadPlugin.lazyLoad();
        expect(rtlMainThreadPlugin.status).toBe('requested');
        await sleep(1);

        // notice even when deferred is true, it should download because already requested
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(rtlMainThreadPlugin.status).toBe('loaded');
        expect(broadcastSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'loading', pluginURL: url});
    });

    it('should allow multiple calls to lazyLoad', async () => {
        rtlMainThreadPlugin.lazyLoad();
        expect(rtlMainThreadPlugin.status).toBe('requested');
        rtlMainThreadPlugin.lazyLoad();
        expect(rtlMainThreadPlugin.status).toBe('requested');
    });

    it('should be in error state if lazyLoad fails', async () => {
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccessDefer);
        const resultPromise = rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        await expect(resultPromise).resolves.toBeUndefined();

        expect(rtlMainThreadPlugin.status).toBe('deferred');

        // the next one should fail
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockFailure as any);

        await expect(rtlMainThreadPlugin._requestImport()).rejects.toBe(failedToLoadMessage);
        expect(rtlMainThreadPlugin.url).toEqual(url);
        expect(rtlMainThreadPlugin.status).toBe('error');
    });
});
