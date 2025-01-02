import {describe, beforeEach, beforeAll, afterEach, afterAll, test, expect} from 'vitest';
import puppeteer, {type Page, type Browser} from 'puppeteer';

import {deepEqual} from '../lib/json-diff';
import st from 'st';
import http from 'node:http';
import type {Server} from 'node:http';

import path from 'node:path/posix';
import fs from 'node:fs';
import type {AddressInfo} from 'node:net';

import {localizeURLs} from '../lib/localize-urls';
import {globSync} from 'glob';

import type * as maplibreglModule from '../../../dist/maplibre-gl';
let maplibregl: typeof maplibreglModule;

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
                const wait = () => {
                    if (map.loaded()) {
                        done();
                    } else {
                        map.once('render', wait);
                    }
                };
                wait();
            },
            idle(map, params, done) {
                const idle = () => {
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
                    // Stop recursive chain when at the end of the operations
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

        const map =  new maplibregl.Map({
            container: 'map',
            style,
            interactive: false,
            attributionControl: false,
            pixelRatio: options.pixelRatio,
            canvasContextAttributes: {preserveDrawingBuffer: true, powerPreference: 'default'},
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
    let browser: Browser;
    let server: Server;

    beforeAll(async () => {
        server = http.createServer(
            st({
                path: 'test/integration/assets',
                cors: true,
            })
        );
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--enable-webgl', 
                '--no-sandbox',
            ],
        });
        await new Promise<void>((resolve) => server.listen(resolve));
    }, 60000);

    afterAll(async () => {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    });

    let page: Page;

    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({width: 512, height: 512, deviceScaleFactor: 2});
    });
    afterEach(async() => {
        await page.close();
    });

    const allTestsRoot = path.join('test', 'integration', 'query', 'tests');
    let globPattern = path.join(allTestsRoot, '**/style.json');
    globPattern = globPattern.replace(/\\/g, '/');
    const testStyles = globSync(globPattern);

    for (const styleJson of testStyles) {
        const testCaseRoot = path.dirname(styleJson.replace(/\\/g, '/')); // glob is returning paths that dirname can't handle...
        const caseName = path.relative(allTestsRoot, testCaseRoot);
        test(caseName, {retry: 3, timeout: 20000}, async () => {
            const port = (server.address() as AddressInfo).port;
            const fixture = await dirToJson(testCaseRoot, port);

            const style = fixture.style;
            const options = style.metadata.test;
            await page.setContent(`
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Query Test Page</title>
    <meta charset='utf-8'>
    <link rel="icon" href="about:blank">
    <style>#map {
        box-sizing:content-box;
        width:${options.width}px;
        height:${options.height}px;
    }</style>
</head>
<body id='map'></body>
</html>`);
            await page.addScriptTag({path: 'dist/maplibre-gl.js'});
            await page.addStyleTag({path: 'dist/maplibre-gl.css'});
            const actual = await page.evaluate(performQueryOnFixture, fixture);

            const isEqual = deepEqual(actual, fixture.expected);
            // update expected.json if UPDATE=true is passed and the test fails
            if (process.env.UPDATE && !isEqual) {
                const expectedPath = path.join(testCaseRoot, 'expected.json');
                console.log('updating', expectedPath);
                fs.writeFileSync(expectedPath, JSON.stringify(actual, null, 2));
            }
            expect(isEqual).toBeTruthy();

        });

    }
});

/**
 * Analyzes the contents of the specified directory, and converts it to a JSON-serializable
 * object, suitable for sending to the browser
 * @param basePath - The root directory
 */
async function dirToJson(dir: string, port: number) {
    const files = await fs.promises.readdir(dir);

    // Extract the filedata into a flat dictionary
    const result = {} as {
        style?: any;
        expected?: any;
        actual?: any;
        [s:string]:unknown;
    };

    for (const file of files) {
        const fullname = path.join(dir, file);
        const pp = path.parse(file);
        try {
            if (pp.ext === '.json') {
                let json = JSON.parse(await fs.promises.readFile(fullname, {encoding: 'utf8'}));

                // Special case for style json which needs some preprocessing
                if (file === 'style.json') {
                    json = processStyle(dir, json, port);
                }

                result[pp.name] = json;
            } else {
                console.warn(`Ignoring file with unexpected extension. ${pp.ext}`);
            }
        } catch (e) {
            console.warn(`Error parsing file: ${file} ${e.message}`);
            throw e;
        }
    }
    return result;
}

function processStyle(testName:string, style: unknown, port:number) {
    const clone = JSON.parse(JSON.stringify(style));
    localizeURLs(clone, port, 'test/integration');

    clone.metadata = clone.metadata || {};

    clone.metadata.test = {
        testName,
        width: 512,
        height: 512,
        pixelRatio: 1,
        recycleMap: false,
        allowed: 0.00015,
        ...clone.metadata.test
    };

    return clone;
}
