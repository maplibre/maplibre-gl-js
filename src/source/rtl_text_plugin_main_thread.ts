
import {browser} from '../util/browser';
import {Event, Evented} from '../util/evented';
import {RTLPluginStatus, RTLPluginLoadedEventName, SyncRTLPluginStateMessageName, PluginState} from './rtl_text_plugin_status';
import {Dispatcher, getGlobalDispatcher} from '../util/dispatcher';

class RTLMainThreadPlugin extends Evented {
    status: RTLPluginStatus = 'unavailable';
    url: string = null;
    dispatcher: Dispatcher = getGlobalDispatcher();

    /** Sync RTL plugin state by broadcasting a message to the worker */
    _syncState(statusToSend: RTLPluginStatus): Promise<PluginState[]> {
        this.status = statusToSend;
        return this.dispatcher.broadcast(SyncRTLPluginStateMessageName, {pluginStatus: statusToSend, pluginURL: this.url});
    }

    /** This one is exposed to outside */
    getRTLTextPluginStatus(): RTLPluginStatus {
        return this.status;
    }

    clearRTLTextPlugin(): void {
        this.status = 'unavailable';
        this.url = null;
    }

    async setRTLTextPlugin(url: string, deferred: boolean = false): Promise<void> {
        if (this.url) {
            // error
            throw new Error('setRTLTextPlugin cannot be called multiple times.');
        }

        this.url = browser.resolveURL(url);
        if (!this.url) {
            throw new Error(`requested url ${url} is invalid`);
        }
        if (this.status === 'unavailable') {

            // from initial state:
            if (deferred) {

                this.status = 'deferred';
                // fire and forget: in this case it does not need wait for the broadcasting result
                // it is important to sync the deferred status once because
                // symbol_bucket will be checking it in worker
                this._syncState(this.status);

            } else {
                // immediate download
                return this._requestImport();
            }

        } else if (this.status === 'requested') {
            // already requested, start downloading
            return this._requestImport();
        }
    }

    /** Send a message to worker which will import the RTL plugin script */
    async _requestImport() : Promise<void> {
        const workerResults = await this._syncState('loading');
        if (workerResults.length > 0) {
            const workerResult: PluginState = workerResults[0];
            this.status = workerResult.pluginStatus;

            // expect worker to return 'loaded'
            if (workerResult.pluginStatus === 'loaded') {
                this.fire(new Event(RTLPluginLoadedEventName));
            } else {
                throw new Error(`worker failed to load ${this.url}, worker status=${workerResult.pluginStatus}`);
            }
        }
    }

    /** Start a lazy loading process of RTL plugin */
    lazyLoad(): void {
        if (this.status === 'unavailable') {
            this.status = 'requested';
        } else if (this.status === 'deferred') {
            this._requestImport();
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
