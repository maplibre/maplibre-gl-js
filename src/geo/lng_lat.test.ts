import LngLat from './lng_lat';

describe('Constructor', () => {
    test('creates an object', () => {
        expect(new LngLat(0, 0)).toBeInstanceOf(LngLat);
        expect(new LngLat(10, 90)).toBeInstanceOf(LngLat);
        expect(new LngLat(10, -90)).toBeInstanceOf(LngLat);
        expect(new LngLat(200, 10)).toBeInstanceOf(LngLat);
        expect(new LngLat(-200, 10)).toBeInstanceOf(LngLat);
        expect(new LngLat(-200, -90)).toBeInstanceOf(LngLat);
        expect('LngLat(10, 20)').not.toBeInstanceOf(LngLat);

        const Position = new LngLat(10, 90);
        expect(Position).toHaveProperty('lat');
        expect(Position).toHaveProperty('lng');
        expect(Position.lat).toBe(90);
        expect(Position.lng).toBe(10);
    });

    test('detects and throws on invalid lat input - for lng see wrap()', () => {
        const t = () => {
            new LngLat(0, -91);
        };
        expect(t).toThrow('Invalid LngLat latitude value: must be between -90 and 90');
    });

    test('detects and throws on invalid input', () => {
        const t = () => {
            new LngLat(0, 91);
        };
        expect(t).toThrow('Invalid LngLat latitude value: must be between -90 and 90');
    });

});

describe('Method wrap()', () => {
    test('convert returns a new `LngLat` object whose longitude is wrapped to the range (-180, 180)', () => {
        expect(new LngLat(0, 0).wrap()).toEqual({lng: 0, lat: 0});
        expect(new LngLat(10, 20).wrap()).toEqual({lng: 10, lat: 20});
        expect(new LngLat(360, 0).wrap()).toEqual({lng: 0, lat: 0});
        expect(new LngLat(720, 10).wrap()).toEqual({lng: 0, lat: 10});
        expect(new LngLat(190, 0).wrap()).toEqual({lng: -170, lat: 0});
        expect(new LngLat(-190, 0).wrap()).toEqual({lng: 170, lat: 0});

        expect(new LngLat(0, 0).wrap()).not.toEqual({lng: 10, lat: 0});
        expect(new LngLat(10, 20).wrap()).not.toEqual({lng: 0, lat: 20});
        expect(new LngLat(360, 0).wrap()).not.toEqual({lng: 10, lat: 0});
        expect(new LngLat(720, 10).wrap()).not.toEqual({lng: 10, lat: 10});
        expect(new LngLat(190, 0).wrap()).not.toEqual({lng: 170, lat: 0});
        expect(new LngLat(-190, 0).wrap()).not.toEqual({lng: -170, lat: 0});
    });
});

describe('Method toArray()', () => {
    expect(new LngLat(10, 20).toArray()).toEqual([10, 20]);
});

describe('Method convert()', () => {
    test('convert creates a LngLat instance', () => {
        expect(LngLat.convert([0, 10])).toBeInstanceOf(LngLat);

        expect(LngLat.convert({lng: 0, lat: 0})).toBeInstanceOf(LngLat);
        expect(LngLat.convert({lng: 0, lat: 10})).toBeInstanceOf(LngLat);

        expect(LngLat.convert({lon: 0, lat: 0})).toBeInstanceOf(LngLat);
        expect(LngLat.convert({lon: 0, lat: 10})).toBeInstanceOf(LngLat);

        expect(LngLat.convert(new LngLat(0, 0))).toBeInstanceOf(LngLat);
    });
});

describe('Method toString()', () => {
    test('Make sure, that LngLat(10, 20).toString() converts to an correct String', () => {
        expect(new LngLat(10, 20).toString()).toEqual('LngLat(10, 20)');
    });

    test('Check that the test also work the other way round', () => {
        expect(new LngLat(10, 20).toString()).not.toEqual('LngLat(20, 20)');
    });
});

describe('Method distanceTo()', () => {
    test('Make sure that distanceTo returns the approximate distance between New York and Los Angeles', () => {
        const newYork = new LngLat(-74.0060, 40.7128);
        const losAngeles = new LngLat(-118.2437, 34.0522);
        const d = newYork.distanceTo(losAngeles); // 3935751.690893987, "true distance" is 3966km
        expect(d > 3935750).toBeTruthy();
        expect(d < 3935752).toBeTruthy();
    });

    test('Make sure that distanceTo returns the approximate distance between New York and North Pole', () => {
        const newYork = new LngLat(-74.0060, 40.7128);
        const northPole = new LngLat(-135, 90);
        const d = newYork.distanceTo(northPole); // 5480494.158486183 , "true distance" is 5499km
        expect(d > 5480493).toBeTruthy();
        expect(d < 5480495).toBeTruthy();
    });

    test('Make sure that distanceTo returns the approximate distance between New York and Null Island', () => {
        const newYork = new LngLat(-74.0060, 40.7128);
        const nullIsland = new LngLat(0, 0);
        const d = newYork.distanceTo(nullIsland); // 8667080.125666846 , "true distance" is 8661km
        expect(d > 8667079).toBeTruthy();
        expect(d < 8667081).toBeTruthy();
    });
});

describe('Method toBounds()', () => {
    test('Make sure that toBounds returns A new `LngLatBounds` object representing the coordinates. This new `LngLatBounds`is extended by the `radius`', () => {
        expect(new LngLat(0, 0).toBounds(10).toArray()).toEqual([[-0.00008983152770714982, -0.00008983152770714982], [0.00008983152770714982, 0.00008983152770714982]]);
        expect(new LngLat(-73.9749, 40.7736).toBounds(10).toArray()).toEqual([[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]);
        expect(new LngLat(-73.9749, 40.7736).toBounds().toArray()).toEqual([[-73.9749, 40.7736], [-73.9749, 40.7736]]);
    });
});
