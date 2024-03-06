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
    const SyncRTLPluginStateMessageName = 'syncRTLPluginState';
    let consoleSpy: jest.SpyInstance;
    beforeEach(() => {
        server = fakeServer.create();
        global.fetch = null;
        // Reset the singleton instance before each test
        rtlMainThreadPlugin.clearRTLTextPlugin();
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => { return Promise.resolve({} as any); });
    });

    function broadcastMockSuccess(message: MessageType, payload: PluginState): Promise<PluginState[]> {
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

    function broadcastMockFailure(message: MessageType, payload: PluginState): Promise<PluginState[]> {
        if (message === SyncRTLPluginStateMessageName) {
            if (payload.pluginStatus === 'loading') {
                const resultState: PluginState = {
                    pluginStatus: 'error',
                    pluginURL: payload.pluginURL
                };
                return Promise.resolve([resultState]);
            }
        }
    }

    /** return two results, one success one failure */
    function broadcastMockMix(message: MessageType, payload: PluginState): Promise<PluginState[]> {
        if (message === SyncRTLPluginStateMessageName) {
            if (payload.pluginStatus === 'loading') {
                const resultState0: PluginState = {
                    pluginStatus: 'loaded',
                    pluginURL: payload.pluginURL
                };
                const resultState1: PluginState = {
                    pluginStatus: 'error',
                    pluginURL: payload.pluginURL
                };
                return Promise.resolve([resultState0, resultState1]);
            }
        }
    }

    afterEach(() => {
        server.restore();
        broadcastSpy.mockRestore();
        if (consoleSpy) {
            consoleSpy.mockRestore();
        }
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
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await rtlMainThreadPlugin.setRTLTextPlugin(url);
        expect(consoleSpy).toHaveBeenCalledWith(`worker failed to load ${url}, worker status is error`);
        expect(rtlMainThreadPlugin.url).toEqual(url);
        expect(rtlMainThreadPlugin.status).toBe('error');
    });

    it('should lazy load the plugin if deferred', async () => {
        // use success spy to make sure test case does not throw exception
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccess as any);
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(broadcastSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'deferred', pluginURL: url});
        expect(rtlMainThreadPlugin.status).toBe('deferred');

        // this is really a fire and forget
        // two calls to lazyLoad
        rtlMainThreadPlugin.lazyLoad();
        await sleep(1);
        expect(broadcastSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'loading', pluginURL: url});

        // two times, first for "deferred", second for 'loading'
        expect(broadcastSpy).toHaveBeenCalledTimes(2);

        // second call to lazyLoad should not change anything
        rtlMainThreadPlugin.lazyLoad();
        expect(broadcastSpy).toHaveBeenCalledTimes(2);

        expect(rtlMainThreadPlugin.status).toBe('loaded');

        // 3rd call to lazyLoad should not change anything
        rtlMainThreadPlugin.lazyLoad();
        expect(rtlMainThreadPlugin.status).toBe('loaded');
        expect(broadcastSpy).toHaveBeenCalledTimes(2);
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

    it('should report error for multiple results and one failure', async () => {
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockMix as any);
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await rtlMainThreadPlugin.setRTLTextPlugin(url);
        expect(consoleSpy).toHaveBeenCalledWith(`worker failed to load ${url}, worker status is error`);
    });
});
