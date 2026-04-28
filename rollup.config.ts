import {type RollupOptions} from 'rollup';
import {createBundleConfig, outputPostfix} from './build/rollup_bundle_config';

const config: RollupOptions[] = [
    createBundleConfig('src/index.ts', `dist/maplibre-gl${outputPostfix}.mjs`, 'es'),
    createBundleConfig('src/source/worker.ts', `dist/maplibre-gl-worker${outputPostfix}.mjs`, 'es')
];

export default config;
