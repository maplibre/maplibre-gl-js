
import {browser} from '../util/browser';
import {Event, Evented} from '../util/evented';
import {RTLPluginStatus, RTLPluginLoadedEventName, PluginState} from './rtl_text_plugin_status';
import {Dispatcher, getGlobalDispatcher} from '../util/dispatcher';

import {getArrayBuffer} from '../util/ajax';
import {SyncRTLPluginStateMessageName} from '../util/actor_messages';
import {WorkerPool} from '../util/worker_pool';

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
            return this._requestImport();
        }
    }

    /** Send a message to worker which will import the RTL plugin script */
    async _requestImport() : Promise<void> {

        // Reference PR: https://github.com/mapbox/mapbox-gl-js/pull/9122
        // if have more than 1 workers, it is better to load once in main thread to warm up browser cache
        // so all workers can use it --- even though the result of getArrayBuffer is not being used here.
        // Otherwise, just let worker importScript once.
        if (WorkerPool.workerCount > 1) {
            await getArrayBuffer({url: this.url}, new AbortController());
        }

        try {
            const workerResults = await this._syncState('loading');
            if (workerResults.length > 0) {

                // expect all of them to be 'loaded'
                const expectedStatus = 'loaded';
                const failedToLoadWorkers = workerResults.filter((workerResult) => {
                    return workerResult.pluginStatus !== expectedStatus;
                });

                if (failedToLoadWorkers.length > 0) {
                    throw new Error(failedToLoadWorkers[1].pluginStatus);
                } else {
                    // all success
                    this.status = expectedStatus;
                    this.fire(new Event(RTLPluginLoadedEventName));
                }
            }
        } catch (e) {
            this.status = 'error';
            throw new Error(`worker failed to load ${this.url}, ${e.toString()}`);
        }
    }

    /** Start a lazy loading process of RTL plugin */
    lazyLoad(): void {
        if (this.status === 'unavailable') {
            this.status = 'requested';
        } else if (this.status === 'deferred') {
            console.log(`lazy load, status = ${this.status}, calling _requestImport`);
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
