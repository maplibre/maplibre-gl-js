import validate from './validate_style';
import glob from 'glob';
import fs from 'fs';

describe('validate style', () => {
    const UPDATE = !!process.env.UPDATE;

    glob.sync('src/style-spec/fixture/*.input.json').forEach((file) => {
        test(file, () => {
            const outputfile = file.replace('.input', '.output');
            const style = fs.readFileSync(file);
            const result = validate(style);
            if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
            const expectParsed = JSON.parse(fs.readFileSync(outputfile).toString());
            expect(result).toEqual(expectParsed);
        });
    });
});
