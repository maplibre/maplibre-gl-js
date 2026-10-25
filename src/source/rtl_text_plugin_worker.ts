import type {PluginState, RTLPluginStatus} from './rtl_text_plugin_status.ts';

/**
 * The functions a right-to-left text plugin supplies for ordering bidirectional text.
 *
 * @deprecated MapLibre implements both itself. A registered plugin still replaces the built-in
 * implementation, but this will be removed in a future release. Arabic is no longer shaped by a
 * plugin: its letters are drawn joined by the browser.
 */
export interface RTLTextPlugin {
    processBidirectionalText: ((b: string, a: number[]) => string[]);
    processStyledBidirectionalText: ((c: string, b: number[], a: number[]) => Array<[string, number[]]>);
}

class RTLWorkerPlugin implements RTLTextPlugin {
    readonly TIMEOUT = 5000;

    processBidirectionalText: ((b: string, a: number[]) => string[]) = null;
    processStyledBidirectionalText: ((c: string, b: number[], a: number[]) => Array<[string, number[]]>) = null;
    pluginStatus: RTLPluginStatus = 'unavailable';
    pluginURL: string = null;
    loadScriptResolve: () => void = () => {};

    private setState(state: PluginState): void {
        this.pluginStatus = state.pluginStatus;
        this.pluginURL = state.pluginURL;
    }

    private getState(): PluginState {
        return {
            pluginStatus: this.pluginStatus,
            pluginURL: this.pluginURL
        };
    }

    public setMethods(rtlTextPlugin: RTLTextPlugin): void {
        if (rtlWorkerPlugin.isParsed()) {
            throw new Error('RTL text plugin already registered.');
        }
        this.processBidirectionalText = rtlTextPlugin.processBidirectionalText;
        this.processStyledBidirectionalText = rtlTextPlugin.processStyledBidirectionalText;
        this.loadScriptResolve();
    }

    public isParsed(): boolean {
        return this.processBidirectionalText != null &&
            this.processStyledBidirectionalText != null;
    }

    public getRTLTextPluginStatus(): RTLPluginStatus {
        return this.pluginStatus;
    }

    public async syncState(incomingState: PluginState, loadScript: (url: string) => Promise<void>): Promise<PluginState> {
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
        const dontWaitForeverTimeoutPromise = new Promise<void>((resolve) => setTimeout(() => resolve(), this.TIMEOUT));
        await loadScript(urlToLoad);
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

export const rtlWorkerPlugin: RTLWorkerPlugin = new RTLWorkerPlugin();
