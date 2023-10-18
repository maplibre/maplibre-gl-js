import {DEMData} from '../data/dem_data';
import {RGBAImage} from '../util/image';
import type {Actor} from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';
import {getImageData, isImageBitmap} from '../util/util';

export class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};

    constructor() {
        this.loaded = {};
    }

    async loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData, redFactor, greenFactor, blueFactor, baseShift} = params;
        const width = rawImageData.width + 2;
        const height = rawImageData.height + 2;
        const imagePixels: RGBAImage = isImageBitmap(rawImageData) ?
            new RGBAImage({width, height}, await getImageData(rawImageData, -1, -1, width, height)) :
            rawImageData;
        const dem = new DEMData(uid, imagePixels, encoding, redFactor, greenFactor, blueFactor, baseShift);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
    }

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}
