import {test} from '../util/test';
import fs from 'fs';

test('dev build contains asserts', (t) => {
    expect(
        fs.readFileSync('dist/maplibre-gl-dev.js', 'utf8').indexOf('canary assert') !== -1
    ).toBeTruthy();
    expect(
        fs.readFileSync('dist/maplibre-gl-dev.js', 'utf8').indexOf('canary debug run') !== -1
    ).toBeTruthy();
    t.end();
});
