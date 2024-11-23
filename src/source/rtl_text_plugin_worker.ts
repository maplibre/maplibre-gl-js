import {type PluginState, type RTLPluginStatus} from './rtl_text_plugin_status';

export interface RTLTextPlugin {
    applyArabicShaping: (a: string) => string;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>);
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>);
}

class RTLWorkerPlugin implements RTLTextPlugin {
    readonly TIMEOUT = 5000;

    applyArabicShaping: (a: string) => string = null;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>) = null;
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>) = null;
    pluginStatus: RTLPluginStatus = 'unavailable';
    pluginURL: string = null;
    loadScriptResolve: () => void = () => {};

    private setState(state: PluginState) {
        this.pluginStatus = state.pluginStatus;
        this.pluginURL = state.pluginURL;
    }

    private getState(): PluginState {
        return {
            pluginStatus: this.pluginStatus,
            pluginURL: this.pluginURL
        };
    }

    public setMethods(rtlTextPlugin: RTLTextPlugin) {
        if (rtlWorkerPlugin.isParsed()) {
            throw new Error('RTL text plugin already registered.');
        }
        this.applyArabicShaping = rtlTextPlugin.applyArabicShaping;
        this.processBidirectionalText = rtlTextPlugin.processBidirectionalText;
        this.processStyledBidirectionalText = rtlTextPlugin.processStyledBidirectionalText;
        this.loadScriptResolve();
    }

    public isParsed(): boolean {
        return this.applyArabicShaping != null &&
            this.processBidirectionalText != null &&
            this.processStyledBidirectionalText != null;
    }

    public getRTLTextPluginStatus() {
        return this.pluginStatus;
    }

    public async syncState(incomingState: PluginState, importScripts: (url: string) => void): Promise<PluginState> {
        // Parsed plugin cannot be changed, so just return its current state.
        if (this.isParsed()) {
            return this.getState();
        }

        if (incomingState.pluginStatus !== 'loading') {
            // simply sync and done
            this.setState(incomingState);
            return incomingState;
        }
        const urlToLoad = incomingState.pluginURL;
        const loadScriptPromise = new Promise<void>((resolve) => {
            this.loadScriptResolve = resolve;
        });
        importScripts(urlToLoad);
        const dontWaitForeverTimeoutPromise = new Promise<void>((resolve) => setTimeout(() => resolve(), this.TIMEOUT));
        await Promise.race([loadScriptPromise, dontWaitForeverTimeoutPromise]);
        const complete = this.isParsed();
        if (complete) {
            const loadedState: PluginState = {
                pluginStatus: 'loaded',
                pluginURL: urlToLoad
            };
            this.setState(loadedState);
            return loadedState;
        }

        // error case
        this.setState({
            pluginStatus: 'error',
            pluginURL: ''
        });
        throw new Error(`RTL Text Plugin failed to import scripts from ${urlToLoad}`);
    }
}

export const rtlWorkerPlugin = new RTLWorkerPlugin();
