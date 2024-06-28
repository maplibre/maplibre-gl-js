
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import strip from '@rollup/plugin-strip';
import {Plugin} from 'rollup';
import json from '@rollup/plugin-json';

// Common set of plugins/transformations shared across different rollup
// builds (main maplibre bundle, style-spec package, benchmarks bundle)

export const nodeResolve = resolve({
    browser: true,
    preferBuiltins: false
});

export const plugins = (production: boolean, minified: boolean): Plugin[] => [
    json(),
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
        functions: ['PerformanceUtils.*']
    }),
    minified && terser({
        compress: {
            // eslint-disable-next-line camelcase
            pure_getters: true,
            passes: 3
        },
        sourceMap: true
    }),
    nodeResolve,
    typescript(),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    })
].filter(Boolean) as Plugin[];

export const watchStagingPlugin: Plugin = {
    name: 'watch-external',
    buildStart() {
        this.addWatchFile('staging/maplibregl/index.js');
        this.addWatchFile('staging/maplibregl/shared.js');
        this.addWatchFile('staging/maplibregl/worker.js');
    }
};
