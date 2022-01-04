import puppeteer from 'puppeteer';
import PDFMerger from 'pdf-merger-js';

const run = async name => {
    console.log(`Running ${name}...`);

    const url = `http://localhost:9966/bench/versions?compare=main#${name}`;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--use-gl=egl']
    });

    try {
        const webPage = await browser.newPage();

        await webPage.goto(url);

        await webPage.waitForFunction(
            'document.querySelector("body").innerText.includes("Finished")',
            {
                timeout: 0
            }
        );

        await webPage.pdf({
            format: 'A4',
            path: `${name}.pdf`,
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
    names.map(name => merger.add(`${name}.pdf`));
    await merger.save('benchmarks.pdf');
}).catch((error) => {
    console.log(error);
    if (error.message.startsWith('net::ERR_CONNECTION_REFUSED')) {
        console.log("Could not connect to server. Please run 'npm run start-bench'.")
    }
});
