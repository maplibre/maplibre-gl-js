import Painter from './painter';
import Tile from '../source/tile';
import Color from '../style-spec/util/color';
import {OverscaledTileID} from '../source/tile_id';
import {prepareTerrain, drawTerrain} from './draw_terrain';
import type StyleLayer from '../style/style_layer';

/**
 * RenderToTexture
 */
export default class RenderToTexture {
    painter: Painter;
    // this object holds a lookup table which layers should rendered to texture
    _renderToTexture: {[keyof in StyleLayer['type']]?: boolean};
    // coordsDescendingInv contains a list of all tiles which should be rendered for one render-to-texture tile
    // e.g. render 4 raster-tiles with size 256px to the 512px render-to-texture tile
    _coordsDescendingInv: {[_: string]: {[_:string]: Array<OverscaledTileID>}} = {};
    // create a string representation of all to tiles rendered to render-to-texture tiles
    // this string representation is used to check if tile should be re-rendered.
    _coordsDescendingInvStr: {[_: string]: {[_:string]: string}} = {};
    // store for render-stacks
    // a render stack is a set of layers which should be rendered into one texture
    // every stylesheet can have multipe stacks. A new stack is created if layers which should
    // not rendered to texture sit inbetween layers which should rendered to texture. e.g. hillshading or symbols
    _stacks: Array<Array<string>>;
    // remember the previous processed layer to check if a new stack is needed
    _prevType: string;
    // create a lookup which tiles should rendered to texture
    _rerender: {[_: string]: boolean};
    // a list of tiles that can potentially rendered
    _renderableTiles: Array<Tile>;

    constructor(painter: Painter) {
        this.painter = painter;
        this._renderToTexture = {background: true, fill: true, line: true, raster: true};
        this._coordsDescendingInv = {};
        this._coordsDescendingInvStr = {};
        this._stacks = [];
        this._prevType = null;
        this._rerender = {};
        this._renderableTiles = painter.style.terrain.sourceCache.getRenderableTiles();
        this._init();
    }

    _init() {
        const style = this.painter.style;
        const terrain = style.terrain;

        // fill _coordsDescendingInv
        for (const id in style.sourceCaches) {
            this._coordsDescendingInv[id] = {};
            const tileIDs = style.sourceCaches[id].getVisibleCoordinates();
            for (const tileID of tileIDs) {
                const keys = terrain.sourceCache.getTerrainCoords(tileID);
                for (const key in keys) {
                    if (!this._coordsDescendingInv[id][key]) this._coordsDescendingInv[id][key] = [];
                    this._coordsDescendingInv[id][key].push(keys[key]);
                }
            }
        }

        // fill _coordsDescendingInvStr
        for (const id of style._order) {
            const layer = style._layers[id], source = layer.source;
            if (this._renderToTexture[layer.type]) {
                if (!this._coordsDescendingInvStr[source]) {
                    this._coordsDescendingInvStr[source] = {};
                    for (const key in this._coordsDescendingInv[source])
                        this._coordsDescendingInvStr[source][key] = this._coordsDescendingInv[source][key].map(c => c.key).sort().join();
                }
            }
        }

        // remove cached textures
        this._renderableTiles.forEach(tile => {
            for (const source in this._coordsDescendingInvStr) {
                // rerender if there are more coords to render than in the last rendering
                const coords = this._coordsDescendingInvStr[source][tile.tileID.key];
                if (coords && coords !== tile.textureCoords[source]) tile.clearTextures(this.painter);
                // rerender if tile is marked for rerender
                if (terrain.needsRerender(source, tile.tileID)) tile.clearTextures(this.painter);
            }
            this._rerender[tile.tileID.key] = !tile.textures.length;
        });
        terrain.clearRerenderCache();
        terrain.sourceCache.removeOutdated(this.painter);

        return this;
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
        const type = layer.type;
        const painter = this.painter;
        const layerIds = painter.style._order;
        const currentLayer = painter.currentLayer;
        const isLastLayer = currentLayer + 1 === layerIds.length;

        // remember background, fill, line & raster layer to render into a stack
        if (this._renderToTexture[type]) {
            if (!this._prevType || !this._renderToTexture[this._prevType]) this._stacks.push([]);
            this._prevType = type;
            this._stacks[this._stacks.length - 1].push(layerIds[currentLayer]);
            // rendering is done later, all in once
            if (!isLastLayer) return true;
        }

        // in case a stack is finished render all collected stack-layers into a texture
        if (this._renderToTexture[this._prevType] || type === 'hillshade' || (this._renderToTexture[type] && isLastLayer)) {
            this._prevType = type;
            const stack = this._stacks.length - 1, layers = this._stacks[stack] || [];
            for (const tile of this._renderableTiles) {
                prepareTerrain(painter, painter.style.terrain, tile, stack);
                if (this._rerender[tile.tileID.key]) {
                    painter.context.clear({color: Color.transparent});
                    for (let l = 0; l < layers.length; l++) {
                        const layer = painter.style._layers[layers[l]];
                        const coords = layer.source ? this._coordsDescendingInv[layer.source][tile.tileID.key] : [tile.tileID];
                        painter._renderTileClippingMasks(layer, coords);
                        painter.renderLayer(painter, painter.style.sourceCaches[layer.source], layer, coords);
                        if (layer.source) tile.textureCoords[layer.source] = this._coordsDescendingInvStr[layer.source][tile.tileID.key];
                    }
                }
                drawTerrain(painter, painter.style.terrain, tile);
            }

            // the hillshading layer is a special case because it changes on every camera-movement
            // so rerender it in any case.
            if (type === 'hillshade') {
                this._stacks.push([layerIds[currentLayer]]);
                for (const tile of this._renderableTiles) {
                    const coords = this._coordsDescendingInv[layer.source][tile.tileID.key];
                    prepareTerrain(painter, painter.style.terrain, tile, this._stacks.length - 1);
                    painter.context.clear({color: Color.transparent});
                    painter._renderTileClippingMasks(layer, coords);
                    painter.renderLayer(painter, painter.style.sourceCaches[layer.source], layer, coords);
                    drawTerrain(painter, painter.style.terrain, tile);
                }
                return true;
            }

            return this._renderToTexture[type];
        }

        return false;
    }

}
