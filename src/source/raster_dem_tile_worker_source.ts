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
import {Callback} from '../types/callback';

let offscreenCanvas: OffscreenCanvas;
let offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

export class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};

    constructor() {
        this.loaded = {};
    }

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData, redFactor, greenFactor, blueFactor, baseShift} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        const finish = (err: Error, imagePixels: RGBAImage) => {
            if (err) {
                callback(err);
            } else {
                const dem = new DEMData(uid, imagePixels, encoding, redFactor, greenFactor, blueFactor, baseShift);
                this.loaded = this.loaded || {};
                this.loaded[uid] = dem;
                callback(null, dem);
            }
        };
        if (isImageBitmap(rawImageData)) {
            this.getImageData(rawImageData, finish);
        } else {
            finish(null, rawImageData as RGBAImage);
        }
    }

    getImageData(imgBitmap: ImageBitmap, callback: Callback<RGBAImage>) {
        const width = imgBitmap.width;
        const height = imgBitmap.height;
        if (offscreenCanvasMangled()) {
            readImageUsingVideoFrame(imgBitmap, -1, -1, width + 2, height + 2, (err, parsed) => {
                if (err) fallback();
                else callback(null,  new RGBAImage({width: width + 2, height: height + 2}, parsed));
            });
        } else {
            fallback();
        }

        function fallback() {
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
            const imgData = offscreenCanvasContext.getImageData(-1, -1, width + 2, height + 2);
            offscreenCanvasContext.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            callback(null, new RGBAImage({width: imgData.width, height: imgData.height}, imgData.data));
        }
    }

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}
