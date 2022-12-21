#!/usr/bin/env node


var fs = require('fs'),
    argv = require('minimist')(process.argv.slice(2)),
    format = require('../').format,
    composite = require('../').composite;

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    return help();
}

console.log(format(composite(JSON.parse(fs.readFileSync(argv._[0])))));

function help() {
    console.log('usage:');
    console.log('  gl-style-composite file.json');
    console.log('  gl-style-composite < file.json');
}

