import {describe, test, expect} from 'vitest';
import {mercatorWorldCoordinates} from './world_coordinate_helper.ts';

function createSamplePoints(): Array<[number, number]> {
    return [
        [0, 0],
        [-180, -85],
        [179.999, 85],
        [12.5, 41.9],
        [-122.4, 37.8],
        [151.2, -33.9],
        [37.6, 55.8],
    ];
}

describe('mercatorWorldCoordinates', () => {
    test('round-trips lng/lat through world coordinates', () => {
        for (const [lng, lat] of createSamplePoints()) {
            const {x, y} = mercatorWorldCoordinates.worldFromLngLat(lng, lat);
            const back = mercatorWorldCoordinates.lngLatFromWorld(x, y);
            expect(back.lng).toBeCloseTo(lng, 10);
            expect(back.lat).toBeCloseTo(lat, 10);
        }
    });
});
