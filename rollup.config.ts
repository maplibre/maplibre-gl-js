import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import {plugins} from './build/rollup_plugins';
import banner from './build/banner';
import {RollupOptions} from 'rollup';

const {BUILD} = process.env;
const production = BUILD === 'production';
const outputFile = production ? 'dist/maplibre-gl.js' : 'dist/maplibre-gl-dev.js';

const config: RollupOptions[] = [{
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
        chunkFileNames: 'shared.js'
    },
    treeshake: production,
    plugins: plugins(production)
}, {
    // Next, bundle together the three "chunks" produced in the previous pass
    // into a single, final bundle. See rollup/bundle_prelude.js and
    // rollup/maplibregl.js for details.
    input: 'build/rollup/maplibregl.js',
    output: {
        name: 'maplibregl',
        file: outputFile,
        format: 'umd',
        sourcemap: production ? true : 'inline',
        indent: false,
        intro: fs.readFileSync('build/rollup/bundle_prelude.js', 'utf8'),
        banner
    },
    treeshake: false,
    plugins: [
        // Ingest the sourcemaps produced in the first step of the build.
        // This is the only reason we use Rollup for this second pass
        sourcemaps()
    ],
}];

export default config;
