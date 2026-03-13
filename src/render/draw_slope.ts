import {Texture} from './texture';
import type {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type ColorMode} from '../gl/color_mode';
import {
    slopeUniformValues
} from './program/slope_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {SlopeStyleLayer} from '../style/style_layer/slope_style_layer';
import type {OverscaledTileID} from '../tile/tile_id';

export function drawSlope(painter: Painter, tileManager: TileManager, layer: SlopeStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;
    if (!tileIDs.length) return;

    const {isRenderingToTexture} = renderOptions;
    const projection = painter.style.projection;
    const useSubdivision = projection.useSubdivision;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    if (useSubdivision) {
        const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
        renderSlope(painter, tileManager, layer, coords, stencilBorderless, depthMode, colorMode, false, isRenderingToTexture);
        renderSlope(painter, tileManager, layer, coords, stencilBorders, depthMode, colorMode, true, isRenderingToTexture);
    } else {
        const [stencil, coords] = painter.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
        renderSlope(painter, tileManager, layer, coords, stencil, depthMode, colorMode, false, isRenderingToTexture);
    }
}

function renderSlope(
    painter: Painter,
    tileManager: TileManager,
    layer: SlopeStyleLayer,
    coords: Array<OverscaledTileID>,
    stencilModes: {[_: number]: Readonly<StencilMode>},
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    useBorder: boolean,
    isRenderingToTexture: boolean
) {
    const projection = painter.style.projection;
    const context = painter.context;
    const transform = painter.transform;
    const gl = context.gl;
    const program = painter.useProgram('slope');
    const align = !painter.options.moving;

    let firstTile = true;
    let colorRampSize = 0;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const dem = tile.dem;

        if (!dem || !dem.data) {
            continue;
        }

        if (firstTile) {
            const maxLength = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const {slopeTexture, colorTexture} = layer.getSlopeRampTextures(context, maxLength);
            context.activeTexture.set(gl.TEXTURE1);
            slopeTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            context.activeTexture.set(gl.TEXTURE4);
            colorTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            firstTile = false;
            colorRampSize = slopeTexture.size[0];
        }

        const textureStride = dem.stride;

        const pixelData = dem.getPixels();
        context.activeTexture.set(gl.TEXTURE0);

        context.pixelStoreUnpackPremultiplyAlpha.set(false);
        tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
        if (tile.demTexture) {
            const demTexture = tile.demTexture;
            demTexture.update(pixelData, {premultiply: false});
            demTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        } else {
            tile.demTexture = new Texture(context, pixelData, gl.RGBA, {premultiply: false});
            tile.demTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }

        const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder, true, 'raster');

        const terrainData = painter.style.map.terrain?.getTerrainData(coord);

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            aligned: align,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        program.draw(context, gl.TRIANGLES, depthMode, stencilModes[coord.overscaledZ], colorMode, CullFaceMode.backCCW,
            slopeUniformValues(layer, tile.dem, colorRampSize, coord, coord.overscaledZ), terrainData, projectionData, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}
