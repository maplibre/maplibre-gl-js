import isBuiltin from 'is-builtin-module';
import * as rollup from 'rollup';
import {test} from '../util/test';
import rollupConfig from '../../rollup.config.style-spec';
import styleSpecPackage from '../../src/style-spec/package.json';
/* eslint-disable import/namespace */
import * as spec from '../../dist/style-spec/index.mjs';

test('@mapbox/mapbox-gl-style-spec npm package', (t) => {
    t.test('build plain ES5 bundle in prepublish', (t) => {
        t.stub(console, 'warn');
        rollup.rollup({
            input: `./rollup/build/tsc/src/style-spec/style-spec.js`,
            plugins: [{
                resolveId: (id, importer) => {
                    if (
                        /^[\/\.]/.test(id) ||
                        isBuiltin(id) ||
                        /node_modules/.test(importer)
                    ) {
                        return null;
                    }

                    expect(styleSpecPackage.dependencies[id]).toBeTruthy();
                    return false;
                }
            }].concat(rollupConfig[0].plugins)
        }).then(() => {
            t.end();
        }).catch(e => {
            expect(e).toBeFalsy();
        });
    });

    t.test('exports components directly, not behind `default` - https://github.com/mapbox/mapbox-gl-js/issues/6601', (t) => {
        expect(spec.default && spec.default.validate).toBeFalsy();
        expect(spec.validate).toBeTruthy();
        t.end();
    });

    t.end();
});
