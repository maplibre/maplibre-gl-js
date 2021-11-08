import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from 'rollup-plugin-replace';
import {plugins} from '../build/rollup_plugins';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import buble from 'rollup-plugin-buble';

let styles = ['https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'];

if (process.env.MAPLIBRE_STYLES) {
    styles = process.env.MAPLIBRE_STYLES
        .split(',')
        .map(style => style.match(/\.json$/) ? require(style) : style);
}

const replaceConfig = {
    'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION),
    'process.env.MAPLIBRE_STYLES': JSON.stringify(styles),
    'process.env.NODE_ENV': JSON.stringify('production')
};

const allPlugins = plugins(true, true).concat(replace(replaceConfig));
const intro = fs.readFileSync('rollup/bundle_prelude.js', 'utf8');

const splitConfig = (name) => [{
    input: [`rollup/build/tsc/bench/${name}/benchmarks.js`, 'rollup/build/tsc/src/source/worker.js'],
    output: {
        dir: `rollup/build/benchmarks/${name}`,
        format: 'amd',
        indent: false,
        sourcemap: 'inline',
        chunkFileNames: 'shared.js'
    },
    plugins: allPlugins
}, {
    input: `rollup/benchmarks_${name}.js`,
    output: {
        file: `bench/${name}/benchmarks_generated.js`,
        format: 'umd',
        indent: false,
        sourcemap: true,
        intro
    },
    treeshake: false,
    plugins: [sourcemaps()],
}];

const viewConfig = {
    input: 'rollup/build/tsc/bench/benchmarks_view.jsx',
    output: {
        name: 'Benchmarks',
        file: 'bench/benchmarks_view_generated.js',
        format: 'umd',
        indent: false,
        sourcemap: false
    },
    plugins: [
        buble({transforms: {dangerousForOf: true}, objectAssign: true}),
        resolve({browser: true, preferBuiltins: false}),
        commonjs(),
        replace(replaceConfig)
    ]
};

export default splitConfig('versions').concat(splitConfig('styles')).concat(viewConfig);
