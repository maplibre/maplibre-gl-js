import maplibre from './index';

describe('maplibre', () => {
    test('workerCount', () => {
        expect(typeof maplibre.workerCount === 'number').toBeTruthy();
    });

    test('version', () => {
        expect(typeof maplibre.version === 'string').toBeTruthy();

        // Semver regex: https://gist.github.com/jhorsman/62eeea161a13b80e39f5249281e17c39
        // Backslashes are doubled to escape them
        const regexp = new RegExp('^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+)?$');
        expect(regexp.test(maplibre.version)).toBeTruthy();
    });
});
