import {getArrayBuffer} from '../util/ajax';
import {browser} from '../util/browser';
import {Event, Evented} from '../util/evented';
import {PluginState, RTLPlginStatus} from './rtl_plugin_status';

/**
* An error callback
*/
type ErrorCallback = (error?: Error | null) => void;
type PluginStateSyncCallback = (state: PluginState) => void;

class RTLMainThreadPlugin extends Evented {
    pluginStatus: RTLPlginStatus = 'unavailable';
    pluginURL = null;
    _completionCallback = null;

    _sendPluginStateToWorker() {
        // HM TODO: pass in the dispatcher to allow the manager to send stuff to the workers
        this.fire(new Event('pluginStateChange', {pluginStatus: this.pluginStatus, pluginURL: this.pluginURL}));
    }

    getRTLTextPluginStatus = () => {
        return this.pluginStatus;
    }

    triggerPluginCompletionEvent(error: Error | string) {
        // NetworkError's are not correctly reflected by the plugin status which prevents reloading plugin
        if (error && typeof error === 'string' && error.indexOf('NetworkError') > -1) {
            this.pluginStatus = 'error';
        }
    
        if (this._completionCallback) {
            this._completionCallback(error);
        }
    };

    registerForPluginStateChange(callback: PluginStateSyncCallback) {
        // Do an initial sync of the state
        callback({pluginStatus: this.pluginStatus, pluginURL: this.pluginURL});
        // Listen for all future state changes
        this.on('pluginStateChange', callback);
        return callback;
    };

    clearRTLTextPlugin() {
        this.pluginStatus = 'unavailable';
        this.pluginURL = null;
        this._completionCallback = null;
    };
    
    setRTLTextPlugin = (url: string, callback: ErrorCallback, deferred: boolean = false) => {
        if (this.pluginStatus === 'deferred' || this.pluginStatus === 'loading' || this.pluginStatus === 'loaded') {
            throw new Error('setRTLTextPlugin cannot be called multiple times.');
        }
        this.pluginURL = browser.resolveURL(url);
        this.pluginStatus = 'deferred';
        this._completionCallback = callback;
        this._sendPluginStateToWorker();
    
        //Start downloading the plugin immediately if not intending to lazy-load
        if (!deferred) {
            this._downloadRTLTextPlugin();
        }
    };

    _downloadRTLTextPlugin() {
        if (this.pluginStatus !== 'deferred' || !this.pluginURL) {
            throw new Error('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
        }
        this.pluginStatus = 'loading';
        this._sendPluginStateToWorker();
        getArrayBuffer({url: this.pluginURL}, (error) => {
            if (error) {
                this.triggerPluginCompletionEvent(error);
            } else {
                this.pluginStatus = 'loaded';
                this._sendPluginStateToWorker();
            }
        });
    };

    lazyLoadRTLTextPlugin() {
        if (this.pluginStatus === 'deferred') {
            this._downloadRTLTextPlugin();
        }
    };
}

/**
 * Export RTLMainThreadPlugin class as a singleton
 */
export const rtlMainThreadPlugin = new RTLMainThreadPlugin();
