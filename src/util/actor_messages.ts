import type {DEMEncoding} from '../data/dem_data';
import type {OverscaledTileID} from '../source/tile_id';
import type {RGBAImage} from './image';

export type MessageType = '<response>' | '<cancel>' |
'geojson.getClusterExpansionZoom' | 'geojson.getClusterChildren' | 'geojson.getClusterLeaves' | 'geojson.loadData' |
'removeSource' | 'loadWorkerSource' | 'loadDEMTile' | 'removeDEMTile' |
'removeTile' | 'reloadTile' | 'abortTile' | 'loadTile' | 'getTile' |
'getGlyphs' | 'getImages' | 'setImages' |
'syncRTLPluginState' | 'setReferrer' | 'setLayers' | 'updateLayers';

export type AsyncMessage<T> = {
    type: MessageType;
    data: T;
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    sourceMapId?: string | number | null;
}

export type LoadDEMTileData = {
    uid: number;
    coord: OverscaledTileID;
    source: string;
    rawImageData: ImageBitmap | RGBAImage | ImageData;
    encoding: DEMEncoding;
    redFactor: number;
    greenFactor: number;
    blueFactor: number;
    baseShift: number;
}

export type LoadDEMTileMessage = AsyncMessage<LoadDEMTileData> & { type: 'loadDEMTile' };
