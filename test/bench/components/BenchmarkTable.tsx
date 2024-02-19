import {BenchmarkRow, BenchmarkRowProps} from './BenchmarkRow';
import React from 'react';

type BenchmarksTableProps = {
    finished: boolean;
    benchmarks: BenchmarkRowProps[];
}

export const BenchmarksTable = (props: BenchmarksTableProps) => (
    <div style={{width: 960, margin: '2em auto'}}>
        <h1>TITLE</h1>
        <h1 className="space-bottom1">MapLibre GL JS Benchmarks – {
            props.finished ?
                <span>Finished</span> :
                <span>Running</span>}</h1>

        {props.benchmarks.map((benchmark, i) => {
            benchmark.finishedAll = props.finished;
            return <BenchmarkRow key={`${benchmark.name}-${i}`} {...benchmark} />;
        })}
    </div>
);
