import {defineConfig, type ModuleFormat, type RolldownOptions, type InputOption} from 'rolldown';
import {plugins} from './build/rolldown_plugins';
import banner from './build/banner';

const production = process.env.BUILD === 'production';
const outputPostfix = production ? '' : '-dev';

const bundle = (input: InputOption, file: string, format: ModuleFormat): RolldownOptions => ({
    input,
    platform: 'browser',
    treeshake: production,
    output: {
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
