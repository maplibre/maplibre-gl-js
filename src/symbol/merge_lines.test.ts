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

    test.each([
        {
            direction: 'right',
            parts: [[[0, 1], [10, 11]], [[1, 2], [20, 21]]],
            expected: [[0, 1, 2], [10, 11], [20, 21]]
        },
        {
            direction: 'left',
            parts: [[[1, 2], [10, 11]], [[0, 1], [20, 21]]],
            expected: [[0, 1, 2], [10, 11], [20, 21]]
        },
        {
            direction: 'both ends',
            parts: [[[0, 1], [10, 11]], [[2, 3], [20, 21]], [[1, 2], [30, 31]]],
            expected: [[0, 1, 2, 3], [10, 11], [20, 21], [30, 31]]
        }
    ])('preserves every component when merging multipart features from $direction', ({parts, expected}) => {
        const features = parts.map(lines => {
            const components = makeFeatures(lines.map(line => ['a', ...line]));
            return {...components[0], geometry: components.flatMap(component => component.geometry)};
        });

        expect(mergeLines(features)).toEqual(makeFeatures(expected.map(line => ['a', ...line])));
    });

    test('merges connected components within a multipart feature', () => {
        const components = makeFeatures([['a', 0, 1], ['a', 1, 2], ['a', 10, 11]]);
        const feature = {...components[0], geometry: components.flatMap(component => component.geometry)};

        expect(mergeLines([feature])).toEqual(makeFeatures([['a', 0, 1, 2], ['a', 10, 11]]));
    });

    test('keeps source metadata on disconnected components', () => {
        const [firstLine, secondLine, disconnected] = makeFeatures([['a', 0, 1], ['a', 1, 2], ['a', 10, 11]]);
        const first = {...firstLine, id: 100, index: 0, properties: {kind: 'first'}};
        const second = {...secondLine, id: 200, index: 1, properties: {kind: 'second'},
            geometry: [...secondLine.geometry, ...disconnected.geometry]};

        const merged = mergeLines([first, second]);

        expect(merged).toHaveLength(2);
        expect(merged[1]).toMatchObject({
            id: 200,
            index: 1,
            properties: {kind: 'second'},
            geometry: disconnected.geometry
        });
    });

    test('leaves multipart features without text intact', () => {
        const [first, second] = makeFeatures([['a', 0, 1], ['a', 10, 11]]);
        first.text = null;
        first.geometry.push(...second.geometry);

        expect(mergeLines([first])).toEqual([first]);
    });
});
