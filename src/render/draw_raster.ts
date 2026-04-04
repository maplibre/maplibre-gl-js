import {clamp} from '../util/util';

import {ImageSource} from '../source/image_source';
import {now} from '../util/time_control';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {ColorMode} from '../gl/color_mode';
import {rasterUniformValues} from './program/raster_program';
import {EXTENT} from '../data/extent';
import {FadingDirections} from '../tile/tile';
import Point from '@mapbox/point-geometry';
import {DrawableBuilder} from './drawable/drawable_builder';
import {TileLayerGroup} from './drawable/tile_layer_group';
import {RasterLayerTweaker} from './drawable/tweakers/raster_layer_tweaker';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {RasterStyleLayer} from '../style/style_layer/raster_style_layer';
import type {OverscaledTileID} from '../tile/tile_id';
import type {Tile} from '../tile/tile';

type FadeProperties = {
    parentTile: Tile;
    parentScaleBy: number;
    parentTopLeft: [number, number];
    fadeValues: FadeValues;
};

type FadeValues = {
    tileOpacity: number;
    parentTileOpacity?: number;
    fadeMix: { opacity: number; mix: number };
};

const cornerCoords = [
    new Point(0, 0),
    new Point(EXTENT, 0),
    new Point(EXTENT, EXTENT),
    new Point(0, EXTENT),
];

export function drawRaster(painter: Painter, tileManager: TileManager, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;
    if (!tileIDs.length) return;

    // Use drawable path for WebGPU
    if (painter.useDrawables && painter.useDrawables.has('raster')) {
        drawRasterDrawable(painter, tileManager, layer, tileIDs, renderOptions);
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    const source = tileManager.getSource();

    const projection = painter.style.projection;
    const useSubdivision = projection.useSubdivision;

    // When rendering globe (or any other subdivided projection), two passes are needed.
    // Subdivided tiles with different granularities might have tiny gaps between them.
    // To combat this, tile meshes for globe have a slight border region.
    // However tiles borders will overlap, and a part of a tile often
    // gets hidden by its neighbour's border, which displays an ugly stretched texture.
    // To both hide the border stretch and avoid tiny gaps, tiles are first drawn without borders (with gaps),
    // and then any missing pixels (gaps, not marked in stencil) get overdrawn with tile borders.
    // This approach also avoids pixel shader overdraw, as any pixel is drawn at most once.

    // Stencil mask and two-pass is not used for ImageSource sources regardless of projection.
    if (source instanceof ImageSource) {
        // Image source - no stencil is used
        drawTiles(painter, tileManager, layer, tileIDs, null, false, false, source.tileCoords, source.flippedWindingOrder, isRenderingToTexture);
    } else if (useSubdivision) {
        // Two-pass rendering
        const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
        drawTiles(painter, tileManager, layer, coords, stencilBorderless, false, true, cornerCoords, false, isRenderingToTexture); // draw without borders
        drawTiles(painter, tileManager, layer, coords, stencilBorders, true, true, cornerCoords, false, isRenderingToTexture); // draw with borders
    } else {
        // Simple rendering
        const [stencil, coords] = painter.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
        drawTiles(painter, tileManager, layer, coords, stencil, false, true, cornerCoords, false, isRenderingToTexture);
    }
}

function drawTiles(
    painter: Painter,
    tileManager: TileManager,
    layer: RasterStyleLayer,
    coords: Array<OverscaledTileID>,
    stencilModes: { [_: number]: Readonly<StencilMode> } | null,
    useBorder: boolean,
    allowPoles: boolean,
    corners: Array<Point>,
    flipCullfaceMode: boolean = false,
    isRenderingToTexture: boolean = false) {
    const minTileZ = coords[coords.length - 1].overscaledZ;

    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('raster');
    const transform = painter.transform;

    const projection = painter.style.projection;

    const colorMode = painter.colorModeForRenderPass();
    const align = !painter.options.moving;
    const rasterOpacity = layer.paint.get('raster-opacity');
    const rasterResampling = layer.paint.get('raster-resampling');
    const fadeDuration = layer.paint.get('raster-fade-duration');
    const isTerrain = !!painter.style.map.terrain;

    // Draw all tiles
    for (const coord of coords) {
        // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        // Use gl.LESS to prevent double drawing in areas where tiles overlap.
        const depthMode = painter.getDepthModeForSublayer(coord.overscaledZ - minTileZ,
            rasterOpacity === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

        const tile = tileManager.getTile(coord);
        const textureFilter = rasterResampling === 'nearest' ? gl.NEAREST : gl.LINEAR;

        // create and bind first texture
        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        // create second texture - use either the current tile or fade tile to bind second texture below
        context.activeTexture.set(gl.TEXTURE1);
        const {parentTile, parentScaleBy, parentTopLeft, fadeValues} = getFadeProperties(tile, tileManager, fadeDuration, isTerrain);
        tile.fadeOpacity = fadeValues.tileOpacity;
        if (parentTile) {
            parentTile.fadeOpacity = fadeValues.parentTileOpacity;
            parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        } else {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        }

        // Enable anisotropic filtering only when the pitch is greater than the threshold pitch.
        // The default threshold is 20 degrees to preserve image sharpness on flat or slightly tilted maps.
        if (tile.texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > painter.options.anisotropicFilterPitch) {
            gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
                context.extTextureFilterAnisotropicMax);
        }

        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const projectionData = transform.getProjectionData({overscaledTileID: coord, aligned: align, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});
        const uniformValues = rasterUniformValues(parentTopLeft, parentScaleBy, fadeValues.fadeMix, layer, corners);

        const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder, allowPoles, 'raster');
        const stencilMode = stencilModes ? stencilModes[coord.overscaledZ] : StencilMode.disabled;

        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, flipCullfaceMode ? CullFaceMode.frontCCW : CullFaceMode.backCCW,
            uniformValues as any, terrainData as any, projectionData as any, layer.id, mesh.vertexBuffer,
            mesh.indexBuffer, mesh.segments);
    }
}

/**
 * Get fade properties for current tile - either cross-fading or self-fading properties.
 */
function getFadeProperties(tile: Tile, tileManager: TileManager, fadeDuration: number, isTerrain: boolean): FadeProperties {
    const defaults: FadeProperties = {
        parentTile: null,
        parentScaleBy: 1,
        parentTopLeft: [0, 0],
        fadeValues: {tileOpacity: 1, parentTileOpacity: 1, fadeMix: {opacity: 1, mix: 0}}
    };

    if (fadeDuration === 0 || isTerrain) return defaults;

    // cross-fade with parent first if available
    if (tile.fadingParentID) {
        const parentTile = tileManager.getLoadedTile(tile.fadingParentID);
        if (!parentTile) return defaults;

        const parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
        const parentTopLeft: [number, number] = [
            (tile.tileID.canonical.x * parentScaleBy) % 1,
            (tile.tileID.canonical.y * parentScaleBy) % 1
        ];

        const fadeValues = getCrossFadeValues(tile, parentTile, fadeDuration);
        return {parentTile, parentScaleBy, parentTopLeft, fadeValues};
    }

    // self-fade for edge tiles
    if (tile.selfFading) {
        const fadeValues = getSelfFadeValues(tile, fadeDuration);
        return {parentTile: null, parentScaleBy: 1, parentTopLeft: [0, 0], fadeValues};
    }

    return defaults;
}

/**
 * Cross-fade values for a base tile with a parent tile (for zooming in/out)
 */
function getCrossFadeValues(tile: Tile, parentTile: Tile, fadeDuration: number): FadeValues {
    const currentTime = now();

    const timeSinceTile = (currentTime - tile.timeAdded) / fadeDuration;
    const timeSinceParent = (currentTime - parentTile.timeAdded) / fadeDuration;

    // get fading opacity based on current fade direction
    const doFadeIn = (tile.fadingDirection === FadingDirections.Incoming);
    const opacity1 = clamp(timeSinceTile, 0, 1);
    const opacity2 = clamp(1 - timeSinceParent, 0, 1);

    const tileOpacity = doFadeIn ? opacity1 : opacity2;
    const parentTileOpacity = doFadeIn ? opacity2 : opacity1;
    const fadeMix = {
        opacity: 1,
        mix: 1 - tileOpacity
    };

    return {tileOpacity, parentTileOpacity, fadeMix};
}

/**
 * Simple fade-in values for tile without a parent (i.e. edge tiles)
 */
function getSelfFadeValues(tile: Tile, fadeDuration: number): FadeValues {
    const currentTime = now();

    const timeSinceTile = (currentTime - tile.timeAdded) / fadeDuration;
    const tileOpacity = clamp(timeSinceTile, 0, 1);
    const fadeMix = {
        opacity: tileOpacity,
        mix: 0
    };

    return {tileOpacity, fadeMix};
}

/**
 * Drawable-based rendering path for raster layers.
 */
function drawRasterDrawable(painter: Painter, tileManager: TileManager, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const projection = painter.style.projection;
    const isTerrain = !!painter.style.map.terrain;

    const colorMode = painter.colorModeForRenderPass();
    const align = !painter.options.moving;
    const rasterOpacity = layer.paint.get('raster-opacity');
    const rasterResampling = layer.paint.get('raster-resampling');
    const fadeDuration = layer.paint.get('raster-fade-duration');
    const textureFilter = rasterResampling === 'nearest' ? 9728 /* NEAREST */ : 9729 /* LINEAR */;

    // Get or create tweaker
    let tweaker = painter.layerTweakers.get(layer.id) as RasterLayerTweaker;
    if (!tweaker) {
        tweaker = new RasterLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    // Get or create layer group
    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    // Always rebuild drawables
    (layerGroup as any)._drawablesByTile.clear();

    const minTileZ = tileIDs[tileIDs.length - 1].overscaledZ;

    for (const coord of tileIDs) {
        const depthMode = painter.getDepthModeForSublayer(coord.overscaledZ - minTileZ,
            rasterOpacity === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

        const tile = tileManager.getTile(coord);
        if (!tile || !tile.texture) continue;

        const {parentTile, parentScaleBy, parentTopLeft, fadeValues} = getFadeProperties(tile, tileManager, fadeDuration, isTerrain);
        tile.fadeOpacity = fadeValues.tileOpacity;
        if (parentTile) parentTile.fadeOpacity = fadeValues.parentTileOpacity;

        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const projectionData = transform.getProjectionData({overscaledTileID: coord, aligned: align, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});
        const uniformValues = rasterUniformValues(parentTopLeft, parentScaleBy, fadeValues.fadeMix, layer, cornerCoords);

        const mesh = projection.getMeshFromTileID(context, coord.canonical, false, true, 'raster');

        const builder = new DrawableBuilder()
            .setShader('raster')
            .setRenderPass('translucent')
            .setDepthMode(depthMode)
            .setStencilMode(StencilMode.disabled)
            .setColorMode(colorMode)
            .setCullFaceMode(CullFaceMode.backCCW)
            .setLayerTweaker(tweaker);

        // Add tile texture (image0) and parent texture (image1)
        const tileTexObj = tile.texture as any;
        if (tileTexObj) {
            // image0: current tile
            const texEntry: any = {
                name: 'image0',
                textureUnit: 0,
                texture: tileTexObj.texture || null,
                filter: textureFilter,
                wrap: 33071 /* CLAMP_TO_EDGE */,
                imageSource: tileTexObj.image || null // DOM image for WebGPU upload
            };
            builder.addTexture(texEntry);

            // image1: parent tile (for cross-fade) or same tile
            const parentTexObj = parentTile?.texture as any || tileTexObj;
            const texEntry1: any = {
                name: 'image1',
                textureUnit: 1,
                texture: parentTexObj.texture || null,
                filter: textureFilter,
                wrap: 33071 /* CLAMP_TO_EDGE */,
                imageSource: parentTexObj.image || null
            };
            builder.addTexture(texEntry1);
        }

        const drawable = builder.flush({
            tileID: coord,
            layer,
            program: null,
            programConfiguration: null,
            layoutVertexBuffer: mesh.vertexBuffer,
            indexBuffer: mesh.indexBuffer,
            segments: mesh.segments,
            projectionData,
            terrainData: terrainData || null,
        });
        drawable.uniformValues = uniformValues as any;
        layerGroup.addDrawable(coord, drawable);
    }

    // Run tweaker and draw
    const allDrawables = layerGroup.getAllDrawables();
    tweaker.execute(allDrawables, painter, layer, tileIDs);

    for (const drawable of allDrawables) {
        drawable.draw(context, painter.device, painter, renderOptions.renderPass);
    }
}
