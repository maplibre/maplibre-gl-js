#!/usr/bin/env node

const fs = require('fs');
const execSync = require('child_process').execSync;
const ejs = require('ejs');
const _ = require('lodash');
const semver = require('semver');

const changelogPath = 'CHANGELOG.md';
const changelog = fs.readFileSync(changelogPath, 'utf8');

let currentVersion = execSync('git describe --tags --match=v*.*.* --abbrev=0')
    .toString()
    .trim()
    .replace('v', '');

let gitTags = execSync('git tag --list v*.*.*')
    .toString()
    .split('\n')
    .map(function(tag) {
        tag = tag.replace('v', '').trim();
        return semver.clean(tag);
    });
let previousVersion = semver.maxSatisfying(gitTags, "<" + currentVersion, { includePrerelease: false });

/*
  Parse the raw changelog text and split it into individual releases.

  This regular expression:
    - Matches lines starting with "## x.x.x".
    - Groups the version number.
    - Skips the (optional) release date.
    - Groups the changelog content.
    - Ends when another "## x.x.x" is found.
*/
const regex = /^## (\d+\.\d+\.\d+).*?\n(.+?)(?=\n^## \d+\.\d+\.\d+.*?\n)/gms;

let releaseNotes = [];
// eslint-disable-next-line no-cond-assign
while (match = regex.exec(changelog)) {
    releaseNotes.push({
        'version': match[1],
        'changelog': match[2].trim(),
    });
}

/*
  Match the current tag with the most appropriate release notes.
*/
const versionsInReleaseNotes = _.map(releaseNotes, 'version');
const bestReleaseNotesForCurrentVersion = semver.minSatisfying(versionsInReleaseNotes, ">=" + currentVersion);
const currentReleaseNotes = _.find(releaseNotes, { version: bestReleaseNotesForCurrentVersion });

if (!currentReleaseNotes) {
    console.error('Could not find a release section satisfying %s in %s — did you forget to rename the "main" section to %s?', currentVersion, changelogPath, currentVersion.split("-")[0]);
    process.exit(1); // eslint-disable-line no-process-exit
}

/*
  Fill and print the release notes template.
*/
let templatedReleaseNotes;

templatedReleaseNotes = ejs.render(fs.readFileSync('build/release-notes.md.ejs', 'utf8'), {
    'CURRENTVERSION': currentVersion,
    'PREVIOUSVERSION': previousVersion,
    'CHANGELOG': currentReleaseNotes.changelog,
    'isPrerelease': semver.prerelease(currentVersion)
});
templatedReleaseNotes = templatedReleaseNotes.trimEnd();

// eslint-disable-next-line eol-last
process.stdout.write(templatedReleaseNotes);