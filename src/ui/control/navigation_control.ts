import Point from '@mapbox/point-geometry';

import {DOM} from '../../util/dom';
import {extend} from '../../util/util';
import {generateMousePitchHandler, generateMouseRotationHandler, MousePitchHandler, MouseRotateHandler} from '../handler/mouse';
import {generateOneFingerTouchPitchHandler, generateOneFingerTouchRotationHandler, OneFingerTouchPitchHandler, OneFingerTouchRotateHandler} from '../handler/one_finger_touch_drag';

import type {Map} from '../map';
import type {IControl} from './control';

/**
 * The {@link NavigationControl} options object
 */
type NavigationOptions = {
    /**
     * If `true` the compass button is included.
     */
    showCompass?: boolean;
    /**
     * If `true` the zoom-in and zoom-out buttons are included.
     */
    showZoom?: boolean;
    /**
     * If `true` the pitch is visualized by rotating X-axis of compass.
     */
    visualizePitch?: boolean;
};

const defaultOptions: NavigationOptions = {
    showCompass: true,
    showZoom: true,
    visualizePitch: false
};

/**
 * A `NavigationControl` control contains zoom buttons and a compass.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * let nav = new maplibregl.NavigationControl();
 * map.addControl(nav, 'top-left');
 * ```
 * @see [Display map navigation controls](https://maplibre.org/maplibre-gl-js/docs/examples/navigation/)
 */
export class NavigationControl implements IControl {
    _map: Map;
    options: NavigationOptions;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement;
    _zoomOutButton: HTMLButtonElement;
    _compass: HTMLButtonElement;
    _compassIcon: HTMLElement;
    _handler: MouseRotateWrapper;

    /**
     * @param options - the control's options
     */
    constructor(options?: NavigationOptions) {
        this.options = extend({}, defaultOptions, options);

        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        if (this.options.showZoom) {
            this._zoomInButton = this._createButton('maplibregl-ctrl-zoom-in', (e) => this._map.zoomIn({}, {originalEvent: e}));
            DOM.create('span', 'maplibregl-ctrl-icon', this._zoomInButton).setAttribute('aria-hidden', 'true');
            this._zoomOutButton = this._createButton('maplibregl-ctrl-zoom-out', (e) => this._map.zoomOut({}, {originalEvent: e}));
            DOM.create('span', 'maplibregl-ctrl-icon', this._zoomOutButton).setAttribute('aria-hidden', 'true');
        }
        if (this.options.showCompass) {
            this._compass = this._createButton('maplibregl-ctrl-compass', (e) => {
                if (this.options.visualizePitch) {
                    this._map.resetNorthPitch({}, {originalEvent: e});
                } else {
                    this._map.resetNorth({}, {originalEvent: e});
                }
            });
            this._compassIcon = DOM.create('span', 'maplibregl-ctrl-icon', this._compass);
            this._compassIcon.setAttribute('aria-hidden', 'true');
        }
    }

    _updateZoomButtons = () => {
        const zoom = this._map.getZoom();
        const isMax = zoom === this._map.getMaxZoom();
        const isMin = zoom === this._map.getMinZoom();
        this._zoomInButton.disabled = isMax;
        this._zoomOutButton.disabled = isMin;
        this._zoomInButton.setAttribute('aria-disabled', isMax.toString());
        this._zoomOutButton.setAttribute('aria-disabled', isMin.toString());
    };

    _rotateCompassArrow = () => {
        const rotate = this.options.visualizePitch ?
            `scale(${1 / Math.pow(Math.cos(this._map.transform.pitch * (Math.PI / 180)), 0.5)}) rotateX(${this._map.transform.pitch}deg) rotateZ(${this._map.transform.angle * (180 / Math.PI)}deg)` :
            `rotate(${this._map.transform.angle * (180 / Math.PI)}deg)`;

        this._compassIcon.style.transform = rotate;
    };

    onAdd(map: Map) {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(this._zoomInButton, 'ZoomIn');
            this._setButtonTitle(this._zoomOutButton, 'ZoomOut');
            this._map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(this._compass, 'ResetBearing');
            if (this.options.visualizePitch) {
                this._map.on('pitch', this._rotateCompassArrow);
            }
            this._map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            this._handler = new MouseRotateWrapper(this._map, this._compass, this.options.visualizePitch);
        }
        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);
        if (this.options.showZoom) {
            this._map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                this._map.off('pitch', this._rotateCompassArrow);
            }
            this._map.off('rotate', this._rotateCompassArrow);
            this._handler.off();
            delete this._handler;
        }

        delete this._map;
    }

    _createButton(className: string, fn: (e?: any) => unknown) {
        const a = DOM.create('button', className, this._container) as HTMLButtonElement;
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }

    _setButtonTitle = (button: HTMLButtonElement, title: string) => {
        const str = this._map._getUIString(`NavigationControl.${title}`);
        button.title = str;
        button.setAttribute('aria-label', str);
    };
}

class MouseRotateWrapper {

    map: Map;
    _clickTolerance: number;
    element: HTMLElement;
    // Rotation and pitch handlers are separated due to different _clickTolerance values
    mouseRotate: MouseRotateHandler;
    touchRotate: OneFingerTouchRotateHandler;
    mousePitch: MousePitchHandler;
    touchPitch: OneFingerTouchPitchHandler;
    _startPos: Point;
    _lastPos: Point;

    constructor(map: Map, element: HTMLElement, pitch: boolean = false) {
        this._clickTolerance = 10;
        const mapRotateTolerance = map.dragRotate._mouseRotate.getClickTolerance();
        const mapPitchTolerance = map.dragRotate._mousePitch.getClickTolerance();
        this.element = element;
        this.mouseRotate = generateMouseRotationHandler({clickTolerance: mapRotateTolerance, enable: true});
        this.touchRotate = generateOneFingerTouchRotationHandler({clickTolerance: mapRotateTolerance, enable: true});
        this.map = map;
        if (pitch) {
            this.mousePitch = generateMousePitchHandler({clickTolerance: mapPitchTolerance, enable: true});
            this.touchPitch = generateOneFingerTouchPitchHandler({clickTolerance: mapPitchTolerance, enable: true});
        }

        DOM.addEventListener(element, 'mousedown', this.mousedown);
        DOM.addEventListener(element, 'touchstart', this.touchstart, {passive: false});
        DOM.addEventListener(element, 'touchcancel', this.reset);
    }

    startMouse(e: MouseEvent, point: Point) {
        this.mouseRotate.dragStart(e, point);
        if (this.mousePitch) this.mousePitch.dragStart(e, point);
        DOM.disableDrag();
    }

    startTouch(e: TouchEvent, point: Point) {
        this.touchRotate.dragStart(e, point);
        if (this.touchPitch) this.touchPitch.dragStart(e, point);
        DOM.disableDrag();
    }

    moveMouse(e: MouseEvent, point: Point) {
        const map = this.map;
        const {bearingDelta} = this.mouseRotate.dragMove(e, point) || {};
        if (bearingDelta) map.setBearing(map.getBearing() + bearingDelta);
        if (this.mousePitch) {
            const {pitchDelta} = this.mousePitch.dragMove(e, point) || {};
            if (pitchDelta) map.setPitch(map.getPitch() + pitchDelta);
        }
    }

    moveTouch(e: TouchEvent, point: Point) {
        const map = this.map;
        const {bearingDelta} = this.touchRotate.dragMove(e, point) || {};
        if (bearingDelta) map.setBearing(map.getBearing() + bearingDelta);
        if (this.touchPitch) {
            const {pitchDelta} = this.touchPitch.dragMove(e, point) || {};
            if (pitchDelta) map.setPitch(map.getPitch() + pitchDelta);
        }
    }

    off() {
        const element = this.element;
        DOM.removeEventListener(element, 'mousedown', this.mousedown);
        DOM.removeEventListener(element, 'touchstart', this.touchstart, {passive: false});
        DOM.removeEventListener(window, 'touchmove', this.touchmove, {passive: false});
        DOM.removeEventListener(window, 'touchend', this.touchend);
        DOM.removeEventListener(element, 'touchcancel', this.reset);
        this.offTemp();
    }

    offTemp() {
        DOM.enableDrag();
        DOM.removeEventListener(window, 'mousemove', this.mousemove);
        DOM.removeEventListener(window, 'mouseup', this.mouseup);
        DOM.removeEventListener(window, 'touchmove', this.touchmove, {passive: false});
        DOM.removeEventListener(window, 'touchend', this.touchend);
    }

    mousedown = (e: MouseEvent) => {
        this.startMouse(extend({}, e, {ctrlKey: true, preventDefault: () => e.preventDefault()}), DOM.mousePos(this.element, e));
        DOM.addEventListener(window, 'mousemove', this.mousemove);
        DOM.addEventListener(window, 'mouseup', this.mouseup);
    };

    mousemove = (e: MouseEvent) => {
        this.moveMouse(e, DOM.mousePos(this.element, e));
    };

    mouseup = (e: MouseEvent) => {
        this.mouseRotate.dragEnd(e);
        if (this.mousePitch) this.mousePitch.dragEnd(e);
        this.offTemp();
    };

    touchstart = (e: TouchEvent) => {
        if (e.targetTouches.length !== 1) {
            this.reset();
        } else {
            this._startPos = this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
            this.startTouch(e, this._startPos);
            DOM.addEventListener(window, 'touchmove', this.touchmove, {passive: false});
            DOM.addEventListener(window, 'touchend', this.touchend);
        }
    };

    touchmove = (e: TouchEvent) => {
        if (e.targetTouches.length !== 1) {
            this.reset();
        } else {
            this._lastPos = DOM.touchPos(this.element, e.targetTouches)[0];
            this.moveTouch(e, this._lastPos);
        }
    };

    touchend = (e: TouchEvent) => {
        if (e.targetTouches.length === 0 &&
            this._startPos &&
            this._lastPos &&
            this._startPos.dist(this._lastPos) < this._clickTolerance) {
            this.element.click();
        }
        delete this._startPos;
        delete this._lastPos;
        this.offTemp();
    };

    reset = () => {
        this.mouseRotate.reset();
        if (this.mousePitch) this.mousePitch.reset();
        this.touchRotate.reset();
        if (this.touchPitch) this.touchPitch.reset();
        delete this._startPos;
        delete this._lastPos;
        this.offTemp();
    };
}
