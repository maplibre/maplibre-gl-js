import {describe, beforeAll, afterAll, test, expect} from 'vitest';
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
import {CoverageReport} from 'monocart-coverage-reports';
let maplibregl: typeof maplibreglModule;

async function performQueryOnFixture(fixture)  {

    async function handleOperation(map: maplibregl.Map, operation) {
        const opName = operation[0];
        
        switch (opName) {
            case 'wait':
                while (!map.loaded()) {
                    await map.once('render');
                }
                break;
            case 'idle':
                while(map.isMoving()) {
                    await map.once('render');
                }
                break;
            default:
                map[opName](...operation.slice(1));
                break;
        }
    }

    async function applyOperations(map, operations) {
        // No operations specified, end immediately and invoke done.
        if (!operations || operations.length === 0) {
            return;
        }

        for (const operation of operations) {
            await handleOperation(map, operation);
        }
    }

    const style = fixture.style;
    const options = style.metadata.test;
    const skipLayerDelete = style.metadata.skipLayerDelete;

    document.getElementById('map').style.width = `${options.width}px`;
    document.getElementById('map').style.height = `${options.height}px`;

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
    await map.once('load');
    console.log('load', map);
    // Run the operations on the map
    await applyOperations(map, options.operations);
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

    map.remove();

    return actual;
}

describe('query tests', () => {
    let browser: Browser;
    let server: Server;
    let page: Page;

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
        page = await browser.newPage();
        await page.coverage.startJSCoverage({includeRawScriptCoverage: true});
        await page.setViewport({width: 512, height: 512, deviceScaleFactor: 2});
        await page.setContent(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset='utf-8'>
                
            </head>
            <body id='map'></body>
            </html>`);
        await page.addScriptTag({path: 'dist/maplibre-gl-dev.js'});
        await page.addStyleTag({path: 'dist/maplibre-gl.css'});
    }, 60000);

    afterAll(async () => {
        const coverage = await page.coverage.stopJSCoverage();
        await page.close();
        await browser.close();
        await new Promise(resolve => server.close(resolve));
        const rawV8CoverageData = coverage.map((it) => {
            // Convert to raw v8 coverage format
            const entry: any =  {
                source: it.text,
                ...it.rawScriptCoverage
            };
            if (entry.url.endsWith('maplibre-gl-dev.js')) {
                entry.sourceMap = JSON.parse(fs.readFileSync('dist/maplibre-gl-dev.js.map').toString('utf-8'));
            }
            return entry;
        });
        
        const coverageReport = new CoverageReport({
            name: 'MapLibre Coverage Report',
            outputDir: './coverage/query',
            reports: [['v8'], ['codecov']]
        });
        coverageReport.cleanCache();
        
        await coverageReport.add(rawV8CoverageData);
        
        await coverageReport.generate();
    }, 60000);

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
