#!/usr/bin/env node

const execSync = require('child_process').execSync;
const semver = require('semver');

const args = process.argv.slice(2);

function latestFromTags() {
    const currentVersion = execSync('git describe --tags --match=v*.*.* --abbrev=0')
        .toString()
        .trim()
        .replace('v', '');
    return currentVersion;
}

function listTags() {
    let gitTags = execSync('git log --no-walk --tags --pretty=format:%S')
        .toString()
        .split('\n')
        .filter(function(tag) {
            return tag && /v*.*.*/.test('tag')
        })
        .map(function (tag) {
            tag = tag.replace('v', '').trim();
            return semver.clean(tag);
        })
        .filter(function(cleanTag) {
            return cleanTag
        });
    return gitTags;
}

switch (args[0]) {
    case 'list-version-tags':
        console.log(listTags().join("\n"));
        break;        
    case 'version-type':
        if (semver.prerelease(latestFromTags())) {
            console.log("prerelease");
        } else {
            console.log("regular");
        }
        break;
    case 'version-from-tags':
        console.log(latestFromTags());
        break;
    case 'validate-latest-tag':
        const tags = listTags();
        if (tags && tags.length > 1) {
            const current = tags[tags.length-1];
            const previous = tags[tags.length-2];
            if (semver.gt(current, previous)){
                console.log(`valid version tag current=${current}, previous=${previous}`);
            } else {
                console.log(`invalid - latest tag must contain greater version than previous one (current=${current}, previous=${previous})`);
                process.exit(1);
            }
        } else {
            console.log("valid");
        }
        break;
    default:
        console.log('Unknown command.');
}
