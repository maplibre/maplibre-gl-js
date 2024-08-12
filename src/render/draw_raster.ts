import {clamp} from '../util/util';

import {ImageSource} from '../source/image_source';
import {browser} from '../util/browser';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {rasterUniformValues} from './program/raster_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {RasterStyleLayer} from '../style/style_layer/raster_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';

const cornerCoords = [
    new Point(0, 0),
    new Point(EXTENT, 0),
    new Point(EXTENT, EXTENT),
    new Point(0, EXTENT),
];

export function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;
    if (!tileIDs.length) return;

    const source = sourceCache.getSource();

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
        drawTiles(painter, sourceCache, layer, tileIDs, null, false, false, source.tileCoords, source.flippedWindingOrder);
    } else if (useSubdivision) {
        // Two-pass rendering
        const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
        drawTiles(painter, sourceCache, layer, coords, stencilBorderless, false, true, cornerCoords); // draw without borders
        drawTiles(painter, sourceCache, layer, coords, stencilBorders, true, true, cornerCoords); // draw with borders
    } else {
        // Simple rendering
        const [stencil, coords] = painter.stencilConfigForOverlap(tileIDs);
        drawTiles(painter, sourceCache, layer, coords, stencil, false, true, cornerCoords);
    }
}

function drawTiles(
    painter: Painter,
    sourceCache: SourceCache,
    layer: RasterStyleLayer,
    coords: Array<OverscaledTileID>,
    stencilModes: {[_: number]: Readonly<StencilMode>} | null,
    useBorder: boolean,
    allowPoles: boolean,
    corners: Array<Point>,
    flipCullfaceMode: boolean = false) {
    const minTileZ = coords[coords.length - 1].overscaledZ;

    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('raster');
    const transform = painter.transform;

    const projection = painter.style.projection;

    const colorMode = painter.colorModeForRenderPass();
    const align = !painter.options.moving;

    // Draw all tiles
    for (const coord of coords) {
        // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        // Use gl.LESS to prevent double drawing in areas where tiles overlap.
        const depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
            layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

        const tile = sourceCache.getTile(coord);

        tile.registerFadeDuration(layer.paint.get('raster-fade-duration'));

        const parentTile = sourceCache.findLoadedParent(coord, 0);
        const siblingTile = sourceCache.findLoadedSibling(coord);
        // Prefer parent tile if present
        const fadeTileReference = parentTile || siblingTile || null;
        const fade = getFadeValues(tile, fadeTileReference, sourceCache, layer, painter.transform, painter.style.map.terrain);

        let parentScaleBy, parentTL;

        const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ?  gl.NEAREST : gl.LINEAR;

        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        context.activeTexture.set(gl.TEXTURE1);

        if (parentTile) {
            parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];
        } else {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        }

        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const projectionData = transform.getProjectionData(coord, align);
        const uniformValues = rasterUniformValues(parentTL || [0, 0], parentScaleBy || 1, fade, layer, corners);

        const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder, allowPoles, 'raster');

        const stencilMode = stencilModes ? stencilModes[coord.overscaledZ] : StencilMode.disabled;

        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, flipCullfaceMode ? CullFaceMode.frontCCW : CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, layer.id, mesh.vertexBuffer,
            mesh.indexBuffer, mesh.segments);
    }
}

function getFadeValues(tile, parentTile, sourceCache, layer, transform, terrain) {
    const fadeDuration = layer.paint.get('raster-fade-duration');

    if (!terrain && fadeDuration > 0) {
        const now = browser.now();
        const sinceTile = (now - tile.timeAdded) / fadeDuration;
        const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

        const source = sourceCache.getSource();
        const idealZ = transform.coveringZoomLevel({
            tileSize: source.tileSize,
            roundZoom: source.roundZoom
        });

        // if no parent or parent is older, fade in; if parent is younger, fade out
        const fadeIn = !parentTile || Math.abs(parentTile.tileID.overscaledZ - idealZ) > Math.abs(tile.tileID.overscaledZ - idealZ);

        const childOpacity = (fadeIn && tile.refreshedUponExpiration) ? 1 : clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);

        // we don't crossfade tiles that were just refreshed upon expiring:
        // once they're old enough to pass the crossfading threshold
        // (fadeDuration), unset the `refreshedUponExpiration` flag so we don't
        // incorrectly fail to crossfade them when zooming
        if (tile.refreshedUponExpiration && sinceTile >= 1) tile.refreshedUponExpiration = false;

        if (parentTile) {
            return {
                opacity: 1,
                mix: 1 - childOpacity
            };
        } else {
            return {
                opacity: childOpacity,
                mix: 0
            };
        }
    } else {
        return {
            opacity: 1,
            mix: 0
        };
    }
}
