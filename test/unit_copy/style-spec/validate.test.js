import {test} from '../../util/test';
import glob from 'glob';
import fs from 'fs';
import path, {dirname} from 'path';
import validate from '../../../rollup/build/tsc/style-spec/validate_style';
import {fileURLToPath} from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const UPDATE = !!process.env.UPDATE;

glob.sync(`${__dirname}/fixture/*.input.json`).forEach((file) => {
    test(path.basename(file), (t) => {
        const outputfile = file.replace('.input', '.output');
        const style = fs.readFileSync(file);
        const result = validate(style);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        expect(result).toEqual(expect);
        t.end();
    });
});

const fixtures = glob.sync(`${__dirname}/fixture/*.input.json`);
const style = JSON.parse(fs.readFileSync(fixtures[0]));
import reference from '../../../rollup/build/tsc/style-spec/reference/latest';

test('validate.parsed exists', (t) => {
    expect(typeof validate.parsed).toBe('function');
    t.end();
});

test('errors from validate.parsed do not contain line numbers', (t) => {
    const result = validate.parsed(style, reference);
    expect(result[0].line).toBe(undefined);
    t.end();
});

test('validate.latest exists', (t) => {
    expect(typeof validate.latest).toBe('function');
    t.end();
});

test('errors from validate.latest do not contain line numbers', (t) => {
    const result = validate.latest(style);
    expect(result[0].line).toBe(undefined);
    t.end();
});
