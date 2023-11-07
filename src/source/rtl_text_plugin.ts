import {getArrayBuffer} from '../util/ajax';
import {browser} from '../util/browser';
import {Event, Evented} from '../util/evented';
import {isWorker} from '../util/util';

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
type RTLPlginStatus = 'unavailable' | 'deferred' | 'loading' | 'loaded' | 'error';

/**
 * The RTL plugin state
 */
export type PluginState = {
    pluginStatus: RTLPlginStatus;
    pluginURL: string;
};

/**
 * An error callback
 */
type ErrorCallback = (error?: Error | string | null) => void;
type PluginStateSyncCallback = (state: PluginState) => void;
let _completionCallback: ErrorCallback = null;

//Variables defining the current state of the plugin
let pluginStatus: RTLPlginStatus = 'unavailable';
let pluginURL = null;

export const triggerPluginCompletionEvent = (error: string | Error) => {
    // NetworkError's are not correctly reflected by the plugin status which prevents reloading plugin
    if (error && typeof error === 'string' && error.indexOf('NetworkError') > -1) {
        pluginStatus = 'error';
    }

    if (_completionCallback) {
        _completionCallback(error);
    }
};

function sendPluginStateToWorker() {
    evented.fire(new Event('pluginStateChange', {pluginStatus, pluginURL}));
}

export const evented = new Evented();

export const getRTLTextPluginStatus = () => {
    return pluginStatus;
};

export const registerForPluginStateChange = (callback: PluginStateSyncCallback) => {
    // Do an initial sync of the state
    callback({pluginStatus, pluginURL});
    // Listen for all future state changes
    evented.on('pluginStateChange', callback);
    return callback;
};

export const clearRTLTextPlugin = () => {
    pluginStatus = 'unavailable';
    pluginURL = null;
    _completionCallback = null;
};

export const setRTLTextPlugin = (url: string, callback?: ErrorCallback, deferred: boolean = false) => {
    if (pluginStatus === 'deferred' || pluginStatus === 'loading' || pluginStatus === 'loaded') {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginURL = browser.resolveURL(url);
    pluginStatus = 'deferred';
    _completionCallback = callback;
    sendPluginStateToWorker();

    //Start downloading the plugin immediately if not intending to lazy-load
    if (!deferred) {
        downloadRTLTextPlugin();
    }
};

export const downloadRTLTextPlugin = () => {
    if (pluginStatus !== 'deferred' || !pluginURL) {
        throw new Error('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
    }
    pluginStatus = 'loading';
    sendPluginStateToWorker();
    getArrayBuffer({url: pluginURL}, new AbortController()).then(() => {
        pluginStatus = 'loaded';
        sendPluginStateToWorker();
    }).catch((error) => {
        if (error) {
            triggerPluginCompletionEvent(error);
        }
    });
};

export const plugin: {
    applyArabicShaping: Function;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>);
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>);
    isLoaded: () => boolean;
    isLoading: () => boolean;
    setState: (state: PluginState) => void;
    isParsed: () => boolean;
    getPluginURL: () => string;
} = {
    applyArabicShaping: null,
    processBidirectionalText: null,
    processStyledBidirectionalText: null,
    isLoaded() {
        return pluginStatus === 'loaded' || // Main Thread: loaded if the completion callback returned successfully
            plugin.applyArabicShaping != null; // Web-worker: loaded if the plugin functions have been compiled
    },
    isLoading() { // Main Thread Only: query the loading status, this function does not return the correct value in the worker context.
        return pluginStatus === 'loading';
    },
    setState(state: PluginState) { // Worker thread only: this tells the worker threads that the plugin is available on the Main thread
        if (!isWorker(self)) throw new Error('Cannot set the state of the rtl-text-plugin when not in the web-worker context');

        pluginStatus = state.pluginStatus;
        pluginURL = state.pluginURL;
    },
    isParsed(): boolean {
        if (!isWorker(self)) throw new Error('rtl-text-plugin is only parsed on the worker-threads');

        return plugin.applyArabicShaping != null &&
            plugin.processBidirectionalText != null &&
            plugin.processStyledBidirectionalText != null;
    },
    getPluginURL(): string {
        if (!isWorker(self)) throw new Error('rtl-text-plugin url can only be queried from the worker threads');
        return pluginURL;
    }
};

export const lazyLoadRTLTextPlugin = () => {
    if (!plugin.isLoading() &&
        !plugin.isLoaded() &&
        getRTLTextPluginStatus() === 'deferred'
    ) {
        downloadRTLTextPlugin();
    }
};
