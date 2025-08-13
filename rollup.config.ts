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
// ESM build configuration
    {
    // First pass for ESM: Split into ES modules
        input: ['src/index.ts', 'src/source/worker.ts'],
        output: {
            dir: 'staging/esm',
            format: 'es',
            sourcemap: 'inline',
            indent: false,
            chunkFileNames: '[name].js',
            entryFileNames: '[name].js',
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
