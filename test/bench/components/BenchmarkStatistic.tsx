import {Version} from './util.ts';
import React from 'react';

type BenchmarkStatisticProps = {
    status: string;
    error: Error;
    statistic: (version: Version) => React.ReactNode;
    version: Version;
}

export const BenchmarkStatistic = (props: BenchmarkStatisticProps): React.JSX.Element | React.ReactNode => {

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
