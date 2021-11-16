import {pick, extend} from '../util/util';

import {getJSON, ResourceType, getReferrer} from '../util/ajax';
import browser from '../util/browser';

import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';

export default function(options: any, requestManager: RequestManager, callback: Callback<TileJSON>): Cancelable {
    let tileBaseUrl;
    if (options.url && options.baseUrl)
        tileBaseUrl = requestManager.absoluteURL(options.url, options.baseUrl)
    else
        tileBaseUrl = requestManager.absoluteURL(options.url || options.baseUrl, getReferrer());
    const loaded = function(err: Error, tileJSON: any) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            const result: any = pick(
                // explicit source options take precedence over TileJSON
                extend(tileJSON, options),
                ['tiles', 'minzoom', 'maxzoom', 'attribution', 'maplibreLogo', 'bounds', 'scheme', 'tileSize', 'encoding']
            );

            if (tileJSON.vector_layers) {
                result.vectorLayers = tileJSON.vector_layers;
                result.vectorLayerIds = result.vectorLayers.map((layer) => { return layer.id; });
            }

            result.tileBaseUrl = tileBaseUrl;

            callback(null, result);
        }
    };

    if (options.url) {
        return getJSON(requestManager.transformRequest(requestManager.absoluteURL(options.url, options.baseUrl), ResourceType.Source), loaded);
    } else {
        return browser.frame(() => loaded(null, options));
    }
}
