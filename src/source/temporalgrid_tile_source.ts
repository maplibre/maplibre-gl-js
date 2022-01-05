import VectorTileSource from './vector_tile_source';

class TemporalGridVectorTileSource extends VectorTileSource {
    // TODO support extend vector type in VectorTileSource
    // type: 'temporalgrid';
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'temporalgrid' as any;
    }
}

export default TemporalGridVectorTileSource;
