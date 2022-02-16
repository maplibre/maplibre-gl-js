/* eslint-disable no-process-exit */
import shuffleSeed from 'shuffle-seed';
import {queue} from 'd3-queue';

const {shuffle} = shuffleSeed;

export default function testRunner(sequence: any[], options, run) {
    const q = queue(1);

    if (options.shuffle) {
        console.log(`* shuffle seed: ${options.seed}`);
        sequence = shuffle(sequence, options.seed);
    }

    let index = 0;
    sequence.forEach(style => {
        q.defer((callback) => {
            const test = style.metadata.test;

            try {
                run(style, handleResult);
            } catch (error) {
                handleResult(error);
            }

            function handleResult (error) {
                if (error) {
                    test.error = error;
                }

                if (test.ignored && !test.ok) {
                    test.status = 'ignored failed';
                    console.log(`${++index}/${sequence.length}: ignore ${test.id} (${test.ignored})`);
                } else if (test.ignored) {
                    test.status = 'ignored passed';
                    console.log(`${++index}/${sequence.length}: ignore ${test.id} (${test.ignored})`);
                } else if (test.error) {
                    test.status = 'errored';
                    console.log(`${++index}/${sequence.length}: errored ${test.id}`);
                } else if (!test.ok) {
                    test.status = 'failed';
                    console.log(`${++index}/${sequence.length}: failed ${test.id}`);
                } else {
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
