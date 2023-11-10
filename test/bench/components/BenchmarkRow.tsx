import {LocationsWithTileID} from '../lib/locations_with_tile_id';
import {probabilitiesOfSuperiority} from '../lib/statistics';
import {BenchmarkStatistic} from './BenchmarkStatistic';
import {RegressionPlot} from './RegressionPlot';
import {StatisticsPlot} from './StatisticsPlot';
import {formatSample, Version, versionColor} from './util';
import React from 'react';

export type BenchmarkRowProps = {
    name: string;
    location: LocationsWithTileID;
    versions: Version[];
    finishedAll: boolean;
}

export const BenchmarkRow = (props: BenchmarkRowProps) => {
    const endedCount = props.versions.filter(version => version.status === 'ended').length;

    let main: Version;
    let current: Version;
    if (/main/.test(props.versions[0].name)) {
        [main, current] = props.versions;
    } else {
        [current, main] = props.versions;
    }

    let change;
    let pInferiority;
    if (endedCount === 2) {
        const delta = current.summary.trimmedMean - main.summary.trimmedMean;
        // Use "Cohen's d" (modified to used the trimmed mean/sd) to decide
        // how much to emphasize difference between means
        // https://en.wikipedia.org/wiki/Effect_size#Cohen.27s_d
        const pooledDeviation = Math.sqrt(
            (
                (main.samples.length - 1) * Math.pow(main.summary.windsorizedDeviation, 2) +
                  (current.samples.length - 1) * Math.pow(current.summary.windsorizedDeviation, 2)
            ) /
              (main.samples.length + current.samples.length - 2)
        );
        const d = delta / pooledDeviation;

        const {superior, inferior} = probabilitiesOfSuperiority(main.samples, current.samples);

        change = <span className={d < 0.2 ? 'quiet' : d < 1.5 ? '' : 'strong'}>(
            {delta > 0 ? '+' : ''}{formatSample(delta)} ms / {d.toFixed(1)} std devs
          )</span>;

        const comparison = inferior > superior ? 'SLOWER' : 'faster';
        const probability = Math.max(inferior, superior);
        pInferiority = <p className={`center ${probability > 0.90 ? 'strong' : 'quiet'}`}>
            {(probability * 100).toFixed(0)}%
              chance that a random <svg width={8} height={8}><circle fill={versionColor(current.name)} cx={4} cy={4} r={4} /></svg> sample is
            {comparison} than a random <svg width={8} height={8}><circle fill={versionColor(main.name)} cx={4} cy={4} r={4} /></svg> sample.
        </p>;
    }

    const renderStatistic = (title: string, statistic: (version: Version) => any) => {
        return (
            <tr>
                <th>{title}</th>
                {props.versions.map(version =>
                    <td  key={version.name}><BenchmarkStatistic statistic={statistic} status={version.status} error={version.error} version={version}/></td>
                )}
            </tr>
        );
    };

    const reload = () => {
        location.reload();
    };

    return (
        <div className="col12 clearfix space-bottom">
            <table className="fixed space-bottom">
                <tbody>
                    <tr><th><h2 className="col4"><a href={`#${props.name}`} onClick={reload}>{props.name}</a></h2></th>
                        {props.versions.map(version => <th style={{color: versionColor(version.name)}} key={version.name}>{version.displayName}</th>)}</tr>
                    {props.location && <tr>
                        <th><p style={{color: '#1287A8'}}>{props.location.description}</p></th>
                        <th><p style={{color: '#1287A8'}}>Zoom Level: {props.location.zoom}</p></th>
                        <th><p style={{color: '#1287A8'}}>Lat: {props.location.center[1]} Lng: {props.location.center[0]}</p></th>
                    </tr>}
                    {renderStatistic('(20% trimmed) Mean',
                        (version) => <p>
                            {formatSample(version.summary.trimmedMean)} ms
                            {current && version.name === current.name && change}
                        </p>)}
                    {renderStatistic('(Windsorized) Deviation',
                        (version) => <p>{formatSample(version.summary.windsorizedDeviation)} ms</p>)}
                    {renderStatistic('R² Slope / Correlation',
                        (version) => <p>{formatSample(version.regression.slope)} ms / {version.regression.correlation.toFixed(3)} {
                            version.regression.correlation < 0.9 ? '\u2620\uFE0F' :
                                version.regression.correlation < 0.99 ? '\u26A0\uFE0F' : ''}</p>)}
                    {renderStatistic('Minimum',
                        (version) => <p>{formatSample(version.summary.min)} ms</p>)}
                    {pInferiority && <tr><td colSpan={3}>{pInferiority}</td></tr>}
                </tbody>
            </table>
            {props.finishedAll && <StatisticsPlot versions={props.versions}/>}
            {props.finishedAll && <RegressionPlot versions={props.versions}/>}
        </div>
    );

};
