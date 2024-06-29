import {ImageSource} from './image_source';

import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import {SegmentVector} from '../data/segment';
import {Texture} from '../render/texture';
import {Event, ErrorEvent} from '../util/evented';
import {ValidationError} from '@maplibre/maplibre-gl-style-spec';

import type {Map} from '../ui/map';
import type {Dispatcher} from '../util/dispatcher';
import type {Evented} from '../util/evented';

/**
 * Options to add a canvas source type to the map.
 */
export type CanvasSourceSpecification = {
    /**
     * Source type. Must be `"canvas"`.
     */
    type: 'canvas';
    /**
     * Four geographical coordinates denoting where to place the corners of the canvas, specified in `[longitude, latitude]` pairs.
     */
    coordinates: [[number, number], [number, number], [number, number], [number, number]];
    /**
     * Whether the canvas source is animated. If the canvas is static (i.e. pixels do not need to be re-read on every frame), `animate` should be set to `false` to improve performance.
     * @defaultValue true
     */
    animate?: boolean;
    /**
     * Canvas source from which to read pixels. Can be a string representing the ID of the canvas element, or the `HTMLCanvasElement` itself.
     */
    canvas?: string | HTMLCanvasElement;
};

/**
 * A data source containing the contents of an HTML canvas. See {@link CanvasSourceSpecification} for detailed documentation of options.
 *
 * @group Sources
 *
 * @example
 * ```ts
 * // add to map
 * map.addSource('some id', {
 *    type: 'canvas',
 *    canvas: 'idOfMyHTMLCanvas',
 *    animate: true,
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ]
 * });
 *
 * // update
 * let mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 * ```
 */
export class CanvasSource extends ImageSource {
    options: CanvasSourceSpecification;
    animate: boolean;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    /**
     * Enables animation. The image will be copied from the canvas to the map on each frame.
     */
    play: () => void;
    /**
     * Disables animation. The map will display a static copy of the canvas image.
     */
    pause: () => void;
    _playing: boolean;

    /** @internal */
    constructor(id: string, options: CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);

        // We build in some validation here, since canvas sources aren't included in the style spec:
        if (!options.coordinates) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'missing required property "coordinates"')));
        } else if (!Array.isArray(options.coordinates) || options.coordinates.length !== 4 ||
                options.coordinates.some(c => !Array.isArray(c) || c.length !== 2 || c.some(l => typeof l !== 'number'))) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, '"coordinates" property must be an array of 4 longitude/latitude array pairs')));
        }

        if (options.animate && typeof options.animate !== 'boolean') {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'optional "animate" property must be a boolean value')));
        }

        if (!options.canvas) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'missing required property "canvas"')));
        } else if (typeof options.canvas !== 'string' && !(options.canvas instanceof HTMLCanvasElement)) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, '"canvas" must be either a string representing the ID of the canvas element from which to read, or an HTMLCanvasElement instance')));
        }

        this.options = options;
        this.animate = options.animate !== undefined ? options.animate : true;
    }

    async load() {
        this._loaded = true;
        if (!this.canvas) {
            this.canvas = (this.options.canvas instanceof HTMLCanvasElement) ?
                this.options.canvas :
                document.getElementById(this.options.canvas) as HTMLCanvasElement;
            // cast to HTMLCanvasElement in else of ternary
            // should we do a safety check and throw if it's not actually HTMLCanvasElement?
        }
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        if (this._hasInvalidDimensions()) {
            this.fire(new ErrorEvent(new Error('Canvas dimensions cannot be less than or equal to zero.')));
            return;
        }

        this.play = function() {
            this._playing = true;
            this.map.triggerRepaint();
        };

        this.pause = function() {
            if (this._playing) {
                this.prepare();
                this._playing = false;
            }
        };

        this._finishLoading();
    }

    /**
     * Returns the HTML `canvas` element.
     *
     * @returns The HTML `canvas` element.
     */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
        if (this.canvas) {
            if (this.animate) this.play();
        }
    }

    onRemove() {
        this.pause();
    }

    prepare() {
        let resize = false;
        if (this.canvas.width !== this.width) {
            this.width = this.canvas.width;
            resize = true;
        }
        if (this.canvas.height !== this.height) {
            this.height = this.canvas.height;
            resize = true;
        }

        if (this._hasInvalidDimensions()) return;

        if (Object.keys(this.tiles).length === 0) return; // not enough data for current position

        const context = this.map.painter.context;
        const gl = context.gl;

        if (!this.boundsBuffer) {
            this.boundsBuffer = context.createVertexBuffer(this._boundsArray, rasterBoundsAttributes.members);
        }

        if (!this.boundsSegments) {
            this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        }

        if (!this.texture) {
            this.texture = new Texture(context, this.canvas, gl.RGBA, {premultiply: true});
        } else if (resize || this._playing) {
            this.texture.update(this.canvas, {premultiply: true});
        }

        let newTilesLoaded = false;
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
                newTilesLoaded = true;
            }
        }

        if (newTilesLoaded) {
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'idle', sourceId: this.id}));
        }
    }

    serialize(): CanvasSourceSpecification {
        return {
            type: 'canvas',
            coordinates: this.coordinates
        };
    }

    hasTransition() {
        return this._playing;
    }

    _hasInvalidDimensions() {
        for (const x of [this.canvas.width, this.canvas.height]) {
            if (isNaN(x) || x <= 0) return true;
        }
        return false;
    }
}
