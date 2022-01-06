import {GeoJSONWrapper, GeojsonWrapperOptions} from './geojson_wrapper';
import {EXTENT} from '../data/extent';
import {TemporalgridSourceLayers} from './temporalgrid_tile_worker_source';

export class MultiSourceLayerGeoJSONWrapper extends GeoJSONWrapper {
    super(sourceLayers: TemporalgridSourceLayers, options: GeojsonWrapperOptions) {
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
