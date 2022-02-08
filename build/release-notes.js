#!/usr/bin/env node

import * as fs from 'fs';
import semver from 'semver';

const changelogPath = 'CHANGELOG.md';
const changelog = fs.readFileSync(changelogPath, 'utf8');

/*
  Parse the raw changelog text and split it into individual releases.

  This regular expression:
    - Matches lines starting with "## x.x.x".
    - Groups the version number.
    - Skips the (optional) release date.
    - Groups the changelog content.
    - Ends when another "## x.x.x" is found.
*/
const regex = /^## (\d+\.\d+\.\d+.*?)\n(.+?)(?=\n^## \d+\.\d+\.\d+.*?\n)/gms;

let releaseNotes = [];
let match;
// eslint-disable-next-line no-cond-assign
while (match = regex.exec(changelog)) {
    releaseNotes.push({
        'version': match[1],
        'changelog': match[2].trim(),
    });
}

const latest = releaseNotes[0];
const previous = releaseNotes[1];


//  Print the release notes template.

const templatedReleaseNotes = `https://github.com/maplibre/maplibre-gl-js
[Changes](https://github.com/maplibre/maplibre-gl-js/compare/v${previous.version}...v${latest.version}) since [MapLibre GL JS v${previous.version}](https://github.com/maplibre/releases/tag/v${previous.version}):

${latest.changelog}

${semver.prerelease(latest.version) ? 'Pre-release version' : ''}`;

// eslint-disable-next-line eol-last
process.stdout.write(templatedReleaseNotes.trimEnd());