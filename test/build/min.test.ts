import {describe, test, expect} from 'vitest';
import fs from 'fs';
import packageJson from '../../package.json' assert {type: 'json'};

describe('production bundle', () => {
    const mainBundle = fs.readFileSync('dist/maplibre-gl.mjs', 'utf8');

    test('main bundle does not leak package.json script strings', () => {
        for (const name in packageJson.scripts) {
            const cmd = packageJson.scripts[name];
            if (cmd.length < 10) continue; // skip trivially-short commands
            expect(mainBundle).not.toContain(cmd);
        }
    });
});
