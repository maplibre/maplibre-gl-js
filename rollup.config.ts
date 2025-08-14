import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps2';
import {plugins, watchStagingPlugin} from './build/rollup_plugins';
import banner from './build/banner';
import {type RollupOptions} from 'rollup';

const {BUILD} = process.env;

const production = BUILD === 'production';
const outputFile = production ? 'dist/maplibre-gl.js' : 'dist/maplibre-gl-dev.js';
const esmOutputFile = production ? 'dist/maplibre-gl.mjs' : 'dist/maplibre-gl-dev.mjs';

const config: RollupOptions[] = [
    // Original AMD/UMD build configuration
    {
        // First pass: Bundle GL JS into three AMD chunks for UMD build
        // - staging/maplibregl/index.js: the main module, plus all its dependencies not shared by the worker module
        // - staging/maplibregl/worker.js: the worker module, plus all dependencies not shared by the main module
        // - staging/maplibregl/shared.js: the set of modules that are dependencies of both the main module and the worker module
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
        plugins: plugins(production)
    }, {
        // Second pass: Bundle together the three AMD chunks into a single UMD bundle
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
            buildDelay: 1000
        },
        treeshake: false,
        plugins: [
            sourcemaps(),
            ...production ? [] : [watchStagingPlugin]
        ],
    },
    // ESM build configuration
    {
        // First pass for ESM: Split into ES modules
        input: ['src/index_esm.ts', 'src/source/worker.ts'],
        output: {
            dir: 'staging/esm',
            format: 'es',
            sourcemap: 'inline',
            indent: false,
            chunkFileNames: '[name].js',
            entryFileNames: (chunkInfo) => {
                // Rename index_esm to index for consistency
                if (chunkInfo.name === 'index_esm') return 'index.js';
                return '[name].js';
            },
            minifyInternalExports: production,
            manualChunks: (id) => {
            // Shared utilities go into a shared chunk
                if (id.includes('src/util/') ||
                id.includes('src/style-spec/') ||
                id.includes('src/data/')) {
                    return 'shared';
                }
            }
        },
        onwarn: (message) => {
            console.error(message);
            throw message;
        },
        treeshake: production,
        plugins: plugins(production)
    }, {
    // Second pass for ESM: Bundle with module worker support
        input: 'build/rollup/maplibregl.esm.js',
        output: {
            file: esmOutputFile,
            format: 'es',
            sourcemap: true,
            indent: false,
            banner
        },
        watch: {
            buildDelay: 1000
        },
        treeshake: false,
        plugins: [
            sourcemaps(),
            {
                name: 'watch-esm-staging',
                buildStart() {
                    if (!production) {
                        this.addWatchFile('staging/esm/index.js');
                        this.addWatchFile('staging/esm/worker.js');
                        this.addWatchFile('staging/esm/shared.js');
                    }
                }
            }
        ]
    }, {
    // Separate ESM worker bundle
        input: 'src/source/worker.ts',
        output: {
            file: production ? 'dist/maplibre-gl-worker.mjs' : 'dist/maplibre-gl-worker-dev.mjs',
            format: 'es',
            sourcemap: true,
            indent: false,
            banner
        },
        treeshake: production,
        plugins: plugins(production)
    }];

export default config;
