import type {VectorTileLayer, VectorTile} from '@mapbox/vector-tile';
import GeoJSONWrapper, {GeojsonWrapperOptions} from './geojson_wrapper';
import EXTENT from '../data/extent';

class MultiSourceLayerGeoJSONWrapper implements VectorTile, VectorTileLayer {
    layers: {[_: string]: VectorTileLayer};
    constructor(sourceLayers, options: GeojsonWrapperOptions) {
        const {extent = EXTENT} = options || {};
        const layers = {};
        Object.keys(sourceLayers).forEach((sourceLayerName) => {
            layers[sourceLayerName] = new GeoJSONWrapper(sourceLayers[sourceLayerName].features, {
                name: sourceLayerName,
                extent
            });
        });
        this.layers = layers;
    }
}

export default MultiSourceLayerGeoJSONWrapper;
