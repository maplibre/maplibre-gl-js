import {type AddProtocolAction, config} from '../util/config.ts';

export function getProtocol(url: string): AddProtocolAction {
    return config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];
}
/**
 * Adds a custom load resource function that will be called when using a URL that starts with a custom url schema.
 * This will happen in the main thread, and workers might call it if they don't know how to handle the protocol.
 * The example below will be triggered for custom:// urls defined in the sources list in the style definitions.
 * The function passed will receive the request parameters and should return with the resulting resource.
 * `requestParameters.type` says which kind of resource is expected. A tile is an `ArrayBuffer`, for example
 * a non-compressed pbf vector tile. An image is either its encoded bytes or an `ImageBitmap`/`HTMLImageElement`,
 * which is used without decoding. See {@link AddProtocolResponseData} for every accepted shape.
 *
 * @param customProtocol - the protocol to hook, for example 'custom'
 * @param loadFn - the function to use when trying to fetch a tile specified by the customProtocol
 * @example
 * ```ts
 * // This will fetch a file using the fetch API (this is obviously a non interesting example...)
 * addProtocol('custom', async (params, abortController) => {
 *      const t = await fetch(`https://${params.url.split("://")[1]}`);
 *      if (t.status == 200) {
 *          const buffer = await t.arrayBuffer();
 *          return {data: buffer}
 *      } else {
 *          throw new Error(`Tile fetch error: ${t.statusText}`);
 *      }
 *  });
 * // the following is an example of a way to return an error when trying to load a tile
 * addProtocol('custom2', async (params, abortController) => {
 *      throw new Error('someErrorMessage');
 * });
 * // An image handler that draws or computes its tiles can return them decoded, as an ImageBitmap.
 * addProtocol('drawn', async (params, abortController) => {
 *      const canvas = new OffscreenCanvas(256, 256);
 *      // ... draw the tile ...
 *      return {data: await createImageBitmap(canvas)};
 * });
 * ```
 * @see [Add a COG raster source](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-cog-raster-source/)
 * @see [Add Contour Lines](https://maplibre.org/maplibre-gl-js/docs/examples/add-contour-lines/)
 * @see [PMTiles source and protocol](https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/)
 * @see [Use addProtocol to Transform Feature Properties](https://maplibre.org/maplibre-gl-js/docs/examples/use-addprotocol-to-transform-feature-properties/)
 */
export function addProtocol(customProtocol: string, loadFn: AddProtocolAction): void {
    config.REGISTERED_PROTOCOLS[customProtocol] = loadFn;
}

/**
 * Removes a previously added protocol in the main thread.
 *
 * @param customProtocol - the custom protocol to remove registration for
 * @example
 * ```ts
 * removeProtocol('custom');
 * ```
 */
export function removeProtocol(customProtocol: string): void {
    delete config.REGISTERED_PROTOCOLS[customProtocol];
}
