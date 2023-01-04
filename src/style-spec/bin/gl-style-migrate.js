#!/usr/bin/env node

import fs from 'fs';
import minimist from 'minimist';
import {format, migrate} from '@maplibre/maplibre-gl-style-spec';
const argv = minimist(process.argv.slice(2));

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    help();
} else {
    console.log(format(migrate(JSON.parse(fs.readFileSync(argv._[0]).toString()))));
}

function help() {
    console.log('usage:');
    console.log('  gl-style-migrate style-v7.json > style-v8.json');
}

