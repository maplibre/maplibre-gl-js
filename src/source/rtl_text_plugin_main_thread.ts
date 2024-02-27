
import {browser} from '../util/browser';
import {Event, Evented} from '../util/evented';
import {RTLPluginStatus, RTLPluginLoadedEventName, SyncRTLPluginStateMessageName} from './rtl_text_plugin_status';
import {Dispatcher, getGlobalDispatcher} from '../util/dispatcher';

class RTLMainThreadPlugin extends Evented {
    status: RTLPluginStatus = 'unavailable';
    url: string = null;
    dispatcher: Dispatcher = getGlobalDispatcher();

    /** Download RTL plugin by sending a message to worker and process its response */
    async _download() : Promise<void> {
        this.status = 'loading';
        const workerResults = await this.dispatcher.broadcast(
            SyncRTLPluginStateMessageName,
            {
                pluginStatus: 'loading',
                pluginURL: this.url
            }
        );

        if (workerResults.length > 0) {
            const workerResult = workerResults[0];
            this.status = workerResult.pluginStatus;
            if (workerResult.pluginStatus === 'loaded') {
                // success scenario
                this.fire(new Event(RTLPluginLoadedEventName));
            } else {
                // failed scenario: returned, but status is not loaded.
                if (workerResult.error) {
                    throw workerResult.error;
                } else {
                    throw new Error(`worker failed '${SyncRTLPluginStateMessageName}' for unknown reason`);
                }
            }
        } else {
            // failed scenario(edge case): worker did not respond
            this.status = 'error';
            throw new Error(`worker did not respond to message: ${SyncRTLPluginStateMessageName}`);
        }
    }

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
        if (this.status === 'unavailable') {

            // from initial state:
            if (deferred) {
                // nothing else to do, just wait
                this.status = 'deferred';
            } else {
                // immediate download
                return this._download();
            }

        } else if (this.status === 'requested') {
            // already requested, start downloading
            return this._download();
        }
    }

    /** Start a lazy loading process of RTL plugin */
    lazyLoad(): void {
        if (this.status === 'unavailable') {
            this.status = 'requested';
        } else if (this.status === 'deferred') {
            this._download();
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
