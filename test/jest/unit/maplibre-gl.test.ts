import maplibregl from '../../../rollup/build/tsc';

test('maplibregl', () => {
    expect(typeof maplibregl.workerCount).toBe('number');
});

test('maplibregl', () => {
    expect(maplibregl.workerCount).not.toBeNull();
});

export {};
