import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from '@rollup/plugin-replace';
import {plugins, nodeResolve} from '../../build/rollup_plugins';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import {execSync} from 'child_process';
import {RollupOptions} from 'rollup';
import {importAssertions} from 'acorn-import-assertions';

let styles = ['https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'];

if (process.env.MAPLIBRE_STYLES) {
    styles = process.env.MAPLIBRE_STYLES
        .split(',')
        .map(style => style.match(/\.json$/) ? require(style) : style);
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
const intro = fs.readFileSync('rollup/bundle_prelude.js', 'utf8');

const splitConfig = (name: string): RollupOptions[] => [{
    input: [`test/bench/${name}/benchmarks.ts`, 'src/source/worker.ts'],
    output: {
        dir: `rollup/build/benchmarks/${name}`,
        format: 'amd',
        indent: false,
        sourcemap: 'inline',
        chunkFileNames: 'shared.js'
    },
    acornInjectPlugins: [importAssertions],
    plugins: allPlugins
}, {
    input: `rollup/benchmarks_${name}.js`,
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

// @ts-ignore
export default splitConfig('versions').concat(splitConfig('styles')).concat(viewConfig);
