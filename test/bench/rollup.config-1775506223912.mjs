import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps2';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import { visualizer } from 'rollup-plugin-visualizer';
import { execSync } from 'child_process';

const { BUNDLE } = process.env;
const stats = BUNDLE === 'stats';
// Common set of plugins/transformations shared across different rollup
// builds (main maplibre bundle, style-spec package, benchmarks bundle)
const nodeResolve = resolve({
    browser: true,
    preferBuiltins: false
});
const plugins = (production) => [
    json(),
    // https://github.com/zaach/jison/issues/351
    replace({
        preventAssignment: true,
        include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
        delimiters: ['', ''],
        values: {
            '_token_stack:': ''
        }
    }),
    production && terser({
        compress: {
            pure_getters: true,
            passes: 3
        },
        sourceMap: true
    }),
    nodeResolve,
    typescript(),
    commonjs({
        // global keyword handling causes Webpack compatibility issues, so we disabled it:
        // https://github.com/mapbox/mapbox-gl-js/pull/6956
        ignoreGlobal: true
    }),
    // generate bundle stats in multiple formats (treemap, sunburst, etc...)
    ...(stats ? ['treemap', 'sunburst', 'flamegraph', 'network'].map(template => visualizer({
        template: template,
        title: `gl-js-${template}`,
        filename: `staging/${template}.html`,
        gzipSize: true,
        brotliSize: true,
        sourcemap: true,
        open: true
    })) : [])
].filter(Boolean);
const watchStagingPlugin = {
    name: 'watch-external',
    buildStart() {
        this.addWatchFile('staging/maplibregl/index.js');
        this.addWatchFile('staging/maplibregl/shared.js');
        this.addWatchFile('staging/maplibregl/worker.js');
    }
};

/**
 * This script generates the benchmark bundles for the benchmark suite.
 * It does it by replacing the index.ts file of maplibre-gl-js with a local index.ts file that registers the relevant benchmarks.
 * The thing to note here is that the index.ts file of the benchmarks needs to export the same thing the original index.ts file is exporting.
 */
let styles = ['https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'];
const loadStyle = (styleURL) => {
    if (styleURL.match(/^(?!.*http).*\.json$/)) {
        const data = fs.readFileSync(styleURL, 'utf8');
        return JSON.parse(data);
    }
    else {
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
const splitConfig = (name) => [{
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
const viewConfig = {
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
var rollup_config_benchmarks = splitConfig('versions').concat(splitConfig('styles')).concat(viewConfig);

export { rollup_config_benchmarks as default };
