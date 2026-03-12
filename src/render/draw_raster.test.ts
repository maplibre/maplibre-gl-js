import {describe, test, expect, vi} from 'vitest';
import {OverscaledTileID} from '../tile/tile_id';
import {StencilMode} from '../gl/stencil_mode';
import {drawRaster} from './draw_raster';
import {createStyleLayer} from '../style/create_style_layer';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../style/evaluation_parameters';

describe('drawRaster', () => {
    function getTextureFilter(paintOverrides: {
        resampling?: 'nearest' | 'linear';
        'raster-resampling'?: 'nearest' | 'linear';
    }) {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const textureBind = vi.fn();

        const gl = {
            TEXTURE0: 33984,
            TEXTURE1: 33985,
            TEXTURE_2D: 3553,
            NEAREST: 9728,
            LINEAR: 9729,
            CLAMP_TO_EDGE: 33071,
            LINEAR_MIPMAP_NEAREST: 9985,
            TRIANGLES: 4,
            LESS: 513,
            texParameterf: vi.fn()
        } as any;

        const painter = {
            renderPass: 'translucent',
            context: {
                gl,
                activeTexture: {
                    set: vi.fn()
                }
            },
            style: {
                projection: {
                    useSubdivision: false,
                    getMeshFromTileID: vi.fn().mockReturnValue({
                        vertexBuffer: {},
                        indexBuffer: {},
                        segments: {}
                    })
                },
                map: {
                    terrain: null
                }
            },
            transform: {
                pitch: 0,
                getProjectionData: vi.fn().mockReturnValue({})
            },
            options: {
                moving: false,
                anisotropicFilterPitch: 20
            },
            useProgram: vi.fn().mockReturnValue({
                draw: vi.fn()
            }),
            colorModeForRenderPass: vi.fn().mockReturnValue({}),
            getDepthModeForSublayer: vi.fn().mockReturnValue({}),
            getStencilConfigForOverlapAndUpdateStencilID: vi.fn().mockReturnValue([
                {[tileID.overscaledZ]: StencilMode.disabled},
                [tileID]
            ])
        } as any;

        const tile = {
            tileID,
            texture: {
                bind: textureBind,
                useMipmap: false
            },
            timeAdded: 0,
            fadingParentID: null,
            selfFading: false,
            fadingDirection: null,
            fadeOpacity: 1
        } as any;

        const tileManager = {
            getSource: vi.fn().mockReturnValue({}),
            getTile: vi.fn().mockReturnValue(tile)
        } as any;

        const paint: LayerSpecification['paint'] = {
            'raster-opacity': 1,
            'raster-fade-duration': 0
        };
        if (paintOverrides.resampling !== undefined) {
            paint.resampling = paintOverrides.resampling;
        }
        if (paintOverrides['raster-resampling'] !== undefined) {
            paint['raster-resampling'] = paintOverrides['raster-resampling'];
        }

        const layer = createStyleLayer({
            id: 'raster-layer',
            type: 'raster',
            source: 'rasterSource',
            paint
        } as LayerSpecification, {});

        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, []);

        drawRaster(painter, tileManager, layer as any, [tileID], {isRenderingToTexture: false, isRenderingGlobe: false});

        expect(textureBind).toHaveBeenCalled();
        return {filter: textureBind.mock.calls[0][0], gl};
    }

    test.each([
        {
            caseNo: 1,
            rasterResampling: 'nearest' as const,
            resampling: undefined,
            expected: 'nearest' as const
        },
        {
            caseNo: 2,
            rasterResampling: 'linear' as const,
            resampling: undefined,
            expected: 'linear' as const
        },
        {
            caseNo: 3,
            rasterResampling: undefined,
            resampling: 'nearest' as const,
            expected: 'nearest' as const
        },
        {
            caseNo: 4,
            rasterResampling: undefined,
            resampling: 'linear' as const,
            expected: 'linear' as const
        }
    ])('case $caseNo: raster-resampling=$rasterResampling / resampling=$resampling => $expected', ({rasterResampling, resampling, expected}) => {
        const {filter, gl} = getTextureFilter({
            'raster-resampling': rasterResampling,
            resampling
        });

        const expectedFilter = expected === 'nearest' ? gl.NEAREST : gl.LINEAR;
        expect(filter).toBe(expectedFilter);
    });
});
