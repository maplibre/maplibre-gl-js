import glob from 'glob';
import fs from 'fs';
import path, {dirname} from 'path';
import validate from '../style-spec/validate_style';
import {fileURLToPath} from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const UPDATE = !!process.env.UPDATE;

glob.sync(`${__dirname}/fixture/*.input.json`).forEach((file) => {
    test(path.basename(file), () => {
        const outputfile = file.replace('.input', '.output');
        const style = fs.readFileSync(file);
        const result = validate(style);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        expect(result).toEqual(expect);
    });
});

const fixtures = glob.sync(`${__dirname}/fixture/*.input.json`);
const style = JSON.parse(fs.readFileSync(fixtures[0]));
import reference from '../style-spec/reference/latest';

describe('validate.parsed exists', () => {
    expect(typeof validate.parsed).toBe('function');
});

describe('errors from validate.parsed do not contain line numbers', () => {
    const result = validate.parsed(style, reference);
    expect(result[0].line).toBeUndefined();
});

describe('validate.latest exists', () => {
    expect(typeof validate.latest).toBe('function');
});

describe('errors from validate.latest do not contain line numbers', () => {
    const result = validate.latest(style);
    expect(result[0].line).toBeUndefined();
});
