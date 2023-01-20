import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import {RollupOptions} from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

const config: RollupOptions[] = [{
    input: 'src/style-spec/style-spec.ts',
    output: [{
        file: 'dist/style-spec/index.mjs',
        format: 'es',
        sourcemap: true
    },
    {
        name: 'maplibreGlStyleSpecification',
        file: 'dist/style-spec/index.cjs',
        format: 'umd',
        sourcemap: true
    }],
    plugins: [
        json(),
        resolve({
            browser: true,
            preferBuiltins: false,
            // Some users reference modules within style-spec package directly, instead of the bundle
            // This means that files within the style-spec package should NOT import files from the parent maplibre-gl-js tree.
            // This check will cause the build to fail on CI allowing these issues to be caught.
            jail: 'src/style-spec/',
        }),
        // https://github.com/zaach/jison/issues/351
        replace({
            preventAssignment: true,
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        }),
        typescript(),
        commonjs()
    ]
}];
export default config;
