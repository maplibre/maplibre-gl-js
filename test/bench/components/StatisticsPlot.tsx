import * as d3 from 'd3';
import React from 'react';
import {kde} from '../lib/statistics';
import {Axis} from './Axis';
import {formatSample, Version, versionColor} from './util';

type StatisticsPlotProps = {
    versions: Version[];
}

export const StatisticsPlot = (props:StatisticsPlotProps) => {

    const margin = {top: 0, right: 20, bottom: 20, left: 0};
    const width = 960 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    const kdeWidth = 100;

    const summaries = props.versions
        .filter(v => v.status === 'ended')
        .map(v => v.summary);

    const t = d3.scaleLinear()
        .domain([
            d3.min(summaries.map(s => s.min)),
            d3.max(summaries.map(s => Math.min(s.max, s.q2 + 3 * s.iqr)))
        ])
        .range([height, 0])
        .clamp(true)
        .nice();

    const b = d3.scaleBand()
        .domain(props.versions.map(v => v.name))
        .range([kdeWidth + 20, width])
        .paddingOuter(0.15)
        .paddingInner(0.3);

    const versions = props.versions.map(v => ({
        name: v.name,
        samples: v.samples,
        summary: v.summary,
        density: kde(v.samples, v.summary, t.ticks(50))
    }));

    const p = d3.scaleLinear()
        .domain([0, d3.max(versions.map(v => d3.max(v.density, d => d[1])))])
        .range([0, kdeWidth]);

    const line = d3.line()
        .curve(d3.curveBasis)
        .y(d => t(d[0]))
        .x(d => p(d[1]));

    return (
        <svg
            width="100%"
            height={height + margin.top + margin.bottom}
            style={{overflow: 'visible'}}>
            <defs>
                <g id="up-arrow">
                    <path transform="translate(-6, -2)" style={{stroke: 'inherit', fill: 'inherit'}}
                        d="M2,10 L6,2 L10,10"></path>
                </g>
            </defs>
            <g transform={`translate(${margin.left},${margin.top})`}>
                <Axis orientation="bottom" scale={p} ticks={[2, '%']} transform={`translate(0,${height})`}>
                </Axis>
                <Axis orientation="left" scale={t} tickFormat={formatSample}>
                    <text fill='#000' textAnchor="end"  y={6} transform="rotate(-90)" dy=".71em">Time (ms)</text>
                </Axis>
                {versions.map((v, i) => {
                    if (v.samples.length === 0)
                        return null;

                    const bandwidth = b.bandwidth();
                    const color = versionColor(v.name);
                    const scale = d3.scaleLinear()
                        .domain([0, v.samples.length])
                        .range([0, bandwidth]);

                    const {
                        mean,
                        trimmedMean,
                        q1,
                        q2,
                        q3,
                        min,
                        max,
                        argmin,
                        argmax
                    } = v.summary;

                    const tMax = t.domain()[1];

                    return <g key={i}>
                        <path
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            strokeOpacity={0.7}
                            d={line(v.density)} />
                        <g transform={`translate(${b(v.name)},0)`}>
                            {v.samples.map((d, i) =>
                                <circle
                                    key={i}
                                    fill={color}
                                    cx={scale(i)}
                                    cy={t(d)}
                                    r={i === argmin || i === argmax ? 2 : 1}
                                    style={{
                                        fillOpacity: d < tMax ? 1 : 0
                                    }}
                                />
                            )}
                            {v.samples.filter(d => d >= tMax)
                                .map((d, i) =>
                                    <use key={i}
                                        href="#up-arrow"
                                        x={scale(i)}
                                        y={t(d)}
                                        style={{
                                            stroke: color,
                                            strokeWidth: i === argmin || i === argmax ? 2 : 1,
                                            fill: 'rgba(200, 0, 0, 0.5)'
                                        }}
                                    />
                                )
                            }
                            <line // quartiles
                                x1={bandwidth / 2}
                                x2={bandwidth / 2}
                                y1={t(q1)}
                                y2={t(q3)}
                                stroke={color}
                                strokeWidth={bandwidth}
                                strokeOpacity={0.5} />
                            <line // median
                                x1={bandwidth / 2}
                                x2={bandwidth / 2}
                                y1={t(q2) - 0.5}
                                y2={t(q2) + 0.5}
                                stroke={color}
                                strokeWidth={bandwidth}
                                strokeOpacity={1} />
                            <use href="#up-arrow" // mean
                                style={{stroke: color, fill: color, fillOpacity: 0.4}}
                                transform={mean >= tMax ? 'translate(-10, 0)' : `translate(-5, ${t(mean)}) rotate(90)`}
                                x={0}
                                y={0} />
                            <use href="#up-arrow" // trimmed mean
                                style={{stroke: color, fill: color}}
                                transform={`translate(-5, ${t(trimmedMean)}) rotate(90)`}
                                x={0}
                                y={0} />
                            {[mean, trimmedMean].map((d, i) =>
                                <text // left
                                    key={i}
                                    dx={-16}
                                    dy='.3em'
                                    x={0}
                                    y={t(d)}
                                    textAnchor='end'
                                    fontSize={10}
                                    fontFamily='sans-serif'>{formatSample(d)}</text>
                            )}
                            {[[argmin, min], [argmax, max]].map((d, i) =>
                                <text // extent
                                    key={i}
                                    dx={0}
                                    dy={i === 0 ? '1.3em' : '-0.7em'}
                                    x={scale(d[0])}
                                    y={t(d[1])}
                                    textAnchor='middle'
                                    fontSize={10}
                                    fontFamily='sans-serif'>{formatSample(d[1])}</text>
                            )}
                            {[q1, q2, q3].map((d, i) =>
                                <text // right
                                    key={i}
                                    dx={6}
                                    dy='.3em'
                                    x={bandwidth}
                                    y={t(d)}
                                    textAnchor='start'
                                    fontSize={10}
                                    fontFamily='sans-serif'>{formatSample(d)}</text>
                            )}
                        </g>
                    </g>;
                })}
            </g>
        </svg>
    );

};
