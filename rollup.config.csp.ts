import {plugins} from './build/rollup_plugins';
import banner from './build/banner';
import {InputOption, ModuleFormat, RollupOptions} from 'rollup';
import {importAssertions} from 'acorn-import-assertions';

// a config for generating a special GL JS bundle with static web worker code (in a separate file)
// https://github.com/mapbox/mapbox-gl-js/issues/6058

const config = (input: InputOption, file: string, format: ModuleFormat): RollupOptions => ({
    input,
    output: {
        name: 'maplibregl',
        file,
        format,
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: true,
    acornInjectPlugins: [ importAssertions ],
    plugins: plugins(true)
});

export default [
    config('src/index.ts', 'dist/maplibre-gl-csp.js', 'umd'),
    config('src/source/worker.ts', 'dist/maplibre-gl-csp-worker.js', 'iife')
];
