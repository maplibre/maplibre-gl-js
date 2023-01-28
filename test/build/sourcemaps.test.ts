import packageJson from '../../package.json' assert {type: 'json'};
import {glob} from 'glob';
import path, {dirname} from 'path';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'url';

const distjs = glob.sync('dist/**/*.js');
jest.setTimeout(1000000);
async function getSourceMapForFile(url: string|URL) {
    const content = await fs.readFile(url, {encoding: 'utf-8'});
    const result = new RegExp('^//# sourceMappingURL=(.*)$', 'm').exec(content);
    expect(result).toBeTruthy();
    const sourcemapUrl = result![1];
    expect(sourcemapUrl).toBeTruthy();
    const resolvedSourcemapURL = new URL(sourcemapUrl, url);
    const text = await fs.readFile(resolvedSourcemapURL, {encoding: 'utf-8'});
    return JSON.parse(text);
}

describe.each(distjs)('release file %s', (file) => {
    const sourceFileURL = pathToFileURL(file);

    test('should have a sourcemap', async () => {
        const j = await getSourceMapForFile(sourceFileURL);

        expect(j).toBeTruthy();
        expect(j).toHaveProperty('version', 3);
        expect(j).toHaveProperty('file');
        expect(j.file).toEqual(sourceFileURL.pathname.split('/').at(-1));
        expect(j.sources.length).toBeGreaterThan(0);
        expect(j.sourcesContent.length).toBeGreaterThan(0);
        expect(j.names.length).toBeGreaterThan(0);
        expect(j.mappings).toBeTruthy();
    });
    test('should not reference test files', async () => {
        const j = await getSourceMapForFile(sourceFileURL);
        for (const f of j.sources) {
            expect(f).not.toMatch('[.]test[.]ts$');
            expect(f).not.toMatch('^test');
        }
    });
    test('should not reference dist files', async () => {
        const j = await getSourceMapForFile(sourceFileURL);
        for (const f of j.sources) {
            expect(f).not.toMatch('^dist');
        }
    });
});

describe('main sourcemap', () => {
    test('should match source files', async () => {
        const sourcemapJSON = await getSourceMapForFile(pathToFileURL(packageJson.main));
        const sourcemapDir = path.relative('.', dirname(packageJson.main));

        const sourcemapEntriesNormalized = sourcemapJSON.sources.map(f => {
            const joinedFilePath = path.join(sourcemapDir, f);

            // joined path has back slashes on windows, normalize them to be consistant with
            // entries returned by glob
            return  joinedFilePath.replace(/\\/g, '/');
        });

        // *.js.map file should have these files
        const srcFiles = await promisify(glob)('src/**/*.ts');
        const expectedEntriesInSourcemapJSON = srcFiles.filter(f => {
            if (f.endsWith('.test.ts'))
                return false;
            if (f.startsWith('src/style-spec'))
                return false;
            if (f.startsWith('build/'))
                return false;
            return true;
        }).sort();

        // actual files from *.js.map
        const actualEntriesInSourcemapJSON = sourcemapEntriesNormalized.filter(f => {
            if (f.startsWith('node_modules'))
                return false;
            if (f.startsWith('src/style-spec'))
                return false;
            return true;
        }).sort();

        function setMinus<T>(a: T[], b: T[]) : T[] {
            const sb = new Set(b);
            return a.filter(x => !sb.has(x));
        }

        const s1 = setMinus(actualEntriesInSourcemapJSON, expectedEntriesInSourcemapJSON);
        expect(s1.length).toBeLessThan(5);
        const s2 = setMinus(expectedEntriesInSourcemapJSON, actualEntriesInSourcemapJSON);
        expect(s2.length).toBeLessThan(15);
    });
});
