// @flow

import Martini from '@mapbox/martini';
import DEMData from '../data/dem_data';
import {RGBAImage} from '../util/image';
import window from '../util/window';
import EXTENT from '../data/extent';
import {Pos3DArray, TriangleIndexArray} from '../data/array_types';
import type Actor from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';
const {ImageBitmap} = window;

class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: CanvasRenderingContext2D;

    constructor() {
        this.loaded = {};
    }

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        const imagePixels = (ImageBitmap && rawImageData instanceof ImageBitmap) ? this.getImageData(rawImageData) : rawImageData;
        const dem = new DEMData(uid, imagePixels, encoding);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, { dem: dem, mesh: null });
    }

    getImageData(imgBitmap: ImageBitmap): RGBAImage {
        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            this.offscreenCanvasContext = this.offscreenCanvas.getContext('2d');
        }

        this.offscreenCanvas.width = imgBitmap.width;
        this.offscreenCanvas.height = imgBitmap.height;

        this.offscreenCanvasContext.drawImage(imgBitmap, 0, 0, imgBitmap.width, imgBitmap.height);
        // Insert an additional 1px padding around the image to allow backfilling for neighboring data.
        const imgData = this.offscreenCanvasContext.getImageData(-1, -1, imgBitmap.width + 2, imgBitmap.height + 2);
        this.offscreenCanvasContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        return new RGBAImage({width: imgData.width, height: imgData.height}, imgData.data);
    }

    createTerrainMesh(dem, resolution) {
        // load terrain from dem data
        const dim = dem.dim, dim1 = dim + 1; // add right/bottom overlap
        const terrain = new Array(dim1 * dim1);
        for (let y=0; y<dim+1; y++)
            for (let x=0; x<dim+1; x++)
                terrain[y * (dim+1) + x] = dem.get(x, y);
        // create mesh
        const mesh = new Martini(dim+1).createTile(terrain).getMesh(resolution);
        const vertexArray = new Pos3DArray();
        const indexArray = new TriangleIndexArray();
      //   console.log(mesh.vertices.length);
        vertexArray.reserve(mesh.vertices.length / 2);
        for (let i=0; i<mesh.vertices.length; i+=2) {
            let x = mesh.vertices[i], y = mesh.vertices[i+1], z = terrain[y * dim1 + x];
            vertexArray.emplaceBack(x / dim * EXTENT, y / dim * EXTENT, z < 0 ? 0 : z);
        }
        indexArray.reserve(mesh.triangles / 3);
        for (let i=0; i<mesh.triangles.length; i+=3)
            indexArray.emplaceBack(mesh.triangles[i], mesh.triangles[i+1], mesh.triangles[i+2]);
        return { indexArray: indexArray, vertexArray: vertexArray };
    }

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

export default RasterDEMTileWorkerSource;
