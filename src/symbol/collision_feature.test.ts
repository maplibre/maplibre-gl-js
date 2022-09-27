import CollisionFeature from './collision_feature';
import Anchor from './anchor';
import Point from '@mapbox/point-geometry';
import {CollisionBoxArray} from '../data/array_types.g';
import {SymbolPadding} from '../style/style_layer/symbol_style_layer';

describe('CollisionFeature', () => {

    const collisionBoxArray = new CollisionBoxArray();

    const shapedText = {
        left: -50,
        top: -10,
        right: 50,
        bottom: 10
    };

    const padding: SymbolPadding = [0, 0, 0, 0];

    test('point label', () => {
        const point = new Point(500, 0);
        const anchor = new Anchor(point.x, point.y, 0, undefined);

        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, padding, false, 0);
        expect(cf.circleDiameter).toBeFalsy();
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(1);

        const box = collisionBoxArray.get(cf.boxStartIndex);
        expect(box.x1).toBe(-50);
        expect(box.x2).toBe(50);
        expect(box.y1).toBe(-10);
        expect(box.y2).toBe(10);
    });

    test('point label with padding', () => {
        const point = new Point(500, 0);
        const anchor = new Anchor(point.x, point.y, 0, undefined);
        const pointPadding: SymbolPadding = [10, 20, -5, -10]; // top, right, bottom, left
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, pointPadding, false, 0);

        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(1);
        const box = collisionBoxArray.get(cf.boxStartIndex);
        expect(box.x1).toBe(-40);
        expect(box.x2).toBe(70);
        expect(box.y1).toBe(-20);
        expect(box.y2).toBe(5);
    });

    test('Compute line height for runtime collision circles (line label)', () => {
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, padding, true, 0);
        expect(cf.circleDiameter).toBeTruthy();
        expect(cf.circleDiameter).toBe(shapedText.bottom - shapedText.top);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
    });

    test('Collision circle diameter is not computed for features with zero height', () => {
        const shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, padding, true, 0);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        expect(cf.circleDiameter).toBeFalsy();
    });

    test('Collision circle diameter is not computed for features with negative height', () => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, padding, true, 0);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        expect(cf.circleDiameter).toBeFalsy();
    });

    test('Use minimum collision circle diameter', () => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, padding, true, 0);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        expect(cf.circleDiameter).toBe(10);
    });
});
