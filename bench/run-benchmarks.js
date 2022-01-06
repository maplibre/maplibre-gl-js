import fs from 'fs';
import puppeteer from 'puppeteer';
import PDFMerger from 'pdf-merger-js';

const formatTime = (v) => `${v.toFixed(4)} ms`;
const formatRegression = (v) => v.correlation < 0.9 ? '\u2620\uFE0F' : v.correlation < 0.99 ? '\u26A0\uFE0F' : ' ';

const dir = './bench/results';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const browser = await puppeteer.launch({
    headless: true,
    args: ['--use-gl=egl', '--no-sandbox', '--disable-setuid-sandbox']
});

try {
    const webPage = await browser.newPage();

    await webPage.goto('http://localhost:9966/bench/versions?compare=main#NONE');
    const allnames = await webPage.evaluate(() => Object.keys(window.maplibreglBenchmarks));
    const [main, current] = await webPage.evaluate((name) => Object.keys(window.maplibreglBenchmarks[name]), allnames[0]);

    const torun = process.argv.length > 2 ? process.argv.slice(2) : allnames;

    const namewidth = Math.max(...torun.map(v => v.length)) + 1;
    const timewidth = Math.max(main.length, current.length, 16);

    console.log(''.padStart(namewidth), main.padStart(timewidth), ' ', current.padStart(timewidth), ' ');

    const merger = new PDFMerger();
    for (const name of torun) {
        const url = `http://localhost:9966/bench/versions?compare=main#${name}`;

        process.stdout.write(name.padStart(namewidth));

        await webPage.goto(url);
        await webPage.reload();

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
            formatTime(main.summary.trimmedMean).padStart(timewidth), formatRegression(main.regression),
            formatTime(current.summary.trimmedMean).padStart(timewidth), formatRegression(current.regression),
            ((delta > 0 ? '+' : '') + formatTime(delta)).padStart(15),
        );

        merger.add(await webPage.pdf({
            format: 'A4',
            path: `${dir}/${name}.pdf`,
            printBackground: true,
            margin: {
                top: '1cm',
                bottom: '1cm',
                left: '1cm',
                right: '1cm'
            }
        }));
    }

    await merger.save(`${dir}/all.pdf`);
} catch (error) {
    console.log(error);
    if (error.message.startsWith('net::ERR_CONNECTION_REFUSED')) {
        console.log('Could not connect to server. Please run \'npm run start-bench\'.');
    }
} finally {
    browser.close();
}
