import Point from '@mapbox/point-geometry';

export function indexTouches(touches: Array<Touch>, points: Array<Point>) {
    if (touches.length !== points.length) throw new Error();
    const obj = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}
