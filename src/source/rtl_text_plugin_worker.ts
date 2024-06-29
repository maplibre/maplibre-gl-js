import {PluginState, RTLPluginStatus} from './rtl_text_plugin_status';

export interface RTLTextPlugin {
    applyArabicShaping: (a: string) => string;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>);
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>);
}

class RTLWorkerPlugin implements RTLTextPlugin {
    applyArabicShaping: (a: string) => string = null;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>) = null;
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>) = null;
    pluginStatus: RTLPluginStatus = 'unavailable';
    pluginURL: string = null;

    setState(state: PluginState) {
        this.pluginStatus = state.pluginStatus;
        this.pluginURL = state.pluginURL;
    }

    getState(): PluginState {
        return {
            pluginStatus: this.pluginStatus,
            pluginURL: this.pluginURL
        };
    }

    setMethods(rtlTextPlugin: RTLTextPlugin) {
        this.applyArabicShaping = rtlTextPlugin.applyArabicShaping;
        this.processBidirectionalText = rtlTextPlugin.processBidirectionalText;
        this.processStyledBidirectionalText = rtlTextPlugin.processStyledBidirectionalText;
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
