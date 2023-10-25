import {Painter} from './painter';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {OverscaledTileID} from '../source/tile_id';
import {drawTerrain} from './draw_terrain';
import {Style} from '../style/style';
import {Terrain} from './terrain';
import {RenderPool} from '../gl/render_pool';
import {Texture} from './texture';
import type {StyleLayer} from '../style/style_layer';

/**
 * lookup table which layers should rendered to texture
 */
const LAYERS: { [keyof in StyleLayer['type']]?: boolean } = {
    background: true,
    fill: true,
    line: true,
    raster: true,
    hillshade: true
};

class RttRecord {
    tileID: OverscaledTileID;
    /**
     * A reference to the framebuffer and texture corresponding to each layer of the rendering stack.
     * id references the object from render_pool, stamp is used to identify its contents.
     */
    rtt: Array<{id: number; stamp: number}>;
    /**
     * Map of source ID -> a string representation of all tileIDs that contribute to this tile
     * Used to check whether the cached texture is still valid.
     */
    rttCoords: {[_:string]: string};
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
     * coordsDescendingInv contains a list of all tiles which should be rendered for one render-to-texture tile
     * e.g. render 4 raster-tiles with size 256px to the 512px render-to-texture tile
     */
    _coordsDescendingInv: {[_: string]: {[_:string]: Array<OverscaledTileID>}};
    /**
     * create a string representation of all to tiles rendered to render-to-texture tiles
     * this string representation is used to check if tile should be re-rendered.
     */
    _coordsDescendingInvStr: {[_: string]: {[_:string]: string}};
    /**
     * store for render-stacks
     * a render stack is a set of layers which should be rendered into one texture
     * every stylesheet can have multiple stacks. A new stack is created if layers which should
     * not rendered to texture sit inbetween layers which should rendered to texture. e.g. hillshading or symbols
     */
    _stacks: Array<Array<string>>;
    /**
     * remember the previous processed layer to check if a new stack is needed
     */
    _prevType: string;
    /**
     * a list of tiles that can potentially rendered
     */
    _renderableTiles: Array<OverscaledTileID>;
    /**
     * a list of tiles that should be rendered to screen in the next render-call
     */
    _rttTiles: Array<OverscaledTileID>;
    /**
     * a list of all layer-ids which should be rendered
     */
    _renderableLayerIds: Array<string>;
    /**
     * Map of tileID key to RTT data
     */
    _tileIDtoRtt: {[_: string]: RttRecord} // TODO: make sure to garbage-collect this

    constructor(painter: Painter, terrain: Terrain) {
        this.painter = painter;
        this.terrain = terrain;
        this.pool = new RenderPool(painter.context, 30, terrain.sourceCache.tileSize * terrain.qualityFactor);
        this._tileIDtoRtt = {};
    }

    destruct() {
        this.pool.destruct();
    }

    getTexture(tileIDkey: string): Texture {
        const rttData = this._tileIDtoRtt[tileIDkey];
        return this.pool.getObjectForId(rttData.rtt[this._stacks.length - 1].id).texture;
    }

    prepareForRender(style: Style, zoom: number) {
        this._stacks = [];
        this._prevType = null;
        this._rttTiles = [];
        this._renderableTiles = this.terrain.sourceCache.getRenderableTileIDs();
        this._renderableLayerIds = style._order.filter(id => !style._layers[id].isHidden(zoom));

        this._coordsDescendingInv = {};
        for (const id in style.sourceCaches) {
            this._coordsDescendingInv[id] = {};
            const tileIDs = style.sourceCaches[id].getVisibleCoordinates();
            for (const tileID of tileIDs) {
                const keys = this.terrain.sourceCache.getTerrainCoords(tileID);
                for (const key in keys) {
                    if (!this._coordsDescendingInv[id][key]) this._coordsDescendingInv[id][key] = [];
                    this._coordsDescendingInv[id][key].push(keys[key]);
                }
            }
        }

        this._coordsDescendingInvStr = {};
        for (const id of style._order) {
            const layer = style._layers[id], source = layer.source;
            if (LAYERS[layer.type]) {
                if (!this._coordsDescendingInvStr[source]) {
                    this._coordsDescendingInvStr[source] = {};
                    for (const key in this._coordsDescendingInv[source])
                        this._coordsDescendingInvStr[source][key] = this._coordsDescendingInv[source][key].map(c => c.key).sort().join();
                }
            }
        }

        // check tiles to render
        const usedTileKeys = {};
        for (const tileID of this._renderableTiles) {
            usedTileKeys[tileID.key] = true;
            const rttData = this._tileIDtoRtt[tileID.key];
            if(!rttData)
            {
                this._tileIDtoRtt[tileID.key] = {
                    tileID: tileID,
                    rtt: [],
                    rttCoords: {}
                };
                continue;
            }
            for (const source in this._coordsDescendingInvStr) {
                // rerender if there are more coords to render than in the last rendering
                const coords = this._coordsDescendingInvStr[source][tileID.key];
                if (coords && coords !== rttData.rttCoords[source]) {
                    rttData.rtt = [];
                    break;
                }
            }
        }

        for(const key in this._tileIDtoRtt) {
            if (!usedTileKeys[key]) {
                delete this._tileIDtoRtt[key];
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
     * @returns if true layer is rendered to texture, otherwise false
     */
    renderLayer(layer: StyleLayer): boolean {
        if (layer.isHidden(this.painter.transform.zoom)) return false;

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
            const stack = this._stacks.length - 1;
            const layers = this._stacks[stack] || [];
            for (const tileID of this._renderableTiles) {
                // if render pool is full draw current tiles to screen and free pool
                if (this.pool.isFull()) {
                    drawTerrain(this.painter, this.terrain, this._rttTiles); // TODO: tohle by měla být nějaká customisable funkce
                    this._rttTiles = [];
                    this.pool.freeAllObjects();
                }
                this._rttTiles.push(tileID);
                // check for cached PoolObject
                const rttData = this._tileIDtoRtt[tileID.key];
                if (rttData.rtt[stack]) {
                    const obj = this.pool.getObjectForId(rttData.rtt[stack].id);
                    if (obj.stamp === rttData.rtt[stack].stamp) {
                        this.pool.useObject(obj);
                        continue;
                    }
                }
                // get free PoolObject
                const obj = this.pool.getOrCreateFreeObject();
                this.pool.useObject(obj);
                this.pool.stampObject(obj);
                rttData.rtt[stack] = {id: obj.id, stamp: obj.stamp};
                // prepare PoolObject for rendering
                painter.context.bindFramebuffer.set(obj.fbo.framebuffer);
                painter.context.clear({color: Color.transparent, stencil: 0});
                painter.currentStencilSource = undefined;
                for (let l = 0; l < layers.length; l++) {
                    const layer = painter.style._layers[layers[l]];
                    const coords = layer.source ? this._coordsDescendingInv[layer.source][tileID.key] : [tileID];
                    painter.context.viewport.set([0, 0, obj.fbo.width, obj.fbo.height]);
                    painter._renderTileClippingMasks(layer, coords);
                    painter.renderLayer(painter, painter.style.sourceCaches[layer.source], layer, coords);
                    if (layer.source) rttData.rttCoords[layer.source] = this._coordsDescendingInvStr[layer.source][tileID.key];
                }
            }
            drawTerrain(this.painter, this.terrain, this._rttTiles);
            this._rttTiles = [];
            this.pool.freeAllObjects();

            return LAYERS[type];
        }

        return false;
    }

    /**
     * Free render to texture cache
     * @param tileID - optional, free only corresponding to tileID.
     */
    freeRtt(tileID?: OverscaledTileID) {
        for (const rtt of Object.values(this._tileIDtoRtt)) {
            if (!tileID || rtt.tileID.equals(tileID) || rtt.tileID.isChildOf(tileID) || tileID.isChildOf(rtt.tileID)) {
                rtt.rtt = [];
            }
        }
    }
}
