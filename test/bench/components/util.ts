import * as d3 from 'd3';
import {type RegressionResults, type Summary} from '../lib/statistics.ts';
import {type BenchmarkLike} from '../lib/benchmark.ts';

export type Version = {
    name: string;
    displayName: string;
    status: string;
    samples: number[];
    density: Array<[number, number]>;
    summary: Summary;
    regression: RegressionResults;
    error: Error;
    bench: BenchmarkLike;
};

export const versionColor: d3.ScaleOrdinal<string, string, never> = d3.scaleOrdinal(['#1b9e77', '#7570b3', '#d95f02']);
export const formatSample: (n: number | {
    valueOf(): number;
}) => string = d3.format('.3r');
