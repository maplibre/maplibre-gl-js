/*
 * Builds the commit before HEAD and HEAD, and fails when either bundle grows past the quota.
 * In CI, HEAD is the PR's merge commit, so the commit before it is the base branch.
 */
import {execSync} from 'child_process';
import fs from 'fs';
import zlib from 'zlib';

const RAW_INCREASE_QUOTA = 1024;
const GZIP_INCREASE_QUOTA = 256;
const BUNDLES = ['dist/maplibre-gl.mjs', 'dist/maplibre-gl-worker.mjs'];

type SizeRecord = {raw: number; gzip: number};

function buildAndMeasure(): Record<string, SizeRecord> {
    execSync('npm ci', {stdio: 'inherit'});
    execSync('npm run build-dist', {stdio: 'inherit'});
    return Object.fromEntries(BUNDLES.map(file => {
        const buf = fs.readFileSync(file);
        return [file, {raw: buf.length, gzip: zlib.gzipSync(buf).length}];
    }));
}

execSync('git checkout HEAD^1', {stdio: 'inherit'});
const base = buildAndMeasure();
execSync('git checkout -', {stdio: 'inherit'});
const head = buildAndMeasure();

let grew = false;
for (const file of BUNDLES) {
    const raw = head[file].raw - base[file].raw;
    const gzip = head[file].gzip - base[file].gzip;
    console.log(`${file}: raw ${raw} bytes, gzip ${gzip} bytes`);
    grew ||= raw > RAW_INCREASE_QUOTA || gzip > GZIP_INCREASE_QUOTA;
}

if (grew) {
    console.error(`A bundle grew more than ${RAW_INCREASE_QUOTA} bytes raw or ${GZIP_INCREASE_QUOTA} bytes gzip.`);
    process.exit(1);
}
