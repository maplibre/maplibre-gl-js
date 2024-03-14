/**
 * The possible option of the plugin's status
 *
 * `unavailable`: Not loaded.
 *
 * `deferred`: The plugin URL has been specified, but loading has been deferred.
 *
 * `requested`: at least one tile needs RTL to render, but the plugin has not been set
 *
 * `loading`: RTL is in the process of being loaded by worker.
 *
 * `loaded`: The plugin is now loaded
 *
 *  `error`: The plugin failed to load
 */
export type RTLPluginStatus =
                'unavailable' |
                'deferred' |
                'requested' |
                'loading' |
                'loaded' |
                'error';

/**
 * The RTL plugin state
 */
export type PluginState = {
    pluginStatus: RTLPluginStatus;
    pluginURL: string;
};

export const RTLPluginLoadedEventName = 'RTLPluginLoaded';

