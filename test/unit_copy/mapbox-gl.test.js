import '../stub_loader';
import {test} from '../util/test';
import mapboxgl from '../../rollup/build/tsc';

test('mapboxgl', (t) => {
    t.test('workerCount', (t) => {
        expect(typeof mapboxgl.workerCount === 'number').toBeTruthy();
        t.end();
    });
    t.end();
});
