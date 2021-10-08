import mapboxgl from '.';

describe('mapboxgl', () => {
    test('workerCount', () => {
        expect(typeof mapboxgl.workerCount === 'number').toBeTruthy();
    });
});
