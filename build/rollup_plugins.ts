
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import {terser} from 'rollup-plugin-terser';
import minifyStyleSpec from './rollup_plugin_minify_style_spec';
import strip from '@rollup/plugin-strip';
import {Plugin} from 'rollup';
import {importAssertionsPlugin} from 'rollup-plugin-import-assert';

// Common set of plugins/transformations shared across different rollup
// builds (main maplibre bundle, style-spec package, benchmarks bundle)

export const nodeResolve = resolve({
    browser: true,
    preferBuiltins: false
});

export const plugins = (production: boolean): Plugin[] => [
    minifyStyleSpec(),
    importAssertionsPlugin(),
    // https://github.com/zaach/jison/issues/351
    replace({
        preventAssignment: true,
        include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
        delimiters: ['', ''],
        values: {
            '_token_stack:': ''
        }
    }),
    production && strip({
        sourceMap: true,
        functions: ['PerformanceUtils.*', 'Debug.*']
    }),
    production && terser({
        compress: {
            // eslint-disable-next-line camelcase
            pure_getters: true,
            passes: 3
        }
    }),
    nodeResolve,
    typescript(),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    })
].filter(Boolean);
