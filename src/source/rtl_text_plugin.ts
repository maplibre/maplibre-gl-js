import {PluginState, RTLPlginStatus} from "./rtl_plugin_status";

class RTLWorkerPlugin {
    applyArabicShaping: (a: string) => string = null;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>) = null;
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>) = null;
    pluginStatus: RTLPlginStatus = 'unavailable';
    pluginURL: string = null;

    setState(state: PluginState) { // Worker thread only: this tells the worker threads that the plugin is available on the Main thread
        this.pluginStatus = state.pluginStatus;
        this.pluginURL = state.pluginURL;
    }

    isParsed(): boolean {
        return this.applyArabicShaping != null &&
            this.processBidirectionalText != null &&
            this.processStyledBidirectionalText != null;
    }
    
    getPluginURL(): string {
        return this.pluginURL;
    }

    getRTLTextPluginStatus() {
        return this.pluginStatus;
    }
}

export const rtlWorkerPlugin = new RTLWorkerPlugin();
