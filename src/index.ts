import packageJSON from '../package.json' with {type: 'json'};
import {Map} from './ui/map.ts';
import {NavigationControl} from './ui/control/navigation_control.ts';
import {GeolocateControl} from './ui/control/geolocate_control.ts';
import {AttributionControl} from './ui/control/attribution_control.ts';
import {LogoControl} from './ui/control/logo_control.ts';
import {ScaleControl} from './ui/control/scale_control.ts';
import {FullscreenControl} from './ui/control/fullscreen_control.ts';
import {TerrainControl} from './ui/control/terrain_control.ts';
import {Popup} from './ui/popup.ts';
import {Marker} from './ui/marker.ts';
import {Style} from './style/style.ts';
import {LngLat, LngLatLike} from './geo/lng_lat.ts';
import {LngLatBounds, LngLatBoundsLike} from './geo/lng_lat_bounds.ts';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from './geo/mercator_coordinate.ts';
import {Evented} from './util/evented.ts';
import {config} from './util/config.ts';
import {rtlMainThreadPluginFactory} from './source/rtl_text_plugin_main_thread.ts';
import {WorkerPool} from './util/worker_pool.ts';
import {prewarm, clearPrewarmedResources} from './util/global_worker_pool.ts';
import {AJAXError} from './util/ajax.ts';
import {GeoJSONSource} from './source/geojson_source.ts';
import {CanvasSource, CanvasSourceSpecification} from './source/canvas_source.ts';
import {ImageSource} from './source/image_source.ts';
import {RasterDEMTileSource} from './source/raster_dem_tile_source.ts';
import {RasterTileSource} from './source/raster_tile_source.ts';
import {VectorTileSource} from './source/vector_tile_source.ts';
import {VideoSource} from './source/video_source.ts';
import {Source, addSourceType} from './source/source.ts';
import {addProtocol, removeProtocol} from './source/protocol_crud.ts';
import {getGlobalDispatcher} from './util/dispatcher.ts';
import {IControl} from './ui/control/control.ts';
import {EdgeInsets, PaddingOptions} from './geo/edge_insets.ts';
import {MapTerrainEvent, MapStyleImageMissingEvent, MapStyleDataEvent, MapSourceDataEvent, MapLibreZoomEvent, MapLibreEvent, MapLayerTouchEvent, MapLayerMouseEvent, MapLayerEventType, MapEventType, MapDataEvent, MapContextEvent, MapWheelEvent, MapTouchEvent, MapMouseEvent} from './ui/events.ts';
import {BoxZoomHandler} from './ui/handler/box_zoom.ts';
import {DragRotateHandler} from './ui/handler/shim/drag_rotate.ts';
import {DragPanHandler} from './ui/handler/shim/drag_pan.ts';
import {ScrollZoomHandler} from './ui/handler/scroll_zoom.ts';
import {TwoFingersTouchZoomRotateHandler} from './ui/handler/shim/two_fingers_touch.ts';
import {CustomLayerInterface} from './style/style_layer/custom_style_layer.ts';
import {PointLike} from './ui/camera.ts';
import {Hash} from './ui/hash.ts';
import {CooperativeGesturesHandler} from './ui/handler/cooperative_gestures.ts';
import {DoubleClickZoomHandler} from './ui/handler/shim/dblclick_zoom.ts';
import {KeyboardHandler} from './ui/handler/keyboard.ts';
import {TwoFingersTouchPitchHandler, TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler} from './ui/handler/two_fingers_touch.ts';
import {MessageType} from './util/actor_messages.ts';
const version = packageJSON.version;

export type * from '@maplibre/maplibre-gl-style-spec';

/**
 * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
 * Necessary for supporting the Arabic and Hebrew languages, which are written right-to-left.
 *
 * @param pluginURL - URL pointing to the Mapbox RTL text plugin source.
 * @param lazy - If set to `true`, mapboxgl will defer loading the plugin until rtl text is encountered,
 * rtl text will then be rendered only after the plugin finishes loading.
 * @example
 * ```ts
 * setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js', false);
 * ```
 * @see [Add support for right-to-left scripts](https://maplibre.org/maplibre-gl-js/docs/examples/mapbox-gl-rtl-text/)
 */
function setRTLTextPlugin(pluginURL: string, lazy: boolean): Promise<void> {
    return rtlMainThreadPluginFactory().setRTLTextPlugin(pluginURL, lazy);
}
/**
 * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
 * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
 * If the status is `loaded` and the plugin is requested again, an error will be thrown.
 *
 * @example
 * ```ts
 * const pluginStatus = getRTLTextPluginStatus();
 * ```
 */
function getRTLTextPluginStatus(): string {
    return rtlMainThreadPluginFactory().getRTLTextPluginStatus();
}
/**
 * Returns the package version of the library
 * @returns Package version of the library
 */
function getVersion() { return version; }
/**
 * Gets the number of web workers instantiated on a page with GL JS maps.
 * By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3).
 * Make sure to set this property before creating any map instances for it to have effect.
 *
 * @returns Number of workers currently configured.
 * @example
 * ```ts
 * const workerCount = getWorkerCount()
 * ```
 */
function getWorkerCount() { return WorkerPool.workerCount; }
/**
 * Sets the number of web workers instantiated on a page with GL JS maps.
 * By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3).
 * Make sure to set this property before creating any map instances for it to have effect.
 *
 * @example
 * ```ts
 * setWorkerCount(2);
 * ```
 */
function setWorkerCount(count: number) { WorkerPool.workerCount = count; }
/**
 * Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
 * which affects performance in raster-heavy maps. 16 by default.
 *
 * @returns Number of parallel requests currently configured.
 * @example
 * ```ts
 * getMaxParallelImageRequests();
 * ```
 */
function getMaxParallelImageRequests() { return config.MAX_PARALLEL_IMAGE_REQUESTS; }
/**
 * Sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
 * which affects performance in raster-heavy maps. 16 by default.
 *
 * @example
 * ```ts
 * setMaxParallelImageRequests(10);
 * ```
 */
function setMaxParallelImageRequests(numRequests: number) { config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests; }
/**
 * Gets the worker url
 * @returns The worker url
 */
function getWorkerUrl() { return config.WORKER_URL; }
/**
 * Sets the worker url
 */
function setWorkerUrl(value: string) { config.WORKER_URL = value; }
/**
 * Allows loading javascript code in the worker thread.
 * *Note* that since this is using some very internal classes and flows it is considered experimental and can break at any point.
 *
 * It can be useful for the following examples:
 * 1. Using `self.addProtocol` in the worker thread - note that you might need to also register the protocol on the main thread.
 * 2. Using `self.registerWorkerSource(workerSource: WorkerSource)` to register a worker source, which should come with `addSourceType` usually.
 * 3. using `self.actor.registerMessageHandler` to override some internal worker operations
 * @param workerUrl - the worker url e.g. a url of a javascript file to load in the worker
 * @returns
 *
 * @example
 * ```ts
 * // below is an example of sending a js file to the worker to load the method there
 * // Note that you'll need to call the global function `addProtocol` in the worker to register the protocol there.
 * // add-protocol-worker.js
 * async function loadFn(params, abortController) {
 *     const t = await fetch(`https://${params.url.split("://")[1]}`);
 *     if (t.status == 200) {
 *         const buffer = await t.arrayBuffer();
 *         return {data: buffer}
 *     } else {
 *         throw new Error(`Tile fetch error: ${t.statusText}`);
 *     }
 * }
 * self.addProtocol('custom', loadFn);
 *
 * // main.js
 * importScriptInWorkers('add-protocol-worker.js');
 * ```
 */
function importScriptInWorkers(workerUrl: string) { return getGlobalDispatcher().broadcast(MessageType.importScript, workerUrl); }

export {
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    LogoControl,
    ScaleControl,
    FullscreenControl,
    TerrainControl,
    Hash,
    Popup,
    Marker,
    Style,
    LngLat,
    LngLatBounds,
    Point,
    MercatorCoordinate,
    Evented,
    AJAXError,
    config,
    CanvasSource,
    GeoJSONSource,
    ImageSource,
    RasterDEMTileSource,
    RasterTileSource,
    VectorTileSource,
    VideoSource,
    EdgeInsets,
    BoxZoomHandler,
    DragRotateHandler,
    DragPanHandler,
    ScrollZoomHandler,
    TwoFingersTouchZoomRotateHandler,
    CooperativeGesturesHandler,
    DoubleClickZoomHandler,
    KeyboardHandler,
    TwoFingersTouchZoomHandler,
    TwoFingersTouchRotateHandler,
    TwoFingersTouchPitchHandler,
    MapWheelEvent,
    MapTouchEvent,
    MapMouseEvent,
    type IControl,
    type CustomLayerInterface,
    type CanvasSourceSpecification,
    type PaddingOptions,
    type LngLatLike,
    type PointLike,
    type LngLatBoundsLike,
    type Source,
    type MapTerrainEvent,
    type MapStyleImageMissingEvent,
    type MapStyleDataEvent,
    type MapSourceDataEvent,
    type MapLibreZoomEvent,
    type MapLibreEvent,
    type MapLayerTouchEvent,
    type MapLayerMouseEvent,
    type MapLayerEventType,
    type MapEventType,
    type MapDataEvent,
    type MapContextEvent,
    setRTLTextPlugin,
    getRTLTextPluginStatus,
    prewarm,
    clearPrewarmedResources,
    getVersion,
    getWorkerCount,
    setWorkerCount,
    getMaxParallelImageRequests,
    setMaxParallelImageRequests,
    getWorkerUrl,
    setWorkerUrl,
    addProtocol,
    removeProtocol,
    addSourceType,
    importScriptInWorkers
};
