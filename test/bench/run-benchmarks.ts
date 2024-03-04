import fs from 'fs';
import puppeteer from 'puppeteer';
import PDFMerger from 'pdf-merger-js';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));

const formatTime = (v) => {
    if (typeof v === 'number' && !isNaN(v)) {
        return `${v.toFixed(4)} ms`;
    } else {
        return '';
    }
};

const formatRegression = (v) => {
    if (v) {
        const correlation = v.correlation;
        if (correlation < 0.9) {
            return '\u2620\uFE0F';
        } else if (correlation < 0.99) {
            return '\u26A0\uFE0F';
        }
    }
    return ' ';
};

const dir = './test/bench/results';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const url = new URL('http://localhost:9966/test/bench/versions/index.html');

if (argv.compare !== true && argv.compare !== undefined) { // handle --compare without argument as the default
    for (const compare of [].concat(argv.compare))
        url.searchParams.append('compare', compare || '');
}

console.log(`Starting headless chrome at: ${url.toString()}`);

const browser = await puppeteer.launch({headless: true});

try {

    const webPage = await browser.newPage();
    await webPage.setDefaultTimeout(0);
    await webPage.setViewport({width: 1280, height: 1024});

    url.hash = 'NONE'; // this will simply load the page without running any benchmarks
    await webPage.goto(url.toString());

    await webPage.waitForFunction(() => (window as any).maplibreglBenchmarkFinished);
    const allNames = await webPage.evaluate(() => Object.keys((window as any).maplibreglBenchmarks));
    const versions = await webPage.evaluate((name) => Object.keys((window as any).maplibreglBenchmarks[name]), allNames[0]);
    const versionsDisplayName = await webPage.evaluate(() => (window as any).versionsDisplayName);

    // The following will run all the tests if no arguments are passed, will run only the tests passed as arguments otherwise
    const toRun = argv._.length > 0 ? argv._ : allNames;

    const nameWidth = Math.max(...toRun.map(v => v.length)) + 1;
    const timeWidth = Math.max(...versions.map(v => v.length), 16);

    console.log(''.padStart(nameWidth), ...versions.map((v, i) =>  `${(versionsDisplayName[i]).padStart(timeWidth)} `));

    const merger = new PDFMerger();
    for (const name of toRun) {
        process.stdout.write(name.padStart(nameWidth));

        url.hash = name;
        await webPage.goto(url.toString());
        await webPage.reload();

        await webPage.waitForFunction(
            () => (window as any).maplibreglBenchmarkFinished,
            {
                polling: 200,
                timeout: 0
            }
        );
        const results = await webPage.evaluate((name) => (window as any).maplibreglBenchmarkResults[name], name);
        const output = versions.map((v) => {
            if (v && results[v]) {
                const trimmedMean = results[v].summary?.trimmedMean;
                const regression = results[v].regression;
                const result = formatTime(trimmedMean).padStart(timeWidth) + formatRegression(regression);
                return result;
            } else {
                return ''.padStart(timeWidth + 1);
            }
        });
        if (versions.length === 2) {
            const [main, current] = versions;
            const delta = results[current]?.summary?.trimmedMean - results[main]?.summary?.trimmedMean;
            output.push(((delta > 0 ? '+' : '') + formatTime(delta)).padStart(15));
        }
        console.log(...output);

        await merger.add(await webPage.pdf({
            format: 'a4',
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
    if (error.message.startsWith('net::ERR_CONNECTION_REFUSED')) {
        console.log('Could not connect to server. Please run \'npm run start-bench\'.');
    } else {
        console.log(error);
    }
} finally {
    await browser.close();
}
