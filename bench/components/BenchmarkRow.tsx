import React from 'react';
import {LocationsWithTileID} from '../lib/locations_with_tile_id';
import {probabilitiesOfSuperiority} from '../lib/statistics';
import {BenchmarkStatistic} from './BenchmarkStatistic';
import {RegressionPlot} from './RegressionPlot';
import {StatisticsPlot} from './StatisticsPlot';
import {formatSample, Version, versionColor} from './util';

export type BenchmarkRowProps = {
  name: string;
  location: LocationsWithTileID;
  versions: Version[];
}

export class BenchmarkRow extends React.Component<BenchmarkRowProps, {}> {
    render() {
        const endedCount = this.props.versions.filter(version => version.status === 'ended').length;

        let main;
        let current;
        if (/main/.test(this.props.versions[0].name)) {
            [main, current] = this.props.versions;
        } else {
            [current, main] = this.props.versions;
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

        return (
            <div className="col12 clearfix space-bottom">
                <table className="fixed space-bottom">
                    <tbody>
                        <tr><th><h2 className="col4"><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></h2></th>
                            {this.props.versions.map(version => <th style={{color: versionColor(version.name)}} key={version.name}>{version.name}</th>)}</tr>
                        {this.props.location && <tr>
                            <th><p style={{color: '#1287A8'}}>{this.props.location.description}</p></th>
                            <th><p style={{color: '#1287A8'}}>Zoom Level: {this.props.location.zoom}</p></th>
                            <th><p style={{color: '#1287A8'}}>Lat: {this.props.location.center[1]} Lng: {this.props.location.center[0]}</p></th>
                        </tr>}
                        {this.renderStatistic('(20% trimmed) Mean',
                          (version) => <p>
                              {formatSample(version.summary.trimmedMean)} ms
                              {current && version.name === current.name && change}
                          </p>)}
                        {this.renderStatistic('(Windsorized) Deviation',
                          (version) => <p>{formatSample(version.summary.windsorizedDeviation)} ms</p>)}
                        {this.renderStatistic('R² Slope / Correlation',
                          (version) => <p>{formatSample(version.regression.slope)} ms / {version.regression.correlation.toFixed(3)} {
                              version.regression.correlation < 0.9 ? '\u2620\uFE0F' :
                              version.regression.correlation < 0.99 ? '\u26A0\uFE0F' : ''}</p>)}
                        {this.renderStatistic('Minimum',
                          (version) => <p>{formatSample(version.summary.min)} ms</p>)}
                        {pInferiority && <tr><td colSpan={3}>{pInferiority}</td></tr>}
                    </tbody>
                </table>
                {endedCount > 0 && <StatisticsPlot versions={this.props.versions}/>}
                {endedCount > 0 && <RegressionPlot versions={this.props.versions}/>}
            </div>
        );
    }

    renderStatistic(title: string, statistic: (version: Version) => any) {
        return (
            <tr>
                <th>{title}</th>
                {this.props.versions.map(version =>
                    <td key={version.name}><BenchmarkStatistic statistic={statistic} status={version.status} error={version.error} version={version}/></td>
                )}
            </tr>
        );
    }

    reload() {
        location.reload();
    }
}
