import fs from 'fs';
import puppeteer from 'puppeteer';
import minimist from 'minimist';

/**
 * CI-oriented benchmark runner.
 *
 * Runs benchmarks in headless Chrome against the production build, producing
 * structured JSON output suitable for automated comparison between commits.
 * When a baseline file is provided, computes deltas and exits non-zero if
 * any benchmark regresses beyond the configured threshold.
 *
 * Usage:
 *   # Run benchmarks and write results to a JSON file
 *   npx ts-node test/bench/run-benchmarks-ci.ts --output results.json
 *
 *   # Compare against a baseline and fail on regressions > 10%
 *   npx ts-node test/bench/run-benchmarks-ci.ts --baseline baseline.json --threshold 10
 *
 *   # Run specific benchmarks only
 *   npx ts-node test/bench/run-benchmarks-ci.ts FilterCreate Subdivide
 */

const argv = minimist(process.argv.slice(2));

const REGRESSION_THRESHOLD_PCT = parseFloat(argv.threshold) || 10;
const outputPath = argv.output || 'test/bench/results/ci-results.json';
const baselinePath = argv.baseline;

type BenchmarkResult = {
    name: string;
    trimmedMean: number;
    deviation: number;
    min: number;
    max: number;
    samples: number;
    regressionSlope: number;
    regressionCorrelation: number;
};

type ComparisonResult = {
    name: string;
    current: number;
    baseline: number;
    deltaMs: number;
    deltaPct: number;
    status: 'improved' | 'neutral' | 'regressed';
};

const dir = './test/bench/results';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
}

const url = new URL('http://localhost:9966/test/bench/versions/index.html');
// Run only the current build, no version comparison
url.searchParams.append('compare', '');

console.log('Benchmark CI Runner');
console.log('='.repeat(72));
console.log(`Regression threshold: ${REGRESSION_THRESHOLD_PCT}%`);
if (baselinePath) {
    console.log(`Baseline: ${baselinePath}`);
}
console.log(`Output: ${outputPath}`);
console.log('');

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
    const webPage = await browser.newPage();
    await webPage.setDefaultTimeout(0);
    await webPage.setViewport({width: 1280, height: 1024});

    // First load to discover benchmark names
    url.hash = 'NONE';
    await webPage.goto(url.toString());
    await webPage.waitForFunction(() => (window as any).maplibreglBenchmarkFinished);
    const allNames: string[] = await webPage.evaluate(
        () => Object.keys((window as any).maplibreglBenchmarks)
    );

    const toRun = argv._.length > 0 ? argv._.map(String) : allNames;
    const results: BenchmarkResult[] = [];

    const nameWidth = Math.max(...toRun.map(n => n.length), 30);
    console.log(
        'Benchmark'.padEnd(nameWidth),
        'Mean (ms)'.padStart(12),
        'Dev (ms)'.padStart(12),
        'Min (ms)'.padStart(12),
        'Samples'.padStart(10),
        'R\u00B2'.padStart(8)
    );
    console.log('-'.repeat(nameWidth + 12 + 12 + 12 + 10 + 8 + 5));

    for (const name of toRun) {
        url.hash = name;
        await webPage.goto(url.toString());
        await webPage.reload();

        await webPage.waitForFunction(
            () => (window as any).maplibreglBenchmarkFinished,
            {polling: 200, timeout: 0}
        );

        const data = await webPage.evaluate((benchName) => {
            const benchResults = (window as any).maplibreglBenchmarkResults[benchName];
            if (!benchResults) return null;
            // Get the first (and only, since we passed compare='') version
            const version = Object.values(benchResults)[0] as any;
            if (!version?.summary) return null;
            return {
                trimmedMean: version.summary.trimmedMean,
                deviation: version.summary.windsorizedDeviation,
                min: version.summary.min,
                max: version.summary.max,
                samples: version.summary.mean ? 1 : 0, // placeholder; actual count unavailable from summary
                regressionSlope: version.regression?.slope ?? 0,
                regressionCorrelation: version.regression?.correlation ?? 0,
            };
        }, name);

        if (data) {
            const result: BenchmarkResult = {name, ...data};
            results.push(result);

            const r2Indicator = data.regressionCorrelation < 0.9
                ? ' !!'
                : data.regressionCorrelation < 0.99
                    ? ' ?'
                    : '';

            console.log(
                name.padEnd(nameWidth),
                data.trimmedMean.toFixed(4).padStart(12),
                data.deviation.toFixed(4).padStart(12),
                data.min.toFixed(4).padStart(12),
                '-'.padStart(10),
                (data.regressionCorrelation.toFixed(3) + r2Indicator).padStart(8)
            );
        } else {
            console.log(name.padEnd(nameWidth), 'SKIPPED (no results)');
        }
    }

    // Write results
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log('');
    console.log(`Results written to ${outputPath}`);

    // Comparison mode
    if (baselinePath && fs.existsSync(baselinePath)) {
        const baseline: BenchmarkResult[] = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
        const baselineMap = new Map(baseline.map(b => [b.name, b]));

        const comparisons: ComparisonResult[] = [];
        let hasRegression = false;

        console.log('');
        console.log('Comparison with baseline');
        console.log('='.repeat(72));
        console.log(
            'Benchmark'.padEnd(nameWidth),
            'Baseline'.padStart(12),
            'Current'.padStart(12),
            'Delta'.padStart(12),
            'Status'.padStart(12)
        );
        console.log('-'.repeat(nameWidth + 12 * 4 + 4));

        for (const current of results) {
            const base = baselineMap.get(current.name);
            if (!base) continue;

            const deltaMs = current.trimmedMean - base.trimmedMean;
            const deltaPct = (deltaMs / base.trimmedMean) * 100;
            const status: ComparisonResult['status'] =
                deltaPct > REGRESSION_THRESHOLD_PCT ? 'regressed' :
                    deltaPct < -REGRESSION_THRESHOLD_PCT ? 'improved' :
                        'neutral';

            if (status === 'regressed') hasRegression = true;

            const comp: ComparisonResult = {
                name: current.name,
                current: current.trimmedMean,
                baseline: base.trimmedMean,
                deltaMs,
                deltaPct,
                status
            };
            comparisons.push(comp);

            const statusIcon = status === 'regressed' ? 'REGRESSION'
                : status === 'improved' ? 'IMPROVED'
                    : 'ok';

            console.log(
                current.name.padEnd(nameWidth),
                base.trimmedMean.toFixed(4).padStart(12),
                current.trimmedMean.toFixed(4).padStart(12),
                (`${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`).padStart(12),
                statusIcon.padStart(12)
            );
        }

        // Write comparison output as JSON for CI consumption
        const compPath = outputPath.replace('.json', '-comparison.json');
        fs.writeFileSync(compPath, JSON.stringify({
            threshold: REGRESSION_THRESHOLD_PCT,
            comparisons,
            hasRegression
        }, null, 2));

        console.log('');
        if (hasRegression) {
            console.log(`FAIL: One or more benchmarks regressed by more than ${REGRESSION_THRESHOLD_PCT}%.`);
            process.exitCode = 1;
        } else {
            console.log('PASS: No significant regressions detected.');
        }
    }

} catch (error) {
    if (error.message?.startsWith('net::ERR_CONNECTION_REFUSED')) {
        console.error('Could not connect to server. Please run \'npm run start-bench\' first.');
    } else {
        console.error(error);
    }
    process.exitCode = 1;
} finally {
    await browser.close();
}
