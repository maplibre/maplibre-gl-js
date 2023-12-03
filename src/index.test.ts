import {config} from './util/config';
import maplibre from './index';
import {getJSON, getArrayBuffer} from './util/ajax';
import {ImageRequest} from './util/image_request';
import {isAbortError} from './util/abort_error';

describe('maplibre', () => {
    beforeEach(() => {
        config.REGISTERED_PROTOCOLS = {};
    });
    afterAll(() => {
        config.REGISTERED_PROTOCOLS = {};
    });

    test('workerCount', () => {
        expect(typeof maplibre.workerCount === 'number').toBeTruthy();
    });

    test('addProtocol', () => {
        const protocolName = 'custom';
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);

        maplibre.addProtocol(protocolName, async () => Promise.resolve({} as any));
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);
    });

    test('removeProtocol', () => {
        const protocolName = 'custom';
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);

        maplibre.addProtocol(protocolName, () => Promise.resolve({} as any));
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);

        maplibre.removeProtocol(protocolName);
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);
    });

    test('#addProtocol - getJSON', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', () => {
            protocolCallbackCalled = true;
            return Promise.resolve({data: {'foo': 'bar'}});
        });
        const response = await getJSON({url: 'custom://test/url/json'}, new AbortController());
        expect(response.data).toEqual({foo: 'bar'});
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - getArrayBuffer', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', () => {
            protocolCallbackCalled = true;
            return Promise.resolve({data: new ArrayBuffer(1), cacheControl: 'cache-control', expires: 'expires'});
        });
        const response = await getArrayBuffer({url: 'custom://test/url/getArrayBuffer'}, new AbortController());
        expect(response.data).toBeInstanceOf(ArrayBuffer);
        expect(response.cacheControl).toBe('cache-control');
        expect(response.expires).toBe('expires');
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - returning ImageBitmap for getImage', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', () => {
            protocolCallbackCalled = true;
            return Promise.resolve({data: new ImageBitmap()});
        });

        const img = await ImageRequest.getImage({url: 'custom://test/url/getImage'}, new AbortController());
        expect(img.data).toBeInstanceOf(ImageBitmap);
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - returning HTMLImageElement for getImage', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', () => {
            protocolCallbackCalled = true;
            return Promise.resolve({data: new Image()});
        });
        const img = await ImageRequest.getImage({url: 'custom://test/url/getImage'}, new AbortController());
        expect(img.data).toBeInstanceOf(HTMLImageElement);
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - error', () => {
        maplibre.addProtocol('custom', () => Promise.reject(new Error('test error')));

        getJSON({url: 'custom://test/url/json'}, new AbortController()).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('#addProtocol - Cancel request', async () => {
        let cancelCalled = false;
        maplibre.addProtocol('custom', (_req, abortController) => {
            abortController.signal.addEventListener('abort', () => {
                cancelCalled = true;
            });
            return Promise.resolve({} as any);
        });
        const abortController = new AbortController();
        const promise = getJSON({url: 'custom://test/url/json'}, abortController);
        abortController.abort();
        try {
            await promise;
        } catch (err) {
            expect(isAbortError(err)).toBeTruthy();
        }

        expect(cancelCalled).toBeTruthy();
    });

    test('version', () => {
        expect(typeof maplibre.version === 'string').toBeTruthy();

        // Semver regex: https://gist.github.com/jhorsman/62eeea161a13b80e39f5249281e17c39
        // Backslashes are doubled to escape them
        const regexp = new RegExp('^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+)?$');
        expect(regexp.test(maplibre.version)).toBeTruthy();
    });
});
