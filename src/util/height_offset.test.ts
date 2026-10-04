import {describe, test, expect} from 'vitest';
import {LngLat} from '../geo/lng_lat.ts';
import {getElevationForHeightOffset} from './height_offset.ts';

import type {Map} from '../ui/map.ts';

describe('getElevationForHeightOffset', () => {
    const lngLat = new LngLat(0, 0);
    const flat = {terrain: null, _camera: {transform: {}}} as unknown as Map;
    const mountain = {terrain: {getElevationForLngLat: () => 1000}, _camera: {transform: {}}} as unknown as Map;

    test('no offset means the ground projection', () => {
        expect(getElevationForHeightOffset(flat, lngLat, 0, 'ground')).toBeUndefined();
        expect(getElevationForHeightOffset(mountain, lngLat, 0, 'ground')).toBeUndefined();
    });

    test('ground offset is measured from the terrain', () => {
        expect(getElevationForHeightOffset(flat, lngLat, 50, 'ground')).toBe(50);
        expect(getElevationForHeightOffset(mountain, lngLat, 50, 'ground')).toBe(1050);
    });

    test('absolute offset is measured from the datum', () => {
        expect(getElevationForHeightOffset(mountain, lngLat, 50, 'absolute')).toBe(50);
        expect(getElevationForHeightOffset(mountain, lngLat, 0, 'absolute')).toBe(0);
    });
});
