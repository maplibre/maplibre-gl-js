import path, {dirname} from 'path';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import {fileURLToPath, pathToFileURL} from 'url';
import {RollupOptions} from 'rollup';
import {nodeResolve} from './build/rollup_plugins';
import typescript from '@rollup/plugin-typescript';
import {importAssertions} from 'acorn-import-assertions';
import {importAssertionsPlugin} from 'rollup-plugin-import-assert';

const esm = 'esm' in process.env;

const config: RollupOptions[] = [{
    input: 'src/style-spec/style-spec.ts',
    output: {
        name: 'maplibreGlStyleSpecification',
        file: `dist/style-spec/${esm ? 'index.mjs' : 'index.cjs'}`,
        format: esm ? 'esm' : 'umd',
        sourcemap: true
    },
    acornInjectPlugins: [importAssertions],
    plugins: [
        {
            name: 'dep-checker',
            resolveId(source, importer) {
                // Some users reference modules within style-spec package directly, instead of the bundle
                // This means that files within the style-spec package should NOT import files from the parent maplibre-gl-js tree.
                // This check will cause the build to fail on CI allowing these issues to be caught.
                if (importer && !importer.includes('node_modules')) {
                    const resolvedPath = path.join(importer, source);
                    const importMetaUrl = pathToFileURL(__filename).toString();
                    const fromRoot = path.relative(dirname(fileURLToPath(importMetaUrl)), resolvedPath);
                    if (fromRoot.length > 2 && fromRoot.slice(0, 2) === '..') {
                        throw new Error(`Module ${importer} imports ${source} from outside the style-spec package root directory.`);
                    }
                }

                return null;
            }
        },
        // https://github.com/zaach/jison/issues/351
        replace({
            preventAssignment: true,
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        }),
        importAssertionsPlugin(),
        nodeResolve,
        typescript(),
        commonjs()
    ]
}];
export default config;
