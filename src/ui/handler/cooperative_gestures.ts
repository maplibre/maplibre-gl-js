import {DOM} from '../../util/dom';
import {Event} from '../../util/evented';
import {type Handler} from '../handler_manager';

import type {Map} from '../map';

/**
 * The {@link CooperativeGesturesHandler} options object for the gesture settings
 */
export type GestureOptions = boolean;

/**
 * A `CooperativeGestureHandler` is a control that adds cooperative gesture info when user tries to zoom in/out.
 *
 * When the CooperativeGestureHandler blocks a gesture, it will emit a `cooperativegestureprevented` event.
 *
 * @group Handlers
 *
 * @example
 * ```ts
 * const map = new Map({
 *   cooperativeGestures: true
 * });
 * ```
 * @see [Example: cooperative gestures](https://maplibre.org/maplibre-gl-js/docs/examples/cooperative-gestures/)
 **/
export class CooperativeGesturesHandler implements Handler {
    _options: GestureOptions;
    _map: Map;
    _container: HTMLElement;
    /**
     * This is the key that will allow to bypass the cooperative gesture protection
     */
    _bypassKey: 'metaKey' | 'ctrlKey' = navigator.userAgent.indexOf('Mac') !== -1 ? 'metaKey' : 'ctrlKey';
    _enabled: boolean;

    constructor(map: Map, options: GestureOptions) {
        this._map = map;
        this._options = options;
        this._enabled = false;
    }
    isActive(): boolean {
        return false;
    }
    reset(): void {}

    _setupUI() {
        if (this._container) return;
        const mapCanvasContainer = this._map.getCanvasContainer();
        // Add a cooperative gestures class (enable touch-action: pan-x pan-y;)
        mapCanvasContainer.classList.add('maplibregl-cooperative-gestures');
        this._container = DOM.create('div', 'maplibregl-cooperative-gesture-screen', mapCanvasContainer);
        let desktopMessage = this._map._getUIString('CooperativeGesturesHandler.WindowsHelpText');
        if (this._bypassKey === 'metaKey') {
            desktopMessage = this._map._getUIString('CooperativeGesturesHandler.MacHelpText');
        }
        const mobileMessage = this._map._getUIString('CooperativeGesturesHandler.MobileHelpText');
        // Create and append the desktop message div
        const desktopDiv = document.createElement('div');
        desktopDiv.className = 'maplibregl-desktop-message';
        desktopDiv.textContent = desktopMessage;
        this._container.appendChild(desktopDiv);
        // Create and append the mobile message div
        const mobileDiv = document.createElement('div');
        mobileDiv.className = 'maplibregl-mobile-message';
        mobileDiv.textContent = mobileMessage;
        this._container.appendChild(mobileDiv);
        // Remove cooperative gesture screen from the accessibility tree since screenreaders cannot interact with the map using gestures
        this._container.setAttribute('aria-hidden', 'true');
    }

    _destroyUI() {
        if (this._container) {
            DOM.remove(this._container);
            const mapCanvasContainer = this._map.getCanvasContainer();
            mapCanvasContainer.classList.remove('maplibregl-cooperative-gestures');
        }
        delete this._container;
    }

    enable() {
        this._setupUI();
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this._destroyUI();
    }

    isEnabled() {
        return this._enabled;
    }

    isBypassed(event: MouseEvent | WheelEvent | PointerEvent) {
        return event[this._bypassKey];
    }

    notifyGestureBlocked(gestureType: 'wheel_zoom' | 'touch_pan', originalEvent: Event) {
        if (!this._enabled) return;

        // notify subscribers that a cooperative gesture was prevented
        this._map.fire(new Event('cooperativegestureprevented', {gestureType, originalEvent}));

        // Alert user how to scroll/pan
        this._container.classList.add('maplibregl-show');
        setTimeout(() => {
            this._container.classList.remove('maplibregl-show');
        }, 100);
    }
}
