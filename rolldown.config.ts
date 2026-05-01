import {defineConfig, type ModuleFormat, type RolldownOptions, type InputOption} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';
import {plugins} from './build/rolldown_plugins';
import banner from './build/banner';
import packageJSON from './package.json' with {type: 'json'};

const production = process.env.BUILD === 'production';
const typesOnly = process.env.BUILD === 'types';
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

const dtsBundle: RolldownOptions = {
    input: {'maplibre-gl': 'src/index.ts'},
    output: {
        dir: 'dist',
        format: 'es',
    },
    external: Object.keys(packageJSON.dependencies),
    plugins: [dts({emitDtsOnly: true, tsgo: true})],
};

export default defineConfig(typesOnly ? [dtsBundle] : [
    bundle('src/index.ts', `dist/maplibre-gl${outputPostfix}.mjs`, 'es'),
    bundle('src/source/worker.ts', `dist/maplibre-gl-worker${outputPostfix}.mjs`, 'es'),
    ...(production ? [dtsBundle] : []),
]);
