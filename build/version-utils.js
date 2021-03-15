#!/usr/bin/env node

const execSync = require('child_process').execSync;
const semver = require('semver');

const args = process.argv.slice(2);

function latestVersionTag() {
    const latestVersionTag = execSync('git describe --tags --match=v*.*.* --abbrev=0')
        .toString()
        .trim();
    return latestVersionTag;
}

function latestFromTags() {
    const currentVersion = execSync('git describe --tags --match=v*.*.* --abbrev=0')
        .toString()
        .trim()
        .replace(/^v/, '');
    return currentVersion;
}

function listTags() {
    let gitTags = execSync('git log --no-walk --tags --pretty=format:%S')
        .toString()
        .split('\n')
        .reduce((filtered, tag) => {
            const parsed = semver.valid(tag.replace(/^v/, ''));
            if (parsed) {
                filtered.push(parsed);
            }
            return filtered;
        }, []);
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
    case 'latest-version-tag':
        console.log(latestVersionTag());
        break;
    case 'version-from-tags':
        console.log(latestFromTags());
        break;
    case 'validate-latest-tag':
        const tags = listTags();
        if (tags && tags.length > 1) {
            const current = tags[0];
            const previous = tags[1];
            if (semver.gt(current, previous)) {
                console.log(`valid version tag current=${current}, previous=${previous}`);
            } else {
                console.log(`invalid - latest tag must contain greater version than previous one (current=${current}, previous=${previous})`);
                process.exit(1); // eslint-disable-line no-process-exit
            }
        } else {
            console.log("valid");
        }
        break;
    default:
        console.log('Unknown command.');
        break;
}
