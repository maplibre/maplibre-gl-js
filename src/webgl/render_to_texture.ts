import {type Painter} from '../render/painter.ts';
import type {RenderOptions} from '../render/render_options.ts';
import {type Tile} from '../tile/tile.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {type OverscaledTileID} from '../tile/tile_id.ts';
import {drawTerrain} from './draw/draw_terrain.ts';
import {type Style} from '../style/style.ts';
import {type Terrain} from '../render/terrain.ts';
import {type Texture} from './texture.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import {ImageSource} from '../source/image_source.ts';
import {RTT_DIFFERENCES, RTTFingerprint, type RTTDifference} from './rtt_fingerprint.ts';

/**
 * lookup table which layers should rendered to texture
 */
const LAYERS_TO_TEXTURES: { [keyof in StyleLayer['type']]?: boolean } = {
    background: true,
    fill: true,
    line: true,
    raster: true,
    hillshade: true,
    'color-relief': true
};

/**
 * @internal
 * Renders RTT-eligible layers into per-tile cached textures, then drapes
 * them onto the terrain mesh. Slots live on each Tile so their lifetime
 * tracks the tile itself; the underlying FBO+texture handles are recycled
 * via the painter's RTT pool.
 */
export class RenderToTexture {
    painter: Painter;
    terrain: Terrain;
    /** RTT texture dimension in pixels (tile size × terrain quality factor). */
    rttSize: number;
    /**
     * coordsAscending contains a list of all tiles which should be rendered for one render-to-texture tile
     * e.g. render 4 raster-tiles with size 256px to the 512px render-to-texture tile
     */
    _coordsAscending: {[_: string]: {[_:string]: OverscaledTileID[]}};
    /**
     * This frame's fingerprint for each render-to-texture tile, keyed by source id
     * then tile key. A tile whose stored fingerprint differs has stale textures.
     */
    _rttFingerprints: Record<string, Record<string, RTTFingerprint>>;
    /**
     * store for render-stacks
     * a render stack is a set of layers which should be rendered into one texture
     * every stylesheet can have multiple stacks. A new stack is created if layers which should
     * not rendered to texture sit between layers which should rendered to texture. e.g. hillshading or symbols
     */
    _stacks: string[][];
    /**
     * remember the previous processed layer to check if a new stack is needed
     */
    _prevType: string;
    /**
     * a list of tiles that can potentially rendered
     */
    _renderableTiles: Tile[];
    /**
     * a list of tiles that should be rendered to screen in the next render-call
     */
    _rttTiles: Tile[];
    /**
     * a list of all layer-ids which should be rendered
     */
    _renderableLayerIds: string[];
    /**
     * the zoom of the previous prepareForRender call
     */
    _lastPrepareZoom: number;
    /**
     * whether the render loop needs a follow-up frame to refresh cached textures that were kept this frame:
     * textures rendered at another zoom, and stale textures beyond the per-frame budget.
     */
    needsFollowUpFrame: boolean = false;
    constructor(painter: Painter, terrain: Terrain) {
        this.painter = painter;
        this.terrain = terrain;
        this.rttSize = terrain.tileManager.tileSize * terrain.qualityFactor;
    }

    getTexture(tile: Tile): Texture {
        return tile.getRTT(this._stacks.length - 1).texture;
    }

    /**
     * Collects the frame's tiles, layers and source fingerprints and releases the textures that need
     * re-rendering. Textures that differ only by zoom are kept while the zoom is changing or the map is moving
     * and re-rendered one tile per frame once it has stopped, nearest to the camera first; textures with other
     * source tiles under them are re-rendered one per frame too, `needsFollowUpFrame` bringing in the rest.
     * Textures whose visible layer set changed (a layer entered or left its zoom range) are kept while the zoom
     * is changing and then all re-rendered in the same frame, since a tile-by-tile change would show; a source
     * data change re-renders immediately.
     */
    prepareForRender(style: Style, zoom: number): void {
        const zoomChanged = zoom !== this._lastPrepareZoom;
        this._lastPrepareZoom = zoom;
        this._stacks = [];
        this._prevType = null;
        this._rttTiles = [];
        this._renderableTiles = this.terrain.tileManager.getRenderableTiles();
        this._renderableLayerIds = style._order.filter(id => !style._layers[id].isHidden(zoom));
        const visibleLayerIds = this._renderableLayerIds.join();

        const rttSourceIds = new Set<string>();
        for (const layerId of this._renderableLayerIds) {
            const layer = style._layers[layerId];
            const source = layer.source;
            if (source && LAYERS_TO_TEXTURES[layer.type]) rttSourceIds.add(source);
        }

        this._coordsAscending = {};
        this._rttFingerprints = {};
        for (const sourceId of rttSourceIds) {
            const tileManager = style.tileManagers[sourceId];
            if (!tileManager) continue;

            this._coordsAscending[sourceId] = {};
            const coordsAscending = this._coordsAscending[sourceId];
            const source = tileManager.getSource();
            const terrainTileRanges = source instanceof ImageSource ? source.terrainTileRanges : null;
            for (const tileID of tileManager.getVisibleCoordinates()) {
                const keys = this.terrain.tileManager.getTerrainCoords(tileID, terrainTileRanges);
                for (const key in keys) {
                    coordsAscending[key] ||= [];
                    coordsAscending[key].push(keys[key]);
                }
            }

            this._rttFingerprints[sourceId] = {};
            const fingerprints = this._rttFingerprints[sourceId];
            const revision = tileManager.getState().revision;
            for (const key in coordsAscending)
                fingerprints[key] = new RTTFingerprint(coordsAscending[key], revision, zoom, visibleLayerIds);
        }

        // check tiles to render
        this.needsFollowUpFrame = false;
        const moving = zoomChanged || this.painter.options.moving;
        let staleTileReleased = false;
        for (const tile of this._renderableTiles) {
            const difference = this._textureDifference(tile);
            if (difference === 'none') continue;
            if ((difference === 'zoom' && moving) || (difference === 'visibleLayers' && zoomChanged)) {
                this.needsFollowUpFrame = true;
                continue;
            }
            if (difference === 'zoom' || difference === 'sourceTiles') {
                if (staleTileReleased) {
                    this.needsFollowUpFrame = true;
                    continue;
                }
                staleTileReleased = true;
            }
            tile.releaseRTT(this.painter);
        }
    }

    /**
     * The most severe difference, over the sources rendered to texture, between the tile's cached textures
     * and what this frame would render into them.
     */
    _textureDifference(tile: Tile): RTTDifference {
        let worst: RTTDifference = 'none';
        for (const source in this._rttFingerprints) {
            const frameFingerprint = this._rttFingerprints[source][tile.tileID.key];
            if (!frameFingerprint) continue;
            const difference = frameFingerprint.difference(tile.rttFingerprint[source]);
            if (RTT_DIFFERENCES.indexOf(difference) > RTT_DIFFERENCES.indexOf(worst)) worst = difference;
        }
        return worst;
    }

    /**
     * due that switching textures is relatively slow, the render
     * layer-by-layer context is not practicable. To bypass this problem
     * this lines of code stack all layers and later render all at once.
     * Because of the stylesheet possibility to mixing render-to-texture layers
     * and 'live'-layers (f.e. symbols) it is necessary to create more stacks. For example
     * a symbol-layer is in between of fill-layers.
     * @param layer - the layer to render
     * @param renderOptions - flags describing how to render the layer
     * @returns if true layer is rendered to texture, otherwise false
     */
    renderLayer(layer: StyleLayer, renderOptions: RenderOptions): boolean {
        if (layer.isHidden(this.painter.transform.zoom)) return false;

        const options: RenderOptions = {...renderOptions, isRenderingToTexture: true};
        const type = layer.type;
        const painter = this.painter;
        const isLastLayer = this._renderableLayerIds[this._renderableLayerIds.length - 1] === layer.id;

        // remember background, fill, line & raster layer to render into a stack
        if (LAYERS_TO_TEXTURES[type]) {
            // create a new stack if previous layer was not rendered to texture (f.e. symbols)
            if (!this._prevType || !LAYERS_TO_TEXTURES[this._prevType]) this._stacks.push([]);
            // push current render-to-texture layer to render-stack
            this._prevType = type;
            this._stacks[this._stacks.length - 1].push(layer.id);
            // rendering is done later, all in once
            if (!isLastLayer) return true;
        }

        // in case a stack is finished render all collected stack-layers into a texture
        if (LAYERS_TO_TEXTURES[this._prevType] || (LAYERS_TO_TEXTURES[type] && isLastLayer)) {
            this._prevType = type;
            const stack = this._stacks.length - 1, layers = this._stacks[stack] || [];
            for (const tile of this._renderableTiles) {
                this._rttTiles.push(tile);
                // Cache hit: this tile already has a RTT object for this stack from a previous frame.
                if (tile.getRTT(stack)) continue;
                const obj = tile.acquireRTT(painter, stack, this.rttSize);
                painter.bindRTT(obj);
                painter.context.clear({color: Color.transparent, stencil: 0});
                painter.currentStencilSource = undefined;
                for (const layerId of layers) {
                    const layer = painter.style._layers[layerId];
                    const coords = layer.source ? this._coordsAscending[layer.source][tile.tileID.key] : [tile.tileID];
                    painter.context.viewport.set([0, 0, this.rttSize, this.rttSize]);
                    painter.renderTileClippingMasks(layer, coords, true);
                    painter.renderLayer(painter, painter.style.tileManagers[layer.source], layer, coords, options);
                    if (layer.source) tile.rttFingerprint[layer.source] = this._rttFingerprints[layer.source][tile.tileID.key];
                }
                obj.texture.generateMipmap();
            }
            drawTerrain(this.painter, this.terrain, this._rttTiles, options);
            this._rttTiles = [];

            return LAYERS_TO_TEXTURES[type];
        }

        return false;
    }

}
