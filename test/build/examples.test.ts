import {describe, test, expect} from 'vitest';
import {globSync} from 'glob';
import fs from 'fs';

/**
 * Show a snippet of the file around `lineNum` (1-based) with a gutter,
 * highlighting the target line. If lineNum is null, shows the first few
 * lines of <head> as context.
 */
function snippet(lines: string[], lineNum: number | null, file: string): string {
    const target = lineNum ?? (lines.findIndex(l => /<head/i.test(l)) + 1 || 1);
    const start = Math.max(0, target - 2);
    const end = Math.min(lines.length, target + 2);
    const gutterWidth = String(end).length;

    const out: string[] = [];
    out.push(`  --> ${file}:${target}`);
    out.push(`${' '.repeat(gutterWidth + 1)} |`);
    for (let i = start; i < end; i++) {
        const num = String(i + 1).padStart(gutterWidth);
        const marker = (i + 1 === target) ? '>' : ' ';
        out.push(`${num} ${marker}| ${lines[i]}`);
    }
    out.push(`${' '.repeat(gutterWidth + 1)} |`);
    return out.join('\n');
}

/**
 * Find the 1-based line number of the first line matching `pattern`,
 * or null if not found.
 */
function findLine(lines: string[], pattern: RegExp): number | null {
    const idx = lines.findIndex(l => pattern.test(l));
    return idx >= 0 ? idx + 1 : null;
}

describe('Example HTML files', () => {
    const exampleFiles = globSync('test/examples/*.html').sort();

    test.each(exampleFiles)('%s has og:created meta tag', (file) => {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        const createdMatch = content.match(/<meta\s+property=["']og:created["']\s+content=["']([^"']*)["']/);
        if (!createdMatch) {
            const descLine = findLine(lines, /og:description/);
            expect.fail(
                `missing \`og:created\` meta tag\n${
                    snippet(lines, descLine, file)}\n` +
                '  = help: add right after og:description:\n' +
                `          <meta property="og:created" content="${new Date().toISOString().slice(0, 10)}" />`
            );
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(createdMatch[1])) {
            const loc = findLine(lines, /og:created/);
            expect.fail(
                `\`og:created\` has invalid date format "${createdMatch[1]}"\n${
                    snippet(lines, loc, file)}\n` +
                '  = help: use YYYY-MM-DD format, e.g.:\n' +
                '          <meta property="og:created" content="2025-10-31" />'
            );
        }
    });

    test.each(exampleFiles)('%s has og:description meta tag', (file) => {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        const descriptionMatch = content.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/);
        if (!descriptionMatch) {
            const loc = findLine(lines, /<head/i);
            expect.fail(
                `missing \`og:description\` meta tag\n${
                    snippet(lines, loc, file)}\n` +
                '  = help: add inside <head>:\n' +
                '          <meta property="og:description" content="A short description of what this example demonstrates." />'
            );
        } else if (!descriptionMatch[1].trim()) {
            const loc = findLine(lines, /og:description/);
            expect.fail(
                ++\`og:description\` content is empty\n${
                    snippet(lines, loc, file)}\n` +
                '  = help: provide a meaningful description, e.g.:\n' +
                '          <meta property="og:description" content="Demonstrates how to ..." />'
            );
        }
    });
});
