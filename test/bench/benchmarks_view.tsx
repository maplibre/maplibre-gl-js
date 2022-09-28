import React from 'react';
import ReactDOM from 'react-dom';

import {BenchmarksTable} from './components/BenchmarkTable';
import {summaryStatistics, regression} from './lib/statistics';

function updateUI(benchmarks, finished?) {
    finished = !!finished;

    ReactDOM.render(
        <BenchmarksTable benchmarks={benchmarks} finished={finished}/>,
        document.getElementById('benchmarks')
    );
}

export function run(benchmarks) {
    const filter = window.location.hash.substr(1);
    if (filter) benchmarks = benchmarks.filter(({name}) => name === filter);

    for (const benchmark of benchmarks) {
        for (const version of benchmark.versions) {
            version.status = 'waiting';
            version.logs = [];
            version.samples = [];
            version.summary = {};
        }
    }

    updateUI(benchmarks);

    let promise = Promise.resolve();

    benchmarks.forEach(bench => {
        bench.versions.forEach(version => {
            promise = promise.then(() => {
                version.status = 'running';
                updateUI(benchmarks);

                return version.bench.run()
                    .then(measurements => {
                        // scale measurements down by iteration count, so that
                        // they represent (average) time for a single iteration
                        const samples = measurements.map(({time, iterations}) => time / iterations);
                        version.status = 'ended';
                        version.samples = samples;
                        version.summary = summaryStatistics(samples);
                        version.regression = regression(measurements);
                        updateUI(benchmarks);
                    })
                    .catch(error => {
                        version.status = 'errored';
                        version.error = error;
                        updateUI(benchmarks);
                    });
            });
        });
    });

    promise = promise.then(() => {
        updateUI(benchmarks, true);
        return benchmarks;
    });

    return promise;
}
