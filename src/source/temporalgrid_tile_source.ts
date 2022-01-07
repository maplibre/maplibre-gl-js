import {VectorTileSource} from './vector_tile_source';

export class TemporalGridVectorTileSource extends VectorTileSource {
    // type: 'temporalgrid'; pending to extend VectorTileSource to allow overrriding
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'temporalgrid' as any;
    }
}
