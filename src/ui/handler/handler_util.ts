// #DISABLE_NODE_ASSERT: import assert from 'assert';
import Point from '@mapbox/point-geometry';

export function indexTouches(touches: Array<Touch>, points: Array<Point>) {
    // #DISABLE_NODE_ASSERT: assert(touches.length === points.length);
    const obj = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}
