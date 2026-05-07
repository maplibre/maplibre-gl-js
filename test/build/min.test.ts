import {describe, test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import packageJson from '../../package.json' assert {type: 'json'};
import bundleSizes from './bundle_size.json' assert {type: 'json'};

type SizeRecord = {raw: number; gzip: number};
type SizeMap = Record<string, SizeRecord>;

// Tolerance windows. We allow small fluctuations either way, but flag bigger jumps.
const RAW_INCREASE_QUOTA = 1024;
const RAW_DECREASE_QUOTA = 4096;
const GZIP_INCREASE_QUOTA = 256;
const GZIP_DECREASE_QUOTA = 1024;

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
            expect(mainBundle.includes(cmd)).toBeFalsy();
        }
    });

    for (const [filePath, expected] of Object.entries(bundleSizes as SizeMap)) {
        test(`${filePath} bundle size stays the same`, () => {
            const actual = measure(filePath);

            if (process.env.UPDATE) {
                const jsonPath = path.resolve(__dirname, './bundle_size.json');
                const updated: SizeMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                updated[filePath] = actual;
                fs.writeFileSync(jsonPath, `${JSON.stringify(updated, null, 4)}\n`);
                return;
            }

            const hint = `Update bundle_size.json by running: UPDATE=true npm run test-build -- min.test.ts (raw ${actual.raw} bytes, gzip ${actual.gzip} bytes)`;
            expect(actual.raw, hint).toBeLessThan(expected.raw + RAW_INCREASE_QUOTA);
            expect(actual.raw, hint).toBeGreaterThan(expected.raw - RAW_DECREASE_QUOTA);
            expect(actual.gzip, hint).toBeLessThan(expected.gzip + GZIP_INCREASE_QUOTA);
            expect(actual.gzip, hint).toBeGreaterThan(expected.gzip - GZIP_DECREASE_QUOTA);
        });
    }
});
