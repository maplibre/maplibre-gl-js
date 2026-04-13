import {describe, test, expect} from 'vitest';
import {globSync} from 'glob';
import fs from 'fs';
import path from 'path';

describe('Example HTML files', () => {
    const exampleFiles = globSync('test/examples/*.html').sort();

    test.each(exampleFiles)('%s has required meta tags', (file) => {
        const content = fs.readFileSync(file, 'utf-8');
        const filename = path.basename(file);
        const errors: string[] = [];

        // Check og:description
        const descriptionMatch = content.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/);
        if (!descriptionMatch) {
            errors.push(
                `missing <meta property="og:description" content="..." />\n` +
                `  add this tag inside <head>:\n` +
                `    <meta property="og:description" content="A short description of what this example demonstrates." />`
            );
        } else if (!descriptionMatch[1].trim()) {
            errors.push(
                `og:description content is empty\n` +
                `  provide a meaningful description, e.g.:\n` +
                `    <meta property="og:description" content="Demonstrates how to ..." />`
            );
        }

        // Check og:created
        const createdMatch = content.match(/<meta\s+property=["']og:created["']\s+content=["']([^"']*)["']/);
        if (!createdMatch) {
            errors.push(
                `missing <meta property="og:created" content="YYYY-MM-DD" />\n` +
                `  add this tag inside <head> (right after og:description):\n` +
                `    <meta property="og:created" content="${new Date().toISOString().slice(0, 10)}" />`
            );
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(createdMatch[1])) {
            errors.push(
                `og:created has invalid date format: "${createdMatch[1]}"\n` +
                `  expected YYYY-MM-DD, e.g.:\n` +
                `    <meta property="og:created" content="2025-10-31" />`
            );
        }

        if (errors.length > 0) {
            expect.fail(
                `\n` +
                `error: ${filename} is missing required meta tags\n` +
                `  --> ${file}\n` +
                `\n` +
                errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n\n') +
                `\n`
            );
        }
    });
});
