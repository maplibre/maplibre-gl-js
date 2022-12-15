import isBuiltin from 'is-builtin-module';
import * as rollup from 'rollup';
import rollupConfig from '../../rollup.config.style-spec';
import styleSpecPackage from '../../src/style-spec/package.json' assert {type: 'json'};
import * as spec from '../../dist/style-spec/index.cjs';
import {importAssertions} from 'acorn-import-assertions';
/* eslint-disable import/namespace */
import {RollupOptions} from 'rollup';

describe('@maplibre/maplibre-gl-style-spec npm package', () => {
    test('build plain ES5 bundle in prepublish', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        await rollup.rollup({
            input: './src/style-spec/style-spec.ts',
            acornInjectPlugins: [importAssertions],
            plugins: [{
                name: 'test-checker',
                resolveId: (id, importer) => {

                    // linux (path starts with slash or dot)
                    const slashOrDot: boolean = /^[\/\.]/.test(id);

                    // Windows (path could start with drive letter: for example c:\)
                    const windowsFullPath: boolean = /^[c-zC-Z]:\\/.test(id);

                    if (
                        slashOrDot ||
                        windowsFullPath ||
                        isBuiltin(id) ||
                        /node_modules/.test(importer)
                    ) {
                        return null;
                    }

                    expect(styleSpecPackage.dependencies[id]).toBeTruthy();
                    return false;
                }
            }, ...(rollupConfig as RollupOptions[])[0].plugins]
        }).then(() => {
        }).catch(e => {
            expect(e).toBeFalsy();
        });
    }, 40000);

    test('exports components directly, not behind `default` - https://github.com/mapbox/mapbox-gl-js/issues/6601', () => {
        // @ts-ignore
        expect(spec.default && spec.default.validate).toBeFalsy();
        // @ts-ignore
        expect(spec.validate).toBeTruthy();
    });

});
