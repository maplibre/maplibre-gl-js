import fs from 'fs';
import replace from '@rollup/plugin-replace';
import {plugins, nodeResolve} from '../../build/rollup_plugins';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import {execSync} from 'child_process';
import {type RollupOptions} from 'rollup';

/**
 * Generates the benchmark bundles. Each benchmark suite (versions, styles) emits
 * two ESM bundles: a main bundle that registers benchmarks into a window global,
 * and a worker bundle that the main bundle points at via `setWorkerUrl()`.
 */

let styles = ['https://tiles.openfreemap.org/styles/liberty'];

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

const benchmarkSuiteConfig = (name: string): RollupOptions[] => [{
    input: `test/bench/${name}/index.ts`,
    output: {
        file: `test/bench/${name}/benchmarks_generated.mjs`,
        format: 'es',
        sourcemap: true,
        indent: false,
    },
    plugins: allPlugins
}, {
    input: 'src/source/worker.ts',
    output: {
        file: `test/bench/${name}/benchmarks_worker.mjs`,
        format: 'es',
        sourcemap: true,
        indent: false,
    },
    plugins: allPlugins
}];

const viewConfig: RollupOptions = {
    input: 'test/bench/benchmarks_view.tsx',
    output: {
        file: 'test/bench/benchmarks_view_generated.mjs',
        format: 'es',
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

const config: RollupOptions[] = benchmarkSuiteConfig('versions').concat(benchmarkSuiteConfig('styles')).concat(viewConfig);
export default config;
