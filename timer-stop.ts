import fs from 'fs';
import {timingFile} from './timer-start';

if (!fs.existsSync(timingFile)) {
    throw new Error(`expecting ${timingFile} before running this script`);
}

const end = Date.now();
const start = parseInt(fs.readFileSync(timingFile).toString());
fs.unlinkSync(timingFile);
const elapsed = (end - start) / 1000;

console.log(`Elapsed: ${elapsed.toFixed(2)}s`);
