import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';

export function getFeatureId<T extends GeoJSON.Feature | VectorTileFeature>(feature: T, promoteId: PromoteIdSpecification | undefined, sourceLayerId?: string): T['id'] {
    let id: T['id'] = feature.id;
    if (promoteId) {
        const propName = typeof promoteId === 'string' ? promoteId : promoteId[sourceLayerId];
        id = feature.properties[propName];
        if (typeof id === 'boolean') id = Number(id);

        // When cluster is true, the id is the cluster_id even though promoteId is set
        if (id === undefined && feature.properties?.cluster && promoteId) {
            id = Number(feature.properties.cluster_id);
        }
    }
    return id;
}
