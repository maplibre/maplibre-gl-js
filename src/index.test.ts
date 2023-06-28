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

    test('#addProtocol - getJSON', done => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, {'foo': 'bar'});
            return {cancel: () => {}};
        });
        getJSON({url: 'custom://test/url/json'}, (error, data) => {
            expect(error).toBeFalsy();
            expect(data).toEqual({foo: 'bar'});
            expect(protocolCallbackCalled).toBeTruthy();
            done();
        });
    });

    test('#addProtocol - getArrayBuffer', done => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, new ArrayBuffer(1));
            return {cancel: () => {}};
        });
        getArrayBuffer({url: 'custom://test/url/getArrayBuffer'}, async (error, data) => {
            expect(error).toBeFalsy();
            expect(data).toBeInstanceOf(ArrayBuffer);
            expect(protocolCallbackCalled).toBeTruthy();
            done();
        });
    });

    test('#addProtocol - returning ImageBitmap for getImage', done => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, new ImageBitmap());
            return {cancel: () => {}};
        });

        ImageRequest.getImage({url: 'custom://test/url/getImage'}, async (error, img) => {
            expect(error).toBeFalsy();
            expect(img).toBeInstanceOf(ImageBitmap);
            expect(protocolCallbackCalled).toBeTruthy();
            done();
        });
    });

    test('#addProtocol - returning HTMLImageElement for getImage', done => {
        let protocolCallbackCalled = false;
        maplibre.addProtocol('custom', (reqParam, callback) => {
            protocolCallbackCalled = true;
            callback(null, new Image());
            return {cancel: () => {}};
        });
        ImageRequest.getImage({url: 'custom://test/url/getImage'}, async (error, img) => {
            expect(error).toBeFalsy();
            expect(img).toBeInstanceOf(HTMLImageElement);
            expect(protocolCallbackCalled).toBeTruthy();
            done();
        });
    });

    test('#addProtocol - error', () => {
        maplibre.addProtocol('custom', (reqParam, callback) => {
            callback(new Error('error'));
            return {cancel: () => { }};
        });

        getJSON({url: 'custom://test/url/json'}, (error) => {
            expect(error).toBeTruthy();
        });
    });

    test('#addProtocol - Cancel request', () => {
        let cancelCalled = false;
        maplibre.addProtocol('custom', () => {
            return {cancel: () => {
                cancelCalled = true;
            }};
        });
        const request = getJSON({url: 'custom://test/url/json'}, () => { });
        request.cancel();
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
