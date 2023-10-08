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

let offscreenCanvas: OffscreenCanvas;
let offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

export class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};

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

    async getImageData(imgBitmap: ImageBitmap) {
        const width = imgBitmap.width;
        const height = imgBitmap.height;
        const newWidth = width + 2;
        const newHeight = height + 2;
        if (offscreenCanvasMangled()) {
            const parsed = await readImageUsingVideoFrame(imgBitmap, -1, -1, newWidth, newHeight);
            if (parsed) return new RGBAImage({width: newWidth, height: newHeight}, parsed);
        }

        // Lazily initialize OffscreenCanvas
        if (!offscreenCanvas || !offscreenCanvasContext) {
        // Dem tiles are typically 256x256
            offscreenCanvas = new OffscreenCanvas(width, height);
            offscreenCanvasContext = offscreenCanvas.getContext('2d', {willReadFrequently: true});
        }

        offscreenCanvas.width = width;
        offscreenCanvas.height = height;

        offscreenCanvasContext.drawImage(imgBitmap, 0, 0, width, height);
        // Insert an additional 1px padding around the image to allow backfilling for neighboring data.
        const imgData = offscreenCanvasContext.getImageData(-1, -1, newWidth, newHeight);
        offscreenCanvasContext.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
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
