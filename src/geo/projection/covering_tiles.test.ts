import {beforeEach, describe, expect, test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {coveringTiles, coveringZoomLevel, createCalculateTileZoomFunction, type CoveringTilesOptions} from './covering_tiles.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {CRSWorldCoordinateHelper, identityCrs} from './crs.ts';
import {createIdentityCrsCamera} from '../../util/test/util.ts';
import {createGlobeCameraProjection, createMercatorCameraProjection} from './camera_projection.ts';
import {createCameraState, type CameraState} from '../camera_state.ts';
import {projectCamera} from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';

import type {CameraContext} from './camera_constrain.ts';

describe('coveringTiles', () => {
    describe('globe', () => {

        test('zoomed out', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(0.0, 0.0));
            state = cameraUpdates.setZoom(state, context, -1);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(0, 0, 0, 0, 0)
            ]);
        });
    
        test('zoomed in', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.02, 0.01));
            state = cameraUpdates.setZoom(state, context, 3);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(3, 0, 3, 3, 3),
                new OverscaledTileID(3, 0, 3, 3, 4),
                new OverscaledTileID(3, 0, 3, 4, 3),
                new OverscaledTileID(3, 0, 3, 4, 4),
            ]);
        });
    
        test('zoomed in 512x512', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 512, 512);
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.02, 0.01));
            state = cameraUpdates.setZoom(state, context, 3);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(3, 0, 3, 3, 3),
                new OverscaledTileID(3, 0, 3, 3, 4),
                new OverscaledTileID(3, 0, 3, 4, 3),
                new OverscaledTileID(3, 0, 3, 4, 4),
                new OverscaledTileID(3, 0, 3, 2, 3),
                new OverscaledTileID(3, 0, 3, 2, 4),
                new OverscaledTileID(3, 0, 3, 5, 3),
                new OverscaledTileID(3, 0, 3, 5, 4)
            ]);
        });
    
        test('pitched', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.002, 0.001));
            state = cameraUpdates.setZoom(state, context, 8);
            state = cameraUpdates.setMaxPitch(state, 80);
            state = cameraUpdates.setPitch(state, 80);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(6, 0, 6, 32, 31),
                new OverscaledTileID(6, 0, 6, 31, 31),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512),
                new OverscaledTileID(10, 0, 10, 511, 513),
                new OverscaledTileID(10, 0, 10, 512, 513),
            ]);
        });

        test('pitched+rotated', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.002, 0.001));
            state = cameraUpdates.setZoom(state, context, 8);
            state = cameraUpdates.setMaxPitch(state, 80);
            state = cameraUpdates.setPitch(state, 80);
            state = cameraUpdates.setBearing(state, 45);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(7, 0, 7, 64, 64),
                new OverscaledTileID(7, 0, 7, 64, 63),
                new OverscaledTileID(7, 0, 7, 63, 63),
                new OverscaledTileID(10, 0, 10, 510, 512),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 511, 513)
            ]);
        });
    
        test('tile zoom stays at the nominal zoom for a distant pitched camera', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 2560, 1265);
            state = cameraUpdates.setCenter(state, context, new LngLat(-140, -52));
            state = cameraUpdates.setZoom(state, context, 5.66);
            state = cameraUpdates.setMaxPitch(state, 60);
            state = cameraUpdates.setPitch(state, 60);
            state = cameraUpdates.setFov(state, 15);

            const tiles = coveringTiles(projectCamera(state, projection), projection, {tileSize: 512});
            const nominalZ = coveringZoomLevel(projectCamera(state, projection), {tileSize: 512});
            const levels = tiles.map(tile => tile.canonical.z);

            expect(nominalZ).toBe(5);
            expect(Math.max(...levels)).toBeLessThanOrEqual(nominalZ + 1);
            expect(Math.min(...levels)).toBeLessThanOrEqual(nominalZ);
        });

        test('tile zoom stays at the nominal zoom for a distant camera with a narrow field of view', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 2560, 1265);
            state = cameraUpdates.setCenter(state, context, new LngLat(-140, 0));
            state = cameraUpdates.setZoom(state, context, 5.5);
            state = cameraUpdates.setMaxPitch(state, 60);
            state = cameraUpdates.setPitch(state, 15);
            state = cameraUpdates.setFov(state, 5);

            const tiles = coveringTiles(projectCamera(state, projection), projection, {tileSize: 512});
            const nominalZ = coveringZoomLevel(projectCamera(state, projection), {tileSize: 512});
            const levels = tiles.map(tile => tile.canonical.z);

            expect(nominalZ).toBe(5);
            expect(Math.max(...levels)).toBeLessThanOrEqual(nominalZ + 1);
            expect(Math.min(...levels)).toBeLessThanOrEqual(nominalZ);
        });

        test('antimeridian1', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(179.99, -0.001));
            state = cameraUpdates.setZoom(state, context, 5);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(5, 0, 5, 31, 16),
                new OverscaledTileID(5, 0, 5, 31, 15),
                new OverscaledTileID(5, 1, 5, 0, 16),
                new OverscaledTileID(5, 1, 5, 0, 15),
            ]);
        });
    
        test('antimeridian2', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.99, 0.001));
            state = cameraUpdates.setZoom(state, context, 5);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(5, 0, 5, 0, 15),
                new OverscaledTileID(5, 0, 5, 0, 16),
                new OverscaledTileID(5, -1, 5, 31, 15),
                new OverscaledTileID(5, -1, 5, 31, 16),
            ]);
        });
    
        test('zoom < 0', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setCenter(state, context, new LngLat(0.0, 80.0));
            state = cameraUpdates.setZoom(state, context, -0.5);
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 0,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(0, 0, 0, 0, 0)
            ]);
        });

        test('zoom = 11', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setPitch(state, 0);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.73, -0.087));
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 15,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(11, 0, 11, 1, 1024)
            ]);
        });
        
        test('zoom = 11, mid lat', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setPitch(state, 0);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.73, 60.02));
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 15,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(11, 0, 11, 1, 594)
            ]);
        });
        
        test('zoom = 11, high lat', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setPitch(state, 0);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.73, 85.028));
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 15,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(11, 0, 11, 1, 1)
            ]);
        });

        test('zoom = 11, mid lat, mid lng', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setPitch(state, 0);
            state = cameraUpdates.setCenter(state, context, new LngLat(-58.97, 60.02));
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 15,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(11, 0, 11, 688, 594)
            ]);
        });
        
        test('zoom = 11, mid lng', () => {
            const projection = createGlobeCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState();
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setPitch(state, 0);
            state = cameraUpdates.setCenter(state, context, new LngLat(-58.97, -0.087));
    
            const tiles = coveringTiles(projectCamera(state, projection), projection, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 15,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(11, 0, 11, 688, 1024)
            ]);
        });

        describe('nonzero center elevation', () => {
            test('looking down', () => {
                const options = {
                    minzoom: 1,
                    maxzoom: 15,
                    tileSize: 512,
                    reparseOverscaled: true
                };

                const projection = createGlobeCameraProjection();
                const context: CameraContext = {projection, constrainOverride: null};
                let state = createCameraState();
                state = cameraUpdates.resize(state, context, 128, 128);
                state = cameraUpdates.setZoom(state, context, 11);
                state = cameraUpdates.setCenter(state, context, new LngLat(0.021, 0.0915));
                state = cameraUpdates.setElevation(state, context, 20000);

                expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                    new OverscaledTileID(11, 0, 11, 1024, 1023),
                    new OverscaledTileID(10, 0, 10, 511, 511),
                ]);
            });

            describe('high pitch', () => {

                test('bearing 0', () => {
                    const options = {
                        minzoom: 1,
                        maxzoom: 15,
                        tileSize: 512,
                        reparseOverscaled: true
                    };

                    const projection = createGlobeCameraProjection();
                    const context: CameraContext = {projection, constrainOverride: null};
                    let state = createCameraState();
                    state = cameraUpdates.resize(state, context, 128, 128);
                    state = cameraUpdates.setZoom(state, context, 11);
                    state = cameraUpdates.setPitch(state, 70);
                    state = cameraUpdates.setBearing(state, 0);
                    state = cameraUpdates.setCenter(state, context, new LngLat(0.021, 0.0915));
                    state = cameraUpdates.setElevation(state, context, 20000);

                    expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                        new OverscaledTileID(11, 0, 11, 1023, 1023),
                        new OverscaledTileID(11, 0, 11, 1024, 1022),
                        new OverscaledTileID(11, 0, 11, 1023, 1022),
                        new OverscaledTileID(12, 0, 12, 2048, 2046),
                        new OverscaledTileID(12, 0, 12, 2048, 2047),
                    ]);
                });

                test('bearing 90', () => {
                    const options = {
                        minzoom: 1,
                        maxzoom: 15,
                        tileSize: 512,
                        reparseOverscaled: true
                    };

                    const projection = createGlobeCameraProjection();
                    const context: CameraContext = {projection, constrainOverride: null};
                    let state = createCameraState();
                    state = cameraUpdates.resize(state, context, 128, 128);
                    state = cameraUpdates.setZoom(state, context, 11);
                    state = cameraUpdates.setPitch(state, 70);
                    state = cameraUpdates.setBearing(state, 90);
                    state = cameraUpdates.setCenter(state, context, new LngLat(0.021, 0.0915));
                    state = cameraUpdates.setElevation(state, context, 20000);

                    expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                        new OverscaledTileID(11, 0, 11, 1024, 1023),
                        new OverscaledTileID(9, 0, 9, 256, 256),
                        new OverscaledTileID(12, 0, 12, 2047, 2046),
                        new OverscaledTileID(12, 0, 12, 2047, 2047),
                    ]);
                });

                test('bearing 180', () => {
                    const options = {
                        minzoom: 1,
                        maxzoom: 15,
                        tileSize: 512,
                        reparseOverscaled: true
                    };

                    const projection = createGlobeCameraProjection();
                    const context: CameraContext = {projection, constrainOverride: null};
                    let state = createCameraState();
                    state = cameraUpdates.resize(state, context, 128, 128);
                    state = cameraUpdates.setZoom(state, context, 11);
                    state = cameraUpdates.setPitch(state, 70);
                    state = cameraUpdates.setBearing(state, 180);
                    state = cameraUpdates.setCenter(state, context, new LngLat(0.021, 0.0915));
                    state = cameraUpdates.setElevation(state, context, 20000);

                    expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                        new OverscaledTileID(11, 0, 11, 1023, 1023),
                        new OverscaledTileID(8, 0, 8, 128, 128),
                        new OverscaledTileID(8, 0, 8, 127, 128),
                        new OverscaledTileID(12, 0, 12, 2048, 2046),
                        new OverscaledTileID(12, 0, 12, 2048, 2047),
                    ]);
                });

                test('bearing 270', () => {
                    const options = {
                        minzoom: 1,
                        maxzoom: 15,
                        tileSize: 512,
                        reparseOverscaled: true
                    };

                    const projection = createGlobeCameraProjection();
                    const context: CameraContext = {projection, constrainOverride: null};
                    let state = createCameraState();
                    state = cameraUpdates.resize(state, context, 128, 128);
                    state = cameraUpdates.setZoom(state, context, 11);
                    state = cameraUpdates.setPitch(state, 70);
                    state = cameraUpdates.setBearing(state, 270);
                    state = cameraUpdates.setCenter(state, context, new LngLat(0.021, 0.0915));
                    state = cameraUpdates.setElevation(state, context, 20000);

                    expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                        new OverscaledTileID(10, 0, 10, 511, 511),
                        new OverscaledTileID(9, 0, 9, 255, 256),
                        new OverscaledTileID(12, 0, 12, 2048, 2046),
                        new OverscaledTileID(12, 0, 12, 2048, 2047),
                    ]);
                });
            });
        });
    });

    describe('mercator', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };
    
        const projection = createMercatorCameraProjection();
        const context: CameraContext = {projection, constrainOverride: null};
        let state = createCameraState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        state = cameraUpdates.resize(state, context, 200, 200);
    
        test('general', () => {
    
            // make slightly off center so that sort order is not subject to precision issues
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.01, 0.01));
    
            state = cameraUpdates.setZoom(state, context, 0);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([]);
    
            state = cameraUpdates.setZoom(state, context, 1);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, 0, 1, 1, 1)]);
    
            state = cameraUpdates.setZoom(state, context, 2.4);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(2, 0, 2, 1, 1),
                new OverscaledTileID(2, 0, 2, 2, 1),
                new OverscaledTileID(2, 0, 2, 1, 2),
                new OverscaledTileID(2, 0, 2, 2, 2)]);
    
            state = cameraUpdates.setZoom(state, context, 10);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);
    
            state = cameraUpdates.setZoom(state, context, 11);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);
    
            state = cameraUpdates.resize(state, context, 2048, 128);
            state = cameraUpdates.setZoom(state, context, 9);
            state = cameraUpdates.setPadding(state, context, {top: 16});
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(9, 0, 9, 255, 255),
                new OverscaledTileID(9, 0, 9, 256, 255),
                new OverscaledTileID(9, 0, 9, 255, 256),
                new OverscaledTileID(9, 0, 9, 256, 256),
                new OverscaledTileID(9, 0, 9, 254, 255),
                new OverscaledTileID(9, 0, 9, 254, 256),
                new OverscaledTileID(9, 0, 9, 257, 255),
                new OverscaledTileID(9, 0, 9, 257, 256),
                new OverscaledTileID(9, 0, 9, 253, 255),
                new OverscaledTileID(9, 0, 9, 253, 256)]);
    
            state = cameraUpdates.setPadding(state, context, {top: 0});
            state = cameraUpdates.setZoom(state, context, 5.1);
            state = cameraUpdates.setPitch(state, 60.0);
            state = cameraUpdates.setBearing(state, 32.0);
            state = cameraUpdates.setCenter(state, context, new LngLat(56.90, 48.20));
            state = cameraUpdates.resize(state, context, 1024, 768);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(5, 0, 5, 21, 11),
                new OverscaledTileID(5, 0, 5, 20, 11),
                new OverscaledTileID(5, 0, 5, 21, 10),
                new OverscaledTileID(5, 0, 5, 20, 10),
                new OverscaledTileID(5, 0, 5, 21, 12),
                new OverscaledTileID(5, 0, 5, 22, 11),
                new OverscaledTileID(5, 0, 5, 20, 12),
                new OverscaledTileID(5, 0, 5, 22, 10),
                new OverscaledTileID(5, 0, 5, 21, 9),
                new OverscaledTileID(5, 0, 5, 20, 9),
                new OverscaledTileID(5, 0, 5, 22, 9),
                new OverscaledTileID(5, 0, 5, 23, 10),
                new OverscaledTileID(5, 0, 5, 21, 8),
                new OverscaledTileID(5, 0, 5, 20, 8),
                new OverscaledTileID(5, 0, 5, 23, 9),
                new OverscaledTileID(5, 0, 5, 22, 8),
                new OverscaledTileID(5, 0, 5, 23, 8),
                new OverscaledTileID(5, 0, 5, 21, 7),
                new OverscaledTileID(5, 0, 5, 20, 7),
                new OverscaledTileID(5, 0, 5, 24, 9),
                new OverscaledTileID(5, 0, 5, 22, 7)
            ]);
    
            state = cameraUpdates.setZoom(state, context, 8);
            state = cameraUpdates.setPitch(state, 85.0);
            state = cameraUpdates.setBearing(state, 0.0);
            state = cameraUpdates.setCenter(state, context, new LngLat(20.918, 39.232));
            state = cameraUpdates.resize(state, context, 50, 1000);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(8, 0, 8, 142, 98),
                new OverscaledTileID(7, 0, 7, 71, 48),
                new OverscaledTileID(5, 0, 5, 17, 11),
                new OverscaledTileID(5, 0, 5, 17, 10),
                new OverscaledTileID(9, 0, 9, 285, 198),
                new OverscaledTileID(9, 0, 9, 285, 199)
            ]);
    
            state = cameraUpdates.setZoom(state, context, 8);
            state = cameraUpdates.setPitch(state, 60);
            state = cameraUpdates.setBearing(state, 45.0);
            state = cameraUpdates.setCenter(state, context, new LngLat(25.02, 60.15));
            state = cameraUpdates.resize(state, context, 300, 50);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(8, 0, 8, 145, 74),
                new OverscaledTileID(8, 0, 8, 145, 73),
                new OverscaledTileID(8, 0, 8, 146, 74)
            ]);
    
            state = cameraUpdates.resize(state, context, 50, 300);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(8, 0, 8, 145, 74),
                new OverscaledTileID(8, 0, 8, 145, 73),
                new OverscaledTileID(8, 0, 8, 146, 74),
                new OverscaledTileID(8, 0, 8, 146, 73)
            ]);
            
            const optionsWithCustomTileLoading = { 
                minzoom: 1,
                maxzoom: 10,
                tileSize: 512,
                calculateTileZoom: (_requestedCenterZoom: number,
                    _distanceToTile2D: number,
                    _distanceToTileZ: number,
                    _distanceToCenter3D: number,
                    _cameraVerticalFOV: number) => { return 7; }
            };
            state = cameraUpdates.resize(state, context, 50, 300);
            state = cameraUpdates.setPitch(state, 70);
            expect(coveringTiles(projectCamera(state, projection), projection, optionsWithCustomTileLoading)).toEqual([
                new OverscaledTileID(7, 0, 7, 74, 36),
                new OverscaledTileID(7, 0, 7, 73, 37),
                new OverscaledTileID(7, 0, 7, 74, 35),
                new OverscaledTileID(7, 0, 7, 73, 36),
                new OverscaledTileID(7, 0, 7, 72, 37),
                new OverscaledTileID(7, 0, 7, 73, 35),
                new OverscaledTileID(7, 0, 7, 72, 36)
            ]);
        });
    
        test('calculates tile coverage with low number of zoom levels and low tile count', () => {
        
            const optionsWithTileLodParams = { 
                minzoom: 1,
                maxzoom: 10,
                tileSize: 512,
                calculateTileZoom: createCalculateTileZoomFunction(1.0, 1.0)
            };
            expect(coveringTiles(projectCamera(state, projection), projection, optionsWithTileLodParams)).toEqual([
                new OverscaledTileID(5, 0, 5, 18, 9),
                new OverscaledTileID(5, 0, 5, 18, 8)
            ]);
        });
    
        test('calculates tile coverage with low tile count', () => {
        
            const optionsWithTileLodParams = { 
                minzoom: 1,
                maxzoom: 10,
                tileSize: 512,
                calculateTileZoom: createCalculateTileZoomFunction(1.0, 10.0)
            };
            expect(coveringTiles(projectCamera(state, projection), projection, optionsWithTileLodParams)).toEqual([
                new OverscaledTileID(6, 0, 6, 37, 18),
                new OverscaledTileID(6, 0, 6, 37, 17),
                new OverscaledTileID(6, 0, 6, 36, 18),
                new OverscaledTileID(6, 0, 6, 36, 17)
            ]);
        });
    
        test('calculates tile coverage with low number of zoom levels', () => {
        
            const optionsWithTileLodParams = { 
                minzoom: 1,
                maxzoom: 10,
                tileSize: 512,
                calculateTileZoom: createCalculateTileZoomFunction(10.0, 1.0)
            };
            expect(coveringTiles(projectCamera(state, projection), projection, optionsWithTileLodParams)).toEqual([
                new OverscaledTileID(7, 0, 7, 73, 37),
                new OverscaledTileID(7, 0, 7, 73, 36),
                new OverscaledTileID(7, 0, 7, 72, 36),
                new OverscaledTileID(6, 0, 6, 37, 18),
                new OverscaledTileID(5, 0, 5, 18, 8),
                new OverscaledTileID(9, 0, 9, 290, 148),
                new OverscaledTileID(9, 0, 9, 291, 148)
            ]);
        });
    
        test('calculates tile coverage at w > 0', () => {
            state = cameraUpdates.setZoom(state, context, 2);
            state = cameraUpdates.setPitch(state, 0);
            state = cameraUpdates.setBearing(state, 0);
            state = cameraUpdates.resize(state, context, 300, 300);
            state = cameraUpdates.setCenter(state, context, new LngLat(630.01, 0.01));
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
        });
    
        test('calculates tile coverage at w = -1', () => {
            state = cameraUpdates.setCenter(state, context, new LngLat(-360.01, 0.01));
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
        });
    
        test('calculates tile coverage across meridian', () => {
            state = cameraUpdates.setZoom(state, context, 1);
            state = cameraUpdates.setCenter(state, context, new LngLat(-180.01, 0.01));
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, -1, 1, 1, 1)
            ]);
        });
    
        test('only includes tiles for a single world, if renderWorldCopies is set to false', () => {
            state = cameraUpdates.setZoom(state, context, 1);
            state = cameraUpdates.setCenter(state, context, new LngLat(-180.01, 0.01));
            state = cameraUpdates.setRenderWorldCopies(state, projection.worldCoordinateHelper, false);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
        });

        test('only includes tiles for a single world over a non-wrapping CRS, even where a pitched view sees past its edge', () => {
            const projection = createMercatorCameraProjection(new CRSWorldCoordinateHelper(identityCrs));
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 512, 512);
            state = cameraUpdates.setZoom(state, context, 1);
            state = cameraUpdates.setPitch(state, 60);
            state = cameraUpdates.setCenter(state, context, new LngLat(80, 0));
            const tiles = coveringTiles(projectCamera(state, projection), projection, options);
            expect(tiles.length).toBeGreaterThan(0);
            expect(tiles.every((tileID) => tileID.wrap === 0)).toBe(true);
        });
    
        test('overscaledZ', () => {
            const options = {
                minzoom: 1,
                maxzoom: 10,
                tileSize: 256,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 10, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 10, 400);
            // make slightly off center so that sort order is not subject to precision issues
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.01, 0.01));
            state = cameraUpdates.setPitch(state, 85);
            state = cameraUpdates.setFov(state, 10);
        
            state = cameraUpdates.setZoom(state, context, 10);
            const tiles = coveringTiles(projectCamera(state, projection), projection, options);
            for (const tile of tiles) {
                expect(tile.overscaledZ).toBeGreaterThanOrEqual(tile.canonical.z);
            }
        });
    
        test('maxzoom-0', () => {
            const options = {
                minzoom: 0,
                maxzoom: 0,
                tileSize: 512
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 0, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 200, 200);
            state = cameraUpdates.setCenter(state, context, new LngLat(0.01, 0.01));
            state = cameraUpdates.setZoom(state, context, 8);
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(0, 0, 0, 0, 0)
            ]);
        });
        
        test('z11', () => {
            const options = {
                minzoom: 1,
                maxzoom: 15,
                tileSize: 512,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.73, -0.087));
        
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 1, 1024)
            ]);
        });
        
        test('z11, mid lat', () => {
            const options = {
                minzoom: 1,
                maxzoom: 15,
                tileSize: 512,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.73, 60.02));
        
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 1, 594)
            ]);
        });
        
        test('z11, high lat', () => {
            const options = {
                minzoom: 1,
                maxzoom: 15,
                tileSize: 512,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setCenter(state, context, new LngLat(-179.73, 85.028));
        
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 1, 1)
            ]);
        });

        test('z11, mid lat, mid lng', () => {
            const options = {
                minzoom: 1,
                maxzoom: 15,
                tileSize: 512,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setCenter(state, context, new LngLat(-58.97, 60.02));
        
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 688, 594)
            ]);
        });

        test('z11, low lat, mid lng', () => {
            const options = {
                minzoom: 1,
                maxzoom: 15,
                tileSize: 512,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setCenter(state, context, new LngLat(-58.97, -0.087));
        
            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 688, 1024)
            ]);
        });

        test('nonzero center elevation', () => {
            const options = {
                minzoom: 1,
                maxzoom: 15,
                tileSize: 512,
                reparseOverscaled: true
            };
        
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            state = cameraUpdates.resize(state, context, 128, 128);
            state = cameraUpdates.setZoom(state, context, 11);
            state = cameraUpdates.setCenter(state, context, new LngLat(0.03, 0.0915));
            state = cameraUpdates.setElevation(state, context, 20000);

            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 1024, 1023),
                new OverscaledTileID(11, 0, 11, 1023, 1023)
            ]);
        });
    
    });

    describe('planar CRS (identity projection)', () => {
        const options = {
            minzoom: 0,
            maxzoom: 10,
            tileSize: 512
        };

        test('covers the root tile at zoom 0', () => {
            let {state, context} = createIdentityCrsCamera(200, 200);
            const {projection} = context;
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.01, 0.01));
            state = cameraUpdates.setZoom(state, context, 0);

            expect(coveringTiles(projectCamera(state, projection), projection, options)).toEqual([new OverscaledTileID(0, 0, 0, 0, 0)]);
        });

        test('covers the four children of the root tile at zoom 1 around the center of the square', () => {
            let {state, context} = createIdentityCrsCamera(200, 200);
            const {projection} = context;
            state = cameraUpdates.setCenter(state, context, new LngLat(-0.01, 0.01));
            state = cameraUpdates.setZoom(state, context, 1);

            const tiles = coveringTiles(projectCamera(state, projection), projection, options);

            expect(tiles).toHaveLength(4);
            for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                expect(tiles).toContainEqual(new OverscaledTileID(1, 0, 1, x, y));
            }
        });

        test('addresses tiles by the CRS grid, where lng/lat 45,45 is the top-right quadrant, not by mercator', () => {
            let {state, context} = createIdentityCrsCamera(200, 200);
            const {projection} = context;
            state = cameraUpdates.setCenter(state, context, new LngLat(45, 45));
            state = cameraUpdates.setZoom(state, context, 2.5);

            const tiles = coveringTiles(projectCamera(state, projection), projection, options);

            expect(tiles.every((tile) => tile.canonical.z === 2)).toBe(true);
            for (const [x, y] of [[2, 0], [3, 0], [2, 1], [3, 1]]) {
                expect(tiles).toContainEqual(new OverscaledTileID(2, 0, 2, x, y));
            }
        });

        test('never produces wrapped tiles at the edge of the square', () => {
            let {state, context} = createIdentityCrsCamera(1024, 200);
            const {projection} = context;
            state = cameraUpdates.setCenter(state, context, new LngLat(89, 0));
            state = cameraUpdates.setZoom(state, context, 2);
            const tiles = coveringTiles(projectCamera(state, projection), projection, options);
            expect(tiles.length).toBeGreaterThan(0);
            for (const tile of tiles) {
                expect(tile.wrap).toBe(0);
                expect(tile.canonical.x).toBeGreaterThanOrEqual(0);
                expect(tile.canonical.x).toBeLessThan(4);
            }
        });
    });
});

describe('coveringZoomLevel', () => {
    const projection = createMercatorCameraProjection();
    const context: CameraContext = {projection, constrainOverride: null};
    let state: CameraState;
    let options: CoveringTilesOptions;

    beforeEach(() => {
        state = createCameraState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        options = {
            tileSize: 512,
            roundZoom: false,
        };
    });

    test('zoom 0', () => {
        state = cameraUpdates.setZoom(state, context, 0);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(0);
    });

    test('small zoom should be floored to 0', () => {
        state = cameraUpdates.setZoom(state, context, 0.1);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(0);
    });

    test('zoom 2.7 should be floored to 2', () => {
        state = cameraUpdates.setZoom(state, context, 2.7);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(2);
    });

    test('zoom 0 for small tile size', () => {
        options.tileSize = 256;
        state = cameraUpdates.setZoom(state, context, 0);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(1);
    });

    test('zoom 0.1 for small tile size', () => {
        options.tileSize = 256;
        state = cameraUpdates.setZoom(state, context, 0.1);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(1);
    });

    test('zoom 1 for small tile size', () => {
        options.tileSize = 256;
        state = cameraUpdates.setZoom(state, context, 1);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(2);
    });

    test('zoom 2.4 for small tile size', () => {
        options.tileSize = 256;
        state = cameraUpdates.setZoom(state, context, 2.4);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(3);
    });

    test('zoom 11.5 with rounded setting and small tile size', () => {
        options.tileSize = 256;
        options.roundZoom = true;
        state = cameraUpdates.setZoom(state, context, 11.5);
        expect(coveringZoomLevel(projectCamera(state, projection), options)).toBe(13);
    });
});
