import React from 'react';
import {Version} from './util';

type BenchmarkStatisticProps = {
  status: string;
  error: Error;
  statistic: (version: Version) => any;
  version: Version;
}

export class BenchmarkStatistic extends React.Component<BenchmarkStatisticProps, {}> {
    render() {
        switch (this.props.status) {
        case 'waiting':
            return <p className="quiet"></p>;
        case 'running':
            return <p>Running...</p>;
        case 'error':
        case 'errored':
            return <p>{this.props.error.message}</p>;
        default:
            return this.props.statistic(this.props.version);
        }
    }
}
