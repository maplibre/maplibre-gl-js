import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {clipGeometry, clipLine} from './clip_line';

describe('clipLines', () => {

    const minX = -300;
    const maxX = 300;
    const minY = -200;
    const maxY = 200;

    const clipLineTest = (lines) => {
        return clipLine(lines, minX, minY, maxX, maxY);
    };

    test('Single line fully inside', () => {
        const line = [
            new Point(-100, -100),
            new Point(-40, -100),
            new Point(200, 0),
            new Point(-80, 195)
        ];

        expect(clipLineTest([line])).toEqual([line]);
    });

    test('Multiline fully inside', () => {
        const line0 = [
            new Point(-250, -150),
            new Point(-250, 150),
            new Point(-10, 150),
            new Point(-10, -150)
        ];

        const line1 = [
            new Point(250, -150),
            new Point(250, 150),
            new Point(10, 150),
            new Point(10, -150)
        ];

        const lines = [line0, line1];

        expect(clipLineTest(lines)).toEqual(lines);
    });

    test('Lines fully outside', () => {
        const line0 = [
            new Point(-400, -300),
            new Point(-350, 0),
            new Point(-300, 300)
        ];

        const line1 = [
            new Point(1000, 210),
            new Point(10000, 500)
        ];

        expect(clipLineTest([line0, line1])).toEqual([]);
    });

    test('Intersect with single border', () => {
        const line0 = [
            new Point(-400, 0),
            new Point(0, 0)
        ];

        const result0 = [
            new Point(minX, 0),
            new Point(0, 0)
        ];

        const line1 = [
            new Point(250, -50),
            new Point(350, 50)
        ];

        const result1 = [
            new Point(250, -50),
            new Point(maxX, 0)
        ];

        expect(clipLineTest([line0, line1])).toEqual([result0, result1]);
    });

    test('Intersect with multiple borders', () => {
        const line0 = [
            new Point(-350, -100),
            new Point(-200, -250)
        ];

        const line1 = [
            new Point(-100, 250),
            new Point(0, 150),
            new Point(100, 250)
        ];

        const result0 = [
            new Point(minX, -150),
            new Point(-250, minY)
        ];

        const result1 = [
            new Point(-50, maxY),
            new Point(0, 150),
            new Point(50, maxY)
        ];

        expect(clipLineTest([line0, line1])).toEqual([result0, result1]);
    });

    test('Single line can be split into multiple segments', () => {
        const line = [
            new Point(-80, 150),
            new Point(-80, 350),
            new Point(120, 1000),
            new Point(120, 0)
        ];

        const result0 = [
            new Point(-80, 150),
            new Point(-80, maxY),
        ];

        const result1 = [
            new Point(120, maxY),
            new Point(120, 0),
        ];

        expect(clipLineTest([line])).toEqual([result0, result1]);
    });

    test('Non-clipped points are bit exact', () => {
        const line = [
            new Point(-500, -200),
            new Point(131.2356763, 0.956732)
        ];

        expect(clipLineTest([line])[1]).toEqual(line[0][1]);
    });

    test('Clipped points are rounded to the nearest integer', () => {
        const line = [
            new Point(310, 2.9),
            new Point(290, 2.5)
        ];

        const result = [
            new Point(maxX, 3),
            new Point(290, 2.5)
        ];

        expect(clipLineTest([line])).toEqual([result]);
    });
});

describe('clipGeometry', () => {

    test('Empty geometry', () => {
        expect(clipGeometry([], 2, -300, -200, 300, 200)).toEqual([]);
    });

    test('unknown geometry type', () => {
        expect(clipGeometry([], 0, -300, -200, 300, 200)).toEqual([]);
    });

    test('point fully inside', () => {
        const point = [
            new Point(100, 100)
        ];

        expect(clipGeometry([point], 1, -300, -200, 300, 200)).toEqual([point]);
    });

    test('point fully outside', () => {
        const point = [
            new Point(400, 100)
        ];

        expect(clipGeometry([point], 1, -300, -200, 300, 200)).toEqual([]);
    });

    test('Line fully inside', () => {
        const line = [
            new Point(-100, -100),
            new Point(-40, -100),
            new Point(200, 0),
            new Point(-80, 195)
        ];

        expect(clipGeometry([line], 2, -300, -200, 300, 200)).toEqual([line]);
    });

    test('Line fully outside', () => {
        const line = [
            new Point(-400, 0),
            new Point(-350, 0),
            new Point(-300, 0)
        ];

        expect(clipGeometry([line], 2, -299, -200, 300, 200)).toEqual([]);
    });

    test('Intersect with borders', () => {
        const line = [
            new Point(-400, 0),
            new Point(0, 0),
            new Point(400, 0)
        ];

        const result = [
            [
                new Point(-300, 0),
                new Point(0, 0),
                new Point(300, 0)
            ]
        ];

        expect(clipGeometry([line], 2, -300, -200, 300, 200)).toEqual(result);
    });

    test('Line can be split into multiple segments', () => {
        const line = [
            new Point(-80, 150),
            new Point(-80, 350),
            new Point(120, 1000),
            new Point(120, 0)
        ];

        const result = [
            [
                new Point(-80, 150),
                new Point(-80, 200),
            ],
            [
                new Point(120, 200),
                new Point(120, 0),
            ]
        ];

        expect(clipGeometry([line], 2, -300, -200, 300, 200)).toEqual(result);
    });

    test('Polygon fully inside', () => {
        const polygon = [
            new Point(-100, -100),
            new Point(100, -100),
            new Point(100, 100),
            new Point(-100, 100),
            new Point(-100, -100)
        ];

        expect(clipGeometry([polygon], 3, -300, -200, 300, 200)).toEqual([polygon]);
    });

    test('Polygon fully outside', () => {
        const polygon = [
            new Point(-400, -300),
            new Point(-350, -300),
            new Point(-350, -250),
            new Point(-400, -250),
            new Point(-400, -300)
        ];

        expect(clipGeometry([polygon], 3, -300, -200, 300, 200)).toEqual([]);
    });

    test('Intersect polygon with borders', () => {
        const polygon = [
            new Point(-400, -400),
            new Point(400, -400),
            new Point(400, 400),
            new Point(-400, 400),
            new Point(-400, -400)
        ];

        const result = [
            [
                new Point(200, -200),
                new Point(200, 200),
                new Point(-200, 200),
                new Point(-200, -200),
                new Point(200, -200)
            ]
        ];
        expect(clipGeometry([polygon], 3, -200, -200, 200, 200)).toEqual(result);
    });
});