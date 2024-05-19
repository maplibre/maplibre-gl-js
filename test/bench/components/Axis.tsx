import {ScaleBand, ScaleLinear} from 'd3';
import React from 'react';

function identity(x) {
    return x;
}
function translateX(x) {
    return `translate(${x + 0.5},0)`;
}
function translateY(y) {
    return `translate(0,${y + 0.5})`;
}
function number(scale) {
    return (d) => {
        return +scale(d);
    };
}
function center(scale) {
    let offset = Math.max(0, scale.bandwidth() - 1) / 2; // Adjust for 0.5px offset.
    if (scale.round()) offset = Math.round(offset);
    return (d) => {
        return +scale(d) + offset;
    };
}

type AxisProps = {
    children?: any;
    scale: ScaleBand<string> | ScaleLinear<number, number>;
    orientation: string;
    ticks?: number | (number | string)[];
    tickValues?: number[];
    tickFormat?: (n: number | {
        valueOf(): number;
    }) => string;
    tickSize?: number;
    tickSizeInner?: number;
    tickSizeOuter?: number;
    tickPadding?: number;
    transform?: string;
}

export const Axis = (props: AxisProps) => {

    const scale = props.scale;
    const orient = props.orientation || 'left';
    const tickArguments = props.ticks ? [].concat(props.ticks) : [];
    const tickValues = props.tickValues || null;
    const tickFormat = props.tickFormat || null;
    const tickSizeInner = props.tickSize || props.tickSizeInner || 6;
    const tickSizeOuter = props.tickSize || props.tickSizeOuter || 6;
    const tickPadding = props.tickPadding || 3;

    const k = orient === 'top' || orient === 'left' ? -1 : 1;
    const x = orient === 'left' || orient === 'right' ? 'x' : 'y';
    const transform = orient === 'top' || orient === 'bottom' ? translateX : translateY;

    const values = tickValues == null ? ((scale as ScaleLinear<number, number>).ticks ?
        (scale as ScaleLinear<number, number>).ticks(...tickArguments) :
        scale.domain()) : tickValues;
    const format = tickFormat == null ? ((scale as ScaleLinear<number, number>).tickFormat ?
        (scale as ScaleLinear<number, number>).tickFormat(...tickArguments) :
        identity) : tickFormat;
    const spacing = Math.max(tickSizeInner, 0) + tickPadding;
    const range = scale.range();
    const range0 = +range[0] + 0.5;
    const range1 = +range[range.length - 1] + 0.5;
    const position = ((scale as ScaleBand<string>).bandwidth ? center : number)(scale.copy());

    return (
        <g
            fill='none'
            fontSize={10}
            fontFamily='sans-serif'
            textAnchor={orient === 'right' ? 'start' : orient === 'left' ? 'end' : 'middle'}
            transform={props.transform}>
            <path
                className='domain'
                stroke='#000'
                d={orient === 'left' || orient === 'right' ?
                    `M${k * tickSizeOuter},${range0}H0.5V${range1}H${k * tickSizeOuter}` :
                    `M${range0},${k * tickSizeOuter}V0.5H${range1}V${k * tickSizeOuter}`} />
            {values.map((d, i) =>
                <g
                    key={i}
                    className='tick'
                    transform={transform(position(d))}>
                    <line
                        stroke='#000'
                        {...{[`${x}2`]: k * tickSizeInner}}/>
                    <text
                        fill='#000'
                        dy={orient === 'top' ? '0em' : orient === 'bottom' ? '0.71em' : '0.32em'}
                        {...{[x]: k * spacing}}>{format(d)}</text>
                </g>
            )}
            {props.children}
        </g>
    );
};
