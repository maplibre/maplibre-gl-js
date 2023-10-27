import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {ControlPosition, IControl} from './control';

/**
 * The {@link CooperativeGestureControl} options object
 */
/**
 * An options object for the gesture settings
 * @example
 * ```ts
 * let options = {
 *   windowsHelpText: "Use Ctrl + scroll to zoom the map",
 *   macHelpText: "Use ⌘ + scroll to zoom the map",
 *   mobileHelpText: "Use two fingers to move the map",
 * }
 * ```
 */
export type GestureOptions = {
    windowsHelpText?: string;
    macHelpText?: string;
    mobileHelpText?: string;
};

/**
 * A `CooperativeGestureControl` is a control that adds cooperative gesture info when user tries to zoom in/out.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * map.addControl(new maplibregl.CooperativeGestureControl({
 *   windowsHelpText: "Use Ctrl + scroll to zoom the map",
 *   macHelpText: "Use ⌘ + scroll to zoom the map",
 *   mobileHelpText: "Use two fingers to move the map",
 * }));
 * ```
 **/
export class CooperativeGestureControl implements IControl {
    options: boolean | GestureOptions;
    _map: Map;
    _container: HTMLElement;
    _metaKey: keyof MouseEvent = navigator.userAgent.indexOf('Mac') !== -1 ? 'metaKey' : 'ctrlKey';

    constructor(options: boolean | GestureOptions = {}) {
        this.options = options;
    }

    getDefaultPosition(): ControlPosition {
        return 'full';
    }

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        const mapCanvasContainer = this._map.getCanvasContainer();
        const cooperativeGestures = this._map.getCooperativeGestures();
        this._container = DOM.create('div', 'maplibregl-cooperative-gesture-screen', this._map.getContainer());
        let desktopMessage = typeof cooperativeGestures !== 'boolean' && cooperativeGestures.windowsHelpText ? cooperativeGestures.windowsHelpText : 'Use Ctrl + scroll to zoom the map';
        if (this._metaKey === 'metaKey') {
            desktopMessage = typeof cooperativeGestures !== 'boolean' && cooperativeGestures.macHelpText ? cooperativeGestures.macHelpText : 'Use ⌘ + scroll to zoom the map';
        }
        const mobileMessage = typeof cooperativeGestures !== 'boolean' && cooperativeGestures.mobileHelpText ? cooperativeGestures.mobileHelpText : 'Use two fingers to move the map';
        this._container.innerHTML = `
            <div class="maplibregl-desktop-message">${desktopMessage}</div>
            <div class="maplibregl-mobile-message">${mobileMessage}</div>
        `;
        // Remove cooperative gesture screen from the accessibility tree since screenreaders cannot interact with the map using gestures
        this._container.setAttribute('aria-hidden', 'true');
        // Add event to canvas container since gesture container is pointer-events: none
        this._map.on('wheel', this._cooperativeGesturesOnWheel);
        this._map.on('touchmove', this._cooperativeGesturesOnTouch);
        // Add a cooperative gestures class (enable touch-action: pan-x pan-y;)
        mapCanvasContainer.classList.add('maplibregl-cooperative-gestures');

        return this._container;
    }

    /** {@inheritDoc IControl.onRemove} */
    onRemove(map: Map) {
        DOM.remove(this._container);
        const mapCanvasContainer = map.getCanvasContainer();
        map.off('wheel', this._cooperativeGesturesOnWheel);
        map.off('touchmove', this._cooperativeGesturesOnTouch);
        mapCanvasContainer.classList.remove('maplibregl-cooperative-gestures');
        this._map = undefined;
    }

    _cooperativeGesturesOnTouch = () => {
        this._onCooperativeGesture(false);
    };

    _cooperativeGesturesOnWheel = (event: WheelEvent) => {
        this._onCooperativeGesture(event['originalEvent'][this._metaKey]);
    };

    _onCooperativeGesture(metaPress:boolean) {
        if (!metaPress) {
            // Alert user how to scroll/pan
            this._container.classList.add('maplibregl-show');
            setTimeout(() => {
                this._container.classList.remove('maplibregl-show');
            }, 100);
        }
        return false;
    }

}
