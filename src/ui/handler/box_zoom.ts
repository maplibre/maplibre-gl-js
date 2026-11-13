import {DOM} from '../../util/dom.ts';
import {Evented} from '../../util/evented.ts';
import {MapBoxZoomEvent} from '../events.ts';

import type {Map} from '../map.ts';
import type {MapEventType} from '../events.ts';
import type {Handler, HandlerResult} from '../handler_manager.ts';
import type {Camera} from '../camera.ts';
import type Point from '@mapbox/point-geometry';

/**
 * Callback for customizing what happens when a box zoom gesture ends.
 */
export type BoxZoomEndHandler = (map: Map, startPos: Point, endPos: Point, originalEvent: MouseEvent) => void;

/**
 * A {@link BoxZoomHandler} options object.
 */
export type BoxZoomHandlerOptions = {
    /**
     * A callback that runs when the user completes the Shift-drag box gesture.
     * Providing this callback suppresses the default fit-to-box zoom behavior.
     */
    boxZoomEnd?: BoxZoomEndHandler;
};

/**
 * The `BoxZoomHandler` allows the user to zoom the map to fit within a bounding box.
 * The bounding box is defined by clicking and holding `shift` while dragging the cursor.
 *
 * @group Handlers
 */
export class BoxZoomHandler extends Evented<MapEventType> implements Handler {
    _camera: Camera;
    _el: HTMLElement;
    _container: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _startPos: Point;
    _lastPos: Point;
    _box: HTMLElement;
    _clickTolerance: number;
    /** The map's `boxZoomEnd` option, with the map already bound to it. */
    _boxZoomEnd?: (startPos: Point, endPos: Point, originalEvent: MouseEvent) => void;

    /** @internal */
    constructor(canvasContainer: HTMLElement, container: HTMLElement, options: {
        clickTolerance: number;
    }, camera: Camera, boxZoomEnd?: (startPos: Point, endPos: Point, originalEvent: MouseEvent) => void) {
        super();
        this._camera = camera;
        this._el = canvasContainer;
        this._container = container;
        this._clickTolerance = options.clickTolerance || 1;
        this._boxZoomEnd = boxZoomEnd;
    }

    /**
     * Returns a Boolean indicating whether the "box zoom" interaction is enabled.
     *
     * @returns `true` if the "box zoom" interaction is enabled.
     */
    isEnabled(): boolean {
        return !!this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "box zoom" interaction is active, i.e. currently being used.
     *
     * @returns `true` if the "box zoom" interaction is active.
     */
    isActive(): boolean {
        return !!this._active;
    }

    /**
     * Enables the "box zoom" interaction.
     *
     * @example
     * ```ts
     * map.boxZoom.enable();
     * ```
     */
    enable(): void {
        if (this.isEnabled()) return;
        this._enabled = true;
    }

    /**
     * Disables the "box zoom" interaction.
     *
     * @example
     * ```ts
     * map.boxZoom.disable();
     * ```
     */
    disable(): void {
        if (!this.isEnabled()) return;
        this._enabled = false;
    }

    mousedown(e: MouseEvent, point: Point): void {
        if (!this.isEnabled()) return;
        if (!(e.shiftKey && e.button === 0)) return;

        DOM.disableDrag();
        this._startPos = this._lastPos = point;
        this._active = true;
    }

    mousemoveWindow(e: MouseEvent, point: Point): void {
        if (!this._active) return;

        const pos = point;

        if (this._lastPos.equals(pos) || (!this._box && pos.dist(this._startPos) < this._clickTolerance)) {
            return;
        }

        const p0 = this._startPos;
        this._lastPos = pos;

        if (!this._box) {
            this._box = DOM.create('div', 'maplibregl-boxzoom', this._container);
            this._container.classList.add('maplibregl-crosshair');
            this._fireEvent('boxzoomstart', e);
        }

        const minX = Math.min(p0.x, pos.x),
            maxX = Math.max(p0.x, pos.x),
            minY = Math.min(p0.y, pos.y),
            maxY = Math.max(p0.y, pos.y);

        this._box.style.transform = `translate(${minX}px,${minY}px)`;

        this._box.style.width = `${maxX - minX}px`;
        this._box.style.height = `${maxY - minY}px`;
    }

    mouseupWindow(e: MouseEvent, point: Point): HandlerResult | void {
        if (!this._active) return;

        if (e.button !== 0) return;

        const p0 = this._startPos,
            p1 = point;

        this.reset();

        DOM.suppressClick();

        if (p0.x === p1.x && p0.y === p1.y) {
            this._fireEvent('boxzoomcancel', e);
        } else {
            this.fire(new MapBoxZoomEvent('boxzoomend', {originalEvent: e}));
            if (this._boxZoomEnd) {
                this._boxZoomEnd(p0, p1, e);
                return;
            }
            const easeTo = this._camera.cameraForScreenBox(p0, p1, this._camera.proposedProjectedCamera.bearing);
            if (easeTo) return {easeTo};
        }
    }

    keydown(e: KeyboardEvent): void {
        if (!this._active) return;

        if (e.keyCode === 27) {
            this.reset();
            this._fireEvent('boxzoomcancel', e);
        }
    }

    reset(): void {
        this._active = false;

        this._container.classList.remove('maplibregl-crosshair');

        if (this._box) {
            this._box.remove();
            this._box = null;
        }

        DOM.enableDrag();

        delete this._startPos;
        delete this._lastPos;
    }

    _fireEvent(type: string, e: MouseEvent | KeyboardEvent): this {
        return this.fire(new MapBoxZoomEvent(type, {originalEvent: e}));
    }
}
