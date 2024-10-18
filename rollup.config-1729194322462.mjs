import fs, { readFileSync } from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps2';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import strip from '@rollup/plugin-strip';
import json from '@rollup/plugin-json';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// Common set of plugins/transformations shared across different rollup
// builds (main maplibre bundle, style-spec package, benchmarks bundle)
const nodeResolve = resolve({
    browser: true,
    preferBuiltins: false
});
const plugins = (production, minified) => [
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
].filter(Boolean);
const watchStagingPlugin = {
    name: 'watch-external',
    buildStart() {
        this.addWatchFile('staging/maplibregl/index.js');
        this.addWatchFile('staging/maplibregl/shared.js');
        this.addWatchFile('staging/maplibregl/worker.js');
    }
};

const packageJSONPath = join(dirname(fileURLToPath('file:///home/maplibre-gl-js/build/banner.ts')), '../package.json');
const packageJSON = JSON.parse(readFileSync(packageJSONPath, 'utf8'));
var banner = `/**
 * MapLibre GL JS
 * @license 3-Clause BSD. Full text of license: https://github.com/maplibre/maplibre-gl-js/blob/v${packageJSON.version}/LICENSE.txt
 */`;

const { BUILD, MINIFY } = process.env;
const minified = MINIFY === 'true';
const production = BUILD === 'production';
const outputFile = production ? (minified ? 'dist/maplibre-gl.js' : 'dist/maplibre-gl-unminified.js') : 'dist/maplibre-gl-dev.js';
const config = [{
        // Before rollup you should run build-tsc to transpile from typescript to javascript (except when running rollup in watch mode)
        // Rollup will use code splitting to bundle GL JS into three "chunks":
        // - staging/maplibregl/index.js: the main module, plus all its dependencies not shared by the worker module
        // - staging/maplibregl/worker.js: the worker module, plus all dependencies not shared by the main module
        // - staging/maplibregl/shared.js: the set of modules that are dependencies of both the main module and the worker module
        //
        // This is also where we do all of our source transformations using the plugins.
        input: ['src/index.ts', 'src/source/worker.ts'],
        output: {
            dir: 'staging/maplibregl',
            format: 'amd',
            sourcemap: 'inline',
            indent: false,
            chunkFileNames: 'shared.js',
            amd: {
                autoId: true,
            },
            minifyInternalExports: production
        },
        onwarn: (message) => {
            console.error(message);
            throw message;
        },
        treeshake: production,
        plugins: plugins(production, minified)
    }, {
        // Next, bundle together the three "chunks" produced in the previous pass
        // into a single, final bundle. See rollup/bundle_prelude.js and
        // rollup/maplibregl.js for details.
        input: 'build/rollup/maplibregl.js',
        output: {
            name: 'maplibregl',
            file: outputFile,
            format: 'umd',
            sourcemap: true,
            indent: false,
            intro: fs.readFileSync('build/rollup/bundle_prelude.js', 'utf8'),
            banner
        },
        watch: {
            // give the staging chunks a chance to finish before rebuilding the dev build
            buildDelay: 1000
        },
        treeshake: false,
        plugins: [
            // Ingest the sourcemaps produced in the first step of the build.
            // This is the only reason we use Rollup for this second pass
            sourcemaps(),
            // When running in development watch mode, tell rollup explicitly to watch
            // for changes to the staging chunks built by the previous step. Otherwise
            // only they get built, but not the merged dev build js
            ...production ? [] : [watchStagingPlugin]
        ],
    }];

export { config as default };
