import {beforeEach, describe, expect, test, vi} from 'vitest';
import {type PluginState} from './rtl_text_plugin_status';
import {rtlWorkerPlugin} from './rtl_text_plugin_worker';

describe('RTLWorkerPlugin', () => {
    beforeEach(() => {
        // This is a static class, so we need to reset the properties before each test
        rtlWorkerPlugin.processStyledBidirectionalText = null;
        rtlWorkerPlugin.processBidirectionalText = null;
        rtlWorkerPlugin.applyArabicShaping = null;
    });

    test('should throw if already parsed', () => {
        const rtlTextPlugin = {
            applyArabicShaping: vi.fn(),
            processBidirectionalText: vi.fn(),
            processStyledBidirectionalText: vi.fn(),
        };

        rtlWorkerPlugin.setMethods(rtlTextPlugin);
        expect(() => {
            rtlWorkerPlugin.setMethods(rtlTextPlugin);
        }).toThrow('RTL text plugin already registered.');
    });

    test('should move RTL plugin from unavailable to deferred', async () => {
        rtlWorkerPlugin.pluginURL = '';
        rtlWorkerPlugin.pluginStatus = 'unavailable';

        const mockMessage: PluginState = {
            pluginURL: 'https://somehost/somescript',
            pluginStatus: 'deferred'
        };

        await rtlWorkerPlugin.syncState(mockMessage, vi.fn());

        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('deferred');
    });

    test('should not change RTL plugin status if already parsed', async () => {
        const originalUrl = 'https://somehost/somescript1';
        rtlWorkerPlugin.pluginURL = originalUrl;
        rtlWorkerPlugin.pluginStatus = 'loaded';
        rtlWorkerPlugin.setMethods({
            applyArabicShaping: vi.fn(),
            processBidirectionalText: vi.fn(),
            processStyledBidirectionalText: vi.fn(),
        });
        const mockMessage: PluginState = {
            pluginURL: 'https://somehost/somescript2',
            pluginStatus: 'loading'
        };

        const workerResult: PluginState = await await rtlWorkerPlugin.syncState(mockMessage, vi.fn());

        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('loaded');
        expect(rtlWorkerPlugin.pluginURL).toBe(originalUrl);

        expect(workerResult.pluginStatus).toBe('loaded');
        expect(workerResult.pluginURL).toBe(originalUrl);
    });

    test('should do a full cycle of rtl loading synchronously', async () => {
        const originalUrl = 'https://somehost/somescript1';
        const loadScriptsMock = vi.fn().mockImplementation((_) => {
            rtlWorkerPlugin.setMethods({
                applyArabicShaping: vi.fn(),
                processBidirectionalText: vi.fn(),
                processStyledBidirectionalText: vi.fn(),
            });
        });

        const workerResult: PluginState = await rtlWorkerPlugin.syncState({
            pluginURL: originalUrl,
            pluginStatus: 'loading'
        }, loadScriptsMock);

        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('loaded');
        expect(rtlWorkerPlugin.pluginURL).toBe(originalUrl);
        expect(workerResult.pluginStatus).toBe('loaded');
        expect(workerResult.pluginURL).toBe(originalUrl);
    });

    test('should do a full cycle of rtl loading asynchronously', async () => {
        const originalUrl = 'https://somehost/somescript1';
        const loadScriptsMock = vi.fn().mockImplementation((_) => {
            setTimeout(() => {
                rtlWorkerPlugin.setMethods({
                    applyArabicShaping: vi.fn(),
                    processBidirectionalText: vi.fn(),
                    processStyledBidirectionalText: vi.fn(),
                });
            }, 10);
        });

        const workerResult: PluginState = await rtlWorkerPlugin.syncState({
            pluginURL: originalUrl,
            pluginStatus: 'loading'
        }, loadScriptsMock);

        expect(rtlWorkerPlugin.getRTLTextPluginStatus()).toBe('loaded');
        expect(rtlWorkerPlugin.pluginURL).toBe(originalUrl);
        expect(workerResult.pluginStatus).toBe('loaded');
        expect(workerResult.pluginURL).toBe(originalUrl);
    });

    test('should fail loading on timeout', async () => {
        const originalUrl = 'https://somehost/somescript1';
        const loadScriptsMock = vi.fn().mockImplementation(() => {});

        (rtlWorkerPlugin as any).TIMEOUT = 1;

        await expect(rtlWorkerPlugin.syncState({
            pluginURL: originalUrl,
            pluginStatus: 'loading'
        }, loadScriptsMock)
        ).rejects.toThrow('RTL Text Plugin failed to import scripts from https://somehost/somescript1');
    });
});
