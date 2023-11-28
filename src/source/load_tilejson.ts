import {pick, extend} from '../util/util';
import {getJSON} from '../util/ajax';
import {ResourceType} from '../util/request_manager';
import {browser} from '../util/browser';

import type {RequestManager} from '../util/request_manager';
import type {TileJSON} from '../types/tilejson';
import type {RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

export async function loadTileJson(
    options: RasterSourceSpecification | RasterDEMSourceSpecification | VectorSourceSpecification,
    requestManager: RequestManager,
    abortController: AbortController,
): Promise<TileJSON> {
    let tileJSON: TileJSON | typeof options = options;
    if (options.url) {
        const response = await getJSON<TileJSON>(requestManager.transformRequest(options.url, ResourceType.Source), abortController);
        tileJSON = response.data;
    } else {
        await browser.frameAsync(abortController);
    }
    if (tileJSON) {
        const result: TileJSON = pick(
            // explicit source options take precedence over TileJSON
            extend(tileJSON, options),
            ['tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'scheme', 'tileSize', 'encoding']
        );

        if ('vector_layers' in tileJSON) {
            result.vectorLayerIds = tileJSON.vector_layers.map((layer) => { return layer.id; });
        }

        return result;
    }
}
