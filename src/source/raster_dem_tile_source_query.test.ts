import {describe, test, expect} from 'vitest';
import {RasterDEMTileSource} from './raster_dem_tile_source';
import {OverscaledTileID} from '../tile/tile_id';
import {DEMData} from '../data/dem_data';
import {RGBAImage} from '../util/image';
import {RequestManager} from '../util/request_manager';

/**
 * Create a DEMData with a uniform elevation value.
 * The DEM tile has `dim x dim` inner pixels (stride = dim+2 due to 1px border).
 * We use 'custom' encoding with redFactor=1, greenFactor=0, blueFactor=0, baseShift=0
 * so that elevation = R channel value.
 */
function createUniformDEM(dim: number, elevation: number): DEMData {
    const stride = dim + 2;
    const pixels = new Uint8Array(stride * stride * 4);
    const r = Math.round(elevation);
    for (let i = 0; i < stride * stride; i++) {
        pixels[i * 4] = r;       // R
        pixels[i * 4 + 1] = 0;   // G
        pixels[i * 4 + 2] = 0;   // B
        pixels[i * 4 + 3] = 255; // A
    }
    const image = new RGBAImage({width: stride, height: stride}, pixels);
    return new DEMData('test', image, 'custom', 1.0, 0.0, 0.0, 0.0);
}

/**
 * Create a DEMData with a gradient: elevation increases linearly from west to east.
 * At x=0: elevation = minElev, at x=dim-1: elevation = maxElev.
 * Uses 'custom' encoding: elevation = R value.
 */
function createGradientDEM(dim: number, minElev: number, maxElev: number): DEMData {
    const stride = dim + 2;
    const pixels = new Uint8Array(stride * stride * 4);
    for (let py = 0; py < stride; py++) {
        for (let px = 0; px < stride; px++) {
            // Inner pixel coords (clamped to [0, dim-1] for border)
            const innerX = Math.max(0, Math.min(dim - 1, px - 1));
            const frac = dim > 1 ? innerX / (dim - 1) : 0;
            const elev = Math.round(minElev + frac * (maxElev - minElev));
            const i = (py * stride + px) * 4;
            pixels[i] = elev;     // R
            pixels[i + 1] = 0;   // G
            pixels[i + 2] = 0;   // B
            pixels[i + 3] = 255; // A
        }
    }
    const image = new RGBAImage({width: stride, height: stride}, pixels);
    return new DEMData('test', image, 'custom', 1.0, 0.0, 0.0, 0.0);
}

function createMockSource(options: {
    tiles: Array<{z: number; x: number; y: number; dem: DEMData}>;
    minzoom?: number;
    maxzoom?: number;
}): RasterDEMTileSource {
    const source = new RasterDEMTileSource('test-dem', {
        type: 'raster-dem',
        tiles: ['http://example.com/{z}/{x}/{y}.png'],
        minzoom: options.minzoom ?? 0,
        maxzoom: options.maxzoom ?? 14
    }, {} as any, {} as any);

    // Mock map and tile manager: store tiles by their OverscaledTileID key
    const tilesByKey = new Map<string, any>();

    for (const t of options.tiles) {
        const tileID = new OverscaledTileID(t.z, 0, t.z, t.x, t.y);
        const tile = {
            tileID,
            dem: t.dem,
            state: 'loaded' as const
        };
        tilesByKey.set(tileID.key, tile);
    }

    const tileManager = {
        getAnyTileByID: (key: string) => tilesByKey.get(key)
    };

    source.map = {
        style: {
            tileManagers: {
                'test-dem': tileManager
            }
        },
        _requestManager: new RequestManager()
    } as any;

    // Set source zoom bounds from options
    source.minzoom = options.minzoom ?? 0;
    source.maxzoom = options.maxzoom ?? 14;

    return source;
}

describe('RasterDEMTileSource#queryElevations', () => {
    test('returns null when no tiles are loaded', () => {
        const source = createMockSource({tiles: []});
        const results = source.queryElevations([[0, 0]]);
        expect(results).toEqual([null]);
    });

    test('returns elevation from a loaded tile', () => {
        // Tile 0/0/0 covers the entire world
        const dem = createUniformDEM(4, 100);
        const source = createMockSource({
            tiles: [{z: 0, x: 0, y: 0, dem}],
            maxzoom: 0
        });

        const results = source.queryElevations([[0, 0]]);
        expect(results).toHaveLength(1);
        expect(results[0]).not.toBeNull();
        expect(results[0].elevation).toBeCloseTo(100, 0);
        expect(results[0].tileZoom).toBe(0);
    });

    test('returns multiple results for multiple coordinates', () => {
        const dem = createUniformDEM(4, 200);
        const source = createMockSource({
            tiles: [{z: 0, x: 0, y: 0, dem}],
            maxzoom: 0
        });

        const results = source.queryElevations([
            [0, 0],
            [90, 45],
            [-90, -45]
        ]);
        expect(results).toHaveLength(3);
        for (const r of results) {
            expect(r).not.toBeNull();
            expect(r.elevation).toBeCloseTo(200, 0);
        }
    });

    test('prefers higher-zoom tiles', () => {
        const demZ0 = createUniformDEM(4, 50);
        const demZ2 = createUniformDEM(4, 200);

        // z2 tile 0/0 covers lon [-180, -90], lat [~85, ~66]
        // Point at lon=-135 lat=80 falls in z2 tile 0/0
        const source = createMockSource({
            tiles: [
                {z: 0, x: 0, y: 0, dem: demZ0},
                {z: 2, x: 0, y: 0, dem: demZ2}
            ],
            maxzoom: 2
        });

        // lon=-135, lat=80 => mercX ~ 0.125, mercY ~ 0.065
        // At z2: tileX = floor(0.125*4)=0, tileY = floor(0.065*4)=0 → tile 2/0/0
        const results = source.queryElevations([[-135, 80]]);
        expect(results[0]).not.toBeNull();
        expect(results[0].elevation).toBeCloseTo(200, 0);
        expect(results[0].tileZoom).toBe(2);
    });

    test('falls back to lower-zoom tile when higher zoom not loaded', () => {
        const demZ0 = createUniformDEM(4, 100);

        const source = createMockSource({
            tiles: [{z: 0, x: 0, y: 0, dem: demZ0}],
            maxzoom: 10  // source supports up to z10, but only z0 is loaded
        });

        const results = source.queryElevations([[10, 45]]);
        expect(results[0]).not.toBeNull();
        expect(results[0].elevation).toBeCloseTo(100, 0);
        expect(results[0].tileZoom).toBe(0);
    });

    test('returns null for coordinates outside loaded tile coverage', () => {
        // Only tile 2/3/1 is loaded (a specific quadrant)
        const dem = createUniformDEM(4, 300);
        const source = createMockSource({
            tiles: [{z: 2, x: 3, y: 1, dem}],
            minzoom: 2,
            maxzoom: 2
        });

        // This point falls in tile 2/0/1, not 2/3/1
        const results = source.queryElevations([[-135, 45]]);
        expect(results[0]).toBeNull();
    });

    test('handles bilinear interpolation with gradient DEM', () => {
        // Create a gradient DEM: elev 0 at west edge, 200 at east edge
        const dem = createGradientDEM(4, 0, 200);
        const source = createMockSource({
            tiles: [{z: 0, x: 0, y: 0, dem}],
            maxzoom: 0
        });

        // lon=0 is the center of the tile (mercX=0.5), so expect ~100
        const results = source.queryElevations([[0, 0]]);
        expect(results[0]).not.toBeNull();
        // The center of a 4-pixel gradient [0, 67, 133, 200] at fx=0.5
        // px = 0.5 * 4 = 2.0, so x0=2, tx=0 → exact pixel value at index 2 = 133
        expect(results[0].elevation).toBeCloseTo(133, 0);
    });

    test('throws when source is not added to a map', () => {
        const source = new RasterDEMTileSource('id', {
            type: 'raster-dem',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }, {} as any, {} as any);

        expect(() => source.queryElevations([[0, 0]])).toThrow('Source is not added to a map');
    });

    test('handles wrapped longitude values', () => {
        const dem = createUniformDEM(4, 150);
        const source = createMockSource({
            tiles: [{z: 0, x: 0, y: 0, dem}],
            maxzoom: 0
        });

        // lon=360 should wrap to lon=0
        const results = source.queryElevations([[360, 0]]);
        expect(results[0]).not.toBeNull();
        expect(results[0].elevation).toBeCloseTo(150, 0);
    });

    test('handles LngLat object input', () => {
        const dem = createUniformDEM(4, 175);
        const source = createMockSource({
            tiles: [{z: 0, x: 0, y: 0, dem}],
            maxzoom: 0
        });

        const results = source.queryElevations([{lng: 10, lat: 45}]);
        expect(results[0]).not.toBeNull();
        expect(results[0].elevation).toBeCloseTo(175, 0);
    });

    test('finds tile at specific canonical zoom via key lookup', () => {
        // Tile at z=3 with canonical coords 3/4/3
        // For raster-dem, overscaledZ always equals canonical z
        const dem = createUniformDEM(4, 120);

        const source = createMockSource({
            tiles: [{z: 3, x: 4, y: 3, dem}],
            minzoom: 0,
            maxzoom: 5
        });

        // canonical tile 3/4/3 covers:
        // x range [4/8, 5/8] = [0.5, 0.625], y range [3/8, 4/8] = [0.375, 0.5]
        // A point in the middle of this tile
        const mercX = 0.5625; // midpoint of [0.5, 0.625]
        const mercY = 0.4375; // midpoint of [0.375, 0.5]
        // Convert back to lng/lat
        const lng = mercX * 360 - 180; // = 22.5
        const lat = 360 / Math.PI * Math.atan(Math.exp((180 - mercY * 360) * Math.PI / 180)) - 90;

        const results = source.queryElevations([[lng, lat]]);
        expect(results[0]).not.toBeNull();
        expect(results[0].elevation).toBeCloseTo(120, 0);
        expect(results[0].tileZoom).toBe(3);
    });
});
