import {getJSON} from '../util/ajax.ts';
import {browser} from '../util/browser.ts';

import type {TileJSON} from '../util/util.ts';
import type {RequestManager} from '../util/request_manager.ts';
import type {RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * What a tiled source learns from its TileJSON. A field is undefined where neither the source options nor the
 * TileJSON set it, so that the source keeps its own default.
 */
export type LoadTileJsonResponse = {
    tiles?: string[];
    minzoom?: number;
    maxzoom?: number;
    attribution?: string;
    bounds?: RasterSourceSpecification['bounds'];
    scheme?: RasterSourceSpecification['scheme'];
    tileSize?: number;
    encoding?: RasterDEMSourceSpecification['encoding'] | VectorSourceSpecification['encoding'];
    sparse?: boolean;
    vectorLayerIds?: string[];
};

/** The fields a source's options and its TileJSON can both set, the options taking precedence. */
type TileJsonFields = Omit<LoadTileJsonResponse, 'vectorLayerIds'>;

export async function loadTileJson(
    options: RasterSourceSpecification | RasterDEMSourceSpecification | VectorSourceSpecification,
    requestManager: RequestManager,
    abortController: AbortController,
    targetWindow?: Window,
): Promise<LoadTileJsonResponse | null> {
    let tileJSON: TileJSON | typeof options = options;
    if (options.url) {
        const response = await getJSON<TileJSON>(await requestManager.transformRequest(options.url, 'Source'), abortController);
        tileJSON = response.data;
    } else {
        await browser.frameAsync(abortController, targetWindow);
    }
    if (!tileJSON) {
        return null;
    }
    const fromOptions: TileJsonFields = options;
    const fromTileJSON: TileJsonFields = tileJSON;
    const result: LoadTileJsonResponse = {
        tiles: fromOptions.tiles ?? fromTileJSON.tiles,
        minzoom: fromOptions.minzoom ?? fromTileJSON.minzoom,
        maxzoom: fromOptions.maxzoom ?? fromTileJSON.maxzoom,
        attribution: fromOptions.attribution ?? fromTileJSON.attribution,
        bounds: fromOptions.bounds ?? fromTileJSON.bounds,
        scheme: fromOptions.scheme ?? fromTileJSON.scheme,
        tileSize: fromOptions.tileSize ?? fromTileJSON.tileSize,
        encoding: fromOptions.encoding ?? fromTileJSON.encoding,
        sparse: fromOptions.sparse ?? fromTileJSON.sparse,
    };

    if ('vector_layers' in tileJSON && tileJSON.vector_layers) {
        result.vectorLayerIds = tileJSON.vector_layers.map((layer) => layer.id);
    }

    return result;
}
