import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps2';
import replace from '@rollup/plugin-replace';
import {plugins, nodeResolve} from '../../build/rollup_plugins';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import {execSync} from 'child_process';
import {RollupOptions} from 'rollup';

/**
 * This script generates the benchmark bundles for the benchmark suite.
 * It does it by replacing the index.ts file of maplibre-gl-js with a local index.ts file that registers the relevant benchmarks.
 * The thing to note here is that the index.ts file of the benchmarks needs to export the same thing the original index.ts file is exporting.
 */

let styles = ['https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'];

const loadStyle = (styleURL: string): string => {
    if (styleURL.match(/^(?!.*http).*\.json$/)) {
        const data = fs.readFileSync(styleURL, 'utf8');
        return JSON.parse(data);
    } else {
        return styleURL;
    }
};

if (process.env.MAPLIBRE_STYLES) {
    styles = process.env.MAPLIBRE_STYLES
        .split(',')
        .map(loadStyle);
}

const gitDesc = execSync('git describe --all --always --dirty').toString().trim();
const gitRef = execSync('git rev-parse --short=7 HEAD').toString().trim();
const defaultBenchmarkVersion = gitDesc.replace(/^(heads|tags)\//, '') + (gitDesc.match(/^heads\//) ? ` ${gitRef}` : '');

const replaceConfig = {
    preventAssignment: true,
    'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION || defaultBenchmarkVersion),
    'process.env.MAPLIBRE_STYLES': JSON.stringify(styles),
    'process.env.NODE_ENV': JSON.stringify('production')
};

const allPlugins = plugins(true).concat(replace(replaceConfig));
const intro = fs.readFileSync('build/rollup/bundle_prelude.js', 'utf8');

const splitConfig = (name: string): RollupOptions[] => [{
    input: [`test/bench/${name}/index.ts`, 'src/source/worker.ts'],
    output: {
        dir: `staging/benchmarks/${name}`,
        format: 'amd',
        indent: false,
        sourcemap: 'inline',
        chunkFileNames: 'shared.js',
        amd: {
            autoId: true,
        },
    },
    plugins: allPlugins
}, {
    input: `test/bench/rollup/benchmarks_${name}.js`,
    output: {
        file: `test/bench/${name}/benchmarks_generated.js`,
        format: 'umd',
        indent: false,
        sourcemap: true,
        intro
    },
    treeshake: false,
    plugins: [sourcemaps()],
}];

const viewConfig: RollupOptions = {
    input: 'test/bench/benchmarks_view.tsx',
    output: {
        name: 'Benchmarks',
        file: 'test/bench/benchmarks_view_generated.js',
        format: 'umd',
        indent: false,
        sourcemap: false
    },
    plugins: [
        nodeResolve,
        typescript(),
        commonjs(),
        replace(replaceConfig)
    ].filter(Boolean)
};

export default splitConfig('versions').concat(splitConfig('styles')).concat(viewConfig);
