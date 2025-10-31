import {type Painter, type RenderOptions} from './painter';
import {type Tile} from '../tile/tile';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {type OverscaledTileID} from '../tile/tile_id';
import {drawTerrain} from './draw_terrain';
import {type Style} from '../style/style';
import {type Terrain} from './terrain';
import {RenderPool} from '../gl/render_pool';
import {type Texture} from './texture';
import type {StyleLayer} from '../style/style_layer';
import {ImageSource} from '../source/image_source';

/**
 * lookup table which layers should rendered to texture
 */
const LAYERS: { [keyof in StyleLayer['type']]?: boolean } = {
    background: true,
    fill: true,
    line: true,
    raster: true,
    hillshade: true,
    'color-relief': true
};

/**
 * @internal
 * A helper class to help define what should be rendered to texture and how
 */
export class RenderToTexture {
    painter: Painter;
    terrain: Terrain;
    pool: RenderPool;
    /**
     * coordsAscending contains a list of all tiles which should be rendered for one render-to-texture tile
     * e.g. render 4 raster-tiles with size 256px to the 512px render-to-texture tile
     */
    _coordsAscending: {[_: string]: {[_:string]: Array<OverscaledTileID>}};
    /**
     * create a string representation of all to tiles rendered to render-to-texture tiles
     * this string representation is used to check if tile should be re-rendered.
     */
    _coordsAscendingStr: {[_: string]: {[_:string]: string}};
    /**
     * store for render-stacks
     * a render stack is a set of layers which should be rendered into one texture
     * every stylesheet can have multiple stacks. A new stack is created if layers which should
     * not rendered to texture sit between layers which should rendered to texture. e.g. hillshading or symbols
     */
    _stacks: Array<Array<string>>;
    /**
     * remember the previous processed layer to check if a new stack is needed
     */
    _prevType: string;
    /**
     * a list of tiles that can potentially rendered
     */
    _renderableTiles: Array<Tile>;
    /**
     * a list of tiles that should be rendered to screen in the next render-call
     */
    _rttTiles: Array<Tile>;
    /**
     * a list of all layer-ids which should be rendered
     */
    _renderableLayerIds: Array<string>;

    constructor(painter: Painter, terrain: Terrain) {
        this.painter = painter;
        this.terrain = terrain;
        this.pool = new RenderPool(painter.context, 30, terrain.tileManager.tileSize * terrain.qualityFactor);
    }

    destruct() {
        this.pool.destruct();
    }

    getTexture(tile: Tile): Texture {
        return this.pool.getObjectForId(tile.rtt[this._stacks.length - 1].id).texture;
    }

    prepareForRender(style: Style, zoom: number) {
        this._stacks = [];
        this._prevType = null;
        this._rttTiles = [];
        this._renderableTiles = this.terrain.tileManager.getRenderableTiles();
        this._renderableLayerIds = style._order.filter(id => !style._layers[id].isHidden(zoom));

        this._coordsAscending = {};
        for (const id in style.tileManagers) {
            this._coordsAscending[id] = {};
            const tileIDs = style.tileManagers[id].getVisibleCoordinates();
            const source = style.tileManagers[id].getSource();
            const terrainTileRanges = source instanceof ImageSource ? source.terrainTileRanges : null;
            for (const tileID of tileIDs) {
                const keys = this.terrain.tileManager.getTerrainCoords(tileID, terrainTileRanges);
                for (const key in keys) {
                    if (!this._coordsAscending[id][key]) this._coordsAscending[id][key] = [];
                    this._coordsAscending[id][key].push(keys[key]);
                }
            }
        }

        this._coordsAscendingStr = {};
        for (const id of style._order) {
            const layer = style._layers[id], source = layer.source;
            if (LAYERS[layer.type]) {
                if (!this._coordsAscendingStr[source]) {
                    this._coordsAscendingStr[source] = {};
                    for (const key in this._coordsAscending[source])
                        this._coordsAscendingStr[source][key] = this._coordsAscending[source][key].map(c => c.key).sort().join();
                }
            }
        }

        // check tiles to render
        for (const tile of this._renderableTiles) {
            for (const source in this._coordsAscendingStr) {
                // rerender if there are more coords to render than in the last rendering
                const coords = this._coordsAscendingStr[source][tile.tileID.key];
                if (coords && coords !== tile.rttCoords[source]) tile.rtt = [];
            }
        }
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
        if (LAYERS[type]) {
            // create a new stack if previous layer was not rendered to texture (f.e. symbols)
            if (!this._prevType || !LAYERS[this._prevType]) this._stacks.push([]);
            // push current render-to-texture layer to render-stack
            this._prevType = type;
            this._stacks[this._stacks.length - 1].push(layer.id);
            // rendering is done later, all in once
            if (!isLastLayer) return true;
        }

        // in case a stack is finished render all collected stack-layers into a texture
        if (LAYERS[this._prevType] || (LAYERS[type] && isLastLayer)) {
            this._prevType = type;
            const stack = this._stacks.length - 1, layers = this._stacks[stack] || [];
            for (const tile of this._renderableTiles) {
                // if render pool is full draw current tiles to screen and free pool
                if (this.pool.isFull()) {
                    drawTerrain(this.painter, this.terrain, this._rttTiles, options);
                    this._rttTiles = [];
                    this.pool.freeAllObjects();
                }
                this._rttTiles.push(tile);
                // check for cached PoolObject
                if (tile.rtt[stack]) {
                    const obj = this.pool.getObjectForId(tile.rtt[stack].id);
                    if (obj.stamp === tile.rtt[stack].stamp) {
                        this.pool.useObject(obj);
                        continue;
                    }
                }
                // get free PoolObject
                const obj = this.pool.getOrCreateFreeObject();
                this.pool.useObject(obj);
                this.pool.stampObject(obj);
                tile.rtt[stack] = {id: obj.id, stamp: obj.stamp};
                // prepare PoolObject for rendering
                painter.context.bindFramebuffer.set(obj.fbo.framebuffer);
                painter.context.clear({color: Color.transparent, stencil: 0});
                painter.currentStencilSource = undefined;
                for (let l = 0; l < layers.length; l++) {
                    const layer = painter.style._layers[layers[l]];
                    const coords = layer.source ? this._coordsAscending[layer.source][tile.tileID.key] : [tile.tileID];
                    painter.context.viewport.set([0, 0, obj.fbo.width, obj.fbo.height]);
                    painter._renderTileClippingMasks(layer, coords, true);
                    painter.renderLayer(painter, painter.style.tileManagers[layer.source], layer, coords, options);
                    if (layer.source) tile.rttCoords[layer.source] = this._coordsAscendingStr[layer.source][tile.tileID.key];
                }
            }
            drawTerrain(this.painter, this.terrain, this._rttTiles, options);
            this._rttTiles = [];
            this.pool.freeAllObjects();

            return LAYERS[type];
        }

        return false;
    }

}
