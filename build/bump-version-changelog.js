#!/usr/bin/env node

/**
 * This script updates the changelog.md file with the version given in the arguments
 * It replaces ## main with ## <version>
 * Removes _...Add new stuff here..._
 * And adds on top a ## main with add stuff here.
 */

import * as fs from 'fs';

const changelogPath = 'CHANGELOG.md';
let changelog = fs.readFileSync(changelogPath, 'utf8');
changelog = changelog.replace('## main', `## ${process.argv[2]}`);
changelog = changelog.replaceAll('- _...Add new stuff here..._\n', '');
changelog = `## main

### ✨ Features and improvements
- _...Add new stuff here..._

### 🐞 Bug fixes
- _...Add new stuff here..._

` + changelog;

fs.writeFileSync(changelogPath, changelog, 'utf8');