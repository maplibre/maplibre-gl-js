import {describe, test, expect} from 'vitest';
import {createProjectionFromName} from './projection_factory.ts';
import {mercatorWorldCoordinates} from './world_coordinate_helper.ts';

describe('createProjectionFromName', () => {
    test('gives the mercator transform the projection world coordinate helper', () => {
        const {projection, transform} = createProjectionFromName('mercator', undefined, {});
        expect(transform.worldCoordinateHelper).toBe(projection.worldCoordinateHelper);
        expect(transform.worldCoordinateHelper).toBe(mercatorWorldCoordinates);
    });

    test('gives the mercator fallback for an unknown name the same helper', () => {
        const {projection, transform} = createProjectionFromName('not-a-projection', undefined, {});
        expect(transform.worldCoordinateHelper).toBe(projection.worldCoordinateHelper);
        expect(transform.worldCoordinateHelper).toBe(mercatorWorldCoordinates);
    });
});
