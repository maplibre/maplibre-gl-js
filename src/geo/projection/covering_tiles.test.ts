import {beforeEach, describe, expect, test} from 'vitest';
import {GlobeTransform} from './globe_transform';
import {LngLat} from '../lng_lat';
import {coveringTiles, coveringZoomLevel, createCalculateTileZoomFunction, type CoveringTilesOptions} from './covering_tiles';
import {OverscaledTileID} from '../../tile/tile_id';
import {MercatorTransform} from './mercator_transform';
import {globeConstants} from './vertical_perspective_projection';

describe('coveringTiles', () => {
    describe('globe', () => {

        beforeEach(() => {
            // Force faster animations so we can use shorter sleeps when testing them
            globeConstants.errorTransitionTimeSeconds = 0.1;
        });

        test('zoomed out', () => {
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(0.0, 0.0));
            transform.setZoom(-1);
    
            const tiles = coveringTiles(transform, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(0, 0, 0, 0, 0)
            ]);
        });
    
        test('zoomed in', () => {
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(-0.02, 0.01));
            transform.setZoom(3);
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(512, 512);
            transform.setCenter(new LngLat(-0.02, 0.01));
            transform.setZoom(3);
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(-0.002, 0.001));
            transform.setZoom(8);
            transform.setMaxPitch(80);
            transform.setPitch(80);
    
            const tiles = coveringTiles(transform, {
                tileSize: 512,
            });
    
            expect(tiles).toEqual([
                new OverscaledTileID(6, 0, 6, 32, 31),
                new OverscaledTileID(6, 0, 6, 31, 31),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512),
            ]);
        });
    
        test('pitched+rotated', () => {
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(-0.002, 0.001));
            transform.setZoom(8);
            transform.setMaxPitch(80);
            transform.setPitch(80);
            transform.setBearing(45);
    
            const tiles = coveringTiles(transform, {
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
    
        test('antimeridian1', () => {
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(179.99, -0.001));
            transform.setZoom(5);
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(-179.99, 0.001));
            transform.setZoom(5);
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setCenter(new LngLat(0.0, 80.0));
            transform.setZoom(-0.5);
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setPitch(0);
            transform.setCenter(new LngLat(-179.73, -0.087));
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setPitch(0);
            transform.setCenter(new LngLat(-179.73, 60.02));
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setPitch(0);
            transform.setCenter(new LngLat(-179.73, 85.028));
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setPitch(0);
            transform.setCenter(new LngLat(-58.97, 60.02));
    
            const tiles = coveringTiles(transform, {
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
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setPitch(0);
            transform.setCenter(new LngLat(-58.97, -0.087));
    
            const tiles = coveringTiles(transform, {
                tileSize: 512,
                minzoom: 0,
                maxzoom: 15,
                reparseOverscaled: true
            });
    
            expect(tiles).toEqual([
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
        
            const transform = new GlobeTransform();
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(0.021, 0.0915));
            transform.setElevation(20000);

            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 1024, 1023),
                new OverscaledTileID(11, 0, 11, 1023, 1023)
            ]);
        });
    });

    describe('mercator', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };
    
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(200, 200);
    
        test('general', () => {
    
            // make slightly off center so that sort order is not subject to precision issues
            transform.setCenter(new LngLat(-0.01, 0.01));
    
            transform.setZoom(0);
            expect(coveringTiles(transform, options)).toEqual([]);
    
            transform.setZoom(1);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, 0, 1, 1, 1)]);
    
            transform.setZoom(2.4);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(2, 0, 2, 1, 1),
                new OverscaledTileID(2, 0, 2, 2, 1),
                new OverscaledTileID(2, 0, 2, 1, 2),
                new OverscaledTileID(2, 0, 2, 2, 2)]);
    
            transform.setZoom(10);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);
    
            transform.setZoom(11);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);
    
            transform.resize(2048, 128);
            transform.setZoom(9);
            transform.setPadding({top: 16});
            expect(coveringTiles(transform, options)).toEqual([
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
    
            transform.setPadding({top: 0});
            transform.setZoom(5.1);
            transform.setPitch(60.0);
            transform.setBearing(32.0);
            transform.setCenter(new LngLat(56.90, 48.20));
            transform.resize(1024, 768);
            expect(coveringTiles(transform, options)).toEqual([
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
    
            transform.setZoom(8);
            transform.setPitch(85.0);
            transform.setBearing(0.0);
            transform.setCenter(new LngLat(20.918, 39.232));
            transform.resize(50, 1000);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(8, 0, 8, 142, 98),
                new OverscaledTileID(7, 0, 7, 71, 48),
                new OverscaledTileID(5, 0, 5, 17, 11),
                new OverscaledTileID(5, 0, 5, 17, 10),
                new OverscaledTileID(9, 0, 9, 285, 198),
                new OverscaledTileID(9, 0, 9, 285, 199)
            ]);
    
            transform.setZoom(8);
            transform.setPitch(60);
            transform.setBearing(45.0);
            transform.setCenter(new LngLat(25.02, 60.15));
            transform.resize(300, 50);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(8, 0, 8, 145, 74),
                new OverscaledTileID(8, 0, 8, 145, 73),
                new OverscaledTileID(8, 0, 8, 146, 74)
            ]);
    
            transform.resize(50, 300);
            expect(coveringTiles(transform, options)).toEqual([
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
            transform.resize(50, 300);
            transform.setPitch(70);
            expect(coveringTiles(transform, optionsWithCustomTileLoading)).toEqual([
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
            expect(coveringTiles(transform, optionsWithTileLodParams)).toEqual([
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
            expect(coveringTiles(transform, optionsWithTileLodParams)).toEqual([
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
            expect(coveringTiles(transform, optionsWithTileLodParams)).toEqual([
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
            transform.setZoom(2);
            transform.setPitch(0);
            transform.setBearing(0);
            transform.resize(300, 300);
            transform.setCenter(new LngLat(630.01, 0.01));
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
        });
    
        test('calculates tile coverage at w = -1', () => {
            transform.setCenter(new LngLat(-360.01, 0.01));
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
        });
    
        test('calculates tile coverage across meridian', () => {
            transform.setZoom(1);
            transform.setCenter(new LngLat(-180.01, 0.01));
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, -1, 1, 1, 1)
            ]);
        });
    
        test('only includes tiles for a single world, if renderWorldCopies is set to false', () => {
            transform.setZoom(1);
            transform.setCenter(new LngLat(-180.01, 0.01));
            transform.setRenderWorldCopies(false);
            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
        });
    
        test('overscaledZ', () => {
            const options = {
                minzoom: 1,
                maxzoom: 10,
                tileSize: 256,
                reparseOverscaled: true
            };
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 10, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(10, 400);
            // make slightly off center so that sort order is not subject to precision issues
            transform.setCenter(new LngLat(-0.01, 0.01));
            transform.setPitch(85);
            transform.setFov(10);
        
            transform.setZoom(10);
            const tiles = coveringTiles(transform, options);
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 0, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
            transform.resize(200, 200);
            transform.setCenter(new LngLat(0.01, 0.01));
            transform.setZoom(8);
            expect(coveringTiles(transform, options)).toEqual([
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(-179.73, -0.087));
        
            expect(coveringTiles(transform, options)).toEqual([
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(-179.73, 60.02));
        
            expect(coveringTiles(transform, options)).toEqual([
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(-179.73, 85.028));
        
            expect(coveringTiles(transform, options)).toEqual([
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(-58.97, 60.02));
        
            expect(coveringTiles(transform, options)).toEqual([
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(-58.97, -0.087));
        
            expect(coveringTiles(transform, options)).toEqual([
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
        
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 15, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
            transform.resize(128, 128);
            transform.setZoom(11);
            transform.setCenter(new LngLat(0.03, 0.0915));
            transform.setElevation(20000);

            expect(coveringTiles(transform, options)).toEqual([
                new OverscaledTileID(11, 0, 11, 1024, 1023),
                new OverscaledTileID(11, 0, 11, 1023, 1023)
            ]);
        });
    
    });
});

describe('coveringZoomLevel', () => {
    let transform: MercatorTransform;
    let options: CoveringTilesOptions;

    beforeEach(() => {
        transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        options = {
            tileSize: 512,
            roundZoom: false,
        };
    });

    test('zoom 0', () => {
        transform.setZoom(0);
        expect(coveringZoomLevel(transform, options)).toBe(0);
    });

    test('small zoom should be floored to 0', () => {
        transform.setZoom(0.1);
        expect(coveringZoomLevel(transform, options)).toBe(0);
    });

    test('zoom 2.7 should be floored to 2', () => {
        transform.setZoom(2.7);
        expect(coveringZoomLevel(transform, options)).toBe(2);
    });

    test('zoom 0 for small tile size', () => {
        options.tileSize = 256;
        transform.setZoom(0);
        expect(coveringZoomLevel(transform, options)).toBe(1);
    });

    test('zoom 0.1 for small tile size', () => {
        options.tileSize = 256;
        transform.setZoom(0.1);
        expect(coveringZoomLevel(transform, options)).toBe(1);
    });

    test('zoom 1 for small tile size', () => {
        options.tileSize = 256;
        transform.setZoom(1);
        expect(coveringZoomLevel(transform, options)).toBe(2);
    });

    test('zoom 2.4 for small tile size', () => {
        options.tileSize = 256;
        transform.setZoom(2.4);
        expect(coveringZoomLevel(transform, options)).toBe(3);
    });

    test('zoom 11.5 with rounded setting and small tile size', () => {
        options.tileSize = 256;
        options.roundZoom = true;
        transform.setZoom(11.5);
        expect(coveringZoomLevel(transform, options)).toBe(13);
    });
});