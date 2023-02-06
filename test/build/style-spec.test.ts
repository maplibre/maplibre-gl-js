import {readdir} from 'fs/promises';

describe('@maplibre/maplibre-gl-style-spec npm package', () => {
    test('files build', async () => {
        expect(await readdir('dist/style-spec')).toMatchInlineSnapshot(`
[
  "index.cjs",
  "index.cjs.map",
  "index.d.ts",
  "index.mjs",
  "index.mjs.map",
]
`);
    });

    test('exports components directly, not behind `default` - https://github.com/mapbox/mapbox-gl-js/issues/6601', async  () => {

        expect(await import('../../dist/style-spec/index.cjs')).toHaveProperty('validate');
    });
});
