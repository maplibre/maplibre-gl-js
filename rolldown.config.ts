import {defineConfig, type ModuleFormat, type RolldownOptions, type InputOption} from 'rolldown';
import {plugins} from './build/rolldown_plugins';
import banner from './build/banner';

const production = process.env.BUILD === 'production';
const outputPostfix = production ? '' : '-dev';

/** Rolldown config for bundling a single entry point into a single output file. */
const bundle = (input: InputOption, file: string, format: ModuleFormat): RolldownOptions => ({
    input,
    // Match the previous rollup setup which used @rollup/plugin-node-resolve
    // with `browser: true, preferBuiltins: false`.
    platform: 'browser',
    // Override package.json's `"sideEffects": ["*.css"]` for our own source —
    // ~22 modules under `src/` rely on top-level `register(...)` calls
    // (see src/util/web_worker_transfer.ts) that strict tree-shaking would
    // otherwise drop, breaking worker IPC ("can't deserialize unregistered
    // class …").
    treeshake: production ? {
        moduleSideEffects: [
            {test: /[\\/]src[\\/].*\.ts$/, sideEffects: true},
            {test: /\.css$/, sideEffects: true},
        ],
    } : false,
    output: {
        name: 'maplibregl',
        file,
        format,
        sourcemap: true,
        banner,
        // Oxc minifier on production, dead-code-elimination only otherwise.
        // (`'dce-only'` is also Rolldown's default.)
        minify: production ? true : 'dce-only',
    },
    plugins: plugins(production),
});

export default defineConfig([
    bundle('src/index.ts', `dist/maplibre-gl${outputPostfix}.mjs`, 'es'),
    bundle('src/source/worker.ts', `dist/maplibre-gl-worker${outputPostfix}.mjs`, 'es'),
]);
