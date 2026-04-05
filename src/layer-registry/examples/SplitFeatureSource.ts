import {MapResource} from '../MapResource';
import type {Map} from '../../ui/map';

/**
 * All logic for updating data can go in here
 * Sources are primarily for handling map sources but could also be used for other purposes
 * whatever logic needs to run while a FeatureLayer is active can live in a MapResource
 */
export class SplitFeatureSource extends MapResource{
    constructor(map: Map) {
        super('split-feature-source', map);
    }

    async load() {
        this.map.addSource('split-feature-source', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []},
        });
    }

    unload(): void {
        this.map.removeSource('split-feature-source');
    }

}
