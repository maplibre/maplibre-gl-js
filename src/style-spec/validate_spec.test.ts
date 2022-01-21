import glob from 'glob';
import fs from 'fs';
import path from 'path';
import validate from '../style-spec/validate_style';

const UPDATE = !!process.env.UPDATE;

glob.sync('src/style-spec/fixture/*.input.json').forEach((file) => {
    test(path.basename(file), () => {
        const outputfile = file.replace('.input', '.output');
        const style = fs.readFileSync(file);
        const result = validate(style);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expectedOutput = JSON.parse(fs.readFileSync(outputfile).toString());
        expect(result).toEqual(expectedOutput);
    });
});
