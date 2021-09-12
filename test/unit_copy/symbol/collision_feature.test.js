import {test} from '../../util/test';
import CollisionFeature from '../../../rollup/build/tsc/symbol/collision_feature';
import Anchor from '../../../rollup/build/tsc/symbol/anchor';
import Point from '../../../rollup/build/tsc/util/point';
import {CollisionBoxArray} from '../../../rollup/build/tsc/data/array_types';

test('CollisionFeature', (t) => {

    const collisionBoxArray = new CollisionBoxArray();

    const shapedText = {
        left: -50,
        top: -10,
        right: 50,
        bottom: 10
    };

    test('point label', (t) => {
        const point = new Point(500, 0);
        const anchor = new Anchor(point.x, point.y, 0, undefined);

        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, false);
        expect(cf.circleDiameter).toBeFalsy();
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(1);

        const box = collisionBoxArray.get(cf.boxStartIndex);
        expect(box.x1).toBe(-50);
        expect(box.x2).toBe(50);
        expect(box.y1).toBe(-10);
        expect(box.y2).toBe(10);
        t.end();
    });

    test('Compute line height for runtime collision circles (line label)', (t) => {
        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        expect(cf.circleDiameter).toBeTruthy();
        expect(cf.circleDiameter).toBe(shapedText.bottom - shapedText.top);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        t.end();
    });

    test('Collision circle diameter is not computed for features with zero height', (t) => {
        const shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        expect(cf.circleDiameter).toBeFalsy();
        t.end();
    });

    test('Collision circle diameter is not computed for features with negative height', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        expect(cf.circleDiameter).toBeFalsy();
        t.end();
    });

    test('Use minimum collision circle diameter', (t) => {
        const shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        const anchor = new Anchor(505, 95, 0, 1);
        const cf = new CollisionFeature(collisionBoxArray, anchor, 0, 0, 0, shapedText, 1, 0, true);
        expect(cf.boxEndIndex - cf.boxStartIndex).toBe(0);
        expect(cf.circleDiameter).toBe(10);
        t.end();
    });

    t.end();
});
