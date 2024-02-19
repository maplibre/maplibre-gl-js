/**
 * The possible option of the plugin's status
 *
 * `unavailable`: Not loaded.
 *
 * `deferred`: The plugin URL has been specified, but loading has been deferred.
 *
 * `loading`: request in-flight.
 *
 * `loaded`: The plugin is now loaded
 *
 *  `error`: The plugin failed to load
 */
export type RTLPluginStatus = 'unavailable' | 'deferred' | 'loading' | 'loaded' | 'error';

/**
 * The RTL plugin state
 */
export type PluginState = {
    pluginStatus: RTLPluginStatus;
    pluginURL: string;
};
