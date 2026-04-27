import {createBundleConfig, outputPostfix} from './build/rollup_bundle_config';

// CSP-friendly UMD/IIFE bundle: avoids the regular UMD bundle's inlined-worker
// blob-URL trick, which requires `worker-src blob:` in strict CSP setups.
// https://github.com/mapbox/mapbox-gl-js/issues/6058
//
// There is no separate CSP-ESM bundle: the regular ESM build (`maplibre-gl.mjs`)
// already loads its worker from a sibling file URL with no blob involved, so it
// is CSP-friendly by construction.

const configs = [
    createBundleConfig('src/index.ts', `dist/maplibre-gl-csp${outputPostfix}.js`, 'umd'),
    createBundleConfig('src/source/worker.ts', `dist/maplibre-gl-csp-worker${outputPostfix}.js`, 'iife'),
];

export default configs;
