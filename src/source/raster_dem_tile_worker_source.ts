import DEMData from '../data/dem_data';
import {RGBAImage} from '../util/image';
import type Actor from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';
import {isImageBitmap} from '../util/util';

class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

    constructor() {
        this.loaded = {};
    }

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        const imagePixels = isImageBitmap(rawImageData) ? this.getImageData(rawImageData) : rawImageData as RGBAImage;
        const dem = new DEMData(uid, imagePixels, encoding);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
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

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

export default RasterDEMTileWorkerSource;
