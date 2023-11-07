import * as d3 from 'd3';
import {RegressionResults, Summary} from '../lib/statistics';
import Benchmark from '../lib/benchmark';

export type Version = {
    name: string;
    displayName: string;
    status: string;
    samples: number[];
    density: [number, number][];
    summary: Summary;
    regression: RegressionResults;
    error: Error;
    bench: Benchmark;
}

export const versionColor = d3.scaleOrdinal(['#1b9e77', '#7570b3', '#d95f02']);
export const formatSample = d3.format('.3r');
