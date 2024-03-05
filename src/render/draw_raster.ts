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
import {GlobeProjection} from '../geo/projection/globe';

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

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();
    const program = painter.useProgram('raster');

    const projection = painter.style.map.projection;
    const globe = (projection instanceof GlobeProjection && projection.useGlobeRendering);

    const colorMode = painter.colorModeForRenderPass();
    const align = !painter.options.moving;

    // When rendering globe, two passes are needed.
    // Subdivided tiles with different granularities might have tiny gaps between them.
    // To combat this, tile meshes for globe have a slight border region.
    // However tiles borders will overlap, and a part of a tile often
    // gets hidden by its neighbour's border, which displays an ugly stretched texture.
    // To both hide the border stretch and avoid tiny gaps, tiles are first drawn without borders (with gaps),
    // and then any missing pixels (gaps, not marked in stencil) get overdrawn with tile borders.
    // This approach also avoids pixel shader overdraw, as any pixel is drawn at most once.

    // Stencil and two-pass is not used for ImageSource sources.
    const passCount = (globe && !(source instanceof ImageSource)) ? 2 : 1;

    let stencilModesLow, stencilModesHigh, coords: Array<OverscaledTileID>;

    if (passCount > 1) {
        [stencilModesHigh, stencilModesLow, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
    } else {
        [stencilModesHigh, coords] = source instanceof ImageSource ? [{}, tileIDs] : painter.stencilConfigForOverlap(tileIDs);
    }

    const minTileZ = coords[coords.length - 1].overscaledZ;

    for (let pass = 0; pass < passCount; pass++) {
        const stencilModes = pass === 0 ? stencilModesHigh : stencilModesLow;
        const useBorder = pass > 0;

        // Draw all tiles
        for (const coord of coords) {
            // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
            // Use gl.LESS to prevent double drawing in areas where tiles overlap.
            const depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
                layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

            const tile = sourceCache.getTile(coord);

            tile.registerFadeDuration(layer.paint.get('raster-fade-duration'));

            const parentTile = sourceCache.findLoadedParent(coord, 0),
                fade = getFadeValues(tile, parentTile, sourceCache, layer, painter.transform, painter.style.map.terrain);

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

            const terrainCoord = terrainData ? coord : null;
            const posMatrix = terrainCoord ? terrainCoord.posMatrix : painter.transform.calculatePosMatrix(coord.toUnwrapped(), align);
            const projectionData = projection.getProjectionData(coord.canonical, posMatrix);
            const uniformValues = rasterUniformValues(parentTL || [0, 0], parentScaleBy || 1, fade, layer,
                (source instanceof ImageSource) ? source.tileCoords : cornerCoords);

            let vertexBuffer = painter.rasterBoundsBufferPosOnly;
            let indexBuffer = painter.quadTriangleIndexBuffer;
            let segments = painter.rasterBoundsSegmentsPosOnly;

            if (globe) {
                const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder);
                vertexBuffer = mesh.vertexBuffer;
                indexBuffer = mesh.indexBuffer;
                segments = mesh.segments;
            }

            if (source instanceof ImageSource) {
                program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                    uniformValues, terrainData, projectionData, layer.id, vertexBuffer,
                    indexBuffer, segments);
            } else {
                program.draw(context, gl.TRIANGLES, depthMode, stencilModes[coord.overscaledZ], colorMode, CullFaceMode.disabled,
                    uniformValues, terrainData, projectionData, layer.id, vertexBuffer,
                    indexBuffer, segments);
            }
        }
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
