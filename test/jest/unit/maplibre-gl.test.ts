import maplibregl from '../../../rollup/build/tsc';

describe('Make sure, that maplibregl is defined', () => {
    test('maplibregl is not null', () => {
        expect(maplibregl).not.toBeNull();
    });
});

describe('Make sure, that maplibregl has workers', () => {
    test('Check that the type of maplibregl.workerCount is number', () => {
        expect(typeof maplibregl.workerCount).toBe('number');
    });

    test('Check that the tests also work the other way round', () => {
        expect(typeof maplibregl.workerCount).not.toBe('string');
    });
});
