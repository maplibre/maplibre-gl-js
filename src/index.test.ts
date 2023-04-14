import config from './util/config';
import maplibre from './index';

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

        maplibre.addProtocol(protocolName, (reqParam, callback) => { return {cancel: () => { }}; });
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);
    });

    test('removeProtocol', () => {
        const protocolName = 'custom';
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);

        maplibre.addProtocol(protocolName, (reqParam, callback) => { return {cancel: () => { }}; });
        expect(Object.keys(config.REGISTERED_PROTOCOLS)[0]).toBe(protocolName);

        maplibre.removeProtocol(protocolName);
        expect(Object.keys(config.REGISTERED_PROTOCOLS)).toHaveLength(0);
    });

    test('version', () => {
        expect(typeof maplibre.version === 'string').toBeTruthy();

        // Semver regex: https://gist.github.com/jhorsman/62eeea161a13b80e39f5249281e17c39
        // Backslashes are doubled to escape them
        const regexp = new RegExp('^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+)?$');
        expect(regexp.test(maplibre.version)).toBeTruthy();
    });
});
