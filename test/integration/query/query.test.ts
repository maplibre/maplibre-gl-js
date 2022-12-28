
// fixtures.json is automatically generated before this file gets built
// refer build/generate-query-test-fixtures.ts
import {Browser, chromium, Page} from 'playwright';

import fixtures from './dist/fixtures.json' assert {type: 'json'};
import {deepEqual} from '../lib/json-diff';
import st from 'st';
import http from 'http';
import path from 'path';
import fs from 'fs';

let browser: Browser;
let page: Page;
const server = http.createServer(
    st({
        path: 'test/integration/assets',
        cors: true,
    })
).listen(7357);

function performQueryOnFixture(fixture)  {

    return new Promise((resolve, _reject) => {

        function handleOperation(map, operations, opIndex, done) {
            const operation = operations[opIndex];
            const opName = operation[0];
            //Delegate to special handler if one is available
            if (opName in operationHandlers) {
                operationHandlers[opName](map, operation.slice(1), () => {
                    done(opIndex);
                });
            } else {
                map[opName](...operation.slice(1));
                done(opIndex);
            }
        }

        const operationHandlers = {
            wait(map, params, done) {
                const wait = function() {
                    if (map.loaded()) {
                        done();
                    } else {
                        map.once('render', wait);
                    }
                };
                wait();
            },
            idle(map, params, done) {
                const idle = function() {
                    if (!map.isMoving()) {
                        done();
                    } else {
                        map.once('render', idle);
                    }
                };
                idle();
            }
        };

        function applyOperations(map, operations, done) {
            // No operations specified, end immediately and invoke done.
            if (!operations || operations.length === 0) {
                done();
                return;
            }

            // Start recursive chain
            const scheduleNextOperation = (lastOpIndex) => {
                if (lastOpIndex === operations.length - 1) {
                    // Stop recusive chain when at the end of the operations
                    done();
                    return;
                }

                handleOperation(map, operations, ++lastOpIndex, scheduleNextOperation);
            };
            scheduleNextOperation(-1);
        }

        const style = fixture.style;
        const options = style.metadata.test;
        const skipLayerDelete = style.metadata.skipLayerDelete;

        // @ts-ignore
        const map =  new maplibregl.Map({
            container: 'map',
            style,
            // @ts-ignore
            classes: options.classes,
            interactive: false,
            attributionControl: false,
            pixelRatio: options.pixelRatio,
            preserveDrawingBuffer: true,
            axonometric: options.axonometric || false,
            skew: options.skew || [0, 0],
            fadeDuration: options.fadeDuration || 0,
            localIdeographFontFamily: options.localIdeographFontFamily || false,
            crossSourceCollisions: typeof options.crossSourceCollisions === 'undefined' ? true : options.crossSourceCollisions
        });

        map.repaint = true;
        map.once('load', () => {
            console.log('load', map);
            // Run the operations on the map
            applyOperations(map, options.operations, () => {
                console.log('operation', map.queryRenderedFeatures);

                // Perform query operation and compare results from expected values
                const results = options.queryGeometry ?
                    map.queryRenderedFeatures(options.queryGeometry, options.queryOptions || {}) :
                    [];
                console.log('results', results);

                const actual = results.map((feature) => {
                    const featureJson = JSON.parse(JSON.stringify(feature.toJSON()));
                    if (!skipLayerDelete) delete featureJson.layer;
                    return featureJson;
                });

                resolve(actual);

            });
        });

    });
}

describe('query tests', () => {

    beforeAll(async () => {

        browser = await chromium.launch({
            headless: false,
        });
    });

    beforeEach(async () => {
        page = await browser.newPage();
    });

    afterEach(async () => {
        await page.close();
    });

    afterAll(async () => {
        await browser.close();
        server.close();
    });

    Object.keys(fixtures).forEach((testName, testindex) => {

        test(testName, async () => {
            console.log(`${testindex + 1} / ${Object.keys(fixtures).length}: ${testName}`);

            await page.goto(`file:${path.join(__dirname, 'assets/loadMap.html')}`);

            const currentTestName = testName;
            const fixture = fixtures[currentTestName];

            const style = fixture.style;
            const options = style.metadata.test;

            await page.evaluate((options) => {
                const container: HTMLDivElement = document.querySelector('#map');
                container.style.position = 'fixed';
                container.style.bottom = '10px';
                container.style.right = '10px';
                container.style.width = `${options.width}px`;
                container.style.height = `${options.height}px`;
            }, options);

            const actual = await page.evaluate(performQueryOnFixture, fixture);

            const isEqual = deepEqual(actual, fixture.expected);
            // update expected.json if UPDATE=true is passed and the test fails
            if (process.env.UPDATE && !isEqual) {
                const expecedPath = path.join('test/integration/query/', testName, 'expected.json');
                console.log('updating', expecedPath);
                fs.writeFileSync(expecedPath, JSON.stringify(actual, null, 2));
            }
            expect(isEqual).toBeTruthy();

        }, 10000);

    });

});

