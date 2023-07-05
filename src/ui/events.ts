import {Event} from '../util/evented';

import {DOM} from '../util/dom';
import Point from '@mapbox/point-geometry';
import {extend} from '../util/util';
import type {MapGeoJSONFeature} from '../util/vectortile_to_geojson';

import type {Map} from './map';
import type {LngLat} from '../geo/lng_lat';
import {SourceSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * An event from the mouse relevant to a specific layer.
 *
 * @group Event Related
 */
export type MapLayerMouseEvent = MapMouseEvent & { features?: MapGeoJSONFeature[] };

/**
 * An event from a touch device relevat to a specific layer.
 *
 * @group Event Related
 */
export type MapLayerTouchEvent = MapTouchEvent & { features?: MapGeoJSONFeature[] };

/**
 * The source event data type
 */
export type MapSourceDataType = 'content' | 'metadata' | 'visibility' | 'idle';

/**
 * A mapping between the layer events and their type
 */
export type MapLayerEventType = {
    click: MapLayerMouseEvent;
    dblclick: MapLayerMouseEvent;
    mousedown: MapLayerMouseEvent;
    mouseup: MapLayerMouseEvent;
    mousemove: MapLayerMouseEvent;
    mouseenter: MapLayerMouseEvent;
    mouseleave: MapLayerMouseEvent;
    mouseover: MapLayerMouseEvent;
    mouseout: MapLayerMouseEvent;
    contextmenu: MapLayerMouseEvent;

    touchstart: MapLayerTouchEvent;
    touchend: MapLayerTouchEvent;
    touchcancel: MapLayerTouchEvent;
};

/**
 * The base event for MapLibre
 *
 * @group Event Related
 */
export type MapLibreEvent<TOrig = unknown> = {
    type: MapEvent;
    target: Map;
    originalEvent: TOrig;
}

/**
 * The style data event
 *
 * @group Event Related
 */
export type MapStyleDataEvent = MapLibreEvent & {
    dataType: 'style';
}

/**
 * The source data event interface
 *
 * @group Event Related
 */
export type MapSourceDataEvent = MapLibreEvent  & {
    dataType: 'source';
    /**
     * True if the event has a `dataType` of `source` and the source has no outstanding network requests.
     */
    isSourceLoaded: boolean;
    /**
     * The [style spec representation of the source](https://maplibre.org/maplibre-style-spec/#sources) if the event has a `dataType` of `source`.
     */
    source: SourceSpecification;
    sourceId: string;
    sourceDataType: MapSourceDataType;
    /**
     * The tile being loaded or changed, if the event has a `dataType` of `source` and
     * the event is related to loading of a tile.
     */
    tile: any;
}
/**
 * `MapMouseEvent` is the event type for mouse-related map events.
 * @example
 * ```ts
 * // The `click` event is an example of a `MapMouseEvent`.
 * // Set up an event listener on the map.
 * map.on('click', function(e) {
 *   // The event object (e) contains information like the
 *   // coordinates of the point on the map that was clicked.
 *   console.log('A click event has occurred at ' + e.lngLat);
 * });
 * ```
 */
export class MapMouseEvent extends Event implements MapLibreEvent<MouseEvent> {
    /**
     * The event type {@link MapEventType} and {@link MapEvent}
     */
    type: 'mousedown' | 'mouseup' | 'click' | 'dblclick' | 'mousemove' | 'mouseover' | 'mouseenter' | 'mouseleave' | 'mouseout' | 'contextmenu';

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: MouseEvent;

    /**
     * The pixel coordinates of the mouse cursor, relative to the map and measured from the top left corner.
     */
    point: Point;

    /**
     * The geographic location on the map of the mouse cursor.
     */
    lngLat: LngLat;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the following default map behaviors:
     *
     *   * On `mousedown` events, the behavior of {@link DragPanHandler}
     *   * On `mousedown` events, the behavior of {@link DragRotateHandler}
     *   * On `mousedown` events, the behavior of {@link BoxZoomHandler}
     *   * On `dblclick` events, the behavior of {@link DoubleClickZoomHandler}
     *
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    constructor(type: string, map: Map, originalEvent: MouseEvent, data: any = {}) {
        const point = DOM.mousePos(map.getCanvasContainer(), originalEvent);
        const lngLat = map.unproject(point);
        super(type, extend({point, lngLat, originalEvent}, data));
        this._defaultPrevented = false;
        this.target = map;
    }
}

/**
 * `MapTouchEvent` is the event type for touch-related map events.
 *
 * @group Event Related
 */
export class MapTouchEvent extends Event implements MapLibreEvent<TouchEvent> {
    /**
     * The event type.
     */
    type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel';

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: TouchEvent;

    /**
     * The geographic location on the map of the center of the touch event points.
     */
    lngLat: LngLat;

    /**
     * The pixel coordinates of the center of the touch event points, relative to the map and measured from the top left
     * corner.
     */
    point: Point;

    /**
     * The array of pixel coordinates corresponding to a
     * [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.
     */
    points: Array<Point>;

    /**
     * The geographical locations on the map corresponding to a
     * [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.
     */
    lngLats: Array<LngLat>;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the following default map behaviors:
     *
     *   * On `touchstart` events, the behavior of {@link DragPanHandler}
     *   * On `touchstart` events, the behavior of {@link TwoFingersTouchZoomRotateHandler}
     *
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    constructor(type: string, map: Map, originalEvent: TouchEvent) {
        const touches = type === 'touchend' ? originalEvent.changedTouches : originalEvent.touches;
        const points = DOM.touchPos(map.getCanvasContainer(), touches);
        const lngLats = points.map((t) => map.unproject(t));
        const point = points.reduce((prev, curr, i, arr) => {
            return prev.add(curr.div(arr.length));
        }, new Point(0, 0));
        const lngLat = map.unproject(point);
        super(type, {points, point, lngLats, lngLat, originalEvent});
        this._defaultPrevented = false;
    }
}

/**
 * `MapWheelEvent` is the event type for the `wheel` map event.
 *
 * @group Event Related
 */
export class MapWheelEvent extends Event {
    /**
     * The event type.
     */
    type: 'wheel';

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: WheelEvent;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the the behavior of {@link ScrollZoomHandler}.
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    /** */
    constructor(type: string, map: Map, originalEvent: WheelEvent) {
        super(type, {originalEvent});
        this._defaultPrevented = false;
    }
}

/**
 * A `MapLibreZoomEvent` is the event type for the boxzoom-related map events emitted by the {@link BoxZoomHandler}.
 *
 * @group Event Related
 */
export type MapLibreZoomEvent = {
    /**
     * The type of boxzoom event. One of `boxzoomstart`, `boxzoomend` or `boxzoomcancel`
     */
    type: 'boxzoomstart' | 'boxzoomend' | 'boxzoomcancel';
    /**
     * The `Map` instance that triggered the event
     */
    target: Map;
    /**
     * The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent`
     */
    originalEvent: MouseEvent;
};

/**
 * A `MapDataEvent` object is emitted with the `data`
 * and `dataloading` events. Possible values for
 * `dataType`s are:
 *
 * - `'source'`: The non-tile data associated with any source
 * - `'style'`: The [style](https://maplibre.org/maplibre-style-spec/) used by the map
 *
 * Possible values for `sourceDataType`s are:
 *
 * - `'metadata'`: indicates that any necessary source metadata has been loaded (such as TileJSON) and it is ok to start loading tiles
 * - `'content'`: indicates the source data has changed (such as when source.setData() has been called on GeoJSONSource)
 * - `'visibility'`: send when the source becomes used when at least one of its layers becomes visible in style sense (inside the layer's zoom range and with layout.visibility set to 'visible')
 * - `'idle'`: indicates that no new source data has been fetched (but the source has done loading)
 *
 * @group Event Related
 *
 * @example
 * ```ts
 * // The sourcedata event is an example of MapDataEvent.
 * // Set up an event listener on the map.
 * map.on('sourcedata', function(e) {
 *    if (e.isSourceLoaded) {
 *        // Do something when the source has finished loading
 *    }
 * });
 * ```
 */
export type MapDataEvent = {
    /**
     * The event type.
     */
    type: string;
    /**
     * The type of data that has changed. One of `'source'`, `'style'`.
     */
    dataType: string;
    /**
     *  Included if the event has a `dataType` of `source` and the event signals that internal data has been received or changed. Possible values are `metadata`, `content`, `visibility` and `idle`.
     */
    sourceDataType: MapSourceDataType;
};

/**
 * The terrain event
 *
 * @group Event Related
 */
export type MapTerrainEvent = {
    type: 'terrain';
};

/**
 * An event related to the web gl context
 *
 * @group Event Related
 */
export type MapContextEvent = {
    type: 'webglcontextlost' | 'webglcontextrestored';
    originalEvent: WebGLContextEvent;
};

/**
 * The style image missing event
 *
 * @group Event Related
 *
 * @see [Generate and add a missing icon to the map](https://maplibre.org/maplibre-gl-js-docs/example/add-image-missing-generated/)
 */
export type MapStyleImageMissingEvent = MapLibreEvent & {
    type: 'styleimagemissing';
    id: string;
}

/**
 * MapEventType - a mapping between the event name and the event value
 */
export type MapEventType = {
    error: ErrorEvent;

    load: MapLibreEvent;
    idle: MapLibreEvent;
    remove: MapLibreEvent;
    render: MapLibreEvent;
    resize: MapLibreEvent;

    webglcontextlost: MapContextEvent;
    webglcontextrestored: MapContextEvent;

    dataloading: MapDataEvent;
    data: MapDataEvent;
    tiledataloading: MapDataEvent;
    sourcedataloading: MapSourceDataEvent;
    styledataloading: MapStyleDataEvent;
    sourcedata: MapSourceDataEvent;
    styledata: MapStyleDataEvent;
    styleimagemissing: MapStyleImageMissingEvent;
    dataabort: MapDataEvent;
    sourcedataabort: MapSourceDataEvent;

    boxzoomcancel: MapLibreZoomEvent;
    boxzoomstart: MapLibreZoomEvent;
    boxzoomend: MapLibreZoomEvent;

    touchcancel: MapTouchEvent;
    touchmove: MapTouchEvent;
    touchend: MapTouchEvent;
    touchstart: MapTouchEvent;

    click: MapMouseEvent;
    contextmenu: MapMouseEvent;
    dblclick: MapMouseEvent;
    mousemove: MapMouseEvent;
    mouseup: MapMouseEvent;
    mousedown: MapMouseEvent;
    mouseout: MapMouseEvent;
    mouseover: MapMouseEvent;

    movestart: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    move: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    moveend: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;

    zoomstart: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoom: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoomend: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;

    rotatestart: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    rotate: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    rotateend: MapLibreEvent<MouseEvent | TouchEvent | undefined>;

    dragstart: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    drag: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    dragend: MapLibreEvent<MouseEvent | TouchEvent | undefined>;

    pitchstart: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    pitch: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    pitchend: MapLibreEvent<MouseEvent | TouchEvent | undefined>;

    wheel: MapWheelEvent;

    terrain: MapTerrainEvent;
};

/**
 * All the events
 *
 * @event `mousedown` Fired when a pointing device (usually a mouse) is pressed within the map.
 *
 * **Note:** This event is compatible with the optional `layerId` parameter.
 * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
 * the cursor is pressed while inside a visible portion of the specified layer.
 * `data` - {@link MapMouseEvent}
 *
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('mousedown', function() {
 *   console.log('A mousedown event has occurred.');
 * });
 * ```
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener for a specific layer
 * map.on('mousedown', 'poi-label', function() {
 *   console.log('A mousedown event has occurred on a visible portion of the poi-label layer.');
 * });
 * ```
 *
 * @see [Create a draggable point](https://maplibre.org/maplibre-gl-js-docs/example/drag-a-point/)
 *
 * @event `mouseup` Fired when a pointing device (usually a mouse) is released within the map.
 *
 * **Note:** This event is compatible with the optional `layerId` parameter.
 * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
 * the cursor is released while inside a visible portion of the specified layer.
 * `data` - {@link MapMouseEvent}
 *
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('mouseup', function() {
 *   console.log('A mouseup event has occurred.');
 * });
 * ```
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener for a specific layer
 * map.on('mouseup', 'poi-label', function() {
 *   console.log('A mouseup event has occurred on a visible portion of the poi-label layer.');
 * });
 * ```
 *
 * @see [Create a draggable point](https://maplibre.org/maplibre-gl-js-docs/example/drag-a-point/)
 *
 * @event `mouseover` Fired when a pointing device (usually a mouse) is moved within the map.
 * As you move the cursor across a web page containing a map,
 * the event will fire each time it enters the map or any child elements.
 *
 * **Note:** This event is compatible with the optional `layerId` parameter.
 * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
 * the cursor is moved inside a visible portion of the specified layer.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('mouseover', function() {
 *   console.log('A mouseover event has occurred.');
 * });
 * ```
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener for a specific layer
 * map.on('mouseover', 'poi-label', function() {
 *   console.log('A mouseover event has occurred on a visible portion of the poi-label layer.');
 * });
 * ```
 * @see [Get coordinates of the mouse pointer](https://maplibre.org/maplibre-gl-js-docs/example/mouse-position/)
 * @see [Highlight features under the mouse pointer](https://maplibre.org/maplibre-gl-js-docs/example/hover-styles/)
 * @see [Display a popup on hover](https://maplibre.org/maplibre-gl-js-docs/example/popup-on-hover/)
 *
 * @event `mousemove` Fired when a pointing device (usually a mouse) is moved while the cursor is inside the map.
 * As you move the cursor across the map, the event will fire every time the cursor changes position within the map.
 *
 * **Note:** This event is compatible with the optional `layerId` parameter.
 * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
 * the cursor is inside a visible portion of the specified layer.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('mousemove', function() {
 *   console.log('A mousemove event has occurred.');
 * });
 * ```
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener for a specific layer
 * map.on('mousemove', 'poi-label', function() {
 *   console.log('A mousemove event has occurred on a visible portion of the poi-label layer.');
 * });
 * ```
 * @see [Get coordinates of the mouse pointer](https://maplibre.org/maplibre-gl-js-docs/example/mouse-position/)
 * @see [Highlight features under the mouse pointer](https://maplibre.org/maplibre-gl-js-docs/example/hover-styles/)
 * @see [Display a popup on over](https://maplibre.org/maplibre-gl-js-docs/example/popup-on-hover/)
 *
 * @event `click` Fired when a pointing device (usually a mouse) is pressed and released at the same point on the map.
 *
 * **Note:** This event is compatible with the optional `layerId` parameter.
 * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
 * point that is pressed and released contains a visible portion of the specified layer.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('click', function(e) {
 *   console.log('A click event has occurred at ' + e.lngLat);
 * });
 * ```
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener for a specific layer
 * map.on('click', 'poi-label', function(e) {
 *   console.log('A click event has occurred on a visible portion of the poi-label layer at ' + e.lngLat);
 * });
 * ```
 * @see [Measure distances](https://maplibre.org/maplibre-gl-js-docs/example/measure/)
 * @see [Center the map on a clicked symbol](https://maplibre.org/maplibre-gl-js-docs/example/center-on-symbol/)
 *
 * @event `dblclick` Fired when a pointing device (usually a mouse) is pressed and released twice at the same point on
 * the map in rapid succession.
 *
 * **Note:** This event is compatible with the optional `layerId` parameter.
 * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only
 * when the point that is clicked twice contains a visible portion of the specified layer.
 *
 * **Note:** Under normal conditions, this event will be preceded by two `click` events.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('dblclick', function(e) {
 *   console.log('A dblclick event has occurred at ' + e.lngLat);
 * });
 * ```
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener for a specific layer
 * map.on('dblclick', 'poi-label', function(e) {
 *   console.log('A dblclick event has occurred on a visible portion of the poi-label layer at ' + e.lngLat);
 * });
 * ```
 *
 * @event `mouseenter` Fired when a pointing device (usually a mouse) enters a visible portion of a specified layer from
 * outside that layer or outside the map canvas.
 *
 * **Important:** This event can only be listened for when {@link Map#on} includes three arguments,
 * where the second argument specifies the desired layer.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener
 * map.on('mouseenter', 'water', function() {
 *   console.log('A mouseenter event occurred on a visible portion of the water layer.');
 * });
 * ```
 * @see [Center the map on a clicked symbol](https://maplibre.org/maplibre-gl-js-docs/example/center-on-symbol/)
 * @see [Display a popup on click](https://maplibre.org/maplibre-gl-js-docs/example/popup-on-click/)
 *
 * @event `mouseleave` Fired when a pointing device (usually a mouse) leaves a visible portion of a specified layer, or leaves
 * the map canvas.
 *
 * **Important:** This event can only be listened for when {@link Map#on} includes three arguments,
 * where the second argument specifies the desired layer.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the pointing device leaves
 * // a visible portion of the specified layer.
 * map.on('mouseleave', 'water', function() {
 *   console.log('A mouseleave event occurred.');
 * });
 * ```
 * @see [Highlight features under the mouse pointer](https://maplibre.org/maplibre-gl-js-docs/example/hover-styles/)
 * @see [Display a popup on click](https://maplibre.org/maplibre-gl-js-docs/example/popup-on-click/)
 *
 * @event `mouseout` Fired when a point device (usually a mouse) leaves the map's canvas.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the pointing device leave's
 * // the map's canvas.
 * map.on('mouseout', function() {
 *   console.log('A mouseout event occurred.');
 * });
 * ```
 *
 * @event `contextmenu` Fired when the right button of the mouse is clicked or the context menu key is pressed within the map.
 * `data` - {@link MapMouseEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the right mouse button is
 * // pressed within the map.
 * map.on('contextmenu', function() {
 *   console.log('A contextmenu event occurred.');
 * });
 * ```
 *
 * @event `wheel` Fired when a [`wheel`](https://developer.mozilla.org/en-US/docs/Web/Events/wheel) event occurs within the map.
 * `data` - {@link MapWheelEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a wheel event occurs within the map.
 * map.on('wheel', function() {
 *   console.log('A wheel event occurred.');
 * });
 * ```
 *
 * @event `touchstart` Fired when a [`touchstart`](https://developer.mozilla.org/en-US/docs/Web/Events/touchstart) event occurs within the map.
 * `data` - {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a touchstart event occurs within the map.
 * map.on('touchstart', function() {
 *   console.log('A touchstart event occurred.');
 * });
 * ```
 * @see [Create a draggable point](https://maplibre.org/maplibre-gl-js-docs/example/drag-a-point/)
 *
 *  @event `touchend` Fired when a [`touchend`](https://developer.mozilla.org/en-US/docs/Web/Events/touchend) event occurs within the map.
 * `data` - {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a touchstart event occurs within the map.
 * map.on('touchstart', function() {
 *   console.log('A touchstart event occurred.');
 * });
 * ```
 * @see [Create a draggable point](https://maplibre.org/maplibre-gl-js-docs/example/drag-a-point/)
 *
 * @event `touchmove` Fired when a [`touchmove`](https://developer.mozilla.org/en-US/docs/Web/Events/touchmove) event occurs within the map.
 * `data` - {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a touchmove event occurs within the map.
 * map.on('touchmove', function() {
 *   console.log('A touchmove event occurred.');
 * });
 * ```
 * @see [Create a draggable point](https://maplibre.org/maplibre-gl-js-docs/example/drag-a-point/)
 *
 * @event `touchcancel` Fired when a [`touchcancel`](https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel) event occurs within the map.
 * `data` - {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a touchcancel event occurs within the map.
 * map.on('touchcancel', function() {
 *   console.log('A touchcancel event occurred.');
 * });
 * ```
 *
 * @event `movestart` Fired just before the map begins a transition from one
 * view to another, as the result of either user interaction or methods such as {@link Map#jumpTo}.
 * `data` - `{originalEvent: {@link DragEvent}}`
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just before the map begins a transition
 * // from one view to another.
 * map.on('movestart', function() {
 *   console.log('A movestart` event occurred.');
 * });
 * ```
 *
 * @event `move` Fired repeatedly during an animated transition from one view to
 * another, as the result of either user interaction or methods such as {@link Map#flyTo}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // repeatedly during an animated transition.
 * map.on('move', function() {
 *   console.log('A move event occurred.');
 * });
 * ```
 * @see [Display HTML clusters with custom properties](https://maplibre.org/maplibre-gl-js-docs/example/cluster-html/)
 *
 * @event `moveend` Fired just after the map completes a transition from one
 * view to another, as the result of either user interaction or methods such as {@link Map#jumpTo}.
 * `data` - `{originalEvent: {@link DragEvent}}`
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just after the map completes a transition.
 * map.on('moveend', function() {
 *   console.log('A moveend event occurred.');
 * });
 * ```
 * @see [Display HTML clusters with custom properties](https://maplibre.org/maplibre-gl-js-docs/example/cluster-html/)
 *
 * @event `dragstart` Fired when a "drag to pan" interaction starts. See {@link DragPanHandler}.
 * `data` - `{originalEvent: {@link DragEvent}}`
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a "drag to pan" interaction starts.
 * map.on('dragstart', function() {
 *   console.log('A dragstart event occurred.');
 * });
 * ```
 *
 * @event `drag` Fired repeatedly during a "drag to pan" interaction. See {@link DragPanHandler}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // repeatedly  during a "drag to pan" interaction.
 * map.on('drag', function() {
 *   console.log('A drag event occurred.');
 * });
 * ```
 *
 * @event `dragend` Fired when a "drag to pan" interaction ends. See {@link DragPanHandler}.
 * `data` - `{originalEvent: {@link DragEvent}}`
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a "drag to pan" interaction ends.
 * map.on('dragend', function() {
 *   console.log('A dragend event occurred.');
 * });
 * ```
 * @see [Create a draggable marker](https://maplibre.org/maplibre-gl-js-docs/example/drag-a-marker/)
 *
 * @event `zoomstart` Fired just before the map begins a transition from one zoom level to another,
 * as the result of either user interaction or methods such as {@link Map#flyTo}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just before a zoom transition starts.
 * map.on('zoomstart', function() {
 *   console.log('A zoomstart event occurred.');
 * });
 * ```
 *
 * @event `zoom` Fired repeatedly during an animated transition from one zoom level to another,
 * as the result of either user interaction or methods such as {@link Map#flyTo}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // repeatedly during a zoom transition.
 * map.on('zoom', function() {
 *   console.log('A zoom event occurred.');
 * });
 * ```
 *
 * @event `zoomend` Fired just after the map completes a transition from one zoom level to another,
 * as the result of either user interaction or methods such as {@link Map#flyTo}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just after a zoom transition finishes.
 * map.on('zoomend', function() {
 *   console.log('A zoomend event occurred.');
 * });
 * ```
 *
 * @event `rotatestart` Fired when a "drag to rotate" interaction starts. See {@link DragRotateHandler}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just before a "drag to rotate" interaction starts.
 * map.on('rotatestart', function() {
 *   console.log('A rotatestart event occurred.');
 * });
 * ```
 *
 * @event `rotate` Fired repeatedly during a "drag to rotate" interaction. See {@link DragRotateHandler}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // repeatedly during "drag to rotate" interaction.
 * map.on('rotate', function() {
 *   console.log('A rotate event occurred.');
 * });
 * ```
 *
 * @event `rotateend` Fired when a "drag to rotate" interaction ends. See {@link DragRotateHandler}.
 * `data` - {@link MapMouseEvent} or {@link MapTouchEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just after a "drag to rotate" interaction ends.
 * map.on('rotateend', function() {
 *   console.log('A rotateend event occurred.');
 * });
 * ```
 *
 * @event `pitchstart` Fired whenever the map's pitch (tilt) begins a change as
 * the result of either user interaction or methods such as {@link Map#flyTo} .
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just before a pitch (tilt) transition starts.
 * map.on('pitchstart', function() {
 *   console.log('A pitchstart event occurred.');
 * });
 * ```
 *
 * @event `pitch` Fired repeatedly during the map's pitch (tilt) animation between
 * one state and another as the result of either user interaction
 * or methods such as {@link Map#flyTo}.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // repeatedly during a pitch (tilt) transition.
 * map.on('pitch', function() {
 *   console.log('A pitch event occurred.');
 * });
 * ```
 *
 * @event `pitchend` Fired immediately after the map's pitch (tilt) finishes changing as
 * the result of either user interaction or methods such as {@link Map#flyTo}.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just after a pitch (tilt) transition ends.
 * map.on('pitchend', function() {
 *   console.log('A pitchend event occurred.');
 * });
 * ```
 *
 * @event `boxzoomstart` Fired when a "box zoom" interaction starts. See {@link BoxZoomHandler}.
 * `data` - {@link MapLibreZoomEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just before a "box zoom" interaction starts.
 * map.on('boxzoomstart', function() {
 *   console.log('A boxzoomstart event occurred.');
 * });
 * ```
 *
 * @event `boxzoomend` Fired when a "box zoom" interaction ends.  See {@link BoxZoomHandler}.
 * `data` - {@link MapLibreZoomEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just after a "box zoom" interaction ends.
 * map.on('boxzoomend', function() {
 *   console.log('A boxzoomend event occurred.');
 * });
 * ```
 *
 * @event `boxzoomcancel` Fired when the user cancels a "box zoom" interaction, or when the bounding box does not meet the minimum size threshold.
 * See {@link BoxZoomHandler}.
 * `data` - {@link MapLibreZoomEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // the user cancels a "box zoom" interaction.
 * map.on('boxzoomcancel', function() {
 *   console.log('A boxzoomcancel event occurred.');
 * });
 * ```
 *
 * @event `resize` Fired immediately after the map has been resized.
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // immediately after the map has been resized.
 * map.on('resize', function() {
 *   console.log('A resize event occurred.');
 * });
 * ```
 *
 * @event `webglcontextlost` Fired when the WebGL context is lost.
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the WebGL context is lost.
 * map.on('webglcontextlost', function() {
 *   console.log('A webglcontextlost event occurred.');
 * });
 * ```
 *
 * @event `webglcontextrestored` Fired when the WebGL context is restored.
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the WebGL context is restored.
 * map.on('webglcontextrestored', function() {
 *   console.log('A webglcontextrestored event occurred.');
 * });
 * ```
 *
 * @event `load` Fired immediately after all necessary resources have been downloaded
 * and the first visually complete rendering of the map has occurred.
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the map has finished loading.
 * map.on('load', function() {
 *   console.log('A load event occurred.');
 * });
 * ```
 * @see [Draw GeoJSON points](https://maplibre.org/maplibre-gl-js-docs/example/geojson-markers/)
 * @see [Add live realtime data](https://maplibre.org/maplibre-gl-js-docs/example/live-geojson/)
 * @see [Animate a point](https://maplibre.org/maplibre-gl-js-docs/example/animate-point-along-line/)
 *
 * @event `render` Fired whenever the map is drawn to the screen, as the result of
 *
 * - a change to the map's position, zoom, pitch, or bearing
 * - a change to the map's style
 * - a change to a GeoJSON source
 * - the loading of a vector tile, GeoJSON file, glyph, or sprite
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // whenever the map is drawn to the screen.
 * map.on('render', function() {
 *   console.log('A render event occurred.');
 * });
 * ```
 *
 *  @event `idle` Fired after the last frame rendered before the map enters an
 * "idle" state:
 *
 * - No camera transitions are in progress
 * - All currently requested tiles have loaded
 * - All fade/transition animations have completed
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just before the map enters an "idle" state.
 * map.on('idle', function() {
 *   console.log('A idle event occurred.');
 * });
 * ```
 *
 * @event `remove` Fired immediately after the map has been removed with {@link Map#remove}.
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // just after the map is removed.
 * map.on('remove', function() {
 *   console.log('A remove event occurred.');
 * });
 * ```
 *
 * @event `error` Fired when an error occurs. This is GL JS's primary error reporting
 * mechanism. We use an event instead of `throw` to better accommodate
 * asynchronous operations. If no listeners are bound to the `error` event, the
 * error will be printed to the console.
 * `data` - `{error: {message: string}}`
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when an error occurs.
 * map.on('error', function() {
 *   console.log('A error event occurred.');
 * });
 * ```
 *
 * @event `data` Fired when any map data loads or changes. See {@link MapDataEvent}
 * for more information.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when map data loads or changes.
 * map.on('data', function() {
 *   console.log('A data event occurred.');
 * });
 * ```
 * @see [Display HTML clusters with custom properties](https://maplibre.org/maplibre-gl-js-docs/example/cluster-html/)
 *
 * @event `styledata` Fired when the map's style loads or changes.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when the map's style loads or changes.
 * map.on('styledata', function() {
 *   console.log('A styledata event occurred.');
 * });
 * ```
 *
 * @event `sourcedata` Fired when one of the map's sources loads or changes, including if a tile belonging
 * to a source loads or changes.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when one of the map's sources loads or changes.
 * map.on('sourcedata', function() {
 *   console.log('A sourcedata event occurred.');
 * });
 * ```
 *
 * @event `dataloading` Fired when any map data (style, source, tile, etc) begins loading or
 * changing asynchronously. All `dataloading` events are followed by a `data`,
 * `dataabort` or `error` event.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when any map data begins loading
 * // or changing asynchronously.
 * map.on('dataloading', function() {
 *   console.log('A dataloading event occurred.');
 * });
 * ```
 *
 * @event `styledataloading` Fired when the map's style begins loading or changing asynchronously.
 * All `styledataloading` events are followed by a `styledata`
 * or `error` event.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // map's style begins loading or
 * // changing asynchronously.
 * map.on('styledataloading', function() {
 *   console.log('A styledataloading event occurred.');
 * });
 * ```
 *
 * @event `sourcedataloading` Fired when one of the map's sources begins loading or changing asynchronously.
 * All `sourcedataloading` events are followed by a `sourcedata`, `sourcedataabort` or `error` event.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // map's sources begin loading or
 * // changing asynchronously.
 * map.on('sourcedataloading', function() {
 *   console.log('A sourcedataloading event occurred.');
 * });
 * ```
 *
 * @event `styleimagemissing` Fired when an icon or pattern needed by the style is missing. The missing image can
 * be added with {@link Map#addImage} within this event listener callback to prevent the image from
 * being skipped. This event can be used to dynamically generate icons and patterns.
 * `id` - `string`
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires an icon or pattern is missing.
 * map.on('styleimagemissing', function(event: MapStyleImageMissingEvent) {
 *   const imageId = event.id
 *   console.log('A styleimagemissing event occurred for image id', imageId);
 * });
 * ```
 * @see [Generate and add a missing icon to the map](https://maplibre.org/maplibre-gl-js-docs/example/add-image-missing-generated/)
 *
 * @event `style.load` Fired when the style finishes loading
 *
 * @event `terrain` Fired when terrain is changed
 *
 * @event `dataabort` Fired when a request for one of the map's sources' tiles is aborted.
 * Fired when a request for one of the map's sources' data is aborted.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a request for one of the map's sources' data is aborted.
 * map.on('dataabort', function() {
 *   console.log('A dataabort event occurred.');
 * });
 * ```
 *
 * @event `sourcedataabort` Fired when a request for one of the map's sources' data is aborted.
 * `data` - {@link MapDataEvent}
 *
 * @example
 * ```ts
 * // Initialize the map
 * let map = new maplibregl.Map({ // map options });
 * // Set an event listener that fires
 * // when a request for one of the map's sources' data is aborted.
 * map.on('sourcedataabort', function() {
 *   console.log('A sourcedataabort event occurred.');
 * });
 * ```
 */
export type MapEvent = 'mousedown' | 'mouseup' | 'mouseover' | 'mousemove' | 'click' | 'dblclick'
| 'mouseenter' | 'mouseleave' | 'mouseout' | 'contextmenu'| 'wheel' | 'touchstart'
| 'touchend' | 'touchmove' | 'touchcancel'| 'movestart'| 'move' | 'moveend' | 'dragstart'
| 'drag' | 'dragend' | 'zoomstart' | 'zoom' | 'zoomend' | 'rotatestart' | 'rotate'
| 'rotateend' | 'pitchstart' | 'pitch' | 'pitchend' | 'boxzoomstart' | 'boxzoomend'
| 'boxzoomcancel' | 'resize' | 'webglcontextlost' | 'webglcontextrestored' | 'load' | 'render'
| 'idle' | 'remove' | 'error' | 'data' | 'styledata' | 'sourcedata' | 'dataloading'
| 'styledataloading' | 'sourcedataloading' | 'styleimagemissing' | 'dataabort' | 'sourcedataabort';
