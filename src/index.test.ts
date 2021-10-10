import maplibre from './index';

describe('maplibre', () => {
    test('workerCount', () => {
        expect(typeof maplibre.workerCount === 'number').toBeTruthy();
    });
});
