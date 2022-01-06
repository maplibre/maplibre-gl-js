import {VectorTileSource} from './vector_tile_source';

export class TemporalGridVectorTileSource extends VectorTileSource {
    // support extend vector type in VectorTileSource
    // type: 'temporalgrid';
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'temporalgrid' as any;
    }
}
