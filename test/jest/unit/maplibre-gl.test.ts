import maplibregl from '../../../rollup/build/tsc';

test('maplibregl', () => {
    expect(typeof maplibregl.workerCount).toBe('number');
});

export {};
