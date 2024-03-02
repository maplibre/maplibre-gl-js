import {FakeServer, fakeServer} from 'nise';
import {rtlMainThreadPluginFactory} from './rtl_text_plugin_main_thread';
import {sleep} from '../util/test/util';
import {browser} from '../util/browser';
import {Dispatcher} from '../util/dispatcher';
import {PluginState, SyncRTLPluginStateMessageName} from './rtl_text_plugin_status';
const rtlMainThreadPlugin = rtlMainThreadPluginFactory();

describe('RTLMainThreadPlugin', () => {
    let server: FakeServer;
    let broadcastSpy: jest.SpyInstance;
    const url = 'http://example.com/plugin';
    beforeEach(() => {
        server = fakeServer.create();
        global.fetch = null;
        // Reset the singleton instance before each test
        rtlMainThreadPlugin.clearRTLTextPlugin();
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => { return Promise.resolve({} as any); });
    });

    function broadcastMockSuccess(message: string, payload: PluginState): Promise<PluginState[]> {
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

    function broadcastMockFailure(message: string, payload: PluginState): Promise<PluginState[]> {
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
        const promise = rtlMainThreadPlugin.setRTLTextPlugin(url);
        await expect(promise).rejects.toThrow(`worker failed to load ${url}`);
        expect(rtlMainThreadPlugin.url).toEqual(url);
        expect(rtlMainThreadPlugin.status).toBe('error');
    });

    it('should lazy load the plugin if deferred', async () => {
        // use success spy to make sure test case does not throw exception
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(broadcastMockSuccess as any);
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(rtlMainThreadPlugin.status).toBe('deferred');

        // this is really a fire and forget
        rtlMainThreadPlugin.lazyLoad();
        await sleep(1);
        expect(broadcastSpy).toHaveBeenCalledWith(SyncRTLPluginStateMessageName, {pluginStatus: 'loading', pluginURL: url});
        expect(rtlMainThreadPlugin.status).toBe('loaded');
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
});
