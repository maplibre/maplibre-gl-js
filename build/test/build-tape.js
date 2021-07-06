/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */
import browserify from 'browserify';
import fs from 'fs';
import {fileURLToPath} from 'url';

export default function buildTape() {
    return new Promise((resolve, reject) => {
        browserify(fileURLToPath(new URL('../../test/util/tape_config.js', import.meta.url)), { standalone: 'tape' })
            .transform("babelify", {presets: ["@babel/preset-env"], global: true})
            .bundle((err, buff) => {
                if (err) { throw err; }

                fs.writeFile('test/integration/dist/tape.js', buff, { encoding: 'utf8'}, (err) => {
                    if (err) { reject(err); }
                    resolve();
                });
            });
    });
};

buildTape()
