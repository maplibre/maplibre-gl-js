import React from 'react';
import {createRoot} from 'react-dom/client';

import {BenchmarksTable} from './components/BenchmarkTable.tsx';
import {summaryStatistics, regression, Summary} from './lib/statistics.ts';
import {ensureError} from '../../src/util/util.ts';
import type {BenchmarkRowProps} from './components/BenchmarkRow.tsx';

function updateUI(benchmarks: BenchmarkRowProps[], finished?: boolean) {
    finished = !!finished;
    const root = createRoot(document.getElementById('benchmarks'));
    root.render(<BenchmarksTable benchmarks={benchmarks} finished={finished}/>);
}

export async function run(benchmarks: BenchmarkRowProps[]) {
    const filter = window.location.hash.substr(1);
    if (filter) benchmarks = benchmarks.filter(({name}) => name === filter);

    for (const benchmark of benchmarks) {
        for (const version of benchmark.versions) {
            version.status = 'waiting';
            version.samples = [];
            version.summary = {} as Summary;
        }
    }

    updateUI(benchmarks);

    const allRuns: Promise<any>[] = [];

    for (const bench of benchmarks) {
        for (const version of bench.versions) {
            version.status = 'running';
            updateUI(benchmarks);

            try {
                const measurements = await version.bench.run();
                const samples = measurements.map(({time, iterations}) => time / iterations);
                version.status = 'ended';
                version.samples = samples;
                version.summary = summaryStatistics(samples);
                version.regression = regression(measurements);
                updateUI(benchmarks);
            } catch (error) {
                version.status = 'errored';
                version.error = ensureError(error);
                updateUI(benchmarks);
            }
        }
    }

    await Promise.all(allRuns);
    updateUI(benchmarks, true);
    return benchmarks;
}
