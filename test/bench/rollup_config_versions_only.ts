import {execSync} from 'child_process';
import replace from '@rollup/plugin-replace';
import {plugins} from '../../build/rollup_plugins';
import {type RollupOptions} from 'rollup';

const gitDesc = execSync('git describe --all --always --dirty').toString().trim();
const gitRef = execSync('git rev-parse --short=7 HEAD').toString().trim();
const benchVersion = gitDesc.replace(/^(heads|tags)\//, '') + (gitDesc.match(/^heads\//) ? ` ${gitRef}` : '');

const replaceConfig = {
    preventAssignment: true,
    'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION || benchVersion),
    'process.env.MAPLIBRE_STYLES': JSON.stringify(['https://tiles.openfreemap.org/styles/liberty']),
    'process.env.NODE_ENV': JSON.stringify('production')
};

const allPlugins = plugins(true).concat(replace(replaceConfig));

const config: RollupOptions[] = [{
    input: 'test/bench/versions/index.ts',
    output: {
        file: 'test/bench/versions/benchmarks_generated.mjs',
        format: 'es',
        sourcemap: true,
        indent: false,
    },
    plugins: allPlugins
}, {
    input: 'src/source/worker.ts',
    output: {
        file: 'test/bench/versions/benchmarks_worker.mjs',
        format: 'es',
        sourcemap: true,
        indent: false,
    },
    plugins: allPlugins
}];

export default config;
