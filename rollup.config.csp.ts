import {createBundleConfig, outputPostfix} from './build/rollup_bundle_config';

// a config for generating a special GL JS bundle with static web worker code (in a separate file)
// https://github.com/mapbox/mapbox-gl-js/issues/6058

const configs = [
    // UMD/IIFE builds for CSP
    createBundleConfig('src/index.ts', `dist/maplibre-gl-csp${outputPostfix}.js`, 'umd'),
    createBundleConfig('src/source/worker.ts', `dist/maplibre-gl-csp-worker${outputPostfix}.js`, 'iife'),

    // ESM builds for CSP. Worker filename has no `-dev` postfix to keep
    // auto-detection working in both build modes (see rollup.config.ts).
    createBundleConfig('src/index.ts', `dist/maplibre-gl-csp${outputPostfix}.mjs`, 'es'),
    createBundleConfig('src/source/worker.ts', 'dist/maplibre-gl-csp-worker.mjs', 'es')
];

export default configs;
