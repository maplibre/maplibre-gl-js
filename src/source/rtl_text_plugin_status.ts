/**
 * The possible option of the plugin's status
 *
 * @deprecated Right-to-left text is drawn without a plugin, so this describes only a plugin set
 * through the deprecated {@link setRTLTextPlugin}.
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
 *
 * @deprecated Right-to-left text is drawn without a plugin, so this describes only a plugin set
 * through the deprecated {@link setRTLTextPlugin}.
 */
export type PluginState = {
    pluginStatus: RTLPluginStatus;
    pluginURL: string;
};

/**
 * Fired once a plugin set through {@link setRTLTextPlugin} has loaded, so that tiles drawn before it
 * arrived can be drawn again.
 *
 * @deprecated Right-to-left text is drawn without a plugin, so nothing has to be waited for.
 */
export const RTLPluginLoadedEventName = 'RTLPluginLoaded';

