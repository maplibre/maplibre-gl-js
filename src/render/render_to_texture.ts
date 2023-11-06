import {Painter} from './painter';
import type {FuncDrawBufferedRttTiles} from './painter';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {OverscaledTileID} from '../source/tile_id';
import {Style} from '../style/style';
import {RenderPool} from '../gl/render_pool';
import {Texture} from './texture';
import type {StyleLayer} from '../style/style_layer';
import {EXTENT} from '../data/extent';
import {mat4, vec4} from 'gl-matrix';

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
     * Map of source ID to a string representation of all tileIDs that contribute to this tile
     * Used to check whether the cached texture is still valid.
     */
    rttCoords: {[_:string]: string};
}

function fract(x: number): number {
    return x - Math.floor(x);
}

function randomColor(x: number): vec4 {
    return [
        fract(Math.sin(x * 1234) * 5678) * 0.5 + 0.5,
        fract(Math.sin(x * 8522) * 4527) * 0.5 + 0.5,
        fract(Math.sin(x * 7154) * 3415) * 0.5 + 0.5,
        1.0
    ];
}

/**
 * @internal
 * A helper class to help define what should be rendered to texture and how
 */
export class RenderToTexture {
    painter: Painter;
    pool: RenderPool;
    /**
     * When true, each RTT tile is drawn with a random color tone to visualize tile density.
     * Eg. you would usually expect to see 4 by 2 tiles of 1024x1024 pixels on a 4K screen.
     */
    debugTileColor: boolean = false;
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
    _tileIDtoRtt: {[_: string]: RttRecord};

    constructor(painter: Painter) {
        this.painter = painter;

        const baseTileSize = 512; // constant
        // to not see pixels in the render-to-texture tiles it is good to render them bigger
        // this number is the multiplicator (must be a power of 2) for the current tileSize.
        // So to get good results with not too much memory footprint a value of 2 should be fine.
        const qualityFactor = 2;
        this.pool = new RenderPool(painter.context, 30, baseTileSize * qualityFactor);
        this._tileIDtoRtt = {};
    }

    destruct() {
        this.pool.destruct();
    }

    getTexture(tileIDkey: string): Texture {
        const rttData = this._tileIDtoRtt[tileIDkey];
        return this.pool.getObjectForId(rttData.rtt[this._stacks.length - 1].id).texture;
    }

    /**
     * For debug purposes only - returns a unique number to any rendered texture.
     */
    getTileColorForDebug(tileIDkey: string): vec4 {
        if (!this.debugTileColor) {
            return [1, 1, 1, 1];
        }
        const rttData = this._tileIDtoRtt[tileIDkey];
        const stamp = this.pool.getObjectForId(rttData.rtt[this._stacks.length - 1].id).stamp;
        return randomColor(stamp);
    }

    prepareForRender(style: Style, zoom: number, renderableTiles: Array<OverscaledTileID>) {
        this._stacks = [];
        this._prevType = null;
        this._rttTiles = [];
        this._renderableTiles = renderableTiles;
        this._renderableLayerIds = style._order.filter(id => !style._layers[id].isHidden(zoom));

        this._coordsDescendingInv = {};
        for (const id in style.sourceCaches) {
            this._coordsDescendingInv[id] = {};
            const tileIDs = style.sourceCaches[id].getVisibleCoordinates();
            for (const tileID of tileIDs) {


                const keys = this.getTerrainCoords(tileID);
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
            if (!rttData) {
                this._tileIDtoRtt[tileID.key] = {
                    tileID,
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

        for (const key in this._tileIDtoRtt) {
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
    renderLayer(layer: StyleLayer, drawBufferedRttTilesFunc: FuncDrawBufferedRttTiles): boolean {
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
                    drawBufferedRttTilesFunc(this.painter, this._rttTiles);
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
                    painter.renderLayer(painter, painter.style.sourceCaches[layer.source], layer, coords, true);
                    if (layer.source) rttData.rttCoords[layer.source] = this._coordsDescendingInvStr[layer.source][tileID.key];
                }
            }
            drawBufferedRttTilesFunc(this.painter, this._rttTiles);
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

    /**
     * Searches for the corresponding current renderable terrain-tiles
     * @param tileID - the tile to look for
     * @returns the tiles that were found
     */
    getTerrainCoords(tileID: OverscaledTileID): Record<string, OverscaledTileID> {
        const coords = {};
        for (const _tileID of this._renderableTiles) {
            const key = _tileID.key;
            if (_tileID.canonical.equals(tileID.canonical)) {
                const coord = tileID.clone();
                coord.posMatrix = new Float64Array(16) as any;
                mat4.ortho(coord.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                coords[key] = coord;
            } else if (_tileID.canonical.isChildOf(tileID.canonical)) {
                const coord = tileID.clone();
                coord.posMatrix = new Float64Array(16) as any;
                const dz = _tileID.canonical.z - tileID.canonical.z;
                const dx = _tileID.canonical.x - (_tileID.canonical.x >> dz << dz);
                const dy = _tileID.canonical.y - (_tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(coord.posMatrix, 0, size, 0, size, 0, 1);
                mat4.translate(coord.posMatrix, coord.posMatrix, [-dx * size, -dy * size, 0]);
                coords[key] = coord;
            } else if (tileID.canonical.isChildOf(_tileID.canonical)) {
                const coord = tileID.clone();
                coord.posMatrix = new Float64Array(16) as any;
                const dz = tileID.canonical.z - _tileID.canonical.z;
                const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
                const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(coord.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                mat4.translate(coord.posMatrix, coord.posMatrix, [dx * size, dy * size, 0]);
                mat4.scale(coord.posMatrix, coord.posMatrix, [1 / (2 ** dz), 1 / (2 ** dz), 0]);
                coords[key] = coord;
            }
        }
        return coords;
    }
}
