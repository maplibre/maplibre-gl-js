import {FakeServer, fakeServer} from 'nise';
import {rtlMainThreadPluginFactory} from './rtl_text_plugin_main_thread';
import {sleep} from '../util/test/util';
import {browser} from '../util/browser';
import {Dispatcher} from '../util/dispatcher';

const rtlMainThreadPlugin = rtlMainThreadPluginFactory();

describe('RTLMainThreadPlugin', () => {
    let server: FakeServer;
    let broadcastSpy: jest.SpyInstance;
    beforeEach(() => {
        server = fakeServer.create();
        global.fetch = null;
        // Reset the singleton instance before each test
        rtlMainThreadPlugin.clearRTLTextPlugin();
        broadcastSpy = jest.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => { return Promise.resolve({} as any); });
    });

    afterEach(() => {
        server.restore();
        broadcastSpy.mockRestore();
    });

    it('should get the RTL text plugin status', () => {
        const status = rtlMainThreadPlugin.getRTLTextPluginStatus();
        expect(status).toBe('unavailable');
    });

    it('should set the RTL text plugin and download it', async () => {
        const url = 'http://example.com/plugin';
        server.respondWith(new ArrayBuffer(0));

        const promise = rtlMainThreadPlugin.setRTLTextPlugin(url);
        await sleep(0);
        server.respond();
        await promise;
        expect(rtlMainThreadPlugin.pluginURL).toEqual(url);
    });

    it('should set the RTL text plugin but deffer downloading', async () => {
        const url = 'http://example.com/plugin';
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(server.requests).toHaveLength(0);
        expect(rtlMainThreadPlugin.pluginStatus).toBe('deferred');
    });

    it('should throw if the plugin is already set', async () => {
        const url = 'http://example.com/plugin';
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        await expect(rtlMainThreadPlugin.setRTLTextPlugin(url)).rejects.toThrow('setRTLTextPlugin cannot be called multiple times.');
    });

    it('should throw if the plugin url is not set', async () => {
        const spy = jest.spyOn(browser, 'resolveURL').mockImplementation(() => { return ''; });
        await expect(rtlMainThreadPlugin.setRTLTextPlugin(null)).rejects.toThrow('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
        spy.mockRestore();
    });

    it('should be in error state if download fails', async () => {
        const url = 'http://example.com/plugin';
        server.respondWith(request => request.respond(404));
        const promise = rtlMainThreadPlugin.setRTLTextPlugin(url);
        await sleep(0);
        server.respond();
        await promise;
        expect(rtlMainThreadPlugin.pluginURL).toEqual(url);
        expect(rtlMainThreadPlugin.pluginStatus).toBe('error');
    });

    it('should lazy load the plugin if deffered', async () => {
        const url = 'http://example.com/plugin';
        server.respondWith(new ArrayBuffer(0));
        await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
        expect(server.requests).toHaveLength(0);
        expect(rtlMainThreadPlugin.pluginStatus).toBe('deferred');
        const promise = rtlMainThreadPlugin.lazyLoadRTLTextPlugin();
        await sleep(0);
        server.respond();
        await promise;
        expect(rtlMainThreadPlugin.pluginStatus).toBe('loaded');
    });
});
