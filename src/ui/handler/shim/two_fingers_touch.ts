import type {TwoFingersTouchZoomHandler, TwoFingersTouchRotateHandler, AroundCenterOptions} from '../two_fingers_touch';
import type {TapDragZoomHandler} from '../tap_drag_zoom';

/**
 * The `TwoFingersTouchZoomRotateHandler` allows the user to zoom and rotate the map by
 * pinching on a touchscreen.
 *
 * They can zoom with one finger by double tapping and dragging. On the second tap,
 * hold the finger down and drag up or down to zoom in or out.
 *
 * @group Handlers
 */
export class TwoFingersTouchZoomRotateHandler {

    _el: HTMLElement;
    _touchZoom: TwoFingersTouchZoomHandler;
    _touchRotate: TwoFingersTouchRotateHandler;
    _tapDragZoom: TapDragZoomHandler;
    _rotationDisabled: boolean;
    _enabled: boolean;

    /** @internal */
    constructor(el: HTMLElement, touchZoom: TwoFingersTouchZoomHandler, touchRotate: TwoFingersTouchRotateHandler, tapDragZoom: TapDragZoomHandler) {
        this._el = el;
        this._touchZoom = touchZoom;
        this._touchRotate = touchRotate;
        this._tapDragZoom = tapDragZoom;
        this._rotationDisabled = false;
        this._enabled = true;
    }

    /**
     * Enables the "pinch to rotate and zoom" interaction.
     *
     * @param options - Options object.
     *
     * @example
     * ```ts
     * map.touchZoomRotate.enable();
     * map.touchZoomRotate.enable({ around: 'center' });
     * ```
     */
    enable(options?: AroundCenterOptions | boolean | null) {
        this._touchZoom.enable(options);
        if (!this._rotationDisabled) this._touchRotate.enable(options);
        this._tapDragZoom.enable();
        this._el.classList.add('maplibregl-touch-zoom-rotate');
    }

    /**
     * Disables the "pinch to rotate and zoom" interaction.
     *
     * @example
     * ```ts
     * map.touchZoomRotate.disable();
     * ```
     */
    disable() {
        this._touchZoom.disable();
        this._touchRotate.disable();
        this._tapDragZoom.disable();
        this._el.classList.remove('maplibregl-touch-zoom-rotate');
    }

    /**
     * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.
     *
     * @returns `true` if the "pinch to rotate and zoom" interaction is enabled.
     */
    isEnabled() {
        return this._touchZoom.isEnabled() &&
            (this._rotationDisabled || this._touchRotate.isEnabled()) &&
            this._tapDragZoom.isEnabled();
    }

    /**
     * Returns true if the handler is enabled and has detected the start of a zoom/rotate gesture.
     *
     * @returns `true` if the handler is active, `false` otherwise
     */
    isActive() {
        return this._touchZoom.isActive() || this._touchRotate.isActive() || this._tapDragZoom.isActive();
    }

    /**
     * Disables the "pinch to rotate" interaction, leaving the "pinch to zoom"
     * interaction enabled.
     *
     * @example
     * ```ts
     * map.touchZoomRotate.disableRotation();
     * ```
     */
    disableRotation() {
        this._rotationDisabled = true;
        this._touchRotate.disable();
    }

    /**
     * Enables the "pinch to rotate" interaction.
     *
     * @example
     * ```ts
     * map.touchZoomRotate.enable();
     * map.touchZoomRotate.enableRotation();
     * ```
     */
    enableRotation() {
        this._rotationDisabled = false;
        if (this._touchZoom.isEnabled()) this._touchRotate.enable();
    }
}
