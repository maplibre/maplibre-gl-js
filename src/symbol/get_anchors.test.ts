import Point from '@mapbox/point-geometry';
import {getAnchors, getCenterAnchor} from './get_anchors';
import {PositionedIcon, Shaping} from './shaping';

const TILE_EXTENT = 4096;

describe('getAnchors', () => {
    const nonContinuedLine = [];
    for (let i = 1; i < 11; i++) {
        nonContinuedLine.push(new Point(1, i));
    }

    const continuedLine = [];
    for (let j = 0; j < 10; j++) {
        continuedLine.push(new Point(1, j));
    }

    const smallSpacing = 2;
    const bigSpacing = 3;

    const shapedText = {left: -1, right: 1, top: -0.5, bottom: 0.5} as Shaping;
    const shapedIcon = {left: -0.5, right: 0.5, top: -0.25, bottom: 0.25} as PositionedIcon;
    const labelLength = Math.max(
        shapedText ? shapedText.right - shapedText.left : 0,
        shapedIcon ? shapedIcon.right - shapedIcon.left : 0);

    const glyphSize = 0.1;

    test('non-continued line with short labels', () => {
        const anchors = getAnchors(nonContinuedLine, bigSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        expect(anchors).toEqual([
            {x: 1, y: 2, angle: 1.5707963267948966, segment: 1},
            {x: 1, y: 5, angle: 1.5707963267948966, segment: 4},
            {x: 1, y: 8, angle: 1.5707963267948966, segment: 7}]);

        expect(
            labelLength / 2 + 1 <= anchors[0].y && anchors[0].y < labelLength / 2 + 3 * glyphSize + 1
        ).toBeTruthy();

    });

    test('non-continued line with long labels', () => {
        const anchors = getAnchors(nonContinuedLine, smallSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        expect(anchors).toEqual([
            {x: 1, y: 2, angle: 1.5707963267948966, segment: 1},
            {x: 1, y: 5, angle: 1.5707963267948966, segment: 3},
            {x: 1, y: 7, angle: 1.5707963267948966, segment: 6}]);

    });

    test('continued line with short labels', () => {
        const anchors = getAnchors(continuedLine, bigSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        expect(anchors).toEqual([
            {x: 1, y: 2, angle: 1.5707963267948966, segment: 1},
            {x: 1, y: 5, angle: 1.5707963267948966, segment: 4},
            {x: 1, y: 8, angle: 1.5707963267948966, segment: 7}]);

    });

    test('continued line with long labels', () => {
        const anchors = getAnchors(continuedLine, smallSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        expect(anchors).toEqual([
            {x: 1, y: 1, angle: 1.5707963267948966, segment: 1},
            {x: 1, y: 4, angle: 1.5707963267948966, segment: 3},
            {x: 1, y: 6, angle: 1.5707963267948966, segment: 6}]);

    });

    test('overscaled anchors contain all anchors in parent', () => {
        const anchors = getAnchors(nonContinuedLine, bigSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);
        const childAnchors = getAnchors(nonContinuedLine, bigSpacing / 2, Math.PI, shapedText, shapedIcon, glyphSize, 0.5, 2, TILE_EXTENT);
        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            let found = false;
            for (let k = 0; k < childAnchors.length; k++) {
                if (anchor.equals(childAnchors[k])) {
                    found = true;
                    break;
                }
            }
            expect(found).toBeTruthy();
        }
    });

    test('use middle point as a fallback position for short non-continued lines', () => {
        const line = [new Point(1, 1), new Point(1, 3.1)];
        const anchors = getAnchors(line, 2, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);
        expect(anchors).toEqual([
            {x: 1, y: 2, angle: 1.5707963267948966, segment: 0}]);
    });

    test('getCenterAnchor', () => {
        const line = [new Point(1, 1), new Point(1, 3.1), new Point(3, 6), new Point(4, 7)];
        const anchor = getCenterAnchor(line, Math.PI, shapedText, shapedIcon, glyphSize, 1);
        expect(anchor).toEqual({x: 2, y: 4, angle: 0.9670469933974603, segment: 1});
    });

    test('getCenterAnchor with center outside tile bounds', () => {
        const line = [new Point(-10, -10), new Point(5, 5)];
        const anchor = getCenterAnchor(line, Math.PI, shapedText, shapedIcon, glyphSize, 1);
        expect(anchor).toEqual({x: -2, y: -2, angle: 0.7853981633974483, segment: 0});
    });

    test('getCenterAnchor failing maxAngle test', () => {
        const line = [new Point(1, 1), new Point(1, 3), new Point(3, 3)];
        const anchor = getCenterAnchor(line, Math.PI / 4, shapedText, shapedIcon, glyphSize, 1);
        expect(anchor).toBeFalsy();
    });
});
