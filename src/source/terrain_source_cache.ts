// @flow

import {OverscaledTileID} from './tile_id';
import Tile from './tile';
import EXTENT from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import Style from '../style/style';
import Texture from '../render/texture';
import {RGBAImage} from '../util/image';
import {PosArray, TriangleIndexArray} from '../data/array_types';
import posAttributes from '../data/pos_attributes';
import SegmentVector from '../data/segment';
import DEMData from '../data/dem_data';
import type Transform from '../geo/transform';
import type SourceCache from '../source/source_cache';
import type Context from '../gl/context';
import type Painter from '../render/painter';
import type RasterDEMTileSource from '../source/raster_dem_tile_source';
import type Framebuffer from '../gl/framebuffer';

class TerrainSourceCache extends Evented {
    _style: Style;
    _source: RasterDEMTileSource;
    _sourceCache: SourceCache;
    _tiles: {[_: string]: Tile};
    _renderableTiles: Array<string>;
    _loadQueue: Array<any>;
    _coordsFramebuffer: any;
    _fbo: any;
    _fboCoordsTexture: Texture;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    _mesh: any;
    _coordsIndex: Array<any>;
    _coordsTexture: Texture;
    _coordsTextureSize: number;
    _terrainTileCache: {[_: string]: string};
    _sourceTileIDs: {[_: string]: OverscaledTileID};
    _emptyDem: any;
    _emptyDemTexture: Texture;
    _emptyDemMatrix: mat4;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    meshSize: number;
    exaggeration: number;
    elevationOffset: number;
    qualityFactor: number;

    /**
     * @param {Style} style
     */
    constructor(style: Style) {
        super();
        this._style = style;
        this._tiles = {};
        this._renderableTiles = [];
        this._loadQueue = [];
        this._terrainTileCache = {};
        this._sourceTileIDs = {};
        this._coordsIndex = [];
        this._coordsTextureSize = 1024;
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.meshSize = 128;
        this.exaggeration = 1.0;
        this.elevationOffset = 450; // add a global offset of 450m to put the dead-sea into positive values.
        this.qualityFactor = 2;

        // create empty DEM Obejcts
        const context = style.map.painter.context;
        this._emptyDem = new DEMData("0", new RGBAImage({width: 4, height: 4}), "mapbox");
        this._emptyDemTexture = new Texture(context, this._emptyDem.getPixels(), context.gl.RGBA, {premultiply: false});
        this._emptyDemTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        this._emptyDemMatrix = new Float64Array(16) as any;
        mat4.ortho(this._emptyDemMatrix, 0, EXTENT, 0, EXTENT, 0, 1);

        // create empty coordsIndexTexture
        const image = new RGBAImage({width: 1, height: 1}, new Uint8Array(1 * 4));
        const texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        this._emptyDepthTexture = texture;

        // rerender corresponding tiles on source-tile updates
        style.on("data", e => {
            if (e.dataType == "source" && e.tile && this.isEnabled()) {
                const transform = style.map.transform;
                if (e.sourceId == this._sourceCache.id) {
                    for (const key in this._tiles) {
                        const tile = this._tiles[key];
                        if (tile.tileID.equals(e.coord) || tile.tileID.isChildOf(e.coord)) {
                            tile.timeLoaded = Date.now();
                            tile.rerender = true;
                        }
                    }
                    const tile = this.getTileByID(e.coord.key);
                    transform.updateElevation();
                    // delete elevationdata from coresponding tile, so that they can be reloaded on next rendering
                    // FIXME-3D! when symbol-occlusion is moved to GPU, this lines can be removed
                    for (let s in style.sourceCaches) {
                        for (let key in style.sourceCaches[s]._tiles)
                            style.sourceCaches[s]._tiles[key].elevation = {};
                    }
                } else if (e.coord) {
                    // FIXME! mark only necessary tiles to rerender
                    for (let key in this._tiles) this.getTileByID(key).rerender = true;
                  //   let dz = e.coord.canonical.z - transform.tileZoom;
                  //   let x = e.coord.canonical.x, y = e.coord.canonical.y, wrap = e.coord.wrap, z = transform.tileZoom;
                  //   const sourceTile = this.getSourceTile(dz > 0 ? new OverscaledTileID(z, wrap, z, x >> dz, y >> dz) : e.coord);
                  //   const tile = sourceTile && this.getTileByID(sourceTile.tileID.key);
                  //   if (tile) {
                  //      tile.rerender = true;
                  //   } else if (sourceTile) {
                  //      for (let key in this._tiles) {
                  //         let _tile = this.getTileByID(key);
                  //         if (_tile.tileID.isChildOf(sourceTile.tileID)) _tile.rerender = true;
                  //      }
                  //   }
                }
            }
        });
    }

    /**
     *
     * @param {SourceCache} sourceCache
     * @param options Allowed options are exaggeration, elevationOffset & meshSize
     */
    enable(sourceCache: SourceCache, options?: {exaggeration: boolean; elevationOffset: number; meshSize: number}): void {
        sourceCache.usedForTerrain = true;
        sourceCache._source.roundZoom = false;
        this._sourceCache = sourceCache;
        ['exaggeration', 'elevationOffset', 'meshSize'].forEach(key => {
            if (options && options[key] != undefined) this[key] = options[key]
        });
    }

    /**
     * remove the the 3d terrain from map.
     */
    disable(): void {
        if (!this._sourceCache) return;
        this._sourceCache.usedForTerrain = false;
        this._sourceCache._source.roundZoom = true;
        this._sourceCache = null;
        for (const key in this._tiles) {
            let tile = this._tiles[key];
            tile.textures.forEach(t => t.destroy());
            tile.textures = [];
        }
        for (let s in this._style.sourceCaches) {
            for (let key in this._style.sourceCaches[s]._tiles) {
                this._style.sourceCaches[s]._tiles[key].elevation = {};
            }
        }
        this._tiles = {};
    }

    /**
     * check if terrain is currently activated
     * @return {boolean}
     */
    isEnabled(): boolean {
       return this._sourceCache ? true : false;
    }

    /**
     * Load Terrain Tiles, removes outdated Tiles and update camera elevation.
     */
    update(transform: Transform): void {
        if (!this.isEnabled() || !this._sourceCache._sourceLoaded) return;
        this._sourceCache.update(transform);
        transform.updateElevation();
        let outdated = {};
        for (let key in this._tiles) outdated[key] = true;
        this._renderableTiles = [];
        // create tiles for current view
        for (const tileID of this.getRenderableTileIds(transform)) {
            this._renderableTiles.push(tileID.key);
            delete(outdated[tileID.key]);
            if (this._tiles[tileID.key]) continue;
            // find parent source tile
            const maxzoom = this._sourceCache._source.maxzoom;
            const sourceTileID = this._sourceTileIDs[tileID.key] = tileID.overscaledZ > maxzoom ? tileID.scaledTo(maxzoom) : tileID;
            // create pos matrix in relation to source tile
            tileID.posMatrix = new Float64Array(16) as any;
            mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
            const demMatrix = new Float64Array(16) as any;
            if (tileID.canonical.z == sourceTileID.canonical.z) {
                mat4.ortho(demMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
            } else {
                const dz = tileID.canonical.z - sourceTileID.canonical.z;
                const dx = tileID.canonical.x - (sourceTileID.canonical.x << dz);
                const dy = tileID.canonical.y - (sourceTileID.canonical.y << dz);
                mat4.ortho(demMatrix, 0, EXTENT << dz, 0, EXTENT << dz, 0, 1);
                mat4.translate(demMatrix, demMatrix, [dx * EXTENT, dy * EXTENT, 0]);
            }
            // create new tile
            this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
            this._tiles[tileID.key].demMatrix = demMatrix;
        }
        // free GPU memory from outdated tiles
        for (const key in outdated) {
            let tile = this._tiles[key];
            tile.textures.forEach(t => this._style.map.painter.saveTileTexture(t));
            if (tile.demTexture) this._style.map.painter.saveTileTexture(tile.demTexture);
            tile.textures = [];
            tile.demTexture = null;
        }
    }

    /**
     * get a list of tileIds, which should be rendered in the current scene
     * @param {Transform} transform
     * @return {Array<OverscaledTileID>}
     */
    getRenderableTileIds(transform: Transform): Array<OverscaledTileID> {
        return transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false
        });
    }

    /**
     * get a list of tiles, which are loaded and should be rendered in the current scene
     * @param {Transform} transform
     * @returns {Array<Tile>}
     */
    getRenderableTiles(transform: Transform): Array<Tile> {
        return this.getRenderableTileIds(transform).map(tileID => this.getTileByID(tileID.key)).filter(t => t);
    }

    /**
     * get a list of tile-keys which are available in cache
     * @param {Transform} transform
     * @returns {Array<string>}
     */
    getRenderableIds(): Array<string> {
        return Object.values(this._tiles).map(t => t.tileID.key);
    }

    /**
     * get terrain tile by the TileID key
     * @returns {Tile}
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * searches for the corresponding terrain-tile at a given zoomlevel
     * @param {OverscaledTileID} tileID
     * @param {number} zoom
     * @returns {Tile}
     */
    getTerrainTile(tileID: OverscaledTileID, zoom: number): Tile {
        const z = Math.floor(zoom), cacheKey = z + ":" + tileID.key;
        if (this._terrainTileCache[cacheKey]) return this.getTileByID(this._terrainTileCache[cacheKey]);
        const canonical = tileID.canonical.z > this.maxzoom ? tileID.scaledTo(this.maxzoom).canonical : tileID.canonical;
        const id = new OverscaledTileID(canonical.z > z ? canonical.z : z, tileID.wrap, canonical.z, canonical.x, canonical.y);
        this._terrainTileCache[cacheKey] = id.scaledTo(z).key;
        return this.getTileByID(this._terrainTileCache[cacheKey]);
    }

    /**
     * searches for the corresponding terrain-tiles at a given zoomlevel
     * @param {OverscaledTileID} tileID
     * @param {number} zoom
     * @returns {Tile}
     */
    getTerrainCoords(tileID: OverscaledTileID): {[_: string]: OverscaledTileID} {
        const coords = {};
        for (let key of this._renderableTiles) {
            const _tileID = this._tiles[key].tileID;
            if (_tileID.equals(tileID)) {
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

    /**
     * find the sourcetile
     * @param {OverscaledTileID} tileID
     * @returns {Tile}
     */
    getSourceTile(tileID: OverscaledTileID): Tile {
        if (!this.isEnabled()) return null;
        const coord = this._sourceTileIDs[tileID.key];
        return coord && this._sourceCache.getTileByID(coord.key);
    }

    /**
     * get the Elevation for given coordinate
     * FIXME-3D:
     *   - make linear interpolation
     *   - handle negative coordinates
     *   - interploate below ZL this.maxzoom
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     * @returns {number}
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        if (!this.isEnabled()) return this.elevationOffset;
        if (!(x >= 0 && x <= extent && y >= 0 && y <= extent)) return this.elevationOffset;
        // convert tileID to tileID.overscaledZ level
        let dz = tileID.overscaledZ - tileID.canonical.z;
        if (dz > 0) {
            const size = extent >> dz;
            const tx = (tileID.canonical.x << dz) + Math.floor(x / size);
            const ty = (tileID.canonical.y << dz) + Math.floor(y / size);
            tileID = new OverscaledTileID(tileID.overscaledZ, tileID.wrap, tileID.overscaledZ, tx, ty);
            x = (x % size) / size * extent;
            y = (y % size) / size * extent;
        }
        // search for sourceTile
        dz = tileID.overscaledZ - this._sourceCache._source.maxzoom;
        if (dz > 0) {
            const size = extent >> dz;
            const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
            const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
            tileID = tileID.scaledTo(tileID.overscaledZ - dz);
            x = dx * size + x / extent * size;
            y = dy * size + y / extent * size;
        }
        const tile = this._sourceCache.getTileByID(tileID.key);
        // get elevation from dem
        let elevation = tile && tile.dem
            ? tile.dem.get(Math.floor(x / extent * tile.dem.dim), Math.floor(y / extent * tile.dem.dim))
            : 0;
        if (elevation > 8191) elevation = 0; // REMOVEME: this hack is for MTK data, because of false nodata values
        return (elevation + this.elevationOffset);
    }

    /**
     * get the Elevation for given coordinate multiplied by exaggeration.
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     * @returns {number}
     */
    getElevationWithExaggeration(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        return this.getElevation(tileID, x, y, extent) * this.exaggeration;
    }

    /**
     * store all tile-coords in a framebuffer for unprojecting pixel coordinates
     * @param {Painter} painter
     * @returns {Framebuffer}
     */
    getFramebuffer(painter: Painter, texture: string): Framebuffer {
        const width = painter.width / devicePixelRatio;
        const height = painter.height  / devicePixelRatio;
        if (this._fbo && (this._fbo.width != width || this._fbo.height != height)) {
            this._fbo.destroy();
            this._fboCoordsTexture.destroy();
            this._fboDepthTexture.destroy();
            delete this._fbo;
            delete this._fboDepthTexture;
            delete this._fboCoordsTexture;
        }
        if (!this._fboCoordsTexture) {
            this._fboCoordsTexture = new Texture(painter.context, { width: width, height: height, data: null }, painter.context.gl.RGBA, {premultiply: false});
            this._fboCoordsTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fboDepthTexture) {
            this._fboDepthTexture = new Texture(painter.context, { width: width, height: height, data: null }, painter.context.gl.RGBA, {premultiply: false});
            this._fboDepthTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (! this._fbo) {
            this._fbo = painter.context.createFramebuffer(width, height, true);
            this._fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        this._fbo.colorAttachment.set(texture == "coords" ? this._fboCoordsTexture.texture : this._fboDepthTexture.texture);
        return this._fbo;
    }

    /**
     * get a list of tiles, loaded after a spezific time
     * @param {Date} time
     * @returns {Array<Tile>}
     */
    tilesAfterTime(time=Date.now()): Array<Tile> {
        return Object.values(this._tiles).filter(t => t.timeLoaded >= time);
    }

    /**
     * create a regular mesh which will be used by all terrain-tiles
     * @param {Context} context
     * @returns {Object}
     */
    getTerrainMesh(context: Context) {
        if (this._mesh) return this._mesh;
        const vertexArray = new PosArray(), indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize, delta = EXTENT / meshSize, meshSize2 = meshSize * meshSize;
        for (let y=0; y<=meshSize; y++) for (let x=0; x<=meshSize; x++)
            vertexArray.emplaceBack(x * delta, y * delta);
        for (let y=0; y<meshSize2; y+=meshSize+1) for (let x=0; x<meshSize; x++) {
            indexArray.emplaceBack(x+y, meshSize+x+y+1, meshSize+x+y+2);
            indexArray.emplaceBack(x+y, meshSize+x+y+2, x+y+1);
        }
        return this._mesh = {
            indexBuffer: context.createIndexBuffer(indexArray),
            vertexBuffer: context.createVertexBuffer(vertexArray, posAttributes.members),
            segments: SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        };
    }

    /**
     * returns a DEM Object for a tile. Unless the tile has data, return an flat dem object
     * @param {OverscaledTileID} tileID
     */
    getDem(tileID: OverscaledTileID): any {
        const tile = this.getTileByID(tileID.key);
        const sourceTile = this.getSourceTile(tileID);
        if (sourceTile && sourceTile.dem && !sourceTile.demTexture) {
            let context = this._style.map.painter.context;
            sourceTile.demTexture = this._style.map.painter.getTileTexture(sourceTile.dem.dim);
            if (sourceTile.demTexture) sourceTile.demTexture.update(sourceTile.dem.getPixels(), {premultiply: false});
            else sourceTile.demTexture = new Texture(context, sourceTile.dem.getPixels(), context.gl.RGBA, {premultiply: false});
            sourceTile.demTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        }
        return {
            unpackVector: (sourceTile && sourceTile.dem || this._emptyDem).getUnpackVector(),
            texture: (sourceTile && sourceTile.demTexture || this._emptyDemTexture).texture,
            matrix: tile && tile.demMatrix || this._emptyDemMatrix,
        };
    }

    /**
     * create coords texture, needed to grab coordinates from canvas
     * encode coords coordinate into 4 bytes:
     *   - 8 lower bits for x
     *   - 8 lower bits for y
     *   - 4 higher bits for x
     *   - 4 higher bits for y
     *   - 8 bits for coordsIndex (1 .. 255) (= number of terraintile), is later setted in draw_terrain uniform value
     * @param {Context} context
     * @returns {Texture}
     */
    getCoordsTexture(context: Context): Texture {
        if (this._coordsTexture) return this._coordsTexture;
        const data = new Uint8Array(this._coordsTextureSize * this._coordsTextureSize * 4);
        for (let y=0, i=0; y<this._coordsTextureSize; y++) for (let x=0; x<this._coordsTextureSize; x++, i+=4) {
            data[i + 0] = x & 255;
            data[i + 1] = y & 255;
            data[i + 2] = ((x >> 8) << 4) | (y >> 8);
            data[i + 3] = 0;
        }
        let image = new RGBAImage({width: this._coordsTextureSize, height: this._coordsTextureSize}, new Uint8Array(data.buffer));
        let texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        texture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        return this._coordsTexture = texture;
    }

    getDepthTexture(): Texture {
       return  this._fboCoordsTexture || this._emptyDepthTexture;
    }
}

export default TerrainSourceCache;
