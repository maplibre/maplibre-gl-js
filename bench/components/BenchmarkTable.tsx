import React from 'react';
import {BenchmarkRow, BenchmarkRowProps} from './BenchmarkRow';

type BenchmarksTableProps = {
  finished: boolean;
  benchmarks: BenchmarkRowProps[];
}

export class BenchmarksTable extends React.Component<BenchmarksTableProps, {}> {
    render() {
        return (
            <div style={{width: 960, margin: '2em auto'}}>
                <h1 className="space-bottom1">MapLibre GL JS Benchmarks – {
                    this.props.finished ?
                        <span>Finished</span> :
                        <span>Running</span>}</h1>
                {this.props.benchmarks.map((benchmark, i) => {
                    return <BenchmarkRow key={`${benchmark.name}-${i}`} {...benchmark}/>;
                })}
            </div>
        );
    }
}
