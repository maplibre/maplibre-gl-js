import {describe, test, expect, vi} from 'vitest';
import {Painter} from '../../render/painter.ts';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {MercatorProjection} from '../../geo/projection/mercator_projection.ts';
import {createNullGL} from '../../util/test/null_gl.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {LngLat} from '../../geo/lng_lat.ts';
import {drawRaster} from './draw_raster.ts';
import type {RasterStyleLayer} from '../../style/style_layer/raster_style_layer.ts';
import type {TileManager} from '../../tile/tile_manager.ts';

const paintValues = {
    'raster-opacity': 1,
    'raster-fade-duration': 0,
    'raster-brightness-min': 0,
    'raster-brightness-max': 1,
    'raster-saturation': 0,
    'raster-contrast': 0,
    'raster-hue-rotate': 0,
    'raster-resampling': 'linear',
    'resampling': 'linear',
};

function createSetup(options: {moving: boolean; rasterPixelAlignment: boolean}) {
    const gl = createNullGL();
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
    transform.resize(512, 512);
    // Put the camera on a fractional pixel so that the aligned and the unaligned matrix actually differ.
    transform.setCenter(new LngLat(0.0001234, 0.0004321));
    transform.setZoom(4);

    const painter = new Painter(gl, transform);
    painter.renderPass = 'translucent';
    painter.options = {
        showOverdrawInspector: false,
        showTileBoundaries: false,
        showPadding: false,
        rotating: false,
        zooming: false,
        moving: options.moving,
        rasterPixelAlignment: options.rasterPixelAlignment,
        fadeDuration: 0,
        anisotropicFilterPitch: 20,
    };
    painter.style = {
        projection: new MercatorProjection(),
        map: {terrain: null},
    } as any;
    vi.spyOn(painter, 'useProgram').mockReturnValue({draw: vi.fn()} as any);

    const tileID = new OverscaledTileID(4, 0, 4, 8, 8);
    const tile = {
        tileID,
        texture: {bind: () => {}, useMipmap: false},
    };
    const tileManager = {
        getSource: () => ({}),
        getTile: () => tile,
        getLoadedTile: () => null,
    } as any as TileManager;

    const layer = {
        id: 'raster',
        paint: {get: (name: string) => paintValues[name]},
    } as any as RasterStyleLayer;

    const getProjectionData = vi.spyOn(transform, 'getProjectionData');

    return {painter, tileManager, layer, tileID, getProjectionData};
}

function drawAndGetAlignedFlags(options: {moving: boolean; rasterPixelAlignment: boolean}): boolean[] {
    const {painter, tileManager, layer, tileID, getProjectionData} = createSetup(options);
    drawRaster(painter, tileManager, layer, [tileID], {isRenderingToTexture: false, isRenderingGlobe: false});
    expect(getProjectionData).toHaveBeenCalled();
    return getProjectionData.mock.calls.map(call => !!call[0].aligned);
}

describe('drawRaster pixel alignment', () => {
    test('requests the pixel-aligned matrix while the camera is idle', () => {
        expect(drawAndGetAlignedFlags({moving: false, rasterPixelAlignment: true})).not.toContain(false);
    });

    test('requests the unaligned matrix while the camera is moving', () => {
        expect(drawAndGetAlignedFlags({moving: true, rasterPixelAlignment: true})).not.toContain(true);
    });

    test('never requests the pixel-aligned matrix when rasterPixelAlignment is disabled', () => {
        expect(drawAndGetAlignedFlags({moving: false, rasterPixelAlignment: false})).not.toContain(true);
        expect(drawAndGetAlignedFlags({moving: true, rasterPixelAlignment: false})).not.toContain(true);
    });

    test('with rasterPixelAlignment disabled the matrix does not change when the camera starts moving', () => {
        const idle = createSetup({moving: false, rasterPixelAlignment: false});
        drawRaster(idle.painter, idle.tileManager, idle.layer, [idle.tileID], {isRenderingToTexture: false, isRenderingGlobe: false});
        const idleMatrix = Array.from(idle.getProjectionData.mock.results[0].value.mainMatrix);

        const moving = createSetup({moving: true, rasterPixelAlignment: false});
        drawRaster(moving.painter, moving.tileManager, moving.layer, [moving.tileID], {isRenderingToTexture: false, isRenderingGlobe: false});
        const movingMatrix = Array.from(moving.getProjectionData.mock.results[0].value.mainMatrix);

        expect(idleMatrix).toEqual(movingMatrix);
    });

    test('with rasterPixelAlignment enabled the matrix jumps when the camera starts moving', () => {
        const idle = createSetup({moving: false, rasterPixelAlignment: true});
        drawRaster(idle.painter, idle.tileManager, idle.layer, [idle.tileID], {isRenderingToTexture: false, isRenderingGlobe: false});
        const idleMatrix = Array.from(idle.getProjectionData.mock.results[0].value.mainMatrix);

        const moving = createSetup({moving: true, rasterPixelAlignment: true});
        drawRaster(moving.painter, moving.tileManager, moving.layer, [moving.tileID], {isRenderingToTexture: false, isRenderingGlobe: false});
        const movingMatrix = Array.from(moving.getProjectionData.mock.results[0].value.mainMatrix);

        expect(idleMatrix).not.toEqual(movingMatrix);
    });
});
