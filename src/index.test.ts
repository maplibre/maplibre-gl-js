import {describe, beforeEach, afterAll, afterEach, test, expect, vi} from 'vitest';
import {config} from './util/config.ts';
import {addProtocol, getWorkerCount, removeProtocol, getVersion, importScriptInWorkers} from './index.ts';
import {getJSON, getArrayBuffer} from './util/ajax.ts';
import {ImageRequest} from './util/image_request.ts';
import {Dispatcher} from './util/dispatcher.ts';
import {MessageType} from './util/actor_messages.ts';
import {terminateGlobalWorkers} from './util/test/util.ts';

describe('maplibre', () => {
    beforeEach(() => {
        config.REGISTERED_PROTOCOLS = {};
    });
    afterAll(() => {
        config.REGISTERED_PROTOCOLS = {};
    });

    test('workerCount', () => {
        expect(typeof getWorkerCount() === 'number').toBeTruthy();
    });

    test('addProtocol', () => {
        const protocolName = 'custom';
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);

        addProtocol(protocolName, async () => Promise.resolve({} as any));
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);
    });

    test('removeProtocol', () => {
        const protocolName = 'custom';
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);

        addProtocol(protocolName, () => Promise.resolve({} as any));
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);

        removeProtocol(protocolName);
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);
    });

    test('addProtocol - getJSON', async () => {
        const mockProtocol = vi.fn().mockResolvedValue({data: {'foo': 'bar'}});
        addProtocol('custom', mockProtocol);

        const response = await getJSON({url: 'custom://test/url/json'}, new AbortController());
        expect(response.data).toEqual({foo: 'bar'});
        expect(mockProtocol).toHaveBeenCalled();
    });

    test('addProtocol - getArrayBuffer', async () => {
        const mockProtocol = vi.fn().mockResolvedValue({data: new ArrayBuffer(1), cacheControl: 'cache-control', expires: 'expires'});
        addProtocol('custom', mockProtocol);

        const response = await getArrayBuffer({url: 'custom://test/url/getArrayBuffer'}, new AbortController());
        expect(response.data).toBeInstanceOf(ArrayBuffer);
        expect(response.cacheControl).toBe('cache-control');
        expect(response.expires).toBe('expires');
        expect(mockProtocol).toHaveBeenCalled();
    });

    test('addProtocol - null response for getArrayBuffer results in empty array buffer', async () => {
        const mockProtocol = vi.fn().mockResolvedValue({data: null, cacheControl: 'cache-control', expires: 'expires'});
        addProtocol('custom', mockProtocol);

        const response = await getArrayBuffer({url: 'custom://test/url/getArrayBuffer'}, new AbortController());
        expect(response.data).toBeInstanceOf(ArrayBuffer);
        expect(response.data.byteLength).toBe(0);
        expect(response.cacheControl).toBe('cache-control');
        expect(response.expires).toBe('expires');
        expect(mockProtocol).toHaveBeenCalled();
    });

    test('addProtocol - returning ImageBitmap for getImage', async () => {
        const mockProtocol = vi.fn().mockResolvedValue({data: new ImageBitmap()});
        addProtocol('custom', mockProtocol);

        const img = await ImageRequest.getImage({url: 'custom://test/url/getImage'}, new AbortController());
        expect(img.data).toBeInstanceOf(ImageBitmap);
        expect(mockProtocol).toHaveBeenCalled();
    });

    test('addProtocol - returning HTMLImageElement for getImage', async () => {
        const mockProtocol = vi.fn().mockResolvedValue({data: new Image()});
        addProtocol('custom', mockProtocol);

        const img = await ImageRequest.getImage({url: 'custom://test/url/getImage'}, new AbortController());
        expect(img.data).toBeInstanceOf(HTMLImageElement);
        expect(mockProtocol).toHaveBeenCalled();
    });

    test('addProtocol - error', async () => {
        const mockError = new Error('test error');
        const mockProtocol = vi.fn().mockRejectedValue(mockError);
        addProtocol('custom', mockProtocol);

        const successCallback = vi.fn();
        const errorCallback = vi.fn();
        await getJSON({url: 'custom://test/url/json'}, new AbortController()).then(successCallback, errorCallback);
        expect(successCallback).not.toHaveBeenCalled();
        expect(errorCallback).toHaveBeenCalledExactlyOnceWith(mockError);
        expect(mockProtocol).toHaveBeenCalled();
    });

    test('addProtocol - Cancel request', async () => {
        let cancelCalled = false;
        addProtocol('custom', (_req, abortController) => {
            abortController.signal.addEventListener('abort', () => {
                cancelCalled = true;
            });
            return Promise.resolve({} as any);
        });
        const abortController = new AbortController();
        const promise = getJSON({url: 'custom://test/url/json'}, abortController);
        abortController.abort();
        await promise;

        expect(cancelCalled).toBeTruthy();
    });

    test('version', () => {
        expect(typeof getVersion() === 'string').toBeTruthy();

        // Semver regex: https://gist.github.com/jhorsman/62eeea161a13b80e39f5249281e17c39
        // Backslashes are doubled to escape them
        const regexp = new RegExp('^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+)?$');
        expect(regexp.test(getVersion())).toBeTruthy();
    });
});

describe('importScriptInWorkers', () => {
    afterEach(terminateGlobalWorkers);

    test('re-imports scripts exactly once into the workers of a recreated global dispatcher', async () => {
        const broadcastSpy = vi.spyOn(Dispatcher.prototype, 'broadcast').mockResolvedValue([]);
        await importScriptInWorkers('plugin.js');
        terminateGlobalWorkers();
        broadcastSpy.mockClear();

        await importScriptInWorkers('plugin.js');

        expect(broadcastSpy).toHaveBeenCalledExactlyOnceWith(MessageType.importScript, 'plugin.js');
    });
});
