import maplibregl from '../../../rollup/build/tsc';

test('Make sure, that maplibregl is defined', () => {
    expect(maplibregl).not.toBeNull();
});

test('Make sure, that maplibregl has workers', () => {
    expect(typeof maplibregl.workerCount).toBe('number');
});

test('Check that the tests also work the other way round', () => {
    expect(typeof maplibregl.workerCount).not.toBe('string');
});

export {};
