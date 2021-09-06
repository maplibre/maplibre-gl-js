import LngLat from '../../../../rollup/build/tsc/geo/lng_lat';

describe('toString', () => {
    test('Make sure, that LngLat(10, 20).toString() converts to an correct String', () => {
        expect(new LngLat(10, 20).toString()).toEqual('LngLat(10, 20)');
    });
    test('Check that the test also work the other way round', () => {
        expect(new LngLat(10, 20).toString()).not.toEqual('LngLat(20, 20)');
    });
});
