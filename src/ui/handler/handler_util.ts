import type Point from '@mapbox/point-geometry';

export function indexTouches(touches: Touch[], points: Point[]): Record<number, Point> {
    if (touches.length !== points.length) throw new Error(`The number of touches and points are not equal - touches ${touches.length}, points ${points.length}`);
    const obj: Record<number, Point> = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}
