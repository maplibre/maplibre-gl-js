import {Version} from './util';
import React from 'react';

type BenchmarkStatisticProps = {
    status: string;
    error: Error;
    statistic: (version: Version) => any;
    version: Version;
}

export const BenchmarkStatistic = (props: BenchmarkStatisticProps) => {

    switch (props.status) {
        case 'waiting':
            return <p className="quiet"></p>;
        case 'running':
            return <p>Running...</p>;
        case 'error':
        case 'errored':
            return <p>{props.error.message}</p>;
        default:
            return props.statistic(props.version);
    }

};
