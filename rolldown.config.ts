import {defineConfig, type RolldownOptions} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';
import {plugins} from './build/rolldown_plugins';
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
    plugins: [dts({emitDtsOnly: true, oxc: true})],
};

const config: RolldownOptions[] = defineConfig(typesOnly ? [dtsBundle] : [
    {
        input: {
            'maplibre-gl': 'src/index.ts',
            'maplibre-gl-worker': 'src/source/worker.ts',
        },
        platform: 'browser',
        treeshake: production,
        output: {
            dir: 'dist',
            format: 'es',
            sourcemap: true,
            banner,
            minify: production ? true : 'dce-only',
            entryFileNames: `[name]${outputPostfix}.mjs`,
            chunkFileNames: `maplibre-gl-shared${outputPostfix}.mjs`,
        },
        plugins: plugins(production),
    },
    ...(production ? [dtsBundle] : []),
]);

export default config;
