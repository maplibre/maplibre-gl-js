import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import {RollupOptions} from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import path from 'node:path';

const styleSpecRootDir =  path.resolve('src/style-spec/');
const config: RollupOptions[] = [{
    input: 'src/style-spec/style-spec.ts',
    output: [{
        file: 'dist/style-spec/index.mjs',
        format: 'es',
        sourcemap: true
    }, {
        name: 'maplibreGlStyleSpecification',
        file: 'dist/style-spec/index.cjs',
        format: 'umd',
        sourcemap: true
    }],
    plugins: [
        json(),
        resolve({rootDir: styleSpecRootDir}),
        // https://github.com/zaach/jison/issues/351
        replace({
            preventAssignment: true,
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        }),
        typescript({sourceRoot: styleSpecRootDir}),
        commonjs(),
    ]
}];
export default config;
