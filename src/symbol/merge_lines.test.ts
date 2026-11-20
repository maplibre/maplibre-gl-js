import {describe, test, expect} from 'vitest';
import {mergeLines} from './merge_lines.ts';
import Point from '@mapbox/point-geometry';
import {createExpression} from '@maplibre/maplibre-gl-style-spec';
import {CanonicalTileID} from '../tile/tile_id.ts';

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

    test('preserves every component when merging multipart features from the right', () => {
        const [first, firstRest, second, secondRest] = makeFeatures([['a', 0, 1], ['a', 10, 11], ['a', 1, 2], ['a', 20, 21]]);
        first.geometry.push(...firstRest.geometry);
        second.geometry.push(...secondRest.geometry);

        const merged = mergeLines([first, second]);

        expect(merged.flatMap(feature => feature.geometry)).toEqual(
            makeFeatures([['a', 0, 1, 2], ['a', 10, 11], ['a', 20, 21]]).map(feature => feature.geometry[0]));
    });

    test('preserves every component when merging multipart features from the left', () => {
        const [first, firstRest, second, secondRest] = makeFeatures([['a', 1, 2], ['a', 10, 11], ['a', 0, 1], ['a', 20, 21]]);
        first.geometry.push(...firstRest.geometry);
        second.geometry.push(...secondRest.geometry);

        const merged = mergeLines([first, second]);

        expect(merged.flatMap(feature => feature.geometry)).toEqual(
            makeFeatures([['a', 0, 1, 2], ['a', 10, 11], ['a', 20, 21]]).map(feature => feature.geometry[0]));
    });

    test('preserves every component when merging multipart features from both ends', () => {
        const [first, firstRest, second, secondRest, third, thirdRest] = makeFeatures(
            [['a', 0, 1], ['a', 10, 11], ['a', 2, 3], ['a', 20, 21], ['a', 1, 2], ['a', 30, 31]]);
        first.geometry.push(...firstRest.geometry);
        second.geometry.push(...secondRest.geometry);
        third.geometry.push(...thirdRest.geometry);

        const merged = mergeLines([first, second, third]);

        expect(merged.flatMap(feature => feature.geometry)).toEqual(
            makeFeatures([['a', 0, 1, 2, 3], ['a', 10, 11], ['a', 30, 31], ['a', 20, 21]]).map(feature => feature.geometry[0]));
    });

    test('leaves connected components within an unmerged multipart feature intact', () => {
        const components = makeFeatures([['a', 0, 1], ['a', 1, 2], ['a', 10, 11]]);
        const feature = {...components[0], id: 100, index: 0, properties: {kind: 'road'},
            geometry: components.flatMap(component => component.geometry)};

        const merged = mergeLines([feature]);

        expect(merged).toEqual([feature]);
        expect(merged[0]).toBe(feature);
        expect(merged[0].geometry).toEqual(components.map(component => component.geometry[0]));
    });

    test('keeps within evaluation unchanged for an unmerged multipart feature', () => {
        const inside = [new Point(4000, 4096), new Point(4100, 4096)];
        const outside = [new Point(6000, 4096), new Point(6100, 4096)];
        const feature = {text: 'Road', type: 'LineString', properties: {}, geometry: [inside, outside]};
        const parsed = createExpression(['within', {
            type: 'Polygon',
            coordinates: [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]]
        }], 'layers[0].paint.text-color[1]');
        if (parsed.result !== 'success') throw new Error('Invalid within expression');
        const canonical = new CanonicalTileID(0, 0, 0);

        const merged = mergeLines([feature] as any);

        expect(merged.map(component => parsed.value.evaluate({zoom: 0}, component, {}, canonical))).toEqual([false]);
        expect(merged[0]).toBe(feature);
        expect(feature.geometry).toEqual([inside, outside]);
    });

    test('leaves multipart features without text intact', () => {
        const [first, second] = makeFeatures([['a', 0, 1], ['a', 10, 11]]);
        first.text = null;
        first.geometry.push(...second.geometry);

        expect(mergeLines([first])).toEqual([first]);
    });
});
