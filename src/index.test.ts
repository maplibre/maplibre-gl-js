import {config} from './util/config';
import maplibre from './index';
import {getJSON, getArrayBuffer} from './util/ajax';
import {ImageRequest} from './util/image_request';

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

        maplibre.addProtocol(protocolName, () => { return {cancel: () => { }}; });
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);
    });

    test('removeProtocol', () => {
        const protocolName = 'custom';
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);

        maplibre.addProtocol(protocolName, () => { return {cancel: () => { }}; });
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);

        maplibre.removeProtocol(protocolName);
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);
    });

    test('#addProtocol - getJSON', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, {'foo': 'bar'});
            return {cancel: () => {}};
        });
        const response = await getJSON({url: 'custom://test/url/json'}, new AbortController());
        expect(response.data).toEqual({foo: 'bar'});
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - getArrayBuffer', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (_reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, new ArrayBuffer(1), 'cache-control', 'expires');
            return {cancel: () => {}};
        });
        const response = await getArrayBuffer({url: 'custom://test/url/getArrayBuffer'}, new AbortController());
        expect(response.data).toBeInstanceOf(ArrayBuffer);
        expect(response.cacheControl).toBe('cache-control');
        expect(response.expires).toBe('expires');
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - returning ImageBitmap for getImage', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (_reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, new ImageBitmap());
            return {cancel: () => {}};
        });

        const img = await ImageRequest.getImage({url: 'custom://test/url/getImage'}, new AbortController());
        expect(img.data).toBeInstanceOf(ImageBitmap);
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - returning HTMLImageElement for getImage', async () => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, new Image());
            return {cancel: () => {}};
        });
        const img = await ImageRequest.getImage({url: 'custom://test/url/getImage'}, new AbortController());
        expect(img.data).toBeInstanceOf(HTMLImageElement);
        expect(protocolCallbackCalled).toBeTruthy();
    });

    test('#addProtocol - error', () => {
        maplibre.addProtocol('custom', (reqParam, callback) => {
            callback(new Error('error'));
            return {cancel: () => { }};
        });

        getJSON({url: 'custom://test/url/json'}, new AbortController()).catch((error) => {
            expect(error).toBeTruthy();
        });
    });

    test('#addProtocol - Cancel request', async () => {
        let cancelCalled = false;
        maplibre.addProtocol('custom', () => {
            return {cancel: () => {
                cancelCalled = true;
            }};
        });
        const abortController = new AbortController();
        const promise = getJSON({url: 'custom://test/url/json'}, abortController);
        abortController.abort();
        try {
            await promise;
        } catch (err) {
            expect(err.message).toBe('AbortError');
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
