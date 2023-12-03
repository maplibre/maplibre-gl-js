import {getArrayBuffer} from '../util/ajax';
import {browser} from '../util/browser';
import {Event, Evented} from '../util/evented';
import {RTLPluginStatus, PluginState} from './rtl_text_plugin_status';
import {Dispatcher, getGlobalDispatcher} from '../util/dispatcher';

class RTLMainThreadPlugin extends Evented {
    pluginStatus: RTLPluginStatus = 'unavailable';
    pluginURL: string = null;
    dispatcher: Dispatcher = getGlobalDispatcher();
    queue: PluginState[] = [];

    async _sendPluginStateToWorker() {
        await this.dispatcher.broadcast('syncRTLPluginState', {pluginStatus: this.pluginStatus, pluginURL: this.pluginURL});
        this.fire(new Event('pluginStateChange', {pluginStatus: this.pluginStatus, pluginURL: this.pluginURL}));
    }

    getRTLTextPluginStatus() {
        return this.pluginStatus;
    }

    clearRTLTextPlugin() {
        this.pluginStatus = 'unavailable';
        this.pluginURL = null;
    }

    async setRTLTextPlugin(url: string, deferred: boolean = false): Promise<void> {
        if (this.pluginStatus === 'deferred' || this.pluginStatus === 'loading' || this.pluginStatus === 'loaded') {
            throw new Error('setRTLTextPlugin cannot be called multiple times.');
        }
        this.pluginURL = browser.resolveURL(url);
        this.pluginStatus = 'deferred';
        await this._sendPluginStateToWorker();
        if (!deferred) {
            //Start downloading the plugin immediately if not intending to lazy-load
            await this._downloadRTLTextPlugin();
        }
    }

    async _downloadRTLTextPlugin() {
        if (this.pluginStatus !== 'deferred' || !this.pluginURL) {
            throw new Error('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
        }
        try {
            this.pluginStatus = 'loading';
            await this._sendPluginStateToWorker();
            await getArrayBuffer({url: this.pluginURL}, new AbortController());
            this.pluginStatus = 'loaded';
        } catch {
            this.pluginStatus = 'error';
        }
        await this._sendPluginStateToWorker();
    }

    async lazyLoadRTLTextPlugin() {
        if (this.pluginStatus === 'deferred') {
            await this._downloadRTLTextPlugin();
        }
    }
}

let rtlMainThreadPlugin: RTLMainThreadPlugin = null;

export function rtlMainThreadPluginFactory(): RTLMainThreadPlugin {
    if (!rtlMainThreadPlugin) {
        rtlMainThreadPlugin = new RTLMainThreadPlugin();
    }
    return rtlMainThreadPlugin;
}
