import {DOM} from '../../util/dom';

import {defaultEasing, bezier} from '../../util/util';
import {browser} from '../../util/browser';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {LngLat} from '../../geo/lng_lat';
import {TransformProvider} from './transform-provider';

import type {Map} from '../map';
import type Point from '@mapbox/point-geometry';
import type {AroundCenterOptions} from './two_fingers_touch';
import {Handler} from '../handler_manager';

// deltaY value for mouse scroll wheel identification
const wheelZoomDelta = 4.000244140625;

// These magic numbers control the rate of zoom. Trackpad events fire at a greater
// frequency than mouse scroll wheel, so reduce the zoom rate per wheel tick
const defaultZoomRate = 1 / 100;
const wheelZoomRate = 1 / 450;

// upper bound on how much we scale the map in any single render frame; this
// is used to limit zoom rate in the case of very fast scrolling
const maxScalePerFrame = 2;

/**
 * The `ScrollZoomHandler` allows the user to zoom the map by scrolling.
 *
 * @group Handlers
 */
export class ScrollZoomHandler implements Handler {
    _map: Map;
    _tr: TransformProvider;
    _el: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _zooming: boolean;
    _aroundCenter: boolean;
    _around: LngLat;
    _aroundPoint: Point;
    _type: 'wheel' | 'trackpad' | null;
    _lastValue: number;
    _timeout: ReturnType<typeof setTimeout>; // used for delayed-handling of a single wheel movement
    _finishTimeout: ReturnType<typeof setTimeout>; // used to delay final '{move,zoom}end' events

    _lastWheelEvent: any;
    _lastWheelEventTime: number;

    _startZoom: number;
    _targetZoom: number;
    _delta: number;
    _easing: ((a: number) => number);
    _prevEase: {
        start: number;
        duration: number;
        easing: (_: number) => number;
    };

    _frameId: boolean;
    _triggerRenderFrame: () => void;

    _defaultZoomRate: number;
    _wheelZoomRate: number;

    /** @internal */
    constructor(map: Map, triggerRenderFrame: () => void) {
        this._map = map;
        this._tr = new TransformProvider(map);
        this._el = map.getCanvasContainer();
        this._triggerRenderFrame = triggerRenderFrame;

        this._delta = 0;

        this._defaultZoomRate = defaultZoomRate;
        this._wheelZoomRate = wheelZoomRate;
    }

    /**
     * Set the zoom rate of a trackpad
     * @param zoomRate - 1/100 The rate used to scale trackpad movement to a zoom value.
     * @example
     * Speed up trackpad zoom
     * ```ts
     * map.scrollZoom.setZoomRate(1/25);
     * ```
     */
    setZoomRate(zoomRate: number) {
        this._defaultZoomRate = zoomRate;
    }

    /**
     * Set the zoom rate of a mouse wheel
     * @param wheelZoomRate - 1/450 The rate used to scale mouse wheel movement to a zoom value.
     * @example
     * Slow down zoom of mouse wheel
     * ```ts
     * map.scrollZoom.setWheelZoomRate(1/600);
     * ```
     */
    setWheelZoomRate(wheelZoomRate: number) {
        this._wheelZoomRate = wheelZoomRate;
    }

    /**
     * Returns a Boolean indicating whether the "scroll to zoom" interaction is enabled.
     * @returns `true` if the "scroll to zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /*
    * Active state is turned on and off with every scroll wheel event and is set back to false before the map
    * render is called, so _active is not a good candidate for determining if a scroll zoom animation is in
    * progress.
    */
    isActive() {
        return !!this._active || this._finishTimeout !== undefined;
    }

    isZooming() {
        return !!this._zooming;
    }

    /**
     * Enables the "scroll to zoom" interaction.
     *
     * @param options - Options object.
     * @example
     * ```ts
     * map.scrollZoom.enable();
     * map.scrollZoom.enable({ around: 'center' })
     * ```
     */
    enable(options?: AroundCenterOptions | boolean) {
        if (this.isEnabled()) return;
        this._enabled = true;
        this._aroundCenter = !!options && (options as AroundCenterOptions).around === 'center';
    }

    /**
     * Disables the "scroll to zoom" interaction.
     *
     * @example
     * ```ts
     * map.scrollZoom.disable();
     * ```
     */
    disable() {
        if (!this.isEnabled()) return;
        this._enabled = false;
    }

    wheel(e: WheelEvent) {
        if (!this.isEnabled()) return;
        if (this._map._cooperativeGestures) {
            if (e[this._map._metaKey]) {
                e.preventDefault();
            } else {
                return;
            }
        }
        let value = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
        const now = browser.now(),
            timeDelta = now - (this._lastWheelEventTime || 0);

        this._lastWheelEventTime = now;

        if (value !== 0 && (value % wheelZoomDelta) === 0) {
            // This one is definitely a mouse wheel event.
            this._type = 'wheel';

        } else if (value !== 0 && Math.abs(value) < 4) {
            // This one is definitely a trackpad event because it is so small.
            this._type = 'trackpad';

        } else if (timeDelta > 400) {
            // This is likely a new scroll action.
            this._type = null;
            this._lastValue = value;

            // Start a timeout in case this was a singular event, and dely it by up to 40ms.
            this._timeout = setTimeout(this._onTimeout, 40, e);

        } else if (!this._type) {
            // This is a repeating event, but we don't know the type of event just yet.
            // If the delta per time is small, we assume it's a fast trackpad; otherwise we switch into wheel mode.
            this._type = (Math.abs(timeDelta * value) < 200) ? 'trackpad' : 'wheel';

            // Make sure our delayed event isn't fired again, because we accumulate
            // the previous event (which was less than 40ms ago) into this event.
            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
                value += this._lastValue;
            }
        }

        // Slow down zoom if shift key is held for more precise zooming
        if (e.shiftKey && value) value = value / 4;

        // Only fire the callback if we actually know what type of scrolling device the user uses.
        if (this._type) {
            this._lastWheelEvent = e;
            this._delta -= value;
            if (!this._active) {
                this._start(e);
            }
        }

        e.preventDefault();
    }

    _onTimeout = (initialEvent: MouseEvent) => {
        this._type = 'wheel';
        this._delta -= this._lastValue;
        if (!this._active) {
            this._start(initialEvent);
        }
    };

    _start(e: MouseEvent) {
        if (!this._delta) return;

        if (this._frameId) {
            this._frameId = null;
        }

        this._active = true;
        if (!this.isZooming()) {
            this._zooming = true;
        }

        if (this._finishTimeout) {
            clearTimeout(this._finishTimeout);
            delete this._finishTimeout;
        }

        const pos = DOM.mousePos(this._el, e);
        const tr = this._tr;

        this._around = LngLat.convert(this._aroundCenter ? tr.center : tr.unproject(pos));
        this._aroundPoint = tr.transform.locationPoint(this._around);
        if (!this._frameId) {
            this._frameId = true;
            this._triggerRenderFrame();
        }
    }

    renderFrame() {
        if (!this._frameId) return;
        this._frameId = null;

        if (!this.isActive()) return;
        const tr = this._tr.transform;

        // if we've had scroll events since the last render frame, consume the
        // accumulated delta, and update the target zoom level accordingly
        if (this._delta !== 0) {
            // For trackpad events and single mouse wheel ticks, use the default zoom rate
            const zoomRate = (this._type === 'wheel' && Math.abs(this._delta) > wheelZoomDelta) ? this._wheelZoomRate : this._defaultZoomRate;
            // Scale by sigmoid of scroll wheel delta.
            let scale = maxScalePerFrame / (1 + Math.exp(-Math.abs(this._delta * zoomRate)));

            if (this._delta < 0 && scale !== 0) {
                scale = 1 / scale;
            }

            const fromScale = typeof this._targetZoom === 'number' ? tr.zoomScale(this._targetZoom) : tr.scale;
            this._targetZoom = Math.min(tr.maxZoom, Math.max(tr.minZoom, tr.scaleZoom(fromScale * scale)));

            // if this is a mouse wheel, refresh the starting zoom and easing
            // function we're using to smooth out the zooming between wheel
            // events
            if (this._type === 'wheel') {
                this._startZoom = tr.zoom;
                this._easing = this._smoothOutEasing(200);
            }

            this._delta = 0;
        }

        const targetZoom = typeof this._targetZoom === 'number' ?
            this._targetZoom : tr.zoom;
        const startZoom = this._startZoom;
        const easing = this._easing;

        let finished = false;
        let zoom;
        if (this._type === 'wheel' && startZoom && easing) {

            const t = Math.min((browser.now() - this._lastWheelEventTime) / 200, 1);
            const k = easing(t);
            zoom = interpolates.number(startZoom, targetZoom, k);
            if (t < 1) {
                if (!this._frameId) {
                    this._frameId = true;
                }
            } else {
                finished = true;
            }
        } else {
            zoom = targetZoom;
            finished = true;
        }

        this._active = true;

        if (finished) {
            this._active = false;
            this._finishTimeout = setTimeout(() => {
                this._zooming = false;
                this._triggerRenderFrame();
                delete this._targetZoom;
                delete this._finishTimeout;
            }, 200);
        }

        return {
            noInertia: true,
            needsRenderFrame: !finished,
            zoomDelta: zoom - tr.zoom,
            around: this._aroundPoint,
            originalEvent: this._lastWheelEvent
        };
    }

    _smoothOutEasing(duration: number) {
        let easing = defaultEasing;

        if (this._prevEase) {
            const currentEase = this._prevEase;
            const t = (browser.now() - currentEase.start) / currentEase.duration;
            const speed = currentEase.easing(t + 0.01) - currentEase.easing(t);

            // Quick hack to make new bezier that is continuous with last
            const x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01;
            const y = Math.sqrt(0.27 * 0.27 - x * x);

            easing = bezier(x, y, 0.25, 1);
        }

        this._prevEase = {
            start: browser.now(),
            duration,
            easing
        };

        return easing;
    }

    reset() {
        this._active = false;
        this._zooming = false;
        delete this._targetZoom;
        if (this._finishTimeout) {
            clearTimeout(this._finishTimeout);
            delete this._finishTimeout;
        }
    }
}
