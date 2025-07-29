import {type AddProtocolAction, config} from '../util/config';

export function getProtocol(url: string) {
    return config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];
}
/**
 * Adds a custom load resource function that will be called when using a URL that starts with a custom url schema.
 * This will happen in the main thread, and workers might call it if they don't know how to handle the protocol.
 * The example below will be triggered for custom:// urls defined in the sources list in the style definitions.
 * The function passed will receive the request parameters and should return with the resulting resource,
 * for example a pbf vector tile, non-compressed, represented as ArrayBuffer.
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
 * ```
 */
export function addProtocol(customProtocol: string, loadFn: AddProtocolAction) {
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
export function removeProtocol(customProtocol: string) {
    delete config.REGISTERED_PROTOCOLS[customProtocol];
}
