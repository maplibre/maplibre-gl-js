#!/usr/bin/env node

import fs from "fs";
import zlib from "zlib";
import prettyBytes from "pretty-bytes";
const beforeSourcemap = JSON.parse(fs.readFileSync('./before.json').toString());
const afterSourcemap = JSON.parse(fs.readFileSync('./after.json').toString());

function fileSize(file) {
    const {size} = fs.statSync(file);
    const gzipped = zlib.gzipSync(fs.readFileSync(file)).length
    return {
        size,
        gzipped
    };
}

const beforejs = fileSize('./before/maplibre-gl.js');
const beforecss = fileSize('./before/maplibre-gl.css');
const afterjs = fileSize('./after/maplibre-gl.js');
const aftercss = fileSize('./after/maplibre-gl.css');

console.log('Bundle size report:\n');
console.log(`**Size Change:** ${prettyBytes(afterjs.gzipped + aftercss.gzipped - (beforejs.gzipped + beforecss.gzipped), { signed: true })}`);
console.log(`**Total Size Before:** ${prettyBytes(beforejs.gzipped + beforecss.gzipped)}`);
console.log(`**Total Size After:** ${prettyBytes(afterjs.gzipped + aftercss.gzipped)}`);
console.log(`
| Output file | Before | After | Change |
| :--- | :---: | :---: | :---: |
| maplibre-gl.js | ${prettyBytes(beforejs.gzipped)} | ${prettyBytes(afterjs.gzipped)} | ${prettyBytes(afterjs.gzipped - beforejs.gzipped, { signed: true })} |
| maplibre-gl.css | ${prettyBytes(beforecss.gzipped)} | ${prettyBytes(aftercss.gzipped)} | ${prettyBytes(aftercss.gzipped - beforecss.gzipped, { signed: true })} |`);

const before = {};
beforeSourcemap.results.forEach(result => {
    Object.keys(result.files).forEach(filename => {
        const {size} = result.files[filename];
        before[filename] = size;
    });
});

const after = {};
afterSourcemap.results.forEach(result => {
    Object.keys(result.files).forEach(filename => {
        const {size} = result.files[filename];
        after[filename] = size;
    });
});

const diffs = [];
Object.keys(Object.assign({}, before, after)).forEach(filename => {
    const beforeSize = before[filename] || 0;
    const afterSize = after[filename] || 0;
    if (Math.abs(afterSize - beforeSize) > 0) {
        diffs.push([
            afterSize - beforeSize, // for sorting
            filename.replace(/^[\./]+/, ''), // omit ../
            prettyBytes(beforeSize),
            prettyBytes(afterSize),
            prettyBytes(afterSize - beforeSize, { signed: true })
        ]);
    }
});

diffs.sort((a, b) => b[0] - a[0]);

console.log(`
<details><summary>ℹ️ <strong>View Details</strong></summary>`);
if (diffs.length) {
    console.log(`
| Source file | Before | After | Change |
| :--- | :---: | :---: | :---: |
${diffs.map(diff => '| ' + diff.slice(1).join(' | ') + ' |').join('\n')}
`);
} else {
    console.log('No major changes');
}
console.log(`</details>`);
