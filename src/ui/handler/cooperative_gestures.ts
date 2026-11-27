import {DOM} from '../../util/dom.ts';
import {Evented} from '../../util/evented.ts';
import {MapLibreEvent} from '../events.ts';

import type {Event} from '../../util/evented.ts';
import type {Handler} from '../handler_manager.ts';
import type {MapEventType} from '../events.ts';

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
export class CooperativeGesturesHandler extends Evented<MapEventType> implements Handler {
    _options: GestureOptions;
    _canvasContainer: HTMLElement;
    _locale: Record<string, string>;
    _container: HTMLElement;
    /**
     * This is the key that will allow to bypass the cooperative gesture protection
     */
    _bypassKey: 'metaKey' | 'ctrlKey' = navigator.userAgent.includes('Mac') ? 'metaKey' : 'ctrlKey';
    _enabled: boolean;

    /**
     * @internal
     * @param canvasContainer - the map's canvas container, which shows the help message
     * @param locale - the map's UI strings, for the help message
     */
    constructor(canvasContainer: HTMLElement, locale: Record<string, string>, options: GestureOptions) {
        super();
        this._canvasContainer = canvasContainer;
        this._locale = locale;
        this._options = options;
        this._enabled = false;
    }
    isActive(): boolean {
        return false;
    }
    reset(): void {}

    _setupUI(): void {
        if (this._container) return;
        const mapCanvasContainer = this._canvasContainer;
        // Add a cooperative gestures class (enable touch-action: pan-x pan-y;)
        mapCanvasContainer.classList.add('maplibregl-cooperative-gestures');
        this._container = DOM.create('div', 'maplibregl-cooperative-gesture-screen', mapCanvasContainer);
        let desktopMessage = this._locale['CooperativeGesturesHandler.WindowsHelpText'];
        if (this._bypassKey === 'metaKey') {
            desktopMessage = this._locale['CooperativeGesturesHandler.MacHelpText'];
        }
        const mobileMessage = this._locale['CooperativeGesturesHandler.MobileHelpText'];
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

    _destroyUI(): void {
        if (this._container) {
            this._container.remove();
            const mapCanvasContainer = this._canvasContainer;
            mapCanvasContainer.classList.remove('maplibregl-cooperative-gestures');
        }
        delete this._container;
    }

    enable(): void {
        this._setupUI();
        this._enabled = true;
    }

    disable(): void {
        this._enabled = false;
        this._destroyUI();
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    isBypassed(event: MouseEvent | WheelEvent | PointerEvent): boolean {
        return event[this._bypassKey];
    }

    notifyGestureBlocked(gestureType: 'wheel_zoom' | 'touch_pan', originalEvent: Event): void {
        if (!this._enabled) return;

        // notify subscribers that a cooperative gesture was prevented
        this.fire(new MapLibreEvent('cooperativegestureprevented', {gestureType, originalEvent}));

        // Alert user how to scroll/pan
        this._container.classList.add('maplibregl-show');
        setTimeout(() => {
            this._container.classList.remove('maplibregl-show');
        }, 100);
    }
}
