import {describe, test, expect} from 'vitest';
import {globSync} from 'glob';
import fs from 'fs';

describe('Example HTML files', () => {
    const exampleFiles = globSync('test/examples/*.html').sort();

    for (const exampleFile of exampleFiles) {
        const content = fs.readFileSync(exampleFile, 'utf-8');
        test(`${exampleFile} has og:created meta tag`, () => {
            const createdMatch = content.match(/<meta\s+property=["']og:created["']\s+content=["']([^"']*)["']/);
            if (!createdMatch) {
                expect.fail('missing `og:created` meta tag');
            } else if (!/^\d{4}-\d{2}-\d{2}$/.test(createdMatch[1])) {
                expect.fail(`\`og:created\` has invalid date format "${createdMatch[1]}" use YYYY-MM-DD format.`);
            }
        });
    
        test(`${exampleFile} has og:description meta tag`, () => {
            const descriptionMatch = content.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/);
            if (!descriptionMatch) {
                expect.fail('missing `og:description` meta tag');
            } else if (!descriptionMatch[1].trim()) {
                expect.fail('`og:description` content is empty');
            }
        });

        test(`${exampleFile} file name matches the title`, () => {
            const titleMatch = content.match(/<title>([^<]*)<\/title>/);
            if (!titleMatch) {
                expect.fail('missing <title> tag');
            } else if (!titleMatch[1].trim()) {
                expect.fail('<title> content is empty');
            } else {
                const expectedFileName = titleMatch[1].trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                const actualFileName = exampleFile.split('/').pop()?.replace('.html', '').toLowerCase();
                expect(actualFileName).toBe(expectedFileName);
            }
        });
    }
});
