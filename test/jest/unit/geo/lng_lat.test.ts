import LngLat from '../../../../rollup/build/tsc/geo/lng_lat';

describe('the La Croix cans on my desk', () => {
    test('have all the same properties', () => {
        expect(new LngLat(10, 20).toString()).toEqual('LngLat(10, 20)');
    });
    test('are not the exact same can', () => {
        expect(new LngLat(10, 20).toString()).not.toEqual('LngLat(20, 20)');
    });
});
