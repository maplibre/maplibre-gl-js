import fs from 'fs';
import {plugins} from '../../build/rolldown_plugins';
import {execSync} from 'child_process';
import {defineConfig, type RolldownOptions} from 'rolldown';
import {replacePlugin} from 'rolldown/plugins';

// Each benchmark suite (versions, styles) emits a main bundle and a worker
// bundle the main bundle points at via `setWorkerUrl()`.

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

const replaceValues = {
    'process.env.BENCHMARK_VERSION': JSON.stringify(process.env.BENCHMARK_VERSION || defaultBenchmarkVersion),
    'process.env.MAPLIBRE_STYLES': JSON.stringify(styles),
    'process.env.NODE_ENV': JSON.stringify('production'),
};

const allPlugins = [...plugins(true), replacePlugin(replaceValues, {preventAssignment: true})];

const benchmarkSuiteConfig = (name: string): RolldownOptions[] => [{
    input: `test/bench/${name}/index.ts`,
    platform: 'browser',
    output: {
        file: `test/bench/${name}/benchmarks_generated.mjs`,
        format: 'es',
        sourcemap: true,
    },
    plugins: allPlugins,
}, {
    input: 'src/source/worker.ts',
    platform: 'browser',
    output: {
        file: `test/bench/${name}/benchmarks_worker.mjs`,
        format: 'es',
        sourcemap: true,
    },
    plugins: allPlugins,
}];

const viewConfig: RolldownOptions = {
    input: 'test/bench/benchmarks_view.tsx',
    platform: 'browser',
    output: {
        file: 'test/bench/benchmarks_view_generated.mjs',
        format: 'es',
        sourcemap: false,
    },
    plugins: [replacePlugin(replaceValues, {preventAssignment: true})],
};

const config: RolldownOptions[] = defineConfig([
    ...benchmarkSuiteConfig('versions'),
    ...benchmarkSuiteConfig('styles'),
    viewConfig,
]);

export default config;
