import {Texture} from './texture';
import type {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type ColorMode} from '../gl/color_mode';
import {
    colorReliefUniformValues
} from './program/color_relief_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {ColorReliefStyleLayer} from '../style/style_layer/color_relief_style_layer';
import type {OverscaledTileID} from '../tile/tile_id';

export function drawColorRelief(painter: Painter, tileManager: TileManager, layer: ColorReliefStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;
    if (!tileIDs.length) return;

    const {isRenderingToTexture} = renderOptions;
    const projection = painter.style.projection;
    const useSubdivision = projection.useSubdivision;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    // Globe (or any projection with subdivision) needs two-pass rendering to avoid artifacts when rendering texture tiles.
    // See comments in draw_raster.ts for more details.
    if (useSubdivision) {
        // Two-pass rendering
        const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
        renderColorRelief(painter, tileManager, layer, coords, stencilBorderless, depthMode, colorMode, false, isRenderingToTexture); // draw without borders
        renderColorRelief(painter, tileManager, layer, coords, stencilBorders, depthMode, colorMode, true, isRenderingToTexture); // draw with borders
    } else {
        // Simple rendering
        const [stencil, coords] = painter.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
        renderColorRelief(painter, tileManager, layer, coords, stencil, depthMode, colorMode, false, isRenderingToTexture);
    }
}

function renderColorRelief(
    painter: Painter,
    tileManager: TileManager,
    layer: ColorReliefStyleLayer,
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
    const program = painter.useProgram('colorRelief');
    const align = !painter.options.moving;

    let firstTile = true;
    let colorRampSize = 0;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const dem = tile.dem;
        if(firstTile) {
            const maxLength = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const {elevationTexture, colorTexture} = layer.getColorRampTextures(context, maxLength, dem.getUnpackVector());
            context.activeTexture.set(gl.TEXTURE1);
            elevationTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            context.activeTexture.set(gl.TEXTURE4);
            colorTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            firstTile = false;
            colorRampSize = elevationTexture.size[0];
        }

        if (!dem || !dem.data) {
            continue;
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
            colorReliefUniformValues(layer, tile.dem, colorRampSize), terrainData, projectionData, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}
