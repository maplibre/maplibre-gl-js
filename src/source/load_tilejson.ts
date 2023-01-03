import {pick, extend} from '../util/util';

import {getJSON, ResourceType} from '../util/ajax';
import browser from '../util/browser';

import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';
import type {RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification} from '../style-spec/types.g';

export default function loadTileJson(
    options: RasterSourceSpecification | RasterDEMSourceSpecification | VectorSourceSpecification,
    requestManager: RequestManager,
    callback: Callback<TileJSON>
): Cancelable {
    const loaded = function(err: Error, tileJSON: any) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            const result: any = pick(
                // explicit source options take precedence over TileJSON
                extend(tileJSON, options),
                ['tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'scheme', 'tileSize', 'encoding']
            );

            if (tileJSON.vector_layers) {
                result.vectorLayers = tileJSON.vector_layers;
                result.vectorLayerIds = result.vectorLayers.map((layer) => { return layer.id; });
            }

            callback(null, result);
        }
    };

    if (options.url) {
        const request = getJSON(requestManager.transformRequest(options.url, ResourceType.Source));

        request.response.then((response) => {
            loaded(null, response.data);
        }).catch(err => {
            loaded(err, options);
        });

        return request;
    } else {
        return browser.frame(() => loaded(null, options));
    }
}
