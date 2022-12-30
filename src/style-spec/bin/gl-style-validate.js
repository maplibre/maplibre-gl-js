#!/usr/bin/env node
/* eslint-disable no-process-exit */

import minimist from 'minimist';
import rw from 'rw';
import {validate} from '@maplibre/maplibre-gl-style-spec';

const argv = minimist(process.argv.slice(2), {
    boolean: 'json',
});

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    help();
} else {
    let status = 0;

    if (!argv._.length) {
        argv._.push('/dev/stdin');
    }

    argv._.forEach((file) => {
        const errors = validate(rw.readFileSync(file, 'utf8'));
        if (errors.length) {
            if (argv.json) {
                process.stdout.write(JSON.stringify(errors, null, 2));
            } else {
                errors.forEach((e) => {
                    console.log('%s:%d: %s', file, e.line, e.message);
                });
            }
            status = 1;
        }
    });

    process.exit(status);
}

function help() {
    console.log('usage:');
    console.log('  gl-style-validate file.json');
    console.log('  gl-style-validate < file.json');
    console.log('');
    console.log('options:');
    console.log('--json  output errors as json');
}
