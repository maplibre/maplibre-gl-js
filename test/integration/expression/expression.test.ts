import path from 'path';
import fs from 'fs';
import glob from 'glob';
import {createPropertyExpression,
    isFunction,
    convertFunction,
    toString} from '@maplibre/maplibre-gl-style-spec';
import {CanonicalTileID} from '../../../src/source/tile_id';
import {getGeometry} from './lib/geometry';
import {stringify} from './lib/util';
import {deepEqual, stripPrecision} from '../lib/json-diff';
import {ExpressionFixture} from './fixture-types';

const decimalSigFigs =  6;

const expressionTestFileNames = glob.sync('**/test.json', {cwd: __dirname});
describe('expression', () => {

    expressionTestFileNames.forEach((expressionTestFileName) => {
        test(expressionTestFileName, (done) => {

            const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, expressionTestFileName), 'utf8'));

            try {
                const result = evaluateFixture(fixture);

                if (process.env.UPDATE) {
                    fixture.expected = {
                        compiled: result.compiled,
                        outputs: stripPrecision(result.outputs, decimalSigFigs),
                    };

                    delete fixture.metadata;

                    const fname = path.join(__dirname, expressionTestFileName);
                    fs.writeFile(fname, `${stringify(fixture)}\n`, done);
                    return;
                }

                const expected = fixture.expected;
                const compileOk = deepEqual(result.compiled, expected.compiled, decimalSigFigs);
                if (!compileOk) {
                    console.log(`Expected ${JSON.stringify(expected.compiled)}`);
                    console.log(`Result   ${JSON.stringify(result.compiled)}`);
                }

                const evalOk = compileOk && deepEqual(result.outputs, expected.outputs, decimalSigFigs);
                if (!evalOk) {
                    console.log(`Expected ${JSON.stringify(expected.outputs)}`);
                    console.log(`Result   ${JSON.stringify(result.outputs)}`);
                }

                expect(compileOk).toBeTruthy();
                expect(evalOk).toBeTruthy();

                done();
            } catch (e) {
                done(e);
            }

        });
    });

});

function evaluateFixture(fixture) {
    const spec = Object.assign({}, fixture.propertySpec);

    if (!spec['property-type']) {
        spec['property-type'] = 'data-driven';
    }

    if (!spec['expression']) {
        spec['expression'] = {
            'interpolated': true,
            'parameters': ['zoom', 'feature']
        };
    }

    const result: {
        compiled: any;
        outputs?: any;
    } = {compiled: {}};

    const expression = (() => {
        if (isFunction(fixture.expression)) {
            return createPropertyExpression(convertFunction(fixture.expression, spec), spec);
        } else {
            return createPropertyExpression(fixture.expression, spec);
        }
    })();

    result.outputs = evaluateExpression(fixture, expression, result.compiled);

    return result;
}

function evaluateExpression (fixture: ExpressionFixture, expression, compilationResult) {

    let availableImages;
    let canonical;

    if (expression.result === 'error') {
        compilationResult.result = 'error';
        compilationResult.errors = expression.value.map((err) => ({
            key: err.key,
            error: err.message
        }));
        return;
    }

    const evaluationResult = [];

    expression = expression.value;
    const type = expression._styleExpression.expression.type; // :scream:

    compilationResult.result = 'success';
    compilationResult.isFeatureConstant = expression.kind === 'constant' || expression.kind === 'camera';
    compilationResult.isZoomConstant = expression.kind === 'constant' || expression.kind === 'source';
    compilationResult.type = toString(type);

    for (const input of fixture.inputs || []) {
        try {
            const feature: {
                properties: any;
                id?: any;
                type?: any;
            } = {properties: input[1].properties || {}};
            availableImages = input[0].availableImages || [];
            if ('canonicalID' in input[0]) {
                const id = input[0].canonicalID;
                canonical = new CanonicalTileID(id.z, id.x, id.y);
            } else {
                canonical = null;
            }

            if ('id' in input[1]) {
                feature.id = input[1].id;
            }
            if ('geometry' in input[1]) {
                if (canonical !== null) {
                    getGeometry(feature, input[1].geometry, canonical);
                } else {
                    feature.type = input[1].geometry.type;
                }
            }

            let value = expression.evaluateWithoutErrorHandling(input[0], feature, {}, canonical, availableImages);

            if (type.kind === 'color') {
                value = [value.r, value.g, value.b, value.a];
            }
            evaluationResult.push(value);
        } catch (error) {
            if (error.name === 'ExpressionEvaluationError') {
                evaluationResult.push({error: error.toJSON()});
            } else {
                evaluationResult.push({error: error.message});
            }
        }
    }

    if (fixture.inputs) {
        return evaluationResult;
    }
}
