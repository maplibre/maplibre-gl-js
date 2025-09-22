import {ZoomHistory} from './zoom_history';
import {isStringInSupportedScript} from '../util/script_detection';
import {rtlWorkerPlugin} from '../source/rtl_text_plugin_worker';

import type {GlobalProperties, TransitionSpecification} from '@maplibre/maplibre-gl-style-spec';

export type CrossfadeParameters = {
    fromScale: number;
    toScale: number;
    t: number;
};

/**
 * @internal
 * A parameter that can be evaluated to a value.
 * It's main purpose is a parameter to expression `evaluate` methods.
 */
export class EvaluationParameters implements GlobalProperties {
    zoom: number;
    now: number;
    fadeDuration: number;
    zoomHistory: ZoomHistory;
    transition: TransitionSpecification;
    // has to be an own property of an object to be used in expressions
    // if defined as class method, it'll hidden from operations
    // that iterate over own enumerable properties
    // (i..e spread operator (...), Object.keys(), for...in statement, etc.)
    isSupportedScript: (_: string) => boolean = isSupportedScript;

    // "options" may also be another EvaluationParameters to copy, see CrossFadedProperty.possiblyEvaluate
    constructor(zoom: number, options?: any) {
        this.zoom = zoom;

        if (options) {
            this.now = options.now || 0;
            this.fadeDuration = options.fadeDuration || 0;
            this.zoomHistory = options.zoomHistory || new ZoomHistory();
            this.transition = options.transition || {};
        } else {
            this.now = 0;
            this.fadeDuration = 0;
            this.zoomHistory = new ZoomHistory();
            this.transition = {};
        }
    }

    crossFadingFactor() {
        if (this.fadeDuration === 0) {
            return 1;
        } else {
            return Math.min((this.now - this.zoomHistory.lastIntegerZoomTime) / this.fadeDuration, 1);
        }
    }

    getCrossfadeParameters(): CrossfadeParameters {
        const z = this.zoom;
        const fraction = z - Math.floor(z);
        const t = this.crossFadingFactor();

        return z > this.zoomHistory.lastIntegerZoom ?
            {fromScale: 2, toScale: 1, t: fraction + (1 - fraction) * t} :
            {fromScale: 0.5, toScale: 1, t: 1 - (1 - t) * fraction};
    }
}

function isSupportedScript(str: string): boolean {
    return isStringInSupportedScript(str, rtlWorkerPlugin.getRTLTextPluginStatus() === 'loaded');
}
