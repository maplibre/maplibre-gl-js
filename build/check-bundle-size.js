#!/usr/bin/env node

/* eslint-disable */

const fs = require("fs");
const zlib = require("zlib");
const prettyBytes = require("pretty-bytes");
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

const beforejs = fileSize('./before/mapbox-gl.js');
const beforecss = fileSize('./before/mapbox-gl.css');
const afterjs = fileSize('./after/mapbox-gl.js');
const aftercss = fileSize('./after/mapbox-gl.css');

const total = afterjs.size + aftercss.size;
const gzipped = afterjs.gzipped + aftercss.gzipped;
const megabit = Math.pow(2, 12);
const downloadTime3G = (total / (3 * megabit)).toFixed(0);
const downloadTime4G = (total / (10 * megabit)).toFixed(0);
console.log(`**Size Change:** ${prettyBytes(afterjs.gzipped + aftercss.gzipped - (beforejs.gzipped + beforecss.gzipped))}`);
console.log(`**Total Size:** ${prettyBytes(afterjs.gzipped + aftercss.gzipped)}`);
console.log(`
| Filename | Size | Change |
| :--- | :---: | :---: |
| mapbox-gl.js | ${prettyBytes(afterjs.gzipped)} | ${prettyBytes(afterjs.gzipped - beforejs.gzipped)} |
| mapbox-gl.css | ${prettyBytes(aftercss.gzipped)} | ${prettyBytes(aftercss.gzipped - beforecss.gzipped)} |`);

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
    if (afterSize >= (beforeSize + 1)) {
        diffs.push([afterSize - beforeSize, filename.replace(/^[\./]+/, ''), prettyBytes(beforeSize), prettyBytes(afterSize), prettyBytes(afterSize - beforeSize)]);
    }
});

diffs.sort((a, b) => a[0] - b[0]);

console.log(`
<details><summary>ℹ️ <strong>View Details</strong></summary>`);
if (diffs.length) {
    console.log(`
| Filename | Before | After | Change |
| :--- | :---: | :---: |
${diffs.map(diff => '| ' + diff.slice(1).join(' | ') + ' |').join('\n')}
`);
} else {
    console.log('No major changes');
}
console.log(`</details>`);
