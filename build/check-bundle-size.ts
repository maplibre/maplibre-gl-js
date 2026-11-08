import {execSync} from 'child_process';
import fs from 'fs';
import zlib from 'zlib';

const RAW_INCREASE_QUOTA = 1024;
const GZIP_INCREASE_QUOTA = 256;
const BUNDLES = ['dist/maplibre-gl.mjs', 'dist/maplibre-gl-worker.mjs'];
/** The key under which the sizes of all {@link BUNDLES} together are recorded. */
const TOTAL = 'total';

type SizeRecord = {raw: number; gzip: number};

/**
 * Runs a command without echoing its output, which is printed only when the command fails.
 */
function run(command: string) {
    try {
        execSync(command, {stdio: 'pipe', maxBuffer: 64 * 1024 * 1024});
    } catch (error) {
        console.error(`\`${command}\` failed:\n${error.stdout}${error.stderr}`);
        throw error;
    }
}

/**
 * Checks out a commit, builds it, and returns the raw and gzipped size of each bundle, and of all
 * of them together under {@link TOTAL}.
 */
function buildAndMeasure(commit: string): Record<string, SizeRecord> {
    run(`git checkout --quiet ${commit}`);
    run('npm ci');
    run('npm run build-dist');
    const sizes: Record<string, SizeRecord> = Object.fromEntries(BUNDLES.map(file => {
        const buf = fs.readFileSync(file);
        return [file, {raw: buf.length, gzip: zlib.gzipSync(buf).length}];
    }));
    sizes[TOTAL] = {
        raw: BUNDLES.reduce((sum, file) => sum + sizes[file].raw, 0),
        gzip: BUNDLES.reduce((sum, file) => sum + sizes[file].gzip, 0),
    };
    return sizes;
}

function formatChange(change: number): string {
    return change > 0 ? `+${change}` : `${change}`;
}

/**
 * Prints rows of cells as columns padded to a common width, the first `textColumns` aligned to the
 * left and the rest, which hold numbers, to the right.
 */
function printTable(rows: string[][], textColumns: number) {
    const widths = rows[0].map((_, column) => Math.max(...rows.map(row => row[column].length)));
    for (const row of rows) {
        console.log(row.map((cell, column) => column < textColumns ?
            cell.padEnd(widths[column]) :
            cell.padStart(widths[column])).join('  '));
    }
}

/**
 * The commit before HEAD and HEAD itself. In CI, HEAD is the PR's merge commit, so the commit
 * before it is the base branch.
 */
const pr = execSync('git rev-parse HEAD').toString().trim();
const main = buildAndMeasure('HEAD^1');
const head = buildAndMeasure(pr);

const rows = BUNDLES.flatMap(bundle => (['raw', 'gzip'] as const).map(kind => [
    bundle,
    kind,
    `${main[bundle][kind]}`,
    `${head[bundle][kind]}`,
    formatChange(head[bundle][kind] - main[bundle][kind]),
]));
printTable([['bundle', 'kind', 'main', 'pr', 'change'], ...rows], 2);

const rawGrowth = head[TOTAL].raw - main[TOTAL].raw;
const gzipGrowth = head[TOTAL].gzip - main[TOTAL].gzip;

if (rawGrowth > RAW_INCREASE_QUOTA || gzipGrowth > GZIP_INCREASE_QUOTA) {
    console.log(`The bundle size grew by ${rawGrowth} bytes raw and ${gzipGrowth} bytes gzip, which is more than the quota of ${RAW_INCREASE_QUOTA} bytes raw or ${GZIP_INCREASE_QUOTA} bytes gzip.`);
    process.exitCode = 1;
}
