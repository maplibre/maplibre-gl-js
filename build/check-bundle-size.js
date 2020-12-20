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

// const jwt = require('jsonwebtoken');
// const github = require('@octokit/rest')();
// const prettyBytes = require('pretty-bytes');
// const fs = require('fs');
// const {execSync} = require('child_process');
// const zlib = require('zlib');

// const SIZE_CHECK_APP_ID = 14028;
// const SIZE_CHECK_APP_INSTALLATION_ID = 229425;

// const file = process.argv[2];
// const label = process.argv[3];
// const name = `Size - ${label}`;

// if (!file || !label) {
//     console.log(`Usage: ${process.argv[0]} ${process.argv[1]} FILE LABEL`);
//     process.exit(1);
// }

// const {size} = fs.statSync(file);
// const gzipSize = zlib.gzipSync(fs.readFileSync(file)).length;

// process.on('unhandledRejection', error => {
//     // don't log `error` directly, because errors from child_process.execSync
//     // contain an (undocumented) `envPairs` with environment variable values
//     console.log(error.message || 'Error');
//     process.exit(1)
// });

// const pk = process.env['SIZE_CHECK_APP_PRIVATE_KEY'];
// if (!pk) {
//     console.log('Fork PR; not computing size.');
//     process.exit(0);
// }

// const key = Buffer.from(pk, 'base64').toString('binary');
// const payload = {
//     exp: Math.floor(Date.now() / 1000) + 60,
//     iat: Math.floor(Date.now() / 1000),
//     iss: SIZE_CHECK_APP_ID
// };

// const token = jwt.sign(payload, key, {algorithm: 'RS256'});
// github.authenticate({type: 'app', token});

// function getMergeBase() {
//     const pr = process.env['CIRCLE_PULL_REQUEST'];
//     if (pr) {
//         const number = +pr.match(/\/(\d+)\/?$/)[1];
//         return github.pullRequests.get({
//             owner: 'maplibre',
//             repo: 'maplibre-gl-js',
//             pull_number: number
//         }).then(({data}) => {
//             const base = data.base.ref;
//             const head = process.env['CIRCLE_SHA1'];
//             return execSync(`git merge-base origin/${base} ${head}`).toString().trim();
//         });
//     } else {
//         // Walk backward through the history (maximum of 10 commits) until
//         // finding a commit on either main or release-*; assume that's the
//         // base branch.
//         const head = process.env['CIRCLE_SHA1'];
//         for (const sha of execSync(`git rev-list --max-count=10 ${head}`).toString().trim().split('\n')) {
//             const base = execSync(`git branch -r --contains ${sha} origin/main origin/release-* origin/publisher-production`).toString().split('\n')[0].trim().replace(/^origin\//, '');
//             if (base) {
//                 return Promise.resolve(execSync(`git merge-base origin/${base} ${head}`).toString().trim());
//             }
//         }
//     }

//     return Promise.resolve(null);
// }

// function getPriorSize(mergeBase) {
//     if (!mergeBase) {
//         console.log('No merge base available.');
//         return Promise.resolve(null);
//     }

//     return github.checks.listForRef({
//         owner: 'maplibre',
//         repo: 'maplibre-gl-js',
//         ref: mergeBase
//     }).then(({data}) => {
//         const run = data.check_runs.find(run => run.name === name);
//         if (run) {
//             const match = run.output.summary.match(/`[^`]+` is (\d+) bytes \([^\)]+\) uncompressed, (\d+) bytes \([^\)]+\) gzipped\./);
//             if (match) {
//                 const prior = { size: +match[1], gzipSize: +match[2] };
//                 console.log(`Prior size was ${prettyBytes(prior.size)}, gzipped ${prior.gzipSize}.`);
//                 return prior;
//             }
//         }
//         console.log('No matching check found.');
//         return Promise.resolve(null);
//     });
// }

// function formatSize(size, priorSize) {
//     if (priorSize) {
//         const change = size - priorSize;
//         const percent = (change / priorSize) * 100;
//         return `${change >= 0 ? '+' : ''}${prettyBytes(change)} ${percent.toFixed(3)}% (${prettyBytes(size)})`;
//     } else {
//         return prettyBytes(size);
//     }
// }

// github.apps.createInstallationToken({installation_id: SIZE_CHECK_APP_INSTALLATION_ID})
//     .then(({data}) => {
//         github.authenticate({type: 'token', token: data.token});
//         getMergeBase().then(getPriorSize).then(prior => {
//             const title = `${formatSize(size, prior ? prior.size : null)}, gzipped ${formatSize(gzipSize, prior ? prior.gzipSize : null)}`;

//             const megabit = Math.pow(2, 12);
//             const downloadTime3G = (gzipSize / (3 * megabit)).toFixed(0);
//             const downloadTime4G = (gzipSize / (10 * megabit)).toFixed(0);
//             const summary = `\`${file}\` is ${size} bytes (${prettyBytes(size)}) uncompressed, ${gzipSize} bytes (${prettyBytes(gzipSize)}) gzipped.
// That's **${downloadTime3G} seconds** over slow 3G (3 Mbps), **${downloadTime4G} seconds** over fast 4G (10 Mbps).`;

//             console.log(`Posting check result:\n${title}\n${summary}`);

//             return github.checks.create({
//                 owner: 'maplibre',
//                 repo: 'maplibre-gl-js',
//                 name,
//                 head_branch: process.env['CIRCLE_BRANCH'],
//                 head_sha: process.env['CIRCLE_SHA1'],
//                 status: 'completed',
//                 conclusion: 'success',
//                 completed_at: new Date().toISOString(),
//                 output: { title, summary }
//             });
//         })
//     });
