#!/usr/bin/env node

import * as fs from 'fs';
import * as ejs from 'ejs';
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

/*
  Fill and print the release notes template.
*/
let templatedReleaseNotes;

templatedReleaseNotes = ejs.render(fs.readFileSync('build/release-notes.md.ejs', 'utf8'), {
    'CURRENTVERSION': latest.version,
    'PREVIOUSVERSION': previous.version,
    'CHANGELOG': latest.changelog,
    'isPrerelease': semver.prerelease(latest.version)
});
templatedReleaseNotes = templatedReleaseNotes.trimEnd();

// eslint-disable-next-line eol-last
process.stdout.write(templatedReleaseNotes);