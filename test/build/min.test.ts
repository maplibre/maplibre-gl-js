import {describe, test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import packageJson from '../../package.json' assert {type: 'json'};

type SizeRecord = {raw: number; gzip: number};
type SizeMap = Record<string, SizeRecord>;

// Tolerance windows. We allow small increases, but flag bigger jumps.
const RAW_INCREASE_QUOTA = 1024;
const GZIP_INCREASE_QUOTA = 256;

// Sizes of the base build, written with UPDATE=true by the Dependabot workflow
const baseSizesPath = path.resolve(__dirname, './bundle_size.json');

function measure(file: string): SizeRecord {
    const buf = fs.readFileSync(file);
    return {raw: buf.length, gzip: zlib.gzipSync(buf).length};
}

describe('production bundle', () => {
    const mainBundle = fs.readFileSync('dist/maplibre-gl.mjs', 'utf8');

    test('main bundle does not leak package.json script strings', () => {
        for (const name in packageJson.scripts) {
            const cmd = packageJson.scripts[name];
            if (cmd.length < 10) continue; // skip trivially-short commands
            expect(mainBundle).not.toContain(cmd);
        }
    });

    for (const filePath of ['dist/maplibre-gl.mjs', 'dist/maplibre-gl-worker.mjs']) {
        test.skipIf(!process.env.UPDATE && !fs.existsSync(baseSizesPath))(`${filePath} bundle size does not grow past the quota`, () => {
            const actual = measure(filePath);

            if (process.env.UPDATE) {
                const updated: SizeMap = fs.existsSync(baseSizesPath) ? JSON.parse(fs.readFileSync(baseSizesPath, 'utf8')) : {};
                updated[filePath] = actual;
                fs.writeFileSync(baseSizesPath, `${JSON.stringify(updated, null, 4)}\n`);
                return;
            }

            const expected: SizeRecord = JSON.parse(fs.readFileSync(baseSizesPath, 'utf8'))[filePath];
            const hint = `raw ${actual.raw} bytes, gzip ${actual.gzip} bytes`;
            expect(actual.raw, hint).toBeLessThan(expected.raw + RAW_INCREASE_QUOTA);
            expect(actual.gzip, hint).toBeLessThan(expected.gzip + GZIP_INCREASE_QUOTA);
        });
    }
});
