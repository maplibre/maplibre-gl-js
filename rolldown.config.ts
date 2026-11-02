import {defineConfig, type RolldownOptions} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';
import banner from './build/banner';
import packageJSON from './package.json' with {type: 'json'};

const production = process.env.BUILD === 'production';
const typesOnly = process.env.BUILD === 'types';
const outputPostfix = production ? '' : '-dev';

const dtsBundle: RolldownOptions = {
    input: {'maplibre-gl': 'src/index.ts'},
    output: {
        dir: 'dist',
        format: 'es',
    },
    external: Object.keys(packageJSON.dependencies),
    plugins: [dts({emitDtsOnly: true, generator: 'oxc'})],
};

/**
 * The main bundle and the worker are built separately so that each one is a single self-contained
 * file: a chunk shared between them would be a second file that browsers cache independently of
 * the worker, see https://github.com/maplibre/maplibre-gl-js/issues/8621.
 */
const bundleOptions: RolldownOptions = {
    platform: 'browser',
    treeshake: production,
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true,
        banner,
        minify: production ? true : 'dce-only',
        entryFileNames: `[name]${outputPostfix}.mjs`,
    },
};

const config: RolldownOptions[] = defineConfig(typesOnly ? [dtsBundle] : [
    {...bundleOptions, input: {'maplibre-gl': 'src/index.ts'}},
    {...bundleOptions, input: {'maplibre-gl-worker': 'src/source/worker.ts'}},
    ...(production ? [dtsBundle] : []),
]);

export default config;
