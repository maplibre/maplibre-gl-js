import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import packageJson from '../package.json' with { type: 'json' };

const exampleName = process.argv[2];
const useLocalhost = (process.argv.length > 3) && (process.argv[3] === 'serve');
const examplePath = path.resolve('test', 'examples');

const browser = await puppeteer.launch({headless: true});

const page = await browser.newPage();
// set viewport and double deviceScaleFactor to get a closer shot of the map
await page.setViewport({
    width: 600,
    height: 250,
    deviceScaleFactor: 2
});

async function createImage(exampleName) {
    // get the example contents
    if (useLocalhost) {
        console.log('Using localhost to serve examples.');
        await page.goto(`http://localhost:9966/test/examples/${exampleName}.html`);
    } else {
        const html = fs.readFileSync(path.resolve(examplePath, `${exampleName}.html`), 'utf-8');
        await page.setContent(html.replaceAll('../../dist', `https://unpkg.com/maplibre-gl@${packageJson.version}/dist`));
    }

    // Wait for map to load, then wait two more seconds for images, etc. to load.
    try {
        await page.waitForFunction('map.loaded()');
        // Wait for 5 seconds on 3d model examples, since this takes longer to load.
        const waitTime = (exampleName.includes('3d-model') || exampleName.includes('globe')) ? 5000 : 1500;
        console.log(`waiting for ${waitTime} ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch {
        // map.loaded() does not evaluate to true within 3 seconds, it's probably an animated example.
        // In this case we take the screenshot immediately.
        console.log(`Timed out waiting for map load on ${exampleName}.`);
    }

    await page
        .screenshot({
            path: `./docs/assets/examples/${exampleName}.png`,
            type: 'png',
            clip: {
                x: 0,
                y: 0,
                width: 600,
                height: 250
            }
        })
        .then(() => console.log(`Created ./docs/assets/examples/${exampleName}.png`))
        .catch((err) => {
            console.log(err);
        });
}

if (exampleName === 'all') {
    const allFiles = fs.readdirSync(examplePath).filter(f => f.endsWith('html'));
    console.log(`Generating ${allFiles.length} images.`);
    for (const file of allFiles) {
        await createImage(file);
    }
} else if (exampleName) {
    await createImage(exampleName);
} else {
    throw new Error(`
  Usage: npm run generate-images <file-name|all> [serve]
    file-name: the name of the example file in test/examples without the .html extension.
    all: generate images for all examples.
    serve: use localhost to serve examples - use 'npm run start' with this option, otherwise it will use the latest published version in npm.
  Example: npm run generate-images 3d-buildings serve`
    );
}

await browser.close();
