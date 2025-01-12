import {pick, extend, type TileJSON} from '../util/util';
import {getJSON} from '../util/ajax';
import {ResourceType} from '../util/request_manager';
import {browser} from '../util/browser';

import type {RequestManager} from '../util/request_manager';
import type {RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

export type LoadTileJsonResponse = {
    tiles: Array<string>;
    minzoom: number;
    maxzoom: number;
    attribution: string;
    bounds: RasterSourceSpecification['bounds'];
    scheme: RasterSourceSpecification['scheme'];
    tileSize: number;
    encoding: RasterDEMSourceSpecification['encoding'];
    vectorLayerIds?: Array<string>;
};

export async function loadTileJson(
    options: RasterSourceSpecification | RasterDEMSourceSpecification | VectorSourceSpecification,
    requestManager: RequestManager,
    abortController: AbortController,
): Promise<LoadTileJsonResponse | null> {
    let tileJSON: TileJSON | typeof options = options;
    if (options.url) {
        const response = await getJSON<TileJSON>(requestManager.transformRequest(options.url, ResourceType.Source), abortController);
        tileJSON = response.data;
    } else {
        await browser.frameAsync(abortController);
    }
    if (!tileJSON) {
        return null;
    }
    const result = pick(
        // explicit source options take precedence over TileJSON
        extend(tileJSON, options),
        ['tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'scheme', 'tileSize', 'encoding']
    ) as LoadTileJsonResponse;

    if ('vector_layers' in tileJSON && tileJSON.vector_layers) {
        result.vectorLayerIds = tileJSON.vector_layers.map((layer) => { return layer.id; });
    }

    return result;
}
