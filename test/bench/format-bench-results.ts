import fs from 'fs';
import minimist from 'minimist';

/**
 * Formats benchmark comparison results as a Markdown table suitable for
 * posting as a GitHub PR comment.
 *
 * Usage:
 *   npx ts-node test/bench/format-bench-results.ts \
 *     --baseline baseline.json --current current.json --threshold 10
 *
 * Output goes to stdout as markdown.
 */

const argv = minimist(process.argv.slice(2));

type BenchmarkResult = {
    name: string;
    trimmedMean: number;
    deviation: number;
    min: number;
    regressionCorrelation: number;
};

const baselinePath = argv.baseline;
const currentPath = argv.current;
const threshold = parseFloat(argv.threshold) || 10;

if (!baselinePath || !currentPath) {
    console.error('Usage: format-bench-results.ts --baseline <file> --current <file> [--threshold <pct>]');
    process.exit(1);
}

const baseline: BenchmarkResult[] = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
const current: BenchmarkResult[] = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));

const baseMap = new Map(baseline.map(b => [b.name, b]));
const curMap = new Map(current.map(b => [b.name, b]));

const allNames = [...new Set([...baseMap.keys(), ...curMap.keys()])].sort();

let hasRegression = false;
const rows: string[] = [];

for (const name of allNames) {
    const base = baseMap.get(name);
    const cur = curMap.get(name);

    if (!base || !cur) {
        const value = (base || cur)!;
        rows.push(`| ${name} | ${base ? value.trimmedMean.toFixed(3) : '-'} | ${cur ? value.trimmedMean.toFixed(3) : '-'} | - | - |`);
        continue;
    }

    const deltaMs = cur.trimmedMean - base.trimmedMean;
    const deltaPct = (deltaMs / base.trimmedMean) * 100;

    let status: string;
    if (deltaPct > threshold) {
        status = 'regression';
        hasRegression = true;
    } else if (deltaPct < -threshold) {
        status = 'improved';
    } else {
        status = 'neutral';
    }

    rows.push(
        `| ${name} | ${base.trimmedMean.toFixed(3)} ms | ${cur.trimmedMean.toFixed(3)} ms | ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% | ${status} |`
    );
}

// Emit markdown
console.log('## Benchmark Results');
console.log('');
console.log(`Regression threshold: ${threshold}%`);
console.log('');
console.log('| Benchmark | Baseline | Current | Delta | Status |');
console.log('|-----------|----------|---------|-------|--------|');
for (const row of rows) {
    console.log(row);
}
console.log('');

if (hasRegression) {
    console.log('**One or more benchmarks show a significant regression.**');
} else {
    console.log('No significant regressions detected.');
}

process.exitCode = hasRegression ? 1 : 0;
