import Painter from './painter';
import Tile from '../source/tile';
import Color from '../style-spec/util/color';
import {OverscaledTileID} from '../source/tile_id';
import {drawTerrain} from './draw_terrain';
import type StyleLayer from '../style/style_layer';
import Framebuffer from '../gl/framebuffer';
import Texture from './texture';
import Context from '../gl/context';
import Style from '../style/style';
import Terrain from './terrain';
import {DepthStencilAttachment} from '../gl/value';

// lookup table which layers should rendered to texture
const LAYERS: { [keyof in StyleLayer['type']]?: boolean } = {
    background: true,
    fill: true,
    line: true,
    raster: true,
    hillshade: true
};

const POOL_SIZE = 30; // must by divide by 2

type PoolObject = {
    id: number;
    fbo: Framebuffer;
    texture: Texture;
    stamp: number;
    inUse: boolean;
};

export class RenderPool {
    context: Context;
    tileSize: number;
    objs: Array<PoolObject>;
    recentlyUsed: Array<number>;
    stamp: number;

    constructor(context: Context, tileSize: number) {
        this.context = context;
        this.tileSize = tileSize;
        this.objs = [];
        this.recentlyUsed = [];
        this.stamp = 0;
    }

    destruct() {
        for (const obj of this.objs) {
            obj.texture.destroy();
            obj.fbo.destroy();
        }
    }

    createObject(id: number): PoolObject {
        const fbo = this.context.createFramebuffer(this.tileSize, this.tileSize, false);
        const texture = new Texture(this.context, {width: this.tileSize, height: this.tileSize, data: null}, this.context.gl.RGBA);
        texture.bind(this.context.gl.LINEAR, this.context.gl.CLAMP_TO_EDGE);
        fbo.depthAttachment = new DepthStencilAttachment(this.context, fbo.framebuffer);
        fbo.depthAttachment.set(this.context.createRenderbuffer(this.context.gl.DEPTH_STENCIL, this.tileSize, this.tileSize));
        fbo.colorAttachment.set(texture.texture);
        return {id, fbo, texture, stamp: -1, inUse: false};
    }

    getObjectForId(id: number): PoolObject {
        return this.objs[id];
    }

    useObject(obj: PoolObject) {
        obj.inUse = true;
        this.recentlyUsed.push(obj.id);
        while (this.recentlyUsed.length > POOL_SIZE) this.recentlyUsed.shift();
    }

    stampObject(obj: PoolObject) {
        obj.stamp = ++this.stamp;
    }

    getFreeObject(): PoolObject {
        // check for free existing objects
        for (const id of this.recentlyUsed) {
            if (!this.objs[id].inUse) return this.objs[id];
        }
        // create new object
        const obj = this.createObject(this.objs.length);
        this.objs.push(obj);
        return obj;
    }

    freeObject(obj: PoolObject) {
        obj.inUse = false;
    }

    freeObjects() {
        for (const obj of this.objs) this.freeObject(obj);
    }

    isFull(): boolean {
        if (this.objs.length < POOL_SIZE) return false;
        for (const obj of this.objs)
            if (!obj.inUse) return false;
        return true;
    }
}

/**
 * RenderToTexture
 */
export default class RenderToTexture {
    painter: Painter;
    terrain: Terrain;
    pool: RenderPool;
    // coordsDescendingInv contains a list of all tiles which should be rendered for one render-to-texture tile
    // e.g. render 4 raster-tiles with size 256px to the 512px render-to-texture tile
    _coordsDescendingInv: {[_: string]: {[_:string]: Array<OverscaledTileID>}};
    // create a string representation of all to tiles rendered to render-to-texture tiles
    // this string representation is used to check if tile should be re-rendered.
    _coordsDescendingInvStr: {[_: string]: {[_:string]: string}};
    // store for render-stacks
    // a render stack is a set of layers which should be rendered into one texture
    // every stylesheet can have multipe stacks. A new stack is created if layers which should
    // not rendered to texture sit inbetween layers which should rendered to texture. e.g. hillshading or symbols
    _stacks: Array<Array<string>>;
    // remember the previous processed layer to check if a new stack is needed
    _prevType: string;
    // a list of tiles that can potentially rendered
    _renderableTiles: Array<Tile>;
    // a list of tiles that should be rendered to screen in the next render-call
    _rttTiles: Array<Tile>;
    // a list of all layer-ids which should be rendered
    _renderableLayerIds: Array<string>;

    constructor(painter: Painter, terrain: Terrain) {
        this.painter = painter;
        this.terrain = terrain;
        this.pool = new RenderPool(painter.context, terrain.sourceCache.tileSize * terrain.qualityFactor);
    }

    destruct() {
        this.pool.destruct();
    }

    getTexture(tile: Tile) {
        return this.pool.getObjectForId(tile.rtt[this._stacks.length - 1][0]).texture;
    }

    initialize(style: Style, zoom: number) {
        this._stacks = [];
        this._prevType = null;
        this._rttTiles = [];
        this._renderableTiles = this.terrain.sourceCache.getRenderableTiles();
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
        for (const tile of this._renderableTiles) {
            for (const source in this._coordsDescendingInvStr) {
                // rerender if there are more coords to render than in the last rendering
                const coords = this._coordsDescendingInvStr[source][tile.tileID.key];
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
     * @param {StyleLayer} layer the layer to render
     * @returns {boolean} if true layer is rendered to texture, otherwise false
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
            const stack = this._stacks.length - 1, layers = this._stacks[stack] || [];
            for (const tile of this._renderableTiles) {
                // if render pool is full draw current tiles to screen and free pool
                if (this.pool.isFull()) {
                    drawTerrain(this.painter, this.terrain, this._rttTiles);
                    this._rttTiles = [];
                    this.pool.freeObjects();
                }
                this._rttTiles.push(tile);
                // check for cached PoolObject
                if (tile.rtt[stack]) {
                    const [id, stamp] = tile.rtt[stack];
                    const obj = this.pool.getObjectForId(id);
                    if (obj.stamp === stamp) {
                        this.pool.useObject(obj);
                        continue;
                    }
                }
                // get free PoolObject
                const obj = this.pool.getFreeObject();
                this.pool.useObject(obj);
                this.pool.stampObject(obj);
                tile.rtt[stack] = [obj.id, obj.stamp];
                // prepare PoolObject for rendering
                painter.context.bindFramebuffer.set(obj.fbo.framebuffer);
                painter.context.clear({color: Color.transparent, stencil: 0});
                painter.currentStencilSource = null;
                for (let l = 0; l < layers.length; l++) {
                    const layer = painter.style._layers[layers[l]];
                    const coords = layer.source ? this._coordsDescendingInv[layer.source][tile.tileID.key] : [tile.tileID];
                    painter.context.viewport.set([0, 0, obj.fbo.width, obj.fbo.height]);
                    painter._renderTileClippingMasks(layer, coords);
                    painter.renderLayer(painter, painter.style.sourceCaches[layer.source], layer, coords);
                    if (layer.source) tile.rttCoords[layer.source] = this._coordsDescendingInvStr[layer.source][tile.tileID.key];
                }
            }
            drawTerrain(this.painter, this.terrain, this._rttTiles);
            this._rttTiles = [];
            this.pool.freeObjects();

            return LAYERS[type];
        }

        return false;
    }

}
