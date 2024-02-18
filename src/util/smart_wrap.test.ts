import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat';
import {Transform} from '../geo/transform';
import {smartWrap} from './smart_wrap';

const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.getHorizon = () => 0; // map center

describe('smartWrap', () => {
    test('Shifts lng to -360 deg when such point is closer to the priorPos', () => {
        transform.locationPoint = ((ll: LngLat) => {
            if (ll.lng === -360) {
                return new Point(90, 51); // close to priorPos & below horizon
            } else {
                return new Point(120, 51);
            }
        });

        const result = smartWrap(
            new LngLat(0, 0),
            new Point(100, 51),
            transform);
        expect(result.lng).toBe(-360);
    });

    test('Shifts lng to +360 deg when such point is closer to the priorPos', () => {
        transform.locationPoint = ((ll: LngLat) => {
            if (ll.lng === 360) {
                return new Point(90, 51); // close to priorPos & below horizon
            } else {
                return new Point(120, 51);
            }
        });

        const result = smartWrap(
            new LngLat(0, 0),
            new Point(100, 51),
            transform);
        expect(result.lng).toBe(360);
    });

    test('Does not change lng when there are no closer points at -360 and +360 deg', () => {
        transform.locationPoint = ((ll: LngLat) => {
            if (ll.lng === 15) {
                return new Point(90, 51); // close to priorPos & below horizon
            } else {
                return new Point(12000, 51);
            }
        });

        const result = smartWrap(
            new LngLat(15, 0),
            new Point(100, 51),
            transform);
        expect(result.lng).toBe(15);
    });

    test('Does not change lng to -360 deg when such point is above horizon', () => {
        transform.locationPoint = ((ll: LngLat) => {
            if (ll.lng === -360) {
                return new Point(90, 49); // close to priorPos BUT above horizon
            } else {
                return new Point(120, 51);
            }
        });

        const result = smartWrap(
            new LngLat(0, 0),
            new Point(100, 51),
            transform);
        expect(result.lng).toBe(0);
    });

    test('Shifts lng to -360 if lng is outside viewport on the right and at least 180° from map center', () => {
        transform.center.lng = 50;
        transform.locationPoint = (() => { return new Point(110, 51); }); // outside viewport

        const result = smartWrap(
            new LngLat(250, 0), // 200 from map center
            new Point(0, 0), // priorPos doesn't matter in this case
            transform);
        expect(result.lng).toBe(-110);
    });

    test('Shifts lng to +360 if lng is outside viewport on the left and at least 180° from map center', () => {
        transform.center.lng = 50;
        transform.locationPoint = (() => { return new Point(-10, 51); }); // outside viewport

        const result = smartWrap(
            new LngLat(-150, 0), // 200 from map center
            new Point(0, 0), // priorPos doesn't matter in this case
            transform);
        expect(result.lng).toBe(210);
    });
});
