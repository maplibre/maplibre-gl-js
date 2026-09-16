import {describe, test, expect} from 'vitest';
import {globSync} from 'glob';
import {basename} from 'path';
import fs from 'fs';
import exampleCategoryGroups from '../../docs/example-categories.json' with {type: 'json'};

const EXAMPLE_CATEGORIES = exampleCategoryGroups.flatMap(group => group.categories);

describe('Example HTML files', () => {
    const exampleFiles = globSync('test/examples/*.html').sort();

    for (const exampleFile of exampleFiles) {
        const content = fs.readFileSync(exampleFile, 'utf-8');
        test(`${exampleFile} has og:created meta tag`, () => {
            const createdMatch = content.match(/<meta\s+property=["']og:created["']\s+content=["']([^"']*)["']/);
            expect(createdMatch, 'missing `og:created` meta tag').not.toBeNull();
            expect(createdMatch[1], '`og:created` must use the YYYY-MM-DD format').toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        test(`${exampleFile} has og:description meta tag`, () => {
            const descriptionMatch = content.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/);
            expect(descriptionMatch, 'missing `og:description` meta tag').not.toBeNull();
            expect(descriptionMatch[1].trim(), '`og:description` content is empty').not.toBe('');
        });

        test(`${exampleFile} has a valid og:category meta tag`, () => {
            const categoryMatch = content.match(/<meta\s+property=["']og:category["']\s+content=["']([^"']*)["']/);
            expect(categoryMatch, 'missing `og:category` meta tag').not.toBeNull();
            expect(EXAMPLE_CATEGORIES, `unknown \`og:category\` "${categoryMatch?.[1]}"`).toContain(categoryMatch[1]);
        });

        test(`${exampleFile} has a numeric og:order meta tag if present`, () => {
            const orderMatch = content.match(/<meta\s+property=["']og:order["']\s+content=["']([^"']*)["']/);
            const order = orderMatch ? Number(orderMatch[1]) : 0;
            expect(order, `\`og:order\` has a non-numeric value "${orderMatch?.[1]}"`).not.toBeNaN();
        });

        test(`${exampleFile} file name matches the title`, () => {
            const titleMatch = content.match(/<title>([^<]*)<\/title>/);
            expect(titleMatch, 'missing <title> tag').not.toBeNull();

            const title = titleMatch[1].trim();
            expect(title, '<title> content is empty').not.toBe('');

            const expectedFileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
            const actualFileName = basename(exampleFile).replace('.html', '').toLowerCase();
            expect(actualFileName).toBe(expectedFileName);
        });
    }
});
