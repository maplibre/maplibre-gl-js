import {type InputOption, type ModuleFormat, type RollupOptions} from 'rollup';
import {plugins} from './build/rollup_plugins';
import banner from './build/banner';

const production = process.env.BUILD === 'production';
const outputPostfix = production ? '' : '-dev';

/** Rollup config for bundling a single entry point into a single output file. */
const bundle = (input: InputOption, file: string, format: ModuleFormat): RollupOptions => ({
    input,
    output: {
        name: 'maplibregl',
        file,
        format,
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: production,
    plugins: plugins(production)
});

const config: RollupOptions[] = [
    bundle('src/index.ts', `dist/maplibre-gl${outputPostfix}.mjs`, 'es'),
    bundle('src/source/worker.ts', `dist/maplibre-gl-worker${outputPostfix}.mjs`, 'es')
];

export default config;
