import fs from 'fs';
import puppeteer from 'puppeteer';
import PDFMerger from 'pdf-merger-js';

const formatTime = (v) => v.toFixed(4) + " ms";
const formatRegression = (v) => v.correlation < 0.9 ? '\u2620\uFE0F' : v.correlation < 0.99 ? '\u26A0\uFE0F' : ' ';

const dir = './bench/results';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const run = async name => {

    const url = `http://localhost:9966/bench/versions?compare=main#${name}`;

    process.stdout.write(name.padStart(30));

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--use-gl=egl']
    });

    try {
        const webPage = await browser.newPage();

        await webPage.goto(url);

        await webPage.waitForFunction(
            () => window.maplibreglBenchmarkFinished,
            {
                polling: 200,
                timeout: 0
            }
        );

        const results = await webPage.evaluate((name) => window.maplibreglBenchmarkResults[name], name);
        const [main, current] = Object.values(results);
        const delta = current.summary.trimmedMean - main.summary.trimmedMean;
        console.log(
            formatTime(   main.summary.trimmedMean).padStart(15), formatRegression(   main.regression),
            formatTime(current.summary.trimmedMean).padStart(15), formatRegression(current.regression),
            ((delta > 0 ? '+' : '') + formatTime(delta)).padStart(15),
        );

        await webPage.pdf({
            format: 'A4',
            path: `${dir}/${name}.pdf`,
            printBackground: true,
            margin: {
                top: '1cm',
                bottom: '1cm',
                left: '1cm',
                right: '1cm'
            }
        });
    }
    finally {
        await browser.close();
    }
};

const names = process.argv.length > 2 ? process.argv.slice(2) : [
    'Paint',
    'QueryPoint',
    'QueryBox',
    'Layout',
    'Placement',
    'Validate',
    'StyleLayerCreate',
    'FunctionCreate',
    'FunctionEvaluate',
    'ExpressionCreate',
    'ExpressionEvaluate',
    'WorkerTransfer',
    'PaintStates',
    'PropertyLevelRemove',
    'FeatureLevelRemove',
    'SourceLevelRemove',
    'LayerBackground',
    'LayerCircle',
    'LayerFill',
    'LayerFillExtrusion',
    'LayerHeatmap',
    'LayerHillshade',
    'LayerLine',
    'LayerRaster',
    'LayerSymbol',
    'LayerSymbolWithIcons',
    'LayerTextWithVariableAnchor',
    'LayerSymbolWithSortKey',
    'Load',
    'SymbolLayout',
    'FilterCreate',
    'FilterEvaluate',
    'HillshadeLoad'
];

names.reduce(async (carry, name) => {
    return [
        ...(await carry),
        await run(name)
    ];
}, Promise.resolve([])).then(async () => {
    const merger = new PDFMerger();
    names.map(name => merger.add(`${dir}/${name}.pdf`));
    await merger.save(`${dir}/all.pdf`);
}).catch((error) => {
    console.log(error);
    if (error.message.startsWith('net::ERR_CONNECTION_REFUSED')) {
        console.log("Could not connect to server. Please run 'npm run start-bench'.")
    }
});
