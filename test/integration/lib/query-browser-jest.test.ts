
// fixtures.json is automatically generated before this file gets built
// refer build/generate-query-test-fixtures.ts
import fixtures from '../dist/fixtures.json';
import ignores from '../../ignores.json';
import {deepEqual} from './json-diff';
import st from 'st';
import http from 'http';
import puppeteer, {Browser, Page} from 'puppeteer';
import path from 'path';
// alternatively, run npx st  -l --port 7357 -d test/integration -co

let browser: Browser;
let page: Page;
const server = http.createServer(
    st({
        path: 'test/integration',
        cors: true,
    })
).listen(7357);

describe('query tests', () => {

    beforeAll(async () => {

        browser = await puppeteer.launch({
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

        if (testName in ignores) {
        //tape.skip(testName, testFunc);
        } else {

            // eslint-disable-next-line no-loop-func
            test(testName, async () => {
                console.log((testindex + 1), ' / ', Object.keys(fixtures).length);

                await page.goto(`file:${path.join(__dirname, 'fixtures/loadMap.html')}`);

                const currentTestName = testName;
                const fixture = fixtures[currentTestName];

                const style = fixture.style;
                const options = style.metadata.test;

                await page.evaluate((options) => {
                    const container = document.querySelector('#map');
                    // @ts-ignore
                    container.style.position = 'fixed';
                    // @ts-ignore
                    container.style.bottom = '10px';
                    // @ts-ignore
                    container.style.right = '10px';
                    // @ts-ignore
                    container.style.width = `${options.width}px`;
                    // @ts-ignore
                    container.style.height = `${options.height}px`;
                }, options);

                const actual = await page.evaluate((fixture, _testName) => {

                    return new Promise((resolve, _reject) => {

                        function handleOperation(map, operations, opIndex, doneCb) {
                            const operation = operations[opIndex];
                            const opName = operation[0];
                            //Delegate to special handler if one is available
                            if (opName in operationHandlers) {
                                operationHandlers[opName](map, operation.slice(1), () => {
                                    doneCb(opIndex);
                                });
                            } else {
                                map[opName](...operation.slice(1));
                                doneCb(opIndex);
                            }
                        }

                        const operationHandlers = {
                            wait(map, params, doneCb) {
                                const wait = function() {
                                    if (map.loaded()) {
                                        doneCb();
                                    } else {
                                        map.once('render', wait);
                                    }
                                };
                                wait();
                            },
                            idle(map, params, doneCb) {
                                const idle = function() {
                                    if (!map.isMoving()) {
                                        doneCb();
                                    } else {
                                        map.once('render', idle);
                                    }
                                };
                                idle();
                            }
                        };

                        function applyOperations(map, operations, doneCb) {
                            // No operations specified, end immediately adn invoke doneCb.
                            if (!operations || operations.length === 0) {
                                doneCb();
                                return;
                            }

                            // Start recursive chain
                            const scheduleNextOperation = (lastOpIndex) => {
                                if (lastOpIndex === operations.length - 1) {
                                    // Stop recusive chain when at the end of the operations
                                    doneCb();
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
                            //3. Run the operations on the map
                            applyOperations(map, options.operations, () => {
                                console.log('operation', map.queryRenderedFeatures);

                                //4. Perform query operation and compare results from expected values
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

                                // To reusing same map instance in the future, we can cleanup WebGL context:
                                // delete map.painter.context.gl;
                            });
                        });

                    });
                }, fixture, testName);

                expect(deepEqual(actual, fixture.expected)).toBeTruthy();
                // To improve error handling, we can use generateDiffLog(fixture.expected, actual));

            }, 10000);

        }
    });

});

