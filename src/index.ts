import packageJSON from '../package.json' assert {type: 'json'};
import {Map} from './ui/map';
import {NavigationControl} from './ui/control/navigation_control';
import {GeolocateControl} from './ui/control/geolocate_control';
import {AttributionControl} from './ui/control/attribution_control';
import {LogoControl} from './ui/control/logo_control';
import {ScaleControl} from './ui/control/scale_control';
import {FullscreenControl} from './ui/control/fullscreen_control';
import {TerrainControl} from './ui/control/terrain_control';
import {Popup} from './ui/popup';
import {Marker} from './ui/marker';
import {Style} from './style/style';
import {LngLat} from './geo/lng_lat';
import {LngLatBounds} from './geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from './geo/mercator_coordinate';
import {Evented} from './util/evented';
import {config} from './util/config';
// HM TODO: bring this back?
//import {Debug} from './util/debug';
//import {isSafari} from './util/util';
import {rtlMainThreadPluginFactory} from './source/rtl_text_plugin_main_thread';
import {WorkerPool} from './util/worker_pool';
import {prewarm, clearPrewarmedResources} from './util/global_worker_pool';
//import {PerformanceUtils} from './util/performance';
import {AJAXError} from './util/ajax';
import {GeoJSONSource} from './source/geojson_source';
import {CanvasSource} from './source/canvas_source';
import {ImageSource} from './source/image_source';
import {RasterDEMTileSource} from './source/raster_dem_tile_source';
import {RasterTileSource} from './source/raster_tile_source';
import {VectorTileSource} from './source/vector_tile_source';
import {VideoSource} from './source/video_source';
import {addSourceType} from './source/source';
import {addProtocol, removeProtocol} from './source/protocol_crud';
import {getGlobalDispatcher} from './util/dispatcher';
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
 * maplibregl.setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js', false);
 * ```
 * @see [Add support for right-to-left scripts](https://maplibre.org/maplibre-gl-js/docs/examples/mapbox-gl-rtl-text/)
 */
function setRTLTextPlugin(pluginURL: string, lazy: boolean) { return rtlMainThreadPluginFactory().setRTLTextPlugin(pluginURL, lazy); }
/**
 * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
 * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
 * If the status is `loaded` and the plugin is requested again, an error will be thrown.
 *
 * @example
 * ```ts
 * const pluginStatus = maplibregl.getRTLTextPluginStatus();
 * ```
 */
function getRTLTextPluginStatus() { return rtlMainThreadPluginFactory().getRTLTextPluginStatus(); }
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
 * const workerCount = maplibregl.getWorkerCount()
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
 * maplibregl.setWorkerCount(2);
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
 * maplibregl.getMaxParallelImageRequests();
 * ```
 */
function getMaxParallelImageRequests() { return config.MAX_PARALLEL_IMAGE_REQUESTS; }
/**
 * Sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
 * which affects performance in raster-heavy maps. 16 by default.
 *
 * @example
 * ```ts
 * maplibregl.setMaxParallelImageRequests(10);
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
 * 2. Using `self.registerWorkerSource(workerSource: WorkerSource)` to register a worker source, which sould come with `addSourceType` usually.
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
 * self.addPRotocol('custom', loadFn);
 *
 * // main.js
 * maplibregl.importScriptInWorkers('add-protocol-worker.js');
 * ```
 */
function importScriptInWorkers(workerUrl: string) { return getGlobalDispatcher().broadcast('importScript', workerUrl); }

export {
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    LogoControl,
    ScaleControl,
    FullscreenControl,
    TerrainControl,
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

//This gets automatically stripped out in production builds.
//Debug.extend(MapLibreGL, {isSafari, getPerformanceMetrics: PerformanceUtils.getPerformanceMetrics});
