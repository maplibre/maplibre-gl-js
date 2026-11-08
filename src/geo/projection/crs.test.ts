import {describe, test, expect} from 'vitest';
import {CRSWorldCoordinateHelper, identityCrs, type CRS} from './crs.ts';
import {createIdentityCrsAnsweringInside, createPolarStereographicCrs, createRotatedCrs, createWrappingWorldCrs} from '../../util/test/util.ts';
import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';
import {LngLat, earthRadius} from '../lng_lat.ts';

function createSamplePoints(): Array<[number, number]> {
    return [
        [0, 0],
        [-89, -89],
        [89, 89],
        [12.5, 41.9],
        [-73.98, 40.75],
        [174.77, -41.29],
    ];
}

/**
 * Spherical mercator written as a CRS, so its world coordinates can be checked against
 * the mercator helper's own math.
 */
function createMercatorAsCrs(): CRS {
    const halfCircumference = Math.PI * earthRadius;
    return {
        name: 'mercator-as-crs',
        projection: {
            forward([lng, lat]) {
                const phi = lat * Math.PI / 180;
                return [lng * Math.PI / 180 * earthRadius, earthRadius * Math.log(Math.tan(Math.PI / 4 + phi / 2))];
            },
            inverse([x, y]) {
                return [x / earthRadius * 180 / Math.PI, (2 * Math.atan(Math.exp(y / earthRadius)) - Math.PI / 2) * 180 / Math.PI];
            },
        },
        tileMatrixSet: {origin: [-halfCircumference, halfCircumference], extentAtZoom0: 2 * halfCircumference},
    };
}

describe('CRSWorldCoordinateHelper', () => {
    describe('a converter without an answer outside its tile matrix set', () => {
        test('maps a position past the east edge to the nearest position inside where inverse returns null', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createIdentityCrsAnsweringInside(null));
            expect(worldCoordinateHelper.lngLatFromWorld(1.5, 0.25)).toEqual(new LngLat(90, 45));
        });

        test('maps a position past the east edge to the nearest position inside where inverse throws', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper({
                name: 'test:throwing-outside',
                projection: {
                    forward: ([lng, lat]) => [lng, lat],
                    inverse([x, y]) {
                        if (Math.abs(x) > 90 || Math.abs(y) > 90) throw new Error();
                        return [x, y];
                    },
                },
                tileMatrixSet: {origin: [-90, 90], extentAtZoom0: 180},
            });
            expect(worldCoordinateHelper.lngLatFromWorld(1.5, 0.25)).toEqual(new LngLat(90, 45));
        });

        test('maps a position past the east edge to the nearest position inside where inverse returns NaN', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createIdentityCrsAnsweringInside([NaN, NaN]));
            expect(worldCoordinateHelper.lngLatFromWorld(1.5, 0.25)).toEqual(new LngLat(90, 45));
        });

        test('maps a position past the edge of the world to the edge where inverse wraps it to the other side', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createWrappingWorldCrs());
            const pastTheEastEdge = worldCoordinateHelper.lngLatFromWorld(0.875, 0.5);
            expect(pastTheEastEdge.lng).toBeCloseTo(180, 5);
            expect(pastTheEastEdge.lat).toBeCloseTo(0, 5);
        });

        test('keeps the inverse of a converter that is only approximately invertible', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper({
                name: 'test:approximate',
                projection: {forward: ([lng, lat]) => [lng, lat], inverse: ([x, y]) => [x * 1.0001, y]},
                tileMatrixSet: {origin: [-90, 90], extentAtZoom0: 180},
            });
            expect(worldCoordinateHelper.lngLatFromWorld(0.75, 0.5).lng).toBeCloseTo(45.0045, 6);
        });

        test('keeps the inverse of a converter that never leads back to the position', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper({
                name: 'test:imprecise',
                projection: {forward: ([lng, lat]) => [lng, lat], inverse: ([x, y]) => [x + 1, y]},
                tileMatrixSet: {origin: [-90, 90], extentAtZoom0: 180},
            });
            expect(worldCoordinateHelper.lngLatFromWorld(0.5, 0.5)).toEqual(new LngLat(1, 0));
        });

        test('throws when inverse has no answer inside the tile matrix set either', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper({...createIdentityCrsAnsweringInside(null), projection: {forward: ([lng, lat]) => [lng, lat], inverse: () => null}});
            expect(() => worldCoordinateHelper.lngLatFromWorld(0.5, 0.5)).toThrow('has no answer inside its tile matrix set');
        });
    });

    describe('identity', () => {
        test('maps the tile 0 square to lng/lat -90..90', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
            expect(worldCoordinateHelper.worldFromLngLat(-90, 90)).toMatchObject({x: 0, y: 0});
            expect(worldCoordinateHelper.worldFromLngLat(90, -90)).toMatchObject({x: 1, y: 1});
            expect(worldCoordinateHelper.worldFromLngLat(0, 0)).toMatchObject({x: 0.5, y: 0.5});
            expect(worldCoordinateHelper.worldFromLngLat(45, 45)).toMatchObject({x: 0.75, y: 0.25});
        });

        test('round trips lng/lat through world coordinates', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
            for (const [lng, lat] of createSamplePoints()) {
                const world = worldCoordinateHelper.worldFromLngLat(lng, lat);
                const back = worldCoordinateHelper.lngLatFromWorld(world.x, world.y);
                expect(back).toBeInstanceOf(LngLat);
                expect(back.lng).toBeCloseTo(lng, 12);
                expect(back.lat).toBeCloseTo(lat, 12);
            }
        });

        test('uses a constant meters per world unit equal to the zoom 0 extent', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
            expect(worldCoordinateHelper.metersPerWorldUnit(0.5, 0.5)).toBe(180);
            expect(worldCoordinateHelper.metersPerWorldUnit(0.95, 0.05)).toBe(180);
        });

        test('scales altitude to world z by the zoom 0 extent wherever the location is', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
            expect(worldCoordinateHelper.worldZFromAltitude(360, new LngLat(80, 80))).toBe(2);
        });

        test('puts the altitude in z and leaves z at 0 without one', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
            expect(worldCoordinateHelper.worldFromLngLat(0, 0).z).toBe(0);
            expect(worldCoordinateHelper.worldFromLngLat(0, 0, 90).z).toBe(0.5);
        });

        test('clamps a latitude past the poles to the range LngLat accepts, for a position outside the world square', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
            const aTenthOfTheSquareNorthOfIt = -0.1;
            const aTenthOfTheSquareSouthOfIt = 1.1;

            expect(worldCoordinateHelper.lngLatFromWorld(0.5, aTenthOfTheSquareNorthOfIt).lat).toBe(90);
            expect(worldCoordinateHelper.lngLatFromWorld(0.5, aTenthOfTheSquareSouthOfIt).lat).toBe(-90);
        });

        test('does not wrap', () => {
            expect(new CRSWorldCoordinateHelper(identityCrs).wraps).toBe(false);
        });
    });

    describe('identity CRS', () => {
        test('is the identity over lng/lat with tile 0/0/0 spanning -90..90', () => {
            expect(identityCrs.name).toBe('identity');
            expect(identityCrs.projection.forward([12.5, -41.9])).toEqual([12.5, -41.9]);
            expect(identityCrs.projection.inverse([12.5, -41.9])).toEqual([12.5, -41.9]);
            expect(identityCrs.tileMatrixSet).toEqual({origin: [-90, 90], extentAtZoom0: 180});
        });
    });

    describe('rotated CRS', () => {
        test('round trips lng/lat through world coordinates', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createRotatedCrs());
            for (const [lng, lat] of createSamplePoints()) {
                const world = worldCoordinateHelper.worldFromLngLat(lng, lat);
                const back = worldCoordinateHelper.lngLatFromWorld(world.x, world.y);
                expect(back.lng).toBeCloseTo(lng, 10);
                expect(back.lat).toBeCloseTo(lat, 10);
            }
        });

        test('measures world coordinates from the tile matrix set origin with y growing down', () => {
            const crs = createRotatedCrs();
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(crs);
            const quarterAcross = 0.25;
            const threeQuartersDown = 0.75;
            const [originX, originY] = crs.tileMatrixSet.origin;
            const extent = crs.tileMatrixSet.extentAtZoom0;
            const lngLat = worldCoordinateHelper.lngLatFromWorld(quarterAcross, threeQuartersDown);
            const [x, y] = crs.projection.forward([lngLat.lng, lngLat.lat]);
            expect(x).toBeCloseTo(originX + quarterAcross * extent, 10);
            expect(y).toBeCloseTo(originY - threeQuartersDown * extent, 10);
        });

        test('takes the zoom 0 extent as meters per world unit', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createRotatedCrs());
            expect(worldCoordinateHelper.metersPerWorldUnit(0.5, 0.5)).toBe(300);
        });

        test('scales altitude to world z by the zoom 0 extent', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createRotatedCrs());
            expect(worldCoordinateHelper.worldZFromAltitude(300, new LngLat(0, 0))).toBe(1);
        });
    });

    describe('mercator written as a CRS', () => {
        test('projects lng/lat to the same world coordinates as the mercator helper', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createMercatorAsCrs());
            for (const [lng, lat] of [...createSamplePoints(), [-180, -85], [180, 85]]) {
                const expected = mercatorWorldCoordinateHelper.worldFromLngLat(lng, lat);
                const actual = worldCoordinateHelper.worldFromLngLat(lng, lat);
                expect(Math.abs(actual.x - expected.x)).toBeLessThan(1e-12);
                expect(Math.abs(actual.y - expected.y)).toBeLessThan(1e-12);
            }
        });

        test('unprojects world coordinates to the same lng/lat as the mercator helper', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createMercatorAsCrs());
            for (const [x, y] of [[0.5, 0.5], [0.1, 0.9], [0.999, 0.001], [0.25, 0.75]]) {
                const expected = mercatorWorldCoordinateHelper.lngLatFromWorld(x, y);
                const actual = worldCoordinateHelper.lngLatFromWorld(x, y);
                expect(actual.lng).toBeCloseTo(expected.lng, 10);
                expect(actual.lat).toBeCloseTo(expected.lat, 10);
            }
        });

        test('reports the same meters per world unit as the mercator helper at the equator', () => {
            const worldCoordinateHelper = new CRSWorldCoordinateHelper(createMercatorAsCrs());
            expect(worldCoordinateHelper.metersPerWorldUnit(0.5, 0.5)).toBeCloseTo(mercatorWorldCoordinateHelper.metersPerWorldUnit(0.5, 0.5), 6);
        });
    });

    describe('latitudeRange', () => {
        test('runs from where the meridian stretches ten times as much as at the center to the near pole in a north polar CRS', () => {
            expect(new CRSWorldCoordinateHelper(createPolarStereographicCrs()).latitudeRange).toEqual([-53, 90]);
        });

        test('runs from the near pole to where the meridian stretches ten times as much as at the center in a south polar CRS', () => {
            const northPolar = createPolarStereographicCrs();
            const southPolar: CRS = {
                ...northPolar,
                name: 'test:south-polar',
                projection: {
                    forward([lng, lat]) {
                        return northPolar.projection.forward([lng, -lat]);
                    },
                    inverse(position) {
                        const [lng, lat] = northPolar.projection.inverse(position);
                        return [lng, -lat];
                    },
                },
            };
            expect(new CRSWorldCoordinateHelper(southPolar).latitudeRange).toEqual([-90, 53]);
        });

        test('is the whole globe for a projection that stretches no pole that much', () => {
            expect(new CRSWorldCoordinateHelper(identityCrs).latitudeRange).toEqual([-90, 90]);
        });
    });
});
