import {DEMData} from '../data/dem_data';
import {RGBAImage} from '../util/image';
import type {Actor} from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';
import {isImageBitmap, readImageUsingVideoFrame} from '../util/util';
import {offscreenCanvasMangled} from '../util/offscreen_canvas_mangled';

export class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

    constructor() {
        this.loaded = {};
    }

    async loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData, redFactor, greenFactor, blueFactor, baseShift} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        const imagePixels = isImageBitmap(rawImageData) ? await this.getImageData(rawImageData) : rawImageData as RGBAImage;
        const dem = new DEMData(uid, imagePixels, encoding, redFactor, greenFactor, blueFactor, baseShift);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
    }

    async getImageData(imgBitmap: ImageBitmap): Promise<RGBAImage> {
        if (offscreenCanvasMangled()) {
            const parsed = await readImageUsingVideoFrame(imgBitmap, -1, -1, imgBitmap.width + 2, imgBitmap.height + 2);
            if (parsed) return new RGBAImage({width: imgBitmap.width + 2, height: imgBitmap.height + 2}, parsed);
        }

        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            this.offscreenCanvasContext = this.offscreenCanvas.getContext('2d', {willReadFrequently: true});
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
