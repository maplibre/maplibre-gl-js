import {pick, extend} from '../util/util';

import {getJSON} from '../util/ajax';
import {ResourceType} from '../util/request_manager';
import {browser} from '../util/browser';

import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';
import type {RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

export function loadTileJson(
    options: RasterSourceSpecification | RasterDEMSourceSpecification | VectorSourceSpecification,
    requestManager: RequestManager,
    callback: Callback<TileJSON>
): Cancelable {
    // HM TODO: change this to promise
    const loaded = (tileJSON: any) => {
        if (tileJSON) {
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
        const abortController = new AbortController();
        getJSON<TileJSON>(requestManager.transformRequest(options.url, ResourceType.Source), abortController)
            .then((response) => loaded(response.data))
            .catch((err) => callback(err));
        return {
            cancel: () => {
                abortController.abort();
            }
        };
    } else {
        return browser.frame(() => loaded(options));
    }
}
