/* eslint-disable no-process-exit */
import path, {dirname} from 'path';
import fs from 'fs';
import glob from 'glob';
import shuffleSeed from 'shuffle-seed';
import {queue} from 'd3-queue';
import localizeURLs from '../lib/localize-urls';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));
const requireFn = createRequire(import.meta.url);

const {shuffle} = shuffleSeed;

export default function (directory, implementation, options, run) {
    const q = queue(1);

    const tests = options.tests || [];
    const ignores = options.ignores || {};

    let sequence = glob.sync(`**/${options.fixtureFilename || 'style.json'}`, {cwd: directory})
        .map(fixture => {
            const id = path.dirname(fixture);
            const style = JSON.parse(fs.readFileSync(path.join(directory, fixture), 'utf8'));
            style.metadata = style.metadata || {};

            style.metadata.test = Object.assign({
                id,
                ignored: ignores[`${path.basename(directory)}/${id}`],
                width: 512,
                height: 512,
                pixelRatio: 1,
                recycleMap: options.recycleMap || false,
                allowed: 0.00015
            }, style.metadata.test);

            return style;
        })
        .filter(style => {
            const test = style.metadata.test;

            if (tests.length !== 0 && !tests.some(t => test.id.indexOf(t) !== -1)) {
                return false;
            }

            if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && test.id.match(/^debug\//)) {
                console.log(`* skipped ${test.id}`);
                return false;
            }
            if (/^skip/.test(test.ignored)) {
                console.log(`* skipped ${test.id} (${test.ignored})`);
                return false;
            }
            localizeURLs(style, 2900, path.join(__dirname, '../'), requireFn);
            return true;
        });

    if (options.shuffle) {
        console.log(`* shuffle seed: ${options.seed}`);
        sequence = shuffle(sequence, options.seed);
    }

    let index = 0;
    sequence.forEach(style => {
        q.defer((callback) => {
            const test = style.metadata.test;

            try {
                run(style, test, handleResult);
            } catch (error) {
                handleResult(error);
            }

            function handleResult (error) {
                if (error) {
                    test.error = error;
                }

                if (test.ignored && !test.ok) {
                    test.color = '#9E9E9E';
                    test.status = 'ignored failed';
                    console.log(`${++index}/${sequence.length}: ignore ${test.id} (${test.ignored})`);
                } else if (test.ignored) {
                    test.color = '#E8A408';
                    test.status = 'ignored passed';
                    console.log(`${++index}/${sequence.length}: ignore ${test.id} (${test.ignored})`);
                } else if (test.error) {
                    test.color = 'red';
                    test.status = 'errored';
                    console.log(`${++index}/${sequence.length}: errored ${test.id}`);
                } else if (!test.ok) {
                    test.color = 'red';
                    test.status = 'failed';
                    console.log(`${++index}/${sequence.length}: failed ${test.id}`);
                } else {
                    test.color = 'green';
                    test.status = 'passed';
                    console.log(`${++index}/${sequence.length}: passed ${test.id}`);
                }

                callback(null, test);
            }
        });
    });

    q.awaitAll((err, results) => {
        if (err) {
            console.error(err);
            setTimeout(() => { process.exit(-1); }, 0);
            return;
        }

        const tests = results.slice(1, -1);

        if (process.env.UPDATE) {
            console.log(`Updated ${tests.length} tests.`);
            process.exit(0);
        }

        let passedCount = 0,
            ignoreCount = 0,
            ignorePassCount = 0,
            failedCount = 0,
            erroredCount = 0;

        tests.forEach((test) => {
            if (test.ignored && !test.ok) {
                ignoreCount++;
            } else if (test.ignored) {
                ignorePassCount++;
            } else if (test.error) {
                erroredCount++;
            } else if (!test.ok) {
                failedCount++;
            } else {
                passedCount++;
            }
        });

        const totalCount = passedCount + ignorePassCount + ignoreCount + failedCount + erroredCount;

        if (passedCount > 0) {
            console.log('%d passed (%s%)',
                passedCount, (100 * passedCount / totalCount).toFixed(1));
        }

        if (ignorePassCount > 0) {
            console.log('%d passed but were ignored (%s%)',
                ignorePassCount, (100 * ignorePassCount / totalCount).toFixed(1));
        }

        if (ignoreCount > 0) {
            console.log('%d ignored (%s%)',
                ignoreCount, (100 * ignoreCount / totalCount).toFixed(1));
        }

        if (failedCount > 0) {
            console.log('%d failed (%s%)',
                failedCount, (100 * failedCount / totalCount).toFixed(1));
        }

        if (erroredCount > 0) {
            console.log('%d errored (%s%)',
                erroredCount, (100 * erroredCount / totalCount).toFixed(1));
        }

        process.exit((failedCount + erroredCount) === 0 ? 0 : 1);
    });
}
