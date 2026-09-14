import {describe, test, expect} from 'vitest';
import {mergeLines} from './merge_lines.ts';
import Point from '@mapbox/point-geometry';

function makeFeatures(lines) {
    const features = [];
    for (const line of lines) {
        const points = [];
        for (let j = 1; j < line.length; j++) {
            points.push(new Point(line[j], 0));
        }
        features.push({text: line[0], geometry: [points]});
    }
    return features;
}

describe('mergeLines', () => {
    test('mergeLines merges lines with the same text', () => {
        expect(
            mergeLines(makeFeatures([['a', 0, 1, 2], ['b', 4, 5, 6], ['a', 8, 9], ['a', 2, 3, 4], ['a', 6, 7, 8], ['a', 5, 6]]))
        ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4], ['b', 4, 5, 6], ['a', 5, 6, 7, 8, 9]]));
    });

    test('mergeLines handles merge from both ends', () => {
        expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 4, 5, 6], ['a', 2, 3, 4]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5, 6]]));
    });

    test('mergeLines handles circular lines', () => {
        expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 2, 3, 4], ['a', 4, 0]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 0]]));
    });

    test.each([
        ['in order', false],
        ['in reverse order', true]
    ])('mergeLines merges a long chain arriving %s', (_name, reverse) => {
        const segmentCount = 100;
        const lines: Array<Array<string | number>> = [];
        const merged: Array<string | number> = ['a'];
        for (let i = 0; i < segmentCount; i++) {
            lines.push(['a', i, i + 1]);
            merged.push(i);
        }
        merged.push(segmentCount);
        if (reverse) lines.reverse();

        expect(mergeLines(makeFeatures(lines))).toEqual(makeFeatures([merged]));
    });

    test('mergeLines merges a chain that arrives interleaved', () => {
        const segmentCount = 20;
        const even: Array<Array<string | number>> = [];
        const odd: Array<Array<string | number>> = [];
        const merged: Array<string | number> = ['a'];
        for (let i = 0; i < segmentCount; i++) {
            (i % 2 === 0 ? even : odd).push(['a', i, i + 1]);
            merged.push(i);
        }
        merged.push(segmentCount);

        expect(mergeLines(makeFeatures([...even, ...odd]))).toEqual(makeFeatures([merged]));
    });

    test('mergeLines leaves a feature with no geometry alone', () => {
        const feature = {text: null, geometry: []};
        expect(mergeLines([feature] as any)).toEqual([feature]);
        expect(feature.geometry).toEqual([]);
    });
});
