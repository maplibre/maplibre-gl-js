import fs from 'fs';

describe('dev build', () => {
    test('file is not empty', () => {
        expect(fs.readFileSync('dist/maplibre-gl-dev.js', 'utf8').length).toBeGreaterThan(0);
    });
});
