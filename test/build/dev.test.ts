import fs from 'fs';

describe('dev build', () => {
    test('contains asserts', () => {
        expect(
            fs.readFileSync('dist/maplibre-gl-dev.js', 'utf8').indexOf('canary debug run') !== -1
        ).toBeTruthy();
    });
});
