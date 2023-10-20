import type {WorkerDEMTileParameters} from '../source/worker_source';
import type {RGBAImage} from './image';

export type MessageType = '<response>' | '<cancel>' |
'geojson.getClusterExpansionZoom' | 'geojson.getClusterChildren' | 'geojson.getClusterLeaves' | 'geojson.loadData' |
'removeSource' | 'loadWorkerSource' | 'loadDEMTile' | 'removeDEMTile' |
'removeTile' | 'reloadTile' | 'abortTile' | 'loadTile' | 'getTile' |
'getGlyphs' | 'getImages' | 'setImages' |
'syncRTLPluginState' | 'setReferrer' | 'setLayers' | 'updateLayers';

type AsyncMessage<T> = {
    type: MessageType;
    data: T;
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    sourceMapId?: string | number | null;
};

type LoadDEMTileMessage = AsyncMessage<WorkerDEMTileParameters> & { type: 'loadDEMTile' };

export type ActorMessage = LoadDEMTileMessage; // | ...
