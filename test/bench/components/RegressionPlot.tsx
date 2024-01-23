import * as d3 from 'd3';
import React from 'react';
import {Axis} from './Axis';
import {formatSample, Version, versionColor} from './util';

type RegressionPlotProps = {
    versions: Version[];
}

export const RegressionPlot = (props: RegressionPlotProps) => {
    const margin = {top: 10, right: 20, bottom: 30, left: 0};
    const width = 960 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;
    const versions = props.versions.filter(version => version.regression);

    const x = d3.scaleLinear()
        .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[0])))])
        .range([0, width])
        .nice();

    const y = d3.scaleLinear()
        .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[1])))])
        .range([height, 0])
        .nice();

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    return (
        <svg
            width="100%"
            height={height + margin.top + margin.bottom}
            style={{overflow: 'visible'}}>
            <g transform={`translate(${margin.left},${margin.top})`}>
                <Axis orientation="bottom" scale={x} transform={`translate(0,${height})`}>
                    <text fill='#000' textAnchor="end" y={-6} x={width}>Iterations</text>
                </Axis>
                <Axis orientation="left" scale={y} ticks={4} tickFormat={formatSample}>
                    <text fill='#000' textAnchor="end"  y={6} transform="rotate(-90)" dy=".71em">Time (ms)</text>
                </Axis>
                {versions.map((v, i) =>
                    <g
                        key={i}
                        fill={versionColor(v.name)}
                        fillOpacity="0.7">
                        {v.regression.data.map(([a, b], i) =>
                            <circle key={i} r="2" cx={x(a)} cy={y(b)}/>
                        )}
                        <path
                            stroke={versionColor(v.name)}
                            strokeWidth={1}
                            strokeOpacity={0.5}
                            d={line(v.regression.data.map(d => [
                                d[0],
                                d[0] * v.regression.slope + v.regression.intercept
                            ]))} />
                    </g>
                )}
            </g>
        </svg>
    );

};
