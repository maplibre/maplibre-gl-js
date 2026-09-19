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

    test('mergeLines merges a chain arriving in order', () => {
        expect(
            mergeLines(makeFeatures([['a', 0, 1], ['a', 1, 2], ['a', 2, 3], ['a', 3, 4], ['a', 4, 5]]))
        ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5]]));
    });

    test('mergeLines merges a chain arriving in reverse order', () => {
        expect(
            mergeLines(makeFeatures([['a', 4, 5], ['a', 3, 4], ['a', 2, 3], ['a', 1, 2], ['a', 0, 1]]))
        ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5]]));
    });

    test('mergeLines merges a chain that arrives interleaved', () => {
        expect(
            mergeLines(makeFeatures([['a', 0, 1], ['a', 2, 3], ['a', 4, 5], ['a', 1, 2], ['a', 3, 4]]))
        ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5]]));
    });

    test('mergeLines leaves a feature with no geometry alone', () => {
        const feature = {text: null, geometry: []};
        expect(mergeLines([feature] as any)).toEqual([feature]);
        expect(feature.geometry).toEqual([]);
    });
});
