import {defineConfig, type ModuleFormat, type RolldownOptions, type InputOption} from 'rolldown';
import {plugins} from './build/rolldown_plugins';
import banner from './build/banner';

const production = process.env.BUILD === 'production';
const outputPostfix = production ? '' : '-dev';

const bundle = (input: InputOption, file: string, format: ModuleFormat): RolldownOptions => ({
    input,
    platform: 'browser',
    // Override package.json `"sideEffects": ["*.css"]` for our own source so
    // top-level `register(...)` calls (see src/util/web_worker_transfer.ts)
    // survive tree-shaking.
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
        minify: production ? true : 'dce-only',
    },
    plugins: plugins(production),
});

export default defineConfig([
    bundle('src/index.ts', `dist/maplibre-gl${outputPostfix}.mjs`, 'es'),
    bundle('src/source/worker.ts', `dist/maplibre-gl-worker${outputPostfix}.mjs`, 'es'),
]);
