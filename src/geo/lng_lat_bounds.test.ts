import {LngLat} from './lng_lat';
import {LngLatBounds} from './lng_lat_bounds';

describe('LngLatBounds', () => {
    test('#constructor', () => {
        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getSouth()).toBe(0);
        expect(bounds.getWest()).toBe(0);
        expect(bounds.getNorth()).toBe(10);
        expect(bounds.getEast()).toBe(-10);
    });

    test('#constructor across dateline', () => {
        const sw = new LngLat(170, 0);
        const ne = new LngLat(-170, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getSouth()).toBe(0);
        expect(bounds.getWest()).toBe(170);
        expect(bounds.getNorth()).toBe(10);
        expect(bounds.getEast()).toBe(-170);
    });

    test('#constructor across pole', () => {
        const sw = new LngLat(0, 85);
        const ne = new LngLat(-10, -85);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getSouth()).toBe(85);
        expect(bounds.getWest()).toBe(0);
        expect(bounds.getNorth()).toBe(-85);
        expect(bounds.getEast()).toBe(-10);
    });

    test('#constructor no args', () => {
        const bounds = new LngLatBounds();
        const t1 = () => {
            bounds.getCenter();
        };
        expect(t1).toThrow();
    });

    test('#extend with coordinate', () => {
        const bounds = new LngLatBounds([0, 0], [10, 10]);
        bounds.extend([-10, -10]);

        expect(bounds.getSouth()).toBe(-10);
        expect(bounds.getWest()).toBe(-10);
        expect(bounds.getNorth()).toBe(10);
        expect(bounds.getEast()).toBe(10);

        bounds.extend(new LngLat(-15, -15));

        expect(bounds.getSouth()).toBe(-15);
        expect(bounds.getWest()).toBe(-15);
        expect(bounds.getNorth()).toBe(10);
        expect(bounds.getEast()).toBe(10);

        bounds.extend([-80, -80, 80, 80]);

        expect(bounds.getSouth()).toBe(-80);
        expect(bounds.getWest()).toBe(-80);
        expect(bounds.getNorth()).toBe(80);
        expect(bounds.getEast()).toBe(80);

        bounds.extend({lng: -90, lat: -90});

        expect(bounds.getSouth()).toBe(-90);
        expect(bounds.getWest()).toBe(-90);
        expect(bounds.getNorth()).toBe(80);
        expect(bounds.getEast()).toBe(80);

        bounds.extend({lon: 90, lat: 90});

        expect(bounds.getSouth()).toBe(-90);
        expect(bounds.getWest()).toBe(-90);
        expect(bounds.getNorth()).toBe(90);
        expect(bounds.getEast()).toBe(90);
    });

    test('#extend with bounds', () => {
        const bounds1 = new LngLatBounds([0, 0], [10, 10]);
        const bounds2 = new LngLatBounds([-10, -10], [10, 10]);

        bounds1.extend(bounds2);

        expect(bounds1.getSouth()).toBe(-10);
        expect(bounds1.getWest()).toBe(-10);
        expect(bounds1.getNorth()).toBe(10);
        expect(bounds1.getEast()).toBe(10);

        const bounds4 = new LngLatBounds([-20, -20, 20, 20]);
        bounds1.extend(bounds4);

        expect(bounds1.getSouth()).toBe(-20);
        expect(bounds1.getWest()).toBe(-20);
        expect(bounds1.getNorth()).toBe(20);
        expect(bounds1.getEast()).toBe(20);

        const bounds5 = new LngLatBounds();
        bounds1.extend(bounds5);

        expect(bounds1.getSouth()).toBe(-20);
        expect(bounds1.getWest()).toBe(-20);
        expect(bounds1.getNorth()).toBe(20);
        expect(bounds1.getEast()).toBe(20);
    });

    test('#extend with null', () => {
        const bounds = new LngLatBounds([0, 0], [10, 10]);

        bounds.extend(null);

        expect(bounds.getSouth()).toBe(0);
        expect(bounds.getWest()).toBe(0);
        expect(bounds.getNorth()).toBe(10);
        expect(bounds.getEast()).toBe(10);
    });

    test('#extend undefined bounding box', () => {
        const bounds1 = new LngLatBounds(undefined, undefined);
        const bounds2 = new LngLatBounds([-10, -10], [10, 10]);

        bounds1.extend(bounds2);

        expect(bounds1.getSouth()).toBe(-10);
        expect(bounds1.getWest()).toBe(-10);
        expect(bounds1.getNorth()).toBe(10);
        expect(bounds1.getEast()).toBe(10);
    });

    test('#extend same LngLat instance', () => {
        const point = new LngLat(0, 0);
        const bounds = new LngLatBounds(point, point);

        bounds.extend(new LngLat(15, 15));

        expect(bounds.getSouth()).toBe(0);
        expect(bounds.getWest()).toBe(0);
        expect(bounds.getNorth()).toBe(15);
        expect(bounds.getEast()).toBe(15);
    });

    test('accessors', () => {
        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, -20);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getCenter()).toEqual(new LngLat(-5, -10));
        expect(bounds.getSouth()).toBe(0);
        expect(bounds.getWest()).toBe(0);
        expect(bounds.getNorth()).toBe(-20);
        expect(bounds.getEast()).toBe(-10);
        expect(bounds.getSouthWest()).toEqual(new LngLat(0, 0));
        expect(bounds.getSouthEast()).toEqual(new LngLat(-10, 0));
        expect(bounds.getNorthEast()).toEqual(new LngLat(-10, -20));
        expect(bounds.getNorthWest()).toEqual(new LngLat(0, -20));
    });

    test('#convert', () => {
        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(LngLatBounds.convert(undefined)).toBeUndefined();
        expect(LngLatBounds.convert(bounds)).toEqual(bounds);
        expect(LngLatBounds.convert([sw, ne])).toEqual(bounds);
        expect(
            LngLatBounds.convert([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()])
        ).toEqual(bounds);
    });

    test('#toArray', () => {
        const llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
        expect(llb.toArray()).toEqual([[-73.9876, 40.7661], [-73.9397, 40.8002]]);
    });

    test('#toString', () => {
        const llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
        expect(llb.toString()).toBe('LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))');
    });

    test('#isEmpty', () => {
        const nullBounds = new LngLatBounds();
        expect(nullBounds.isEmpty()).toBe(true);

        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.isEmpty()).toBe(false);
    });

    test('#fromLngLat', () => {
        const center0 = new LngLat(0, 0);
        const center1 = new LngLat(-73.9749, 40.7736);

        const center0Radius10 = LngLatBounds.fromLngLat(center0, 10);
        const center1Radius10 = LngLatBounds.fromLngLat(center1, 10);
        const center1Radius0 = LngLatBounds.fromLngLat(center1);

        expect(center0Radius10.toArray()).toEqual(
            [[-0.00008983152770714982, -0.00008983152770714982], [0.00008983152770714982, 0.00008983152770714982]]
        );
        expect(center1Radius10.toArray()).toEqual(
            [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]
        );
        expect(center1Radius0.toArray()).toEqual([[-73.9749, 40.7736], [-73.9749, 40.7736]]);
    });

    describe('contains', () => {
        describe('point', () => {
            test('point is in bounds', () => {
                const llb = new LngLatBounds([-1, -1], [1, 1]);
                const ll = {lng: 0, lat: 0};
                expect(llb.contains(ll)).toBeTruthy();
            });

            test('point is not in bounds', () => {
                const llb = new LngLatBounds([-1, -1], [1, 1]);
                const ll = {lng: 3, lat: 3};
                expect(llb.contains(ll)).toBeFalsy();
            });

            test('point is in bounds that spans dateline', () => {
                const llb = new LngLatBounds([190, -10], [170, 10]);
                const ll = {lng: 180, lat: 0};
                expect(llb.contains(ll)).toBeTruthy();
            });

            test('point is not in bounds that spans dateline', () => {
                const llb = new LngLatBounds([190, -10], [170, 10]);
                const ll = {lng: 0, lat: 0};
                expect(llb.contains(ll)).toBeFalsy();
            });
        });
    });
});
