import {DepthMode} from '../depth_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {DrawableCollection} from '../drawable.ts';
import {
    backgroundUniformValues,
    backgroundPatternUniformValues
} from '../program/background_program.ts';
import {coveringTiles} from '../../geo/projection/covering_tiles.ts';
import {isBackgroundStyleLayer} from '../../style/style_layer/background_style_layer.ts';

import type {RenderContext} from '../../render/render_context.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';
import type {Painter} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {BackgroundStyleLayer} from '../../style/style_layer/background_style_layer.ts';
import type {BackgroundUniformsType, BackgroundPatternUniformsType} from '../program/background_program.ts';

export type BackgroundDrawables = {
    layer: BackgroundStyleLayer;
    tiles: OverscaledTileID[];
    drawables: DrawableCollection<BackgroundUniformsType | BackgroundPatternUniformsType>;
};

/**
 * Keeps one drawable per tile for every visible background layer, including terrain tiles whose texture is cached.
 * Background meshes have no borders or stencil clipping, so tiles within each target must not overlap.
 * Meshes with borders would hide tiny holes at tile boundaries, but they need a tile clipping mask in stencil first.
 */
export function prepareBackgroundDrawables(painter: Painter): void {
    const {context, style, renderContext, backgroundDrawables} = painter;
    const transform = renderContext.transform;
    let tiles: OverscaledTileID[];

    for (let i = 0; i < style._order.length; i++) {
        const layer = style._layers[style._order[i]];
        if (!isBackgroundStyleLayer(layer) || layer.isHidden(transform.zoom)) continue;

        const color = layer.paint.get('background-color');
        const opacity = layer.paint.get('background-opacity');
        const image = layer.paint.get('background-pattern');
        if (opacity === 0 || painter.isPatternMissing(image)) continue;

        tiles ??= painter.renderToTexture ?
            renderContext.terrain.tileManager.getRenderableTiles().map(tile => tile.tileID) :
            coveringTiles(transform, {tileSize: transform.tileSize, terrain: renderContext.terrain});

        const drawables = backgroundDrawables.get(layer.id)?.drawables ?? new DrawableCollection();
        backgroundDrawables.set(layer.id, {layer, tiles, drawables});
        const renderPass = !image && color.a === 1 && opacity === 1 && i < renderContext.opaquePassCutoff ? 'opaque' : 'translucent';
        const depthMask = renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly;
        const program = painter.useProgram(image ? 'backgroundPattern' : 'background');

        for (const tileID of tiles) {
            const mesh = style.projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');
            const drawable = drawables.request(tileID.key, program, mesh, layer.id, context.gl.TRIANGLES);
            drawable.renderPass = renderPass;
            drawable.depthMask = depthMask;
            drawable.cullFaceMode = CullFaceMode.backCCW;
        }
    }

    for (const [layerID, group] of backgroundDrawables) {
        group.drawables.removeUnrequested();
        if (group.drawables.entries.size === 0) {
            backgroundDrawables.delete(layerID);
            continue;
        }
        updateUniformValues(group, painter, renderContext);
    }
}

export function drawBackground(painter: Painter, tileManager: TileManager, layer: BackgroundStyleLayer, coords: OverscaledTileID[], renderContext: RenderContext): void {
    const group = painter.backgroundDrawables.get(layer.id);
    if (!group) return;

    for (const tileID of coords ?? group.tiles) {
        group.drawables.entries.get(tileID.key).draw(painter, renderContext, tileID);
    }
}

/** Must run after all background patterns are packed into the atlas, since packing moves them. */
function updateUniformValues(group: BackgroundDrawables, painter: Painter, renderContext: RenderContext): void {
    const {layer, tiles, drawables} = group;
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');
    const image = layer.paint.get('background-pattern');
    const crossfade = layer.getCrossfadeParameters();
    const tileSize = renderContext.transform.tileSize;
    const uniformValues = image ? null : backgroundUniformValues(opacity, color);
    const textures = image ? [{unit: 0, texture: painter.patternAtlas}] : [];

    for (const tileID of tiles) {
        const drawable = drawables.entries.get(tileID.key);
        drawable.uniformValues = image ?
            backgroundPatternUniformValues(opacity, painter, image, {tileID, tileSize}, crossfade) :
            uniformValues;
        drawable.textures = textures;
    }
}
